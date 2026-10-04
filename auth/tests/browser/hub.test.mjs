import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
import { harness, Browser, emailLogin, account } from '../harness.mjs';

const repo=path.resolve(import.meta.dirname,'../../..');
const sizes=[[280,653],[320,568],[360,800],[390,844],[430,932],[568,320],[844,390],[390,420],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900],[1920,1080],[2560,1440],[3840,2160]];
let fixture,engine,member;
before(async()=>{
  fixture=await harness();
  engine=await ({chromium,firefox,webkit}[process.env.ACCOUNT_TEST_BROWSER||'chromium']).launch({headless:true});
  member=new Browser(fixture.mf);await emailLogin(member,fixture,'hub-layout@example.com');
});
after(async()=>{await engine?.close();await fixture?.close();});

test('the native hub account entry fits signed-in and guest headers in both languages',async()=>{
  for(const language of ['ko','en']) for(const signedIn of [false,true]) {
    const ctx=await engine.newContext({locale:language==='ko'?'ko-KR':'en-US',reducedMotion:'reduce'});
    await ctx.addInitScript(lang=>localStorage.setItem('archerlab:language',lang),language);
    if(signedIn) await ctx.addCookies([...member.cookies.get(account)].map(([name,value])=>({name,value,domain:'account.archerlab.dev',path:'/',secure:true,httpOnly:true,sameSite:'Lax'})));
    await ctx.route('**/*',async route=>{
      const request=route.request();const url=new URL(request.url());
      if(url.origin===account) {
        const headers=await request.allHeaders();
        if(!headers.cookie) headers.cookie=(await ctx.cookies(request.url())).map(c=>`${c.name}=${c.value}`).join('; ');
        const response=await fixture.mf.dispatchFetch(request.url(),{method:request.method(),headers,...(request.postDataBuffer()?{body:request.postDataBuffer()}:{}),redirect:'manual'});
        const output=Object.fromEntries(response.headers);const cookies=response.headers.getSetCookie();if(cookies.length)output['set-cookie']=cookies.join('\n');
        await route.fulfill({status:response.status,headers:output,body:Buffer.from(await response.arrayBuffer())});return;
      }
      if(url.origin!=='https://archerlab.dev'){await route.abort();return;}
      const name=url.pathname==='/'?'/index.html':url.pathname==='/index-en'?'/index-en.html':url.pathname;
      const file=path.resolve(repo,'.'+name);if(!file.startsWith(repo+path.sep)){await route.abort();return;}
      const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
      try {await route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:await fs.readFile(file)});}
      catch {await route.fulfill({status:404,body:''});}
    });
    try {
      const page=await ctx.newPage();await page.goto('https://archerlab.dev/'+(language==='en'?'index-en':''),{waitUntil:'domcontentloaded'});
      const expected=signedIn?(language==='ko'?'내 계정':'My account'):(language==='ko'?'로그인':'Sign in');
      await page.getByRole('link',{name:expected,exact:true}).waitFor();
      for(const [width,height] of sizes) {
        await page.setViewportSize({width,height});
        const rectangles=await page.locator('.logo,.lang-dropdown__toggle,[data-account-link]').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {class:e.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};}));
        assert.ok(rectangles.every(r=>r.left>=0&&r.right<=width),`${language} ${signedIn} ${width}: header fits`);
        for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++) {
          const a=rectangles[i],b=rectangles[j];
          assert.ok(!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top),`${language} ${signedIn} ${width}: header overlap`);
        }
        assert.ok(rectangles.at(-1).height>=44);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
      await page.setViewportSize({width:390,height:844});await page.screenshot({path:`test-results/hub-${language}-${signedIn?'member':'guest'}.png`});
      await page.locator('[data-account-link]').click();await page.waitForURL(url=>url.origin===account&&url.pathname==='/account');
      await page.getByRole('heading',{name:signedIn?(language==='ko'?'내 계정':'My account'):(language==='ko'?'로그인':'Sign in'),exact:true}).waitFor();
      assert.equal(await page.locator('#guest').isVisible(),!signedIn);
    } finally {await ctx.close();}
  }
});

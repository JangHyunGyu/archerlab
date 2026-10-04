import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from '@playwright/test';
import { harness, account, service, Browser, emailLogin } from '../harness.mjs';
import { SERVICES, GAMES, SESSIONS } from '../../src/services.js';

let fixture; let engine;
before(async () => {
  fixture = await harness();
  const type = { chromium, firefox, webkit }[process.env.ACCOUNT_TEST_BROWSER || 'chromium'];
  assert.ok(type, 'ACCOUNT_TEST_BROWSER must be chromium, firefox, or webkit');
  engine = await type.launch({ headless: true });
});
after(async () => { await engine?.close(); await fixture?.close(); });

async function context(options = {}, issuedCookies = []) {
  const context = await engine.newContext({ locale: 'ko-KR', ...options });
  await context.route('**/*', async route => {
    const request = route.request();
    const headers = await request.allHeaders(); headers['CF-Connecting-IP'] = '203.0.113.80';
    if (!headers.cookie && process.env.ACCOUNT_TEST_BROWSER === 'webkit') {
      // WebKit attaches cookies after interception. Our local transport must carry
      // the browser's host-scoped jar because this request never reaches its network stack.
      headers.cookie = (await context.cookies(request.url())).map(value => `${value.name}=${value.value}`).join('; ');
    }
    const response = await fixture.mf.dispatchFetch(request.url(), { method: request.method(), headers,
      ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}), redirect: 'manual' });
    const outputHeaders = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie(); issuedCookies.push(...cookies);
    if (cookies.length) outputHeaders['set-cookie'] = cookies.join('\n');
    if (response.status === 303) {
      // Playwright does not intercept requests following an HTTP redirect. A new
      // document navigation keeps every hop inside the local test runtime.
      const target = outputHeaders.location.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/html', ...(cookies.length ? { 'set-cookie': cookies.join('\n') } : {}) }, body: `<meta http-equiv="refresh" content="0;url=${target}">` });
      return;
    }
    await route.fulfill({ status: response.status, headers: outputHeaders, body: Buffer.from(await response.arrayBuffer()) });
  });
  return context;
}

test('central sign-in silently joins every linked service without controls and logout revokes their sessions', async () => {
  const issuedCookies=[];
  const ctx = await context({ viewport: { width: 390, height: 844 } },issuedCookies); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(account + '/account?lang=ko');
    await page.locator('#email').fill('browser@example.com'); await page.locator('#send').click();
    await page.locator('#code').waitFor({ state: 'visible' });
    const code = fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0];
    await page.locator('#code').fill(code); await page.locator('#code-form button[type=submit]').click();
    await page.locator('#signed-in').waitFor({ state: 'visible' });
    await page.goto(service + '/?view=cards#chosen');
    await page.waitForFunction(() => Boolean(window.archerlabAccount?.user));
    assert.equal(await page.locator('#archerlab-account').count(), 0);
    assert.equal(await page.locator('a,button').count(), 0);
    assert.equal((await page.evaluate(() => document.cookie)).includes('__Host-al_service'), false);
    await page.evaluate(() => localStorage.setItem('existing-game-save', 'preserved'));
    const urls=Object.keys(SERVICES).filter(host=>!['archerlab.dev','game.archerlab.dev'].includes(host)).map(host=>'https://'+host+'/');
    urls.push(...GAMES.map(game=>'https://game.archerlab.dev/'+game+'/'));
    const identities=new Set();
    for(const url of urls) {
      await page.goto(url);await page.waitForFunction(()=>Boolean(window.archerlabAccount?.user));
      identities.add(await page.evaluate(()=>window.archerlabAccount.user.id));
      assert.equal(await page.locator('#archerlab-account').count(),0);
      assert.equal(await page.locator('body').innerHTML(),'<h1>Guest page</h1>');
    }
    assert.equal(identities.size,1);
    const cookies=await ctx.cookies(SESSIONS);
    assert.equal(cookies.filter(cookie=>cookie.name.startsWith('__Host-al_service_')).length,10);
    assert.ok(cookies.every(cookie=>cookie.secure&&cookie.httpOnly));
    assert.ok(issuedCookies.length>0&&issuedCookies.every(cookie=>/; SameSite=Lax(?:;|$)/.test(cookie)));
    // Windows WebKit's cookie inspection reports None for intercepted fetches.
    // Verify its received policy above; other engines also expose the stored policy.
    if(process.env.ACCOUNT_TEST_BROWSER!=='webkit')assert.ok(cookies.every(cookie=>cookie.sameSite==='Lax'));
    await page.goto(account + '/account?lang=ko');
    await page.getByRole('heading', { name: '내 계정', exact: true }).waitFor();
    await page.locator('#logout').click();
    await page.locator('#sign-in').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#email-form').isVisible(), true);
    assert.equal(await page.locator('#code-form').isVisible(), false);
    await page.goto(service + '/');
    assert.equal(await page.evaluate(() => window.archerlabAccount.ready), null);
    for(const key of ['game','nevergrad','karma','harem','cupid','chatbot','golf','itstory','news','chat']) {
      await page.goto('https://'+key+'.archerlab.dev/'+(key==='game'?'jewelria/':''));
      assert.equal(await page.evaluate(()=>window.archerlabAccount.ready),null);
      const status=await page.evaluate(async key=>(await fetch('https://sessions.archerlab.dev/'+key+'/_account/session',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'})).json(),key);
      assert.equal(status.user,null);
    }
    await page.goto(service+'/');
    assert.equal(await page.evaluate(() => localStorage.getItem('existing-game-save')), 'preserved');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('code and signed-in layouts fit both languages, including long account details', async () => {
  const ctx = await context(); const page = await ctx.newPage();
  const sizes=[[280,653],[320,568],[360,800],[390,844],[430,932],[568,320],[844,390],[390,420],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900],[1920,1080],[2560,1440],[3840,2160]];
  async function fits(stage) {
    for (const lang of ['ko','en']) {
      if(await page.locator('html').getAttribute('lang')!==lang) await page.locator('#language').click();
      for(const [width,height] of sizes) {
        await page.setViewportSize({width,height});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${stage} ${lang} ${width}: overflow`);
        const controls=await page.locator('button:visible, input:visible, a:visible').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,left:r.left,right:r.right,height:r.height};}));
        assert.ok(controls.every(r=>r.left>=0&&r.right<=width&&r.height>=44),`${stage} ${lang} ${width}: controls fit`);
      }
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:`test-results/account-${stage}-${lang}.png`,fullPage:true});
    }
  }
  try {
    await page.goto(account + '/account?lang=ko');
    await page.locator('#email').fill('long-layout@example.com');await page.locator('#send').click();
    await page.locator('#code').waitFor({state:'visible'});
    await fits('code');
    const otp=fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0];
    await page.locator('#code').fill(otp);await page.locator('#code-form button[type=submit]').click();
    await page.locator('#signed-in').waitFor({state:'visible'});
    await fixture.db.prepare('UPDATE users SET name=?,email=? WHERE email=?').bind('Alexandria '.repeat(7).trim(),'a'.repeat(64)+'@'+'b'.repeat(63)+'.'+'c'.repeat(63)+'.example','long-layout@example.com').run();
    await page.reload();await page.locator('#signed-in').waitFor({state:'visible'});
    assert.equal(await page.locator('#guest').isVisible(),false);
    await fits('member');
  } finally {await ctx.close();}
});

test('account layout fits phone, tablet and desktop orientations with keyboard and reduced motion', async () => {
  const ctx = await context({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  try {
    for (const [width, height] of [[280, 653], [320, 568], [360, 800], [390, 844], [430, 932], [568, 320], [844, 390], [390, 420], [768, 1024], [820, 1180], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]]) {
      await page.setViewportSize({ width, height }); await page.goto(account + '/?lang=ko');
      await page.locator('#send:not([disabled])').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}×${height}: horizontal overflow`);
      const buttons = await page.locator('button:visible').evaluateAll(elements => elements.map(element => ({ id: element.id, height: element.getBoundingClientRect().height })));
      assert.ok(buttons.every(button => button.height >= 44), `${width}×${height}: touch target too small`);
      await page.locator('#email').focus(); await page.keyboard.type('layout@example.com');
      assert.equal(await page.locator('#email').inputValue(), 'layout@example.com');
      await page.keyboard.press('Tab'); assert.equal(await page.locator('#send').evaluate(element => element === document.activeElement), true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'test-results/account-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/account-mobile.png', fullPage: true });
  } finally { await ctx.close(); }
});

test('failed code keeps the user on the form with a readable error and allows retry', async () => {
  const ctx = await context(); const page = await ctx.newPage();
  try {
    await page.goto(account + '/?lang=ko'); await page.locator('#email').fill('retry@example.com'); await page.locator('#send').click();
    await page.locator('#code').waitFor({ state: 'visible' });
    const code = fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0];
    await page.locator('#code').fill(code === '111111' ? '222222' : '111111');
    await page.locator('#code-form button[type=submit]').click();
    await page.locator('#notice[data-error]').waitFor(); assert.match(await page.locator('#notice').textContent(), /인증번호/);
    await page.locator('#code').fill(code); await page.locator('#code-form button[type=submit]').click();
    await page.locator('#signed-in').waitFor({ state: 'visible' });
  } finally { await ctx.close(); }
});

test('a packed app can replace its document without losing silent SSO or changing its layout', async () => {
  const member = new Browser(fixture.mf);
  await emailLogin(member, fixture, 'packed@example.com');
  const ctx = await context({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([...member.cookies.get(account)].map(([name, value]) => ({ name, value, domain: 'account.archerlab.dev', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' })));
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('https://chatbot.archerlab.dev/');
    await page.evaluate(() => {
      document.open();
      document.write('<!doctype html><html><head><title>Unpacked app</title></head><body><header class="app__actions"></header><h1>Unpacked app</h1></body></html>');
      document.close();
    });
    await page.waitForFunction(() => Boolean(window.archerlabAccount?.user));
    const original = '<header class="app__actions"></header><h1>Unpacked app</h1>';
    assert.equal(await page.locator('body').innerHTML(), original);
    await page.evaluate(() => window.archerlabAccount.refresh());
    assert.equal(await page.locator('body').innerHTML(), original);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a guest stays on the service and silent SSO leaves the document untouched', async () => {
  const ctx = await context(); const page = await ctx.newPage(); const requests=[];
  page.on('request', request => { if(request.url().includes('/_account/') || request.url().includes('/api/status')) requests.push(request.url()); });
  try {
    await page.goto(service + '/?view=cards#chosen');
    assert.equal(await page.evaluate(() => window.archerlabAccount.ready), null);
    assert.equal(page.url(), service + '/?view=cards#chosen');
    assert.equal(await page.locator('body').innerHTML(), '<h1>Guest page</h1>');
    assert.equal(requests.filter(url => url.includes('/api/status')).length, 1);
    assert.equal(requests.filter(url => url.endsWith('/_account/session')).length, 0);
    assert.equal(await page.locator('#archerlab-account').count(), 0);
  } finally { await ctx.close(); }
});

test('simultaneous service tabs keep independent browser proofs and sessions', async () => {
  const member=new Browser(fixture.mf);await emailLogin(member,fixture,'parallel@example.com');
  const ctx=await context();
  await ctx.addCookies([...member.cookies.get(account)].map(([name,value])=>({name,value,domain:'account.archerlab.dev',path:'/',secure:true,httpOnly:true,sameSite:'Lax'})));
  try {
    const pages=await Promise.all(['harem','cupid'].map(async key=>{
      const page=await ctx.newPage();await page.goto('https://'+key+'.archerlab.dev/');
      await page.waitForFunction(()=>Boolean(window.archerlabAccount?.user));return page;
    }));
    assert.equal(await pages[0].evaluate(()=>window.archerlabAccount.user.id),await pages[1].evaluate(()=>window.archerlabAccount.user.id));
    const jar=await ctx.cookies(SESSIONS);
    for(const key of ['harem','cupid'])assert.ok(jar.some(cookie=>cookie.name==='__Host-al_service_'+key&&cookie.httpOnly));
  } finally {await ctx.close();}
});

import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { harness,Browser,emailLogin,account } from './harness.mjs';
import { SESSIONS } from '../src/services.js';
let fixture,browser;
before(async()=>{fixture=await harness();browser=new Browser(fixture.mf);await emailLogin(browser,fixture,'gateway@example.com');});
after(async()=>fixture?.close());
const base=key=>SESSIONS+'/'+key+'/_account/';
const source=key=>'https://'+key+'.archerlab.dev';
async function join(key) {
  const local=await browser.json(base(key)+'session',{}, {origin:source(key)});
  const prepared=await browser.json(base(key)+'prepare',{csrf:local.data.csrf,returnPath:'/'},{origin:source(key)});
  const central=await browser.json(account+'/api/status');
  const ticket=await browser.json(account+'/api/sso',{csrf:central.data.csrf,request:prepared.data.request},{origin:source(key)});
  const result=await browser.json(base(key)+'complete',{csrf:local.data.csrf,request:prepared.data.request,code:ticket.data.code},{origin:source(key)});
  assert.equal(result.response.status,200);
  const issued=result.response.headers.getSetCookie().join(';');
  assert.ok(issued.includes('__Host-al_service_'+key+'='));
  for(const flag of ['Secure','HttpOnly','SameSite=Lax','Path=/'])assert.ok(issued.includes(flag));
  assert.doesNotMatch(issued,/Domain=/);
  return browser.json(base(key)+'session',{}, {origin:source(key)});
}
test('session API binds CORS to its specific service and exposes only POST endpoints',async()=>{
  for(const origin of ['https://cupid.archerlab.dev','https://latindance.kr','https://harem.archerlab.dev.evil.test']) {
    const result=await browser.request(base('harem')+'session',{}, {origin});
    assert.equal(result.status,403);assert.equal(result.headers.get('Access-Control-Allow-Origin'),null);
  }
  const response=await browser.request(base('harem')+'session',undefined,{method:'OPTIONS',headers:{Origin:source('harem'),'Access-Control-Request-Method':'POST'}});
  assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),source('harem'));
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'),'true');
  assert.equal((await browser.request(base('harem')+'session')).status,404);
  assert.equal((await browser.request(base('harem')+'login')).status,404);
  assert.equal((await browser.request(base('photo')+'session',{}, {origin:'https://photo.archerlab.dev'})).status,403);
});
test('separate browser and session cookies preserve independent services and hide credentials',async()=>{
  const harem=await join('harem');const cupid=await join('cupid');
  assert.equal(harem.data.user.id,cupid.data.user.id);
  assert.equal(harem.response.headers.get('Cache-Control'),'no-store');
  const jar=browser.cookies.get(SESSIONS);
  for(const key of ['harem','cupid']) {
    assert.ok(jar.get('__Host-al_browser_'+key));assert.ok(jar.get('__Host-al_service_'+key));
  }
  assert.notEqual(jar.get('__Host-al_browser_harem'),jar.get('__Host-al_browser_cupid'));
  assert.notEqual(jar.get('__Host-al_service_harem'),jar.get('__Host-al_service_cupid'));
  for(const value of jar.values()) assert.ok(!JSON.stringify(harem.data).includes(value));
  const check=await browser.json(base('harem')+'session',{}, {origin:source('harem')});
  assert.equal(check.data.user.id,harem.data.user.id);
  const cookies=harem.response.headers.getSetCookie().join(';');
  assert.doesNotMatch(cookies,/Domain=/);
});
test('proofs from another service cannot authorize a mutation',async()=>{
  const status=await browser.json(base('harem')+'session',{}, {origin:source('harem')});
  const wrong=await browser.request(base('cupid')+'prepare',{csrf:status.data.csrf,returnPath:'/'},{origin:source('cupid')});
  assert.equal(wrong.status,403);
  const forged=await browser.request(base('harem')+'prepare',{returnPath:'/'},{origin:source('harem')});
  assert.equal(forged.status,400);
});
test('legacy origin cookies cannot be replayed as gateway sessions',async()=>{
  const origin=source('harem');
  const local=await browser.json(origin+'/_account/session',{});
  const prepared=await browser.json(origin+'/_account/prepare',{csrf:local.data.csrf,returnPath:'/'});
  const central=await browser.json(account+'/api/status');
  const ticket=await browser.json(account+'/api/sso',{csrf:central.data.csrf,request:prepared.data.request},{origin});
  await browser.json(origin+'/_account/complete',{csrf:local.data.csrf,request:prepared.data.request,code:ticket.data.code});
  const legacy=browser.cookies.get(origin).get('__Host-al_service');
  assert.ok(legacy);
  const status=await fixture.mf.dispatchFetch(base('harem')+'session',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'__Host-al_service_harem='+legacy},body:'{}'
  });
  assert.equal(status.status,200);assert.equal((await status.json()).user,null);
  assert.ok((await join('harem')).data.user);
});
test('central status stays private and rejects unregistered POST origins',async()=>{
  const response=await browser.request(account+'/api/status',{}, {origin:source('harem')});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),source('harem'));
  for(const origin of ['https://latindance.kr','https://archerlab.dev.evil.test']) {
    const denied=await browser.request(account+'/api/status',{}, {origin});
    assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
  }
});
test('logging out invalidates every namespaced service session',async()=>{
  const central=await browser.json(account+'/api/status');
  await browser.json(account+'/api/logout',{csrf:central.data.csrf});
  for(const key of ['harem','cupid']) {
    const result=await browser.json(base(key)+'session',{}, {origin:source(key)});
    assert.equal(result.data.user,null);
  }
});

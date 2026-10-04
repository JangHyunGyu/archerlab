import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { harness, Browser, account, service, emailLogin } from './harness.mjs';
import { verifyGoogle } from '../src/google.js';
import { registered, linkedPage, returnPath, GAMES } from '../src/services.js';

let fixture; let browser;
before(async () => { fixture = await harness(); browser = new Browser(fixture.mf); });
after(async () => fixture?.close());

test('scope includes linked games and rejects separate domains, ports, and sibling projects', () => {
  assert.equal(registered(new URL('https://latindance.kr')), false);
  assert.equal(registered(new URL('https://photo.archerlab.dev')), false);
  assert.equal(registered(new URL('https://harem.archerlab.dev:8443')), false);
  for (const game of GAMES) assert.equal(linkedPage(new URL(`https://game.archerlab.dev/${game}/`)), true);
  assert.equal(linkedPage(new URL('https://game.archerlab.dev/unlisted-game/')), false);
});
test('return destinations reject open redirects and account endpoint loops', () => {
  for (const path of ['https://evil.example/', '//evil.example/', '/_account/callback', '\\evil.example/', 'https://harem.archerlab.dev.evil.example/']) assert.throws(() => returnPath(path, service));
  assert.equal(returnPath('/?lang=ko#cards', service), '/?lang=ko#cards');
  assert.throws(() => returnPath('/not-listed/', 'https://game.archerlab.dev'));
});
test('guest pages load without redirect, auth cookies do not reach upstream, HTML cache validators change', async () => {
  const response = await browser.request(service + '/', undefined, { headers: { Cookie: '__Host-al_service=private; other=preserved' } });
  assert.equal(response.status, 200); assert.match(await response.text(), /data-archerlab-account/);
  assert.equal(response.headers.get('ETag'), null); assert.match(response.headers.get('Cache-Control'), /public/);
  assert.equal(fixture.upstream.at(-1).cookie.trim(), 'other=preserved');
  const unlisted = await browser.request('https://game.archerlab.dev/unlisted-game/');
  assert.doesNotMatch(await unlisted.text(), /data-archerlab-account/);
  assert.equal((await browser.request('https://photo.archerlab.dev/')).status, 404);
});
test('status is private, cookies are host-only, Secure, HttpOnly and Lax', async () => {
  const result = await browser.json(account + '/api/status'); assert.equal(result.data.user, null);
  assert.equal(result.response.headers.get('Cache-Control'), 'no-store');
  const newcomer = new Browser(fixture.mf, '203.0.113.10'); const response = await newcomer.request(account + '/api/status');
  const cookies = response.headers.getSetCookie().join(';');
  for (const flag of ['__Host-', 'Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/']) assert.match(cookies, new RegExp(flag));
  assert.doesNotMatch(cookies, /Domain=/);
});
test('CORS rejects unregistered origins and uses exact approved origins', async () => {
  for (const origin of ['https://evil.example', 'https://latindance.kr', 'https://harem.archerlab.dev.evil.example']) {
    const response = await browser.request(account + '/api/status', undefined, { headers: { Origin: origin } });
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const response = await browser.request(account + '/api/status', undefined, { headers: { Origin: service } });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), service);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
});
test('mutations require matching Origin and a browser-bound CSRF proof', async () => {
  const { data } = await browser.json(account + '/api/status');
  assert.equal((await browser.request(account + '/api/email/start', { email: 'a@example.com', csrf: data.csrf }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await browser.request(account + '/api/email/start', { email: 'a@example.com', csrf: '0'.repeat(64) })).status, 403);
  const stranger = new Browser(fixture.mf, '203.0.113.11');
  assert.equal((await stranger.request(account + '/api/email/start', { email: 'a@example.com', csrf: data.csrf })).status, 403);
});
test('email verification issues a real account session without exposing tokens, consumed codes cannot replay', async () => {
  const result = await emailLogin(browser, fixture); assert.equal(result.response.status, 200);
  assert.equal(result.data.redirect, account + '/');
  assert.doesNotMatch(JSON.stringify(result.data), /token|session/);
  const { data: status } = await browser.json(account + '/api/status'); assert.equal(status.user.email, 'member@example.com');
  assert.equal((await browser.request(account + '/api/email/verify', { csrf: result.csrf, challenge: result.challenge, code: result.code })).status, 400);
});
test('wrong browser cannot redeem a correct email code', async () => {
  const first = new Browser(fixture.mf, '203.0.113.12'); const second = new Browser(fixture.mf, '203.0.113.13');
  const { data: a } = await first.json(account + '/api/status'); const { data: b } = await second.json(account + '/api/status');
  const { data: sent } = await first.json(account + '/api/email/start', { csrf: a.csrf, email: 'isolated@example.com' });
  const code = fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0];
  assert.equal((await second.request(account + '/api/email/verify', { csrf: b.csrf, challenge: sent.challenge, code })).status, 400);
  assert.equal((await first.request(account + '/api/email/verify', { csrf: a.csrf, challenge: sent.challenge, code })).status, 200);
});
test('five failed attempts exhaust a challenge and new code invalidates the previous one', async () => {
  const b = new Browser(fixture.mf, '203.0.113.14'); const { data: state } = await b.json(account + '/api/status');
  const { data: first } = await b.json(account + '/api/email/start', { csrf: state.csrf, email: 'attempts@example.com' });
  const code = fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0]; const wrong = code === '111111' ? '222222' : '111111';
  for (let i = 0; i < 5; i++) assert.equal((await b.request(account + '/api/email/verify', { csrf: state.csrf, challenge: first.challenge, code: wrong })).status, 400);
  assert.equal((await b.request(account + '/api/email/verify', { csrf: state.csrf, challenge: first.challenge, code })).status, 400);
  await b.request(account + '/api/email/start', { csrf: state.csrf, email: 'attempts@example.com' });
  assert.equal((await b.request(account + '/api/email/verify', { csrf: state.csrf, challenge: first.challenge, code })).status, 400);
});
test('email send limits do not distinguish existing users', async () => {
  const b = new Browser(fixture.mf, '203.0.113.15'); const { data } = await b.json(account + '/api/status');
  for (let i = 0; i < 3; i++) assert.equal((await b.request(account + '/api/email/start', { csrf: data.csrf, email: 'limited@example.com' })).status, 200);
  assert.equal((await b.request(account + '/api/email/start', { csrf: data.csrf, email: 'limited@example.com' })).status, 429);
});
test('SSO validates service Origin, browser possession, one-time consumption and fixed return URL', async () => {
  const { data: local } = await browser.json(service + '/_account/session', {}); assert.equal(local.user, null);
  const { data: central } = await browser.json(account + '/api/status');
  const { data: pending } = await browser.json(service + '/_account/prepare', { csrf: local.csrf, returnPath: '/?view=cards#card' });
  const denied = await browser.request(account + '/api/sso', { csrf: central.csrf, request: pending.request }, { origin: 'https://cupid.archerlab.dev' }); assert.equal(denied.status, 403);
  const { data: ticket } = await browser.json(account + '/api/sso', { csrf: central.csrf, request: pending.request }, { origin: service });
  const stranger = new Browser(fixture.mf, '203.0.113.16'); const { data: strangerState } = await stranger.json(service + '/_account/session', {});
  assert.equal((await stranger.request(service + '/_account/complete', { csrf: strangerState.csrf, request: pending.request, code: ticket.code })).status, 401);
  const result = await browser.json(service + '/_account/complete', { csrf: local.csrf, request: pending.request, code: ticket.code });
  assert.equal(result.response.status, 200); assert.equal(result.data.returnPath, '/?view=cards#card');
  assert.equal((await browser.request(service + '/_account/complete', { csrf: local.csrf, request: pending.request, code: ticket.code })).status, 401);
  const { data: signed } = await browser.json(service + '/_account/session', {}); assert.equal(signed.user.id, central.user.id);
});
test('parallel SSO completion has exactly one winner', async () => {
  const { data: local } = await browser.json(service + '/_account/session', {}); const { data: central } = await browser.json(account + '/api/status');
  const { data: pending } = await browser.json(service + '/_account/prepare', { csrf: local.csrf, returnPath: '/' });
  const { data: ticket } = await browser.json(account + '/api/sso', { csrf: central.csrf, request: pending.request }, { origin: service });
  const responses = await Promise.all([1, 2].map(() => browser.request(service + '/_account/complete', { csrf: local.csrf, request: pending.request, code: ticket.code })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
});
test('logout revokes central session and all child service sessions immediately', async () => {
  const { data } = await browser.json(account + '/api/status'); assert.ok(data.user);
  assert.equal((await browser.request(account + '/api/logout', { csrf: data.csrf })).status, 200);
  assert.equal((await browser.json(account + '/api/status')).data.user, null);
  assert.equal((await browser.json(service + '/_account/session', {})).data.user, null);
});
test('Google flow uses PKCE and nonce; forged or cross-browser callbacks fail before provider access', async () => {
  const b = new Browser(fixture.mf, '203.0.113.17'); const { data } = await b.json(account + '/api/status');
  const { data: start } = await b.json(account + '/auth/google/start', { csrf: data.csrf }); const url = new URL(start.redirect);
  assert.equal(url.origin, 'https://accounts.google.com'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), account + '/auth/google/callback'); assert.ok(url.searchParams.get('nonce'));
  const stranger = new Browser(fixture.mf, '203.0.113.18');
  assert.equal((await stranger.request(account + '/auth/google/callback?code=fake&state=' + url.searchParams.get('state'))).status, 400);
  assert.equal((await b.request(account + '/auth/google/callback?code=fake&state=forged')).status, 400);
});
test('Google ID token verification rejects signature, issuer, audience, nonce, expiry and unverified email', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const stamp = Math.floor(Date.now() / 1000);
  const claims = { iss: 'https://accounts.google.com', aud: 'client', sub: 'member', iat: stamp, exp: stamp + 300, nonce: 'nonce', email: 'member@gmail.com', email_verified: true };
  const token = payload => new SignJWT(payload).setProtectedHeader({ alg: 'RS256' }).sign(privateKey);
  const valid = await token(claims); assert.equal((await verifyGoogle(valid, 'client', 'nonce', publicKey)).subject, 'member');
  for (const patch of [{ iss: 'https://evil.example' }, { aud: 'other' }, { nonce: 'other' }, { exp: stamp - 60 }, { email_verified: false }, { azp: 'other' }]) await assert.rejects(() => token({ ...claims, ...patch }).then(t => verifyGoogle(t, 'client', 'nonce', publicKey)));
  const other = await generateKeyPair('RS256'); await assert.rejects(() => verifyGoogle(valid, 'client', 'nonce', other.publicKey));
});
test('expired email challenges and malformed body are rejected', async () => {
  const b = new Browser(fixture.mf, '203.0.113.19'); const { data } = await b.json(account + '/api/status');
  const { data: sent } = await b.json(account + '/api/email/start', { csrf: data.csrf, email: 'expired@example.com' });
  await fixture.db.prepare('UPDATE email_challenges SET expires_at=0 WHERE email=?').bind('expired@example.com').run();
  const code = fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0];
  assert.equal((await b.request(account + '/api/email/verify', { csrf: data.csrf, challenge: sent.challenge, code })).status, 400);
  assert.equal((await b.request(account + '/api/email/start', { csrf: data.csrf, email: 'x'.repeat(5000) })).status, 413);
});
test('provider failure is fail-closed and discarded challenge cannot log in', async () => {
  const failing = await harness({ mailFails: true });
  try {
    const b = new Browser(failing.mf); const { data } = await b.json(account + '/api/status');
    assert.equal((await b.request(account + '/api/email/start', { csrf: data.csrf, email: 'failure@example.com' })).status, 503);
    assert.equal(await failing.db.prepare('SELECT count(*) AS n FROM email_challenges').first('n'), 0);
  } finally { await failing.close(); }
});
test('service status cannot be cached through GET, and callback documents contain no credentials', async () => {
  assert.equal((await browser.request(service + '/_account/session')).status, 404);
  const response = await browser.request(service + '/_account/callback?code=secret&request=secret');
  assert.equal(response.status, 200); assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  const html = await response.text(); assert.match(html, /callback.js/); assert.doesNotMatch(html, /secret/);
});
test('expired exchange codes and revoked parents cannot create service sessions', async () => {
  const b = new Browser(fixture.mf, '203.0.113.20'); await emailLogin(b, fixture, 'revoked@example.com');
  const { data: local } = await b.json(service + '/_account/session', {}); const { data: central } = await b.json(account + '/api/status');
  const { data: pending } = await b.json(service + '/_account/prepare', { csrf: local.csrf, returnPath: '/' });
  const { data: ticket } = await b.json(account + '/api/sso', { csrf: central.csrf, request: pending.request }, { origin: service });
  await fixture.db.prepare('UPDATE sso_codes SET expires_at=0').run();
  assert.equal((await b.request(service + '/_account/complete', { csrf: local.csrf, request: pending.request, code: ticket.code })).status, 401);
  const { data: second } = await b.json(account + '/api/sso', { csrf: central.csrf, request: pending.request }, { origin: service });
  await b.request(account + '/api/logout', { csrf: central.csrf });
  assert.equal((await b.request(service + '/_account/complete', { csrf: local.csrf, request: pending.request, code: second.code })).status, 401);
});
test('email proof connects a pending Google identity only for the matching address', async () => {
  const b = new Browser(fixture.mf, '203.0.113.21');
  await b.json(account + '/api/status');
  const token = b.cookies.get(account).get('__Host-al_browser');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
  await fixture.db.prepare('INSERT INTO pending_google(browser_hash,subject,email,name,expires_at) VALUES(?,?,?,?,?)')
    .bind(hash, 'pending-google-subject', 'link@example.com', 'Linked member', Math.floor(Date.now() / 1000) + 600).run();
  await emailLogin(b, fixture, 'different@example.com');
  assert.equal(await fixture.db.prepare('SELECT count(*) AS n FROM identities WHERE provider=? AND subject=?').bind('google', 'pending-google-subject').first('n'), 0);
  await emailLogin(b, fixture, 'link@example.com');
  const { data } = await b.json(account + '/api/status');
  assert.equal(await fixture.db.prepare('SELECT user_id FROM identities WHERE provider=? AND subject=?').bind('google', 'pending-google-subject').first('user_id'), data.user.id);
});

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { harness, account, service } from '../harness.mjs';

let fixture; let engine;
before(async () => { fixture = await harness(); engine = await chromium.launch({ headless: true }); });
after(async () => { await engine?.close(); await fixture?.close(); });

async function context(options = {}) {
  const context = await engine.newContext({ locale: 'ko-KR', ...options });
  await context.route('**/*', async route => {
    const request = route.request();
    const headers = await request.allHeaders(); headers['CF-Connecting-IP'] = '203.0.113.80';
    const response = await fixture.mf.dispatchFetch(request.url(), { method: request.method(), headers,
      ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}), redirect: 'manual' });
    const outputHeaders = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie(); if (cookies.length) outputHeaders['set-cookie'] = cookies.join('\n');
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

test('browser email sign-in returns to the service, silently joins a second service, and logout revokes both', async () => {
  const ctx = await context({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(service + '/?view=cards#chosen');
    await page.locator('#archerlab-account').getByRole('link', { name: 'Sign in' }).click();
    await page.waitForURL(url => url.origin === account);
    await page.locator('#email').fill('browser@example.com'); await page.locator('#send').click();
    await page.locator('#code').waitFor({ state: 'visible' });
    const code = fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0];
    await page.locator('#code').fill(code); await page.locator('#code-form button[type=submit]').click();
    await page.waitForURL(service + '/?view=cards#chosen');
    await page.locator('#archerlab-account').getByRole('link', { name: 'Account', exact: true }).waitFor();
    assert.equal((await page.evaluate(() => document.cookie)).includes('__Host-al_service'), false);
    await page.evaluate(() => localStorage.setItem('existing-game-save', 'preserved'));
    await page.goto('https://cupid.archerlab.dev/');
    await page.locator('#archerlab-account').getByRole('link', { name: 'Account', exact: true }).waitFor();
    await page.goto(account + '/?lang=ko'); await page.locator('#logout').click();
    await page.locator('#sign-in').waitFor({ state: 'visible' });
    await page.goto(service + '/');
    await page.locator('#archerlab-account').getByRole('link', { name: 'Sign in' }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('existing-game-save')), 'preserved');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('account layout fits phone, tablet and desktop orientations with keyboard and reduced motion', async () => {
  const ctx = await context({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  try {
    for (const [width, height] of [[320, 568], [568, 320], [390, 844], [844, 390], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
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

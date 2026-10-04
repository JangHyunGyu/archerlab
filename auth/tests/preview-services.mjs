import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { harness, root } from './harness.mjs';
import { GAMES } from '../src/services.js';

// Read-only previews against existing public pages; auth requests stay in the local runtime.
const fixture = await harness(); const browser = await chromium.launch({ headless: true });
const [width, height] = (process.argv[3] || '390x844').split('x').map(Number);
const context = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR' });
const reports = [];
try {
  await context.route(/\/_account\/|https:\/\/account\.archerlab\.dev\//, async route => {
    const request = route.request(); const response = await fixture.mf.dispatchFetch(request.url(), {
      method: request.method(), headers: await request.allHeaders(), ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}), redirect: 'manual'
    });
    const headers = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie(); if (cookies.length) headers['set-cookie'] = cookies.join('\n');
    await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  });
  let sources = ['https://archerlab.dev/', 'https://nevergrad.archerlab.dev/', 'https://karma.archerlab.dev/', 'https://harem.archerlab.dev/', 'https://cupid.archerlab.dev/', 'https://chatbot.archerlab.dev/', 'https://golf.archerlab.dev/', 'https://itstory.archerlab.dev/', 'https://news.archerlab.dev/', 'https://chat.archerlab.dev/', ...GAMES.map(game => `https://game.archerlab.dev/${game}/`)];
  if (process.argv[2]) sources = sources.filter(url => process.argv[2].split(',').some(word => url.includes(word)));
  await fs.mkdir(root + '/test-results/services', { recursive: true });
  for (const url of sources) {
    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(800);
      const before = await page.evaluate(() => document.documentElement.scrollWidth);
      await page.addScriptTag({ path: root + '/public/widget.js' });
      await page.locator('#archerlab-account').waitFor({ state: 'attached', timeout: 5000 }); await page.waitForTimeout(500);
      if (!await page.locator('#archerlab-account').count()) await page.addScriptTag({ path: root + '/public/widget.js' });
      const layout = await page.locator('#archerlab-account').evaluate(element => {
        const button = element.shadowRoot.querySelector('.trigger'); const r = button.getBoundingClientRect();
        const overlaps = [...document.querySelectorAll('button,a,select')].filter(other => other !== element && !other.closest('[inert], [aria-hidden="true"]') && other.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).filter(other => {
          const s = other.getBoundingClientRect();
          const x = (Math.max(r.left, s.left) + Math.min(r.right, s.right)) / 2;
          const y = (Math.max(r.top, s.top) + Math.min(r.bottom, s.bottom)) / 2;
          const painted = document.elementFromPoint(x, y);
          return s.width < 300 && s.height < 100 && r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top && (painted === element || other.contains(painted));
        }).map(other => other.id || other.className).slice(0, 5);
        return { width: r.width, height: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom, parent: element.parentElement.className, corner: element.hasAttribute('data-corner'), scrollWidth: document.documentElement.scrollWidth, overlaps };
      });
      const name = new URL(url).hostname.split('.')[0] + (new URL(url).pathname !== '/' ? '-' + new URL(url).pathname.split('/')[1] : '');
      await page.screenshot({ path: root + '/test-results/services/' + name + '-' + width + 'x' + height + '.png' });
      reports.push({ url, status: response.status(), before, ...layout });
      console.log(JSON.stringify(reports.at(-1)));
    } catch (error) { reports.push({ url, error: error.message.slice(0, 150) }); console.log(JSON.stringify(reports.at(-1))); }
    finally { await page.close(); }
  }
  await fs.writeFile(root + '/test-results/services/report-' + width + 'x' + height + '.json', JSON.stringify(reports, null, 2));
} finally { await context.close(); await browser.close(); await fixture.close(); }

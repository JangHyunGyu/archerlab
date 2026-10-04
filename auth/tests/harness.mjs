import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');
export async function harness(options = {}) {
  const mail = []; const upstream = [];
  const compiled = await build({
    stdin: { contents: `import worker from './src/worker.js'; export default {
      fetch(request, env) { return worker.fetch(request, { ...env, EMAIL: { async send(message) {
        const response = await env.TEST_MAIL.fetch('https://mail.test', {method:'POST',body:JSON.stringify(message)});
        if (!response.ok) throw new Error('mail failed'); return { messageId:'local' };
      } } }); }, scheduled(controller, env) { return worker.scheduled(controller, env); }
    };`, resolveDir: root, sourcefile: 'test-entry.mjs' },
    bundle: true, format: 'esm', platform: 'browser', write: false
  });
  const mf = new Miniflare({
    modules: true, script: compiled.outputFiles[0].text, compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'account-test' },
    bindings: { SESSION_SECRET: 'test-only-secret-with-over-32-characters', EMAIL_ENABLED: 'true', EMAIL_FROM: 'login@archerlab.dev', GOOGLE_CLIENT_ID: 'google-test', GOOGLE_CLIENT_SECRET: 'test-only', ...options.bindings },
    serviceBindings: {
      TEST_MAIL: async request => { mail.push(await request.json()); return new Response('', { status: options.mailFails ? 503 : 200 }); },
      ASSETS: async request => {
        const file = path.basename(new URL(request.url).pathname);
        try { return new Response(await fs.readFile(path.join(root, 'public', file)), { headers: { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : 'application/javascript' } }); }
        catch { return new Response('missing', { status: 404 }); }
      }
    },
    outboundService: async request => {
      upstream.push({ url: request.url, cookie: request.headers.get('Cookie') });
      return new Response('<!doctype html><html><head><title>Guest</title></head><body><h1>Guest page</h1></body></html>', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=60', ETag: 'original' } });
    }
  });
  const db = await mf.getD1Database('DB');
  const sql = await fs.readFile(path.join(root, 'migrations/0001_account.sql'), 'utf8');
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  return { mf, db, mail, upstream, close: () => mf.dispose() };
}

export class Browser {
  constructor(mf, ip = '203.0.113.7') { this.mf = mf; this.cookies = new Map(); this.ip = ip; }
  async request(url, body, extra = {}) {
    const origin = new URL(url).origin;
    const stored = this.cookies.get(origin) || new Map();
    const headers = { 'CF-Connecting-IP': this.ip, Cookie: [...stored].map(([key, value]) => `${key}=${value}`).join('; '), ...extra.headers };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers.Origin = extra.origin || origin; }
    const response = await this.mf.dispatchFetch(url, { redirect: 'manual', method: body !== undefined ? 'POST' : 'GET', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), ...extra, headers });
    for (const value of response.headers.getSetCookie()) {
      const part = value.split(';')[0]; const index = part.indexOf('='); const name = part.slice(0, index); const token = part.slice(index + 1);
      if (token) stored.set(name, token); else stored.delete(name);
    }
    this.cookies.set(origin, stored); return response;
  }
  async json(url, body, extra) {
    const response = await this.request(url, body, extra); return { response, data: await response.json() };
  }
}
export const account = 'https://account.archerlab.dev';
export const service = 'https://harem.archerlab.dev';
export async function emailLogin(browser, fixture, address = 'member@example.com') {
  const { data: status } = await browser.json(account + '/api/status');
  const { response: sent, data: challenge } = await browser.json(account + '/api/email/start', { csrf: status.csrf, email: address });
  if (sent.status !== 200) throw new Error(JSON.stringify(challenge));
  const code = fixture.mail.at(-1).text.match(/\b\d{6}\b/)[0];
  const result = await browser.json(account + '/api/email/verify', { csrf: status.csrf, challenge: challenge.challenge, code });
  return { ...result, csrf: status.csrf, challenge: challenge.challenge, code };
}

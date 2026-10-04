import { ACCOUNT, SERVICES, registered, linkedPage, returnPath } from './services.js';
import { HttpError, random, digest, sign, verify, cookie, setCookie, jsonBody, string, email, oneTimeCode, json, redirect, boundedText } from './security.js';
import { verifyGoogle } from './google.js';

/** @typedef {Omit<Env, 'EMAIL_ENABLED'> & { EMAIL_ENABLED: string, SESSION_SECRET?: string, GOOGLE_CLIENT_ID?: string, GOOGLE_CLIENT_SECRET?: string }} AuthEnv */
/** @typedef {{hash:string, user_id:string, email:string, name:string, origin:string, parent_hash:string|null, expires_at:number}} Session */
/** @typedef {{hash:string, browser_hash:string, origin:string, return_path:string, expires_at:number}} SsoRequest */
/** @typedef {{hash:string, browser_hash:string, nonce:string, verifier:string, sso_request:string|null, expires_at:number}} OAuthFlow */
/** @typedef {{subject:string, email:string, name:string, sso_request:string|null}} GooglePending */
const BROWSER = '__Host-al_browser';
const CENTRAL = '__Host-al_account';
const LOCAL = '__Host-al_service';
const LIFETIME = 7 * 86400;
const now = () => Math.floor(Date.now() / 1000);

class Account {
  /** @param {Request} request @param {AuthEnv} env */
  constructor(request, env) {
    this.request = request; this.env = env; this.url = new URL(request.url);
    this.db = env.DB.withSession('first-primary');
    this.browser = cookie(request, BROWSER) || random();
    this.cookies = [];
    if (!cookie(request, BROWSER)) this.cookies.push(setCookie(BROWSER, this.browser, 1800));
  }
  get secret() {
    const value = this.env.SESSION_SECRET || '';
    if (value.length < 32) throw new HttpError(503, 'setup_required');
    return value;
  }
  async csrf() { return sign(this.secret, `csrf:${this.url.origin}:${this.browser}`); }
  /** @param {boolean} [crossService] */
  async body(crossService = false) {
    const origin = this.request.headers.get('Origin');
    let source = null;
    try { if (origin) source = new URL(origin); } catch { throw new HttpError(403, 'origin_denied'); }
    if (source && source.origin !== origin) throw new HttpError(403, 'origin_denied');
    if (!source || (origin !== this.url.origin && !(crossService && registered(source)))) throw new HttpError(403, 'origin_denied');
    const body = await jsonBody(this.request);
    if (!await verify(this.secret, `csrf:${this.url.origin}:${this.browser}`, string(body.csrf, 64))) throw new HttpError(403, 'csrf_denied');
    return body;
  }
  /** @param {string} key @param {number} maximum @param {number} duration */
  async limit(key, maximum, duration) {
    const stamp = now(); const bucket = Math.floor(stamp / duration);
    const hash = await sign(this.secret, `rate:${key}:${bucket}`);
    const row = await this.db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
      .bind(hash, (bucket + 1) * duration).first();
    if (!row || Number(row.count) > maximum) throw new HttpError(429, 'rate_limited');
  }
  async ipLimit() { await this.limit(`ip:${this.request.headers.get('CF-Connecting-IP') || 'unknown'}`, 30, 600); }
  async session() {
    const isAccount = this.url.origin === ACCOUNT;
    const token = cookie(this.request, isAccount ? CENTRAL : LOCAL);
    if (!token) return null;
    return this.db.prepare(`SELECT s.*,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id
      LEFT JOIN sessions p ON p.hash=s.parent_hash WHERE s.hash=? AND s.origin=? AND s.expires_at>?
      AND ((s.parent_hash IS NULL AND s.origin=?) OR (p.hash IS NOT NULL AND p.origin=? AND p.expires_at>?))`)
      .bind(await digest(token), this.url.origin, now(), ACCOUNT, ACCOUNT, now()).first();
  }
  /** @param {string} userId */
  async centralSession(userId) {
    const old = cookie(this.request, CENTRAL);
    if (old) await this.db.prepare('DELETE FROM sessions WHERE hash=? AND origin=?').bind(await digest(old), ACCOUNT).run();
    const token = random(); const hash = await digest(token);
    await this.db.prepare('INSERT INTO sessions(hash,user_id,origin,parent_hash,expires_at,created_at) VALUES(?,?,?,NULL,?,?)')
      .bind(hash, userId, ACCOUNT, now() + LIFETIME, now()).run();
    this.cookies.push(setCookie(CENTRAL, token, LIFETIME));
    return hash;
  }
  /** @param {string} token */
  async ssoRequest(token) {
    return this.db.prepare('SELECT * FROM sso_requests WHERE hash=? AND expires_at>?')
      .bind(await digest(token), now()).first();
  }
  /** @param {string} path */
  async prepare(path) {
    let clean;
    try { clean = returnPath(path, this.url.origin); } catch { throw new HttpError(400, 'invalid_return'); }
    await this.limit(`prepare:${this.browser}`, 20, 600);
    const token = random();
    await this.db.prepare('INSERT INTO sso_requests(hash,browser_hash,origin,return_path,expires_at) VALUES(?,?,?,?,?)')
      .bind(await digest(token), await digest(this.browser), this.url.origin, clean, now() + 600).run();
    return token;
  }
  /** @param {string} requestToken @param {string} parentHash */
  async ticket(requestToken, parentHash) {
    const sso = /** @type {SsoRequest|null} */ (await this.ssoRequest(requestToken));
    if (!sso || !registered(new URL(sso.origin))) throw new HttpError(400, 'request_expired');
    const code = random();
    await this.db.prepare('INSERT INTO sso_codes(hash,request_hash,parent_hash,expires_at) VALUES(?,?,?,?)')
      .bind(await digest(code), sso.hash, parentHash, now() + 60).run();
    const target = new URL('/_account/callback', sso.origin);
    target.searchParams.set('code', code); target.searchParams.set('request', requestToken);
    return { code, redirect: target.href };
  }
  /** @param {string} requestToken @param {string} code */
  async complete(requestToken, code) {
    const requestHash = await digest(requestToken); const codeHash = await digest(code);
    const parent = await this.db.prepare('SELECT parent_hash FROM sso_codes WHERE hash=? AND request_hash=? AND expires_at>?')
      .bind(codeHash, requestHash, now()).first();
    if (!parent) throw new HttpError(401, 'code_invalid');
    // Deleting the request consumes every code issued for it, atomically. A second tab cannot replay one.
    const sso = /** @type {SsoRequest|null} */ (await this.db.prepare(`DELETE FROM sso_requests WHERE hash=? AND browser_hash=? AND origin=? AND expires_at>?
      AND EXISTS(SELECT 1 FROM sso_codes c JOIN sessions p ON p.hash=c.parent_hash
      WHERE c.hash=? AND c.request_hash=sso_requests.hash AND c.expires_at>? AND p.expires_at>? AND p.origin=?) RETURNING *`)
      .bind(requestHash, await digest(this.browser), this.url.origin, now(), codeHash, now(), now(), ACCOUNT).first());
    if (!sso) throw new HttpError(401, 'code_invalid');
    const token = random();
    const result = await this.db.prepare(`INSERT INTO sessions(hash,user_id,origin,parent_hash,expires_at,created_at)
      SELECT ?,user_id,?,hash,expires_at,? FROM sessions WHERE hash=? AND origin=? AND expires_at>?`)
      .bind(await digest(token), this.url.origin, now(), parent.parent_hash, ACCOUNT, now()).run();
    if (result.meta.changes !== 1) throw new HttpError(401, 'session_expired');
    this.cookies.push(setCookie(LOCAL, token, LIFETIME));
    return sso.return_path;
  }
  /** @param {string} address @param {string} name */
  async user(address, name) {
    await this.db.prepare('INSERT OR IGNORE INTO users(id,email,name,created_at) VALUES(?,?,?,?)')
      .bind(crypto.randomUUID(), address, name.slice(0, 80), now()).run();
    const user = await this.db.prepare('SELECT id FROM users WHERE email=?').bind(address).first();
    if (!user) throw new HttpError(503, 'temporarily_unavailable');
    return String(user.id);
  }
  /** @param {string} userId @param {'email'|'google'} provider @param {string} subject */
  async identity(userId, provider, subject) {
    await this.db.prepare('INSERT OR IGNORE INTO identities(provider,subject,user_id) VALUES(?,?,?)').bind(provider, subject, userId).run();
    const row = await this.db.prepare('SELECT user_id FROM identities WHERE provider=? AND subject=?').bind(provider, subject).first();
    if (row?.user_id !== userId) throw new HttpError(409, 'identity_conflict');
  }
  /** @param {string} hash @param {string|null} requestToken */
  async finish(hash, requestToken) {
    if (!requestToken) return ACCOUNT + '/';
    return (await this.ticket(requestToken, hash)).redirect;
  }
  async status() {
    const session = /** @type {Session|null} */ (await this.session());
    const pending = this.url.origin === ACCOUNT ? /** @type {GooglePending|null} */ (await this.db.prepare('SELECT email FROM pending_google WHERE browser_hash=? AND expires_at>?').bind(await digest(this.browser), now()).first()) : null;
    const requestToken = this.url.origin === ACCOUNT ? this.url.searchParams.get('request') : null;
    const target = requestToken ? /** @type {SsoRequest|null} */ (await this.ssoRequest(requestToken)) : null;
    if (requestToken && !target) throw new HttpError(400, 'request_expired');
    return json({
      user: session ? { id: session.user_id, name: session.name, email: session.email } : null,
      csrf: await this.csrf(), pendingEmail: pending?.email || null,
      providers: { google: Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET), email: this.env.EMAIL_ENABLED === 'true' },
      target: target ? { name: SERVICES[/** @type {keyof typeof SERVICES} */ (new URL(target.origin).hostname)], origin: target.origin, returnUrl: target.origin + target.return_path } : null
    });
  }
  async emailStart() {
    const body = await this.body(); await this.ipLimit();
    if (this.env.EMAIL_ENABLED !== 'true') throw new HttpError(503, 'email_unavailable');
    const address = email(body.email);
    await this.limit(`email:${address}`, 3, 900);
    await this.limit(`email-browser:${this.browser}`, 5, 900);
    await this.limit('email-global', 200, 3600);
    const requestToken = body.request ? string(body.request, 43) : null;
    if (requestToken && !await this.ssoRequest(requestToken)) throw new HttpError(400, 'request_expired');
    const code = oneTimeCode(); const challenge = random(); const hash = await digest(challenge);
    const browserHash = await digest(this.browser);
    await this.db.batch([
      this.db.prepare('DELETE FROM email_challenges WHERE browser_hash=?').bind(browserHash),
      this.db.prepare('INSERT INTO email_challenges(hash,browser_hash,email,signature,expires_at,sso_request) VALUES(?,?,?,?,?,?)')
        .bind(hash, browserHash, address, await sign(this.secret, `otp:${hash}:${code}`), now() + 600, requestToken)
    ]);
    try {
      const korean = body.lang === 'ko';
      await this.env.EMAIL.send({
        from: { email: this.env.EMAIL_FROM, name: 'ArcherLab' }, to: address,
        subject: korean ? 'ArcherLab 로그인 인증번호' : 'ArcherLab login code',
        text: `ArcherLab\n\n${code}\n\n${korean ? '인증번호는 10분 동안 유효해요. 다른 사람에게 알려주지 마세요. 로그인 요청을 하지 않았다면 이 메일은 무시하셔도 돼요.' : 'Your login code expires in 10 minutes. Do not share it. If you did not request this email, you can ignore it.'}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:440px;margin:40px auto;color:#202020"><p>ArcherLab</p><h1 style="letter-spacing:8px;font-size:36px">${code}</h1><p>${korean ? '인증번호는 10분 동안 유효해요. 다른 사람에게 알려주지 마세요.' : 'Your login code expires in 10 minutes. Do not share it.'}</p><p>${korean ? '로그인 요청을 하지 않았다면 이 메일은 무시하셔도 돼요.' : 'If you did not request this email, you can ignore it.'}</p></div>`
      });
    } catch {
      await this.db.prepare('DELETE FROM email_challenges WHERE hash=?').bind(hash).run();
      throw new HttpError(503, 'email_unavailable');
    }
    return json({ challenge, expiresIn: 600 });
  }
  async emailVerify() {
    const body = await this.body(); await this.ipLimit();
    if (this.env.EMAIL_ENABLED !== 'true') throw new HttpError(503, 'email_unavailable');
    const challengeHash = await digest(string(body.challenge, 43));
    const code = string(body.code, 6);
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'code_invalid');
    const browserHash = await digest(this.browser);
    const row = await this.db.prepare(`UPDATE email_challenges SET attempts=attempts+1
      WHERE hash=? AND browser_hash=? AND expires_at>? AND attempts<5 RETURNING *`)
      .bind(challengeHash, browserHash, now()).first();
    if (!row || !await verify(this.secret, `otp:${challengeHash}:${code}`, String(row.signature))) throw new HttpError(400, 'code_invalid');
    // Successful proof is also consumed atomically before a session can be created.
    const consumed = await this.db.prepare('DELETE FROM email_challenges WHERE hash=? AND browser_hash=? RETURNING *').bind(challengeHash, browserHash).first();
    if (!consumed) throw new HttpError(400, 'code_invalid');
    const address = String(consumed.email);
    const userId = await this.user(address, address.split('@')[0]);
    await this.identity(userId, 'email', address);
    const pending = /** @type {GooglePending|null} */ (await this.db.prepare('DELETE FROM pending_google WHERE browser_hash=? AND email=? AND expires_at>? RETURNING *')
      .bind(browserHash, address, now()).first());
    if (pending) await this.identity(userId, 'google', pending.subject);
    const hash = await this.centralSession(userId);
    return json({ redirect: await this.finish(hash, consumed.sso_request ? String(consumed.sso_request) : pending?.sso_request || null) });
  }
  async googleStart() {
    const body = await this.body(); await this.ipLimit();
    if (!this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, 'google_unavailable');
    const requestToken = body.request ? string(body.request, 43) : null;
    if (requestToken && !await this.ssoRequest(requestToken)) throw new HttpError(400, 'request_expired');
    const state = random(); const verifier = random(); const nonce = random();
    await this.db.prepare('INSERT INTO oauth_flows(hash,browser_hash,nonce,verifier,sso_request,expires_at) VALUES(?,?,?,?,?,?)')
      .bind(await digest(state), await digest(this.browser), nonce, verifier, requestToken, now() + 600).run();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    const challengeBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeBytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    for (const [k, v] of Object.entries({ client_id: this.env.GOOGLE_CLIENT_ID, redirect_uri: ACCOUNT + '/auth/google/callback',
      response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: challenge,
      code_challenge_method: 'S256', prompt: 'select_account' })) url.searchParams.set(k, v);
    return json({ redirect: url.href });
  }
  async googleCallback() {
    const state = this.url.searchParams.get('state') || '';
    const flow = /** @type {OAuthFlow|null} */ (await this.db.prepare('DELETE FROM oauth_flows WHERE hash=? AND browser_hash=? AND expires_at>? RETURNING *')
      .bind(await digest(state), await digest(this.browser), now()).first());
    if (!flow) throw new HttpError(400, 'google_invalid');
    if (this.url.searchParams.has('error')) return redirect(ACCOUNT + '/?error=google_cancelled');
    if (!this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, 'google_unavailable');
    const code = this.url.searchParams.get('code');
    if (!code || code.length > 4096) throw new HttpError(400, 'google_invalid');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: this.env.GOOGLE_CLIENT_ID, client_secret: this.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: ACCOUNT + '/auth/google/callback', grant_type: 'authorization_code', code_verifier: flow.verifier })
    });
    if (!response.ok) throw new HttpError(400, 'google_invalid');
    const tokens = JSON.parse(await boundedText(response, 32768));
    let identity;
    try { identity = await verifyGoogle(string(tokens.id_token, 16000), this.env.GOOGLE_CLIENT_ID, flow.nonce); }
    catch { throw new HttpError(400, 'google_invalid'); }
    const known = await this.db.prepare('SELECT user_id FROM identities WHERE provider=? AND subject=?').bind('google', identity.subject).first();
    let userId;
    if (known) userId = String(known.user_id);
    else {
      const existing = await this.db.prepare('SELECT id FROM users WHERE email=?').bind(identity.email).first();
      if (existing || !identity.authoritative) {
        // Email ownership is proved again before joining an existing account or trusting a third-party email.
        await this.db.prepare(`INSERT INTO pending_google(browser_hash,subject,email,name,sso_request,expires_at) VALUES(?,?,?,?,?,?)
          ON CONFLICT(browser_hash) DO UPDATE SET subject=excluded.subject,email=excluded.email,name=excluded.name,sso_request=excluded.sso_request,expires_at=excluded.expires_at`)
          .bind(await digest(this.browser), identity.subject, identity.email, identity.name, flow.sso_request, now() + 600).run();
        const target = new URL('/', ACCOUNT); if (flow.sso_request) target.searchParams.set('request', flow.sso_request);
        return redirect(target.href);
      }
      userId = await this.user(identity.email, identity.name);
      await this.identity(userId, 'google', identity.subject);
    }
    return redirect(await this.finish(await this.centralSession(userId), flow.sso_request));
  }
  async dispatch() {
    const path = this.url.pathname; const central = this.url.origin === ACCOUNT;
    if (this.request.method === 'GET' && path === '/api/status' && central) return this.status();
    if (this.request.method === 'POST' && path === '/_account/session' && !central) {
      // Existing app service workers sometimes cache every GET, even with no-store.
      if (this.request.headers.get('Origin') !== this.url.origin) throw new HttpError(403, 'origin_denied');
      await jsonBody(this.request); return this.status();
    }
    if (this.request.method === 'POST' && central && path === '/api/email/start') return this.emailStart();
    if (this.request.method === 'POST' && central && path === '/api/email/verify') return this.emailVerify();
    if (this.request.method === 'POST' && central && path === '/auth/google/start') return this.googleStart();
    if (this.request.method === 'GET' && central && path === '/auth/google/callback') return this.googleCallback();
    if (this.request.method === 'POST' && central && path === '/api/sso') {
      const body = await this.body(true); const session = /** @type {Session|null} */ (await this.session());
      if (!session) throw new HttpError(401, 'login_required');
      const token = string(body.request, 43); const row = await this.ssoRequest(token);
      if (!row || row.origin !== this.request.headers.get('Origin')) throw new HttpError(403, 'origin_denied');
      await this.limit(`ticket:${session.hash}`, 60, 600);
      return json(await this.ticket(token, session.hash));
    }
    if (this.request.method === 'POST' && central && path === '/api/logout') {
      await this.body(true); const session = /** @type {Session|null} */ (await this.session());
      if (session) await this.db.prepare('DELETE FROM sessions WHERE hash=? AND origin=?').bind(session.hash, ACCOUNT).run();
      this.cookies.push(setCookie(CENTRAL, '', 0)); return json({ ok: true });
    }
    if (this.request.method === 'POST' && !central && path === '/_account/prepare') {
      const body = await this.body(); return json({ request: await this.prepare(string(body.returnPath, 2048)) });
    }
    if (this.request.method === 'POST' && !central && path === '/_account/complete') {
      const body = await this.body(); return json({ returnPath: await this.complete(string(body.request, 43), string(body.code, 43)) });
    }
    if (this.request.method === 'GET' && !central && path === '/_account/login') {
      const token = await this.prepare(this.url.searchParams.get('return') || '/');
      const target = new URL('/', ACCOUNT); target.searchParams.set('request', token);
      target.searchParams.set('lang', this.url.searchParams.get('lang') === 'ko' ? 'ko' : 'en'); return redirect(target.href);
    }
    if (this.request.method === 'GET' && !central && path === '/_account/callback') {
      // A service worker can swallow a navigation's HTTP redirect. Complete in the
      // document, then navigate explicitly, so the browser URL and app scope agree.
      return asset(this.env, '/callback.html');
    }
    if (central && path === '/' && this.request.method === 'GET') {
      const token = this.url.searchParams.get('request');
      if (token) {
        if (!await this.ssoRequest(token)) throw new HttpError(400, 'request_expired');
        const session = /** @type {Session|null} */ (await this.session());
        if (session) return redirect((await this.ticket(token, session.hash)).redirect);
      }
      return asset(this.env, '/index.html');
    }
    throw new HttpError(404, 'not_found');
  }
}

/** @param {AuthEnv} env @param {string} path */
async function asset(env, path) {
  return env.ASSETS.fetch(new Request(ACCOUNT + path));
}
/** @param {Request} request @param {Response} response @param {string[]} [cookies] */
function privateResponse(request, response, cookies = []) {
  const result = new Response(response.body, response);
  const headers = result.headers;
  headers.set('Cache-Control', 'no-store'); headers.set('Pragma', 'no-cache');
  headers.set('Referrer-Policy', 'no-referrer'); headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY'); headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  const origin = request.headers.get('Origin');
  if (new URL(request.url).origin === ACCOUNT && origin) {
    try {
      if (registered(new URL(origin))) {
        headers.set('Access-Control-Allow-Origin', origin); headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Access-Control-Allow-Methods', 'GET, POST'); headers.set('Access-Control-Allow-Headers', 'Content-Type'); headers.set('Vary', 'Origin');
      }
    } catch { /* Invalid origins are denied without echoing the supplied header. */ }
  }
  for (const value of cookies) headers.append('Set-Cookie', value);
  return result;
}

/** @param {Request} request */
async function originResponse(request) {
  // Auth cookies belong to this gateway, never to a Pages function, upstream log, or app backend.
  const headers = new Headers(request.headers);
  const remaining = (headers.get('Cookie') || '').split(';').filter(part => !/^\s*__Host-al_/.test(part)).join(';');
  if (remaining) headers.set('Cookie', remaining); else headers.delete('Cookie');
  const upstream = await fetch(new Request(request, { headers }));
  if (request.method !== 'GET' || upstream.status !== 200 || !linkedPage(new URL(request.url)) ||
      !upstream.headers.get('Content-Type')?.includes('text/html')) return upstream;
  const transformed = new HTMLRewriter().on('head', {
    element(element) { element.append('<script src="/_account/widget.js" defer data-archerlab-account></script>', { html: true }); }
  }).transform(upstream);
  const result = new Response(transformed.body, transformed);
  result.headers.delete('Content-Length'); result.headers.delete('ETag');
  return result;
}

export default {
  /** @param {Request} request @param {AuthEnv} env */
  async fetch(request, env) {
    const url = new URL(request.url); const central = url.origin === ACCOUNT;
    if (url.protocol !== 'https:') {
      url.protocol = 'https:';
      if (url.origin === ACCOUNT || registered(url)) return redirect(url.href);
      return new Response('Not found', { status: 404 });
    }
    if (!central && !registered(url)) return new Response('Not found', { status: 404 });
    if (!central && !url.pathname.startsWith('/_account/')) return originResponse(request);
    if (request.method === 'OPTIONS') return privateResponse(request, new Response(null, { status: 204 }));
    const staticPath = central ? url.pathname : url.pathname.slice('/_account'.length);
    if (request.method === 'GET' && ['/widget.js', '/widget.css', '/callback.js', '/account.js', '/account.css', '/privacy.html'].includes(staticPath)) {
      return privateResponse(request, await asset(env, staticPath));
    }
    const account = new Account(request, env);
    try { return privateResponse(request, await account.dispatch(), account.cookies); }
    catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      const code = error instanceof HttpError ? error.message : 'temporarily_unavailable';
      // Do not log URLs, email addresses, OAuth codes, tokens, or raw provider errors.
      if (!(error instanceof HttpError)) console.error(JSON.stringify({ event: 'account_error', path: url.pathname, kind: error instanceof Error ? error.name : 'unknown' }));
      const response = privateResponse(request, json({ error: code }, status), account.cookies);
      if (status === 429) response.headers.set('Retry-After', '600');
      return response;
    }
  },
  /** @param {ScheduledController} controller @param {AuthEnv} env */
  async scheduled(controller, env) {
    const time = now();
    await env.DB.batch(['sso_requests', 'oauth_flows', 'pending_google', 'email_challenges', 'sessions', 'rate_limits']
      .map(table => env.DB.prepare(`DELETE FROM ${table} WHERE expires_at<=?`).bind(time)));
  }
};

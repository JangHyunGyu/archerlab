const encoder = new TextEncoder();
export class HttpError extends Error {
  /** @param {number} status @param {string} code */
  constructor(status, code) { super(code); this.status = status; }
}
/** @param {number} [size] */
export function random(size = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
/** @param {string} value */
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/** @param {string} secret */
async function key(secret) {
  if (secret.length < 32) throw new HttpError(503, 'setup_required');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
/** @param {string} secret @param {string} value */
export async function sign(secret, value) {
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(value));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/** @param {string} secret @param {string} value @param {string} signature */
export async function verify(secret, value, signature) {
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from(signature.match(/../g) || [], s => parseInt(s, 16));
  return crypto.subtle.verify('HMAC', await key(secret), bytes, encoder.encode(value));
}
/** @param {Request} request @param {string} name */
export function cookie(request, name) {
  const values = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
  if (values.length !== 1) return '';
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
/** @param {string} name @param {string} value @param {number} seconds */
export function setCookie(name, value, seconds) {
  return `${name}=${value}; Path=/; Max-Age=${seconds}; Secure; HttpOnly; SameSite=Lax`;
}
/** @param {Request|Response} request @param {number} limit */
export async function boundedText(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, 'too_large');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new HttpError(413, 'too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
}
/** @param {Request} request @returns {Promise<Record<string, unknown>>} */
export async function jsonBody(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) throw new HttpError(415, 'json_required');
  try {
    const value = JSON.parse(await boundedText(request, 4096));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_request');
  }
}
/** @param {unknown} value @param {number} [limit] */
export function string(value, limit = 256) {
  if (typeof value !== 'string' || value.length > limit) throw new HttpError(400, 'invalid_request');
  return value;
}
/** @param {unknown} value */
export function email(value) {
  const address = string(value, 254).trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(address)) throw new HttpError(400, 'invalid_email');
  return address;
}
export function oneTimeCode() {
  let value;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= 4294000000);
  return String(value % 1000000).padStart(6, '0');
}
/** @param {unknown} body @param {number} [status] */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
/** @param {string} location */
export function redirect(location) { return new Response(null, { status: 303, headers: { Location: location } }); }

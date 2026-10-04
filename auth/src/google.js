import { createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError, email } from './security.js';

// Immutable provider metadata; jose manages a bounded cache of public signing keys.
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 5000 });
/** @param {string} token @param {string} audience @param {string} nonce @param {Parameters<typeof jwtVerify>[1]} [keySet] */
export async function verifyGoogle(token, audience, nonce, keySet = keys) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'], audience,
    algorithms: ['RS256'], maxTokenAge: '10m', clockTolerance: 5,
    requiredClaims: ['sub', 'exp', 'iat', 'nonce', 'email']
  });
  if (payload.nonce !== nonce || payload.email_verified !== true || !payload.sub ||
      (payload.azp !== undefined && payload.azp !== audience)) throw new HttpError(400, 'google_invalid');
  return {
    subject: payload.sub, email: email(payload.email),
    name: typeof payload.name === 'string' ? payload.name.slice(0, 80) : email(payload.email).split('@')[0],
    authoritative: email(payload.email).endsWith('@gmail.com') || typeof payload.hd === 'string'
  };
}

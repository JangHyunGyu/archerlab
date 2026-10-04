# ArcherLab account

Self-hosted Google OIDC and passwordless email sign-in, with SSO for the services linked from archerlab.dev. Cloudflare hosts the Worker and D1 database and delivers transactional email; it does not manage user authentication.

The Worker runs in front of the existing origins. It streams their responses, adds a small account control to linked HTML pages, and serves only its reserved `/_account/` endpoints locally. Existing Pages functions, game saves, anonymous sessions and app APIs keep their current behavior. Separate domains and unlisted projects have no routes. Unlisted games receive no account control or SSO return destination.

The hub also has a static account link, so its login entry remains visible before DNS proxying is enabled. Its private cross-origin status request only updates the label; it does not establish a service session or grant permissions. The gateway replaces this entry once active. `/account` displays account details for signed-in users and the sign-in form for guests.

## DNS prerequisite

Worker routes require proxied DNS records. In the archerlab.dev zone, enable the orange cloud for `@`, `game`, `nevergrad`, `karma`, `harem`, `cupid`, `chatbot`, `golf`, `itstory`, `chat` and `news`, preserving each existing record's origin target. `account` is a Worker custom domain and Wrangler creates its DNS record automatically. A successful Worker deployment does not enable proxying on existing DNS-only records. Wrangler OAuth cannot edit ordinary DNS records; use the Cloudflare dashboard or a separate zone-scoped DNS Edit API token.

After DNS propagates, check that each linked page includes `data-archerlab-account`, its `/_account/session` POST returns a private anonymous status, and the login link reaches account.archerlab.dev and can return as a guest. Perform these checks through public DNS, rather than a forced edge address.

## Security boundary

- Account and service cookies are host-only, Secure, HttpOnly and SameSite=Lax. Tokens never enter localStorage. Auth cookies are removed before origin requests.
- Service sessions reference a central session. Signing out revokes its service sessions immediately. Other devices remain signed in.
- Every exchange uses a short-lived, one-time code and a request tied to a host-only browser cookie and registered return destination. SQL consumption is atomic.
- Mutations require an exact Origin and a browser-bound HMAC CSRF proof. Account CORS only allows the registered service origins.
- Email challenges expire after 10 minutes, allow five attempts, and store keyed signatures. Issuing a new challenge replaces the previous one. IP, address, browser and global send limits constrain abuse.
- Google uses authorization code + PKCE, state and nonce. jose verifies signature, issuer, audience, authorized party, token age, expiry and verified email. Existing email accounts and third-party Google email addresses require fresh email proof before linking.
- Status uses POST on service origins because existing service workers cache GET responses. The callback document consumes its code through POST and explicitly replaces the URL. Auth documents carry a restrictive CSP and no analytics.
- Database reads use a D1 session starting on the primary. Expired authentication records are deleted hourly. Logs omit URLs, email, codes and raw provider errors.

SSO establishes account identity. It does not migrate old Karma matching accounts, merge anonymous saves, or grant paid access. Existing app API identifiers are not proof of membership. A server integrating paid features must verify this service's session through a service binding and apply its own entitlement checks; never trust the browser's `archerlab:session` event.

## Google configuration

1. In Google Cloud, configure a Google Auth Platform project with an external audience and ArcherLab branding. Request only `openid`, `email`, `profile`.
2. Create a **Web application** OAuth client. Its authorized redirect URI is exactly:

   `https://account.archerlab.dev/auth/google/callback`

3. Publish the consent configuration for production users. While testing, explicitly add test users.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with `npx wrangler secret put` from this directory. Do not place credentials in git or chat.
5. Verify a real Google login and its return to two services. Until both secrets exist, the UI disables Google and the server rejects its start endpoint.

`SESSION_SECRET` must contain at least 32 cryptographically random bytes. Set it with `wrangler secret put`; `.dev.vars` is ignored. Keep it stable: changing it invalidates pending codes and CSRF proofs.

## Commands

```text
npm ci
npm run types
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm audit
npx wrangler deploy --dry-run
```

Apply additive migrations with `npx wrangler d1 migrations apply archerlab-account --remote`. Commit and push main before `npx wrangler deploy`; confirm a clean worktree and HEAD equal to origin/main. Do not deploy Pages manually. This Worker has its own deployment.

The browser suite defaults to Chromium. Set `ACCOUNT_TEST_BROWSER` to `firefox` or `webkit` to run it in another engine, after installing that engine with Playwright. Responsive checks cover 16 viewport sizes, including a short viewport representing an open mobile keyboard.

Email requires enabled Email Sending and verified SPF/DKIM records for archerlab.dev. The binding only allows login@archerlab.dev. If delivery fails, the challenge is discarded and no session is created.

Local security and browser tests use the real Worker and D1 runtime with a test-only transport adapter. They never send mail or introduce a production bypass. Production verification must also check actual mailbox delivery and an interactive Google sign-in; local tests cannot prove those external steps.

If a route causes an origin regression, remove that route from this Worker and deploy the clean main configuration. Existing app sources and original hosting are preserved.

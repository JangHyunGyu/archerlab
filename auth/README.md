# ArcherLab account

Self-hosted Google OIDC and passwordless email sign-in, with SSO for the services linked from archerlab.dev. Cloudflare hosts the Worker and D1 database and delivers transactional email; it does not manage user authentication.

Each frontend includes a deferred, silent session script in its own HTML. The script never adds an account button, stylesheet, overlay, or layout observer. Its background work starts after load or during idle time. Guests use one account status request and stay on their service; signed-in users establish a service session through sessions.archerlab.dev. Pages and GitHub Pages serve their own HTML and assets without an account Worker proxy. Existing Pages functions, game saves, anonymous sessions and app APIs keep their current behavior. Separate domains and unlisted projects have no routes. Unlisted games receive no session script or SSO return destination.

The hub owns the visible login and account entry, in its original navigation. It works with DNS-only hosting and is never replaced by injected UI. Its private cross-origin status request updates the label; it does not grant permissions. `/account` displays account details for signed-in users and the sign-in form for guests.

## Routing verification

Keep the hub's `@` records and the nine registered static-service CNAMEs DNS-only. SSO does not require proxying their pages and images. The account Worker owns only the `account` and `sessions` custom domains; Wrangler manages their DNS. `sessions/<service>/_account/{session,prepare,complete}` accepts only POST requests from that service's exact Origin, with credentialed CORS. Existing service targets must be preserved. `news` is itself a Worker origin and cannot be changed to DNS-only like a Pages CNAME.

The manually dispatched Service DNS routing workflow uses the repository's existing Cloudflare credential. It defaults to read-only inspection. Changes are restricted to seven known Pages CNAMEs and two GitHub Pages CNAMEs, and update only `proxied` after checking their exact targets. A switch to DNS-only is skipped unless that service's live HTML contains its native session script. It preserves the account domains, unrelated projects, mail records, Worker origins, and the hub.

Before removing the former frontend Worker routes, deploy the session custom domain and confirm every linked HTML page includes its native `data-archerlab-account` script. Then remove frontend routes and revoke legacy child sessions with `DELETE FROM sessions WHERE parent_hash IS NOT NULL AND hash NOT LIKE 'gateway:%'`. Central sessions and new gateway sessions remain valid; replay of former frontend cookies is rejected by the distinct gateway hash prefix.

After DNS propagates, check each service's session POST through the sessions host and confirm its script adds no visible UI. Verify central sign-in and logout with real local sessions, and check the native hub link through public DNS. A forced address is only a diagnostic comparison and cannot prove the production path.

## Security boundary

- Account cookies live only on account.archerlab.dev. Service browser and session cookies live only on sessions.archerlab.dev, with a separate name for each registered service. All are host-only, Secure, HttpOnly and SameSite=Lax; no Domain cookie is used. Frontend requests carry no gateway credentials, and tokens never enter localStorage.
- Service sessions reference a central session. Signing out revokes its service sessions immediately. Other devices remain signed in.
- Every exchange uses a short-lived, one-time code and a request tied to a host-only browser cookie and registered return destination. SQL consumption is atomic.
- Mutations require an exact Origin and a browser-bound HMAC CSRF proof. Account CORS only allows the registered service origins.
- Email challenges expire after 10 minutes, allow five attempts, and store keyed signatures. Issuing a new challenge replaces the previous one. IP, address, browser and global send limits constrain abuse.
- Google uses authorization code + PKCE, state and nonce. jose verifies signature, issuer, audience, authorized party, token age, expiry and verified email. Existing email accounts and third-party Google email addresses require fresh email proof before linking.
- Status uses POST because existing service workers cache GET responses. Auth documents carry a restrictive CSP and no analytics.
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

Do not reintroduce frontend proxy routes to add account UI. Frontends own their visible controls; the account Worker owns only account documents and private session APIs.

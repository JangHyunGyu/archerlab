# Session rollout and performance verification

Observed on 2026-10-04 from the user's Windows PC, using Playwright Chromium and
Chrome DevTools Protocol. These are measurements, not promised load times.

## Changes

- Keep the visible login/account control in the hub's own header. Service pages
  use a deferred silent script with no injected button, CSS, overlay, or observer.
- Serve static frontends directly from their existing Pages or GitHub Pages
  origins. Session exchanges use the private sessions.archerlab.dev gateway.
- Remove ten frontend account-Worker routes. Temporarily retain the Chatbot route
  until its native script reaches production through Git deployment.
- Keep the hub DNS-only. Switch eight verified static CNAMEs to DNS-only without
  changing their targets. Chatbot remains proxied pending its native deployment;
  news, account, and sessions remain proxied because they are Worker origins.
- Fetch Jewelria navigation from the network before using its offline fallback,
  so a cached former account overlay cannot persist. Shared game service workers
  exclude account paths. Golf's SDK cache exclusion reached production through
  Cloudflare's Git build for commit 900a99e6a4a2fafed65bd1159283179f7de244bb.

## Observed page timings

Each URL was visited sequentially in a new browser context, with normal public
DNS. FCP is the first contentful paint; load is the document's load event. The
scripts also record HTTP status, request origins, edge locations and layout
bounds. App service-worker reloads and browser resource caching can affect these
samples; they are not a controlled cold-cache benchmark. An unfinished load
means the event did not occur within the sample window, not a zero-second load.

All twenty pages returned HTTP 200. Static Pages requests changed from the
proxied zone's LAX edge to their direct ICN edge. News still follows its own
Worker route. Chatbot's pending Git deployment prevents the same routing change.

| Page | Before FCP (s) | After FCP (s) | Before load (s) | After load (s) |
| --- | ---: | ---: | ---: | ---: |
| archerlab.dev | 4.13 | 3.82 | 5.71 | 5.37 |
| nevergrad.archerlab.dev | 1.78 | 1.01 | 5.49 | 2.25 |
| karma.archerlab.dev | 1.57 | 1.04 | 3.45 | 1.69 |
| harem.archerlab.dev | 2.06 | 0.92 | 12.73 | 2.40 |
| cupid.archerlab.dev | 1.26 | 0.95 | 4.18 | 1.82 |
| chatbot.archerlab.dev | 1.16 | 4.20 | 4.29 | 3.59 |
| golf.archerlab.dev | 1.36 | 0.19 | 4.62 | 0.28 |
| itstory.archerlab.dev | 1.60 | 1.24 | 2.93 | 2.37 |
| news.archerlab.dev | 1.00 | 1.05 | 1.59 | 1.39 |
| chat.archerlab.dev | 3.59 | 0.83 | 3.89 | 0.81 |
| game.archerlab.dev/water-sort | 1.50 | 0.45 | 2.28 | 1.73 |
| game.archerlab.dev/lumen-shift | 8.75 | 0.68 | unfinished | unfinished |
| game.archerlab.dev/jelly-pang-2048 | 1.88 | 0.86 | 9.22 | 1.97 |
| game.archerlab.dev/school-zombie-defense | 2.58 | 0.33 | 6.91 | 2.21 |
| game.archerlab.dev/jewelria | 2.83 | 0.43 | unfinished | 1.39 |
| game.archerlab.dev/parking-escape | 6.08 | 2.50 | 7.71 | 4.28 |
| game.archerlab.dev/cat-tower | 0.99 | 0.49 | 3.41 | 1.60 |
| game.archerlab.dev/slimevolley | 1.37 | 1.09 | 2.33 | 1.73 |
| game.archerlab.dev/blockpang | 1.42 | 1.77 | 2.32 | 2.19 |
| game.archerlab.dev/solo-leveling | 2.00 | 0.38 | 8.05 | 1.29 |

The hub's first after sample includes a 3.13 s origin-response outlier. Three
subsequent fresh browser contexts measured FCP at 0.79, 0.67 and 0.84 s, with
TTFB at 0.35, 0.13 and 0.18 s. No speculative DNS address changes were made.
Chatbot and BlockPang did not improve in the displayed FCP sample; no universal
speedup is claimed.

## Layout and session checks

- Nineteen live service pages, guest and member states, sixteen viewport sizes:
  608 layout checks, with no injected account controls or horizontal overflow.
  They use the real local account Worker/D1 runtime and a test-only mail
  transport while loading production frontend HTML, styles and assets.
- The hub and account pages passed 432 state/viewport checks across Chromium,
  Firefox and WebKit, including long profile fields and a short viewport
  representing a mobile keyboard.
- Twenty-seven security/protocol tests and eight browser tests in each of those
  three engines passed. Tests cover concurrent service tabs, one-time exchanges,
  cookie isolation, old-cookie replay, CSRF/origin rejection, email-code retries,
  guest access, packed-document initialization, existing saves and central logout.
- Public-DNS session requests passed for all ten service keys. Responses use
  host-only Secure/HttpOnly/SameSite=Lax cookies and exact credentialed CORS.
  Foreign and mismatched service origins are rejected.
- The distribution manifest covers 73 linked HTML entry files and ten identical
  native SDK copies. Unlisted games, projects and separate domains are excluded.

Local mail fixtures do not verify delivery to a real mailbox or an interactive
production Google sign-in. No production sign-in credentials were automated.

## Git deployment state

Karma, Golf and Chatbot are still Git-connected Pages projects, with production
branch main, production deployments enabled and all build paths watched. Their
source configuration was checked against the actual GitHub repository IDs.
Karma's static output is built with npm run build into dist.

A multipart branch=main request asks Cloudflare to clone and build the configured
Git repository; it does not upload local Pages assets. This succeeded for Karma
and Golf. Chatbot still reports that it cannot access main although GitHub
confirms the branch exists. These retries prove the Git build path for two
projects, not restoration of deployment on a Git push.

Automatic push deployment for all three still needs the Cloudflare Workers and
Pages GitHub App's repository access checked and saved for karma, golf and
chatbot. Do not uninstall the App or remove other selected repositories. Verify
a new Git push creates a Cloudflare deployment with its exact commit SHA before
claiming the automation is repaired. Manual Pages uploads were not performed.

After Chatbot's native script is visible in its production HTML, remove its last
frontend account-Worker route, deploy the account Worker, and run the guarded DNS
workflow for Chatbot. The readiness check must continue to skip an old frontend.

## Evidence

The ignored local test-results directory contains services-before.json,
services-after.json, session-layouts.json, live-gateway.json, live-entry.json,
deployment metadata and screenshots. Auth .test-build contains validation logs.
These artifacts are intentionally not committed because they contain temporary
runner data and browser captures. The application and protocol tests remain in
the repositories.

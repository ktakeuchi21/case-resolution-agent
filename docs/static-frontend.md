# Static frontend and workspace startup

Public entry: [Open Pathway Agent](https://case-resolution-frontend.onrender.com). The free Render Static Site serves only `dist/web` through the CDN. Launch waits for backend readiness, then opens the requested workspace at https://case-resolution-agent.onrender.com. The owner approved this routing adjustment after the initial static rewrite buffered streaming updates. All **31 deployed transport checks passed** on the new arrangement. The backend address also remains a working standalone fallback.

## Latest application release

The Conversation Launchpad follow-up is live on both services at `a63de727aa2bc52c01cadca939dfa42b5c77ba1a`. It fixes return navigation and in-page upload expiry. The September 9 follow-up passed 31/31 public transport/security checks and 16/16 CDN asset checks; desktop first contentful paint measured 176 ms. See `conversation-launchpad.md` for release IDs, interface acceptance and the remaining default-provider budget pause. The initial hosting measurements below remain retained historical evidence.

## Initial static release configuration

Both services were manually deployed from revision `2a79b56e8bbecc94916c69c708ddabde0694b056` on September 9, 2026:

| Service | Render service ID | Deployment | Result |
| --- | --- | --- | --- |
| Backend, Docker Free / Oregon | `srv-dag1p2v40ujc73delf20` | `dep-dagr8tqjnfac73crpqu0` | Live, 19:33 UTC, 35.9 s |
| Static frontend | `srv-dagqrdmk1f9s73clchk0` | `dep-dagr9n2jnfac73cs10h0` | Live, 19:34 UTC, 20.6 s |

The static service builds with `npm ci --ignore-scripts --no-audit --no-fund && npm run build`, Node 24.20.0, publish directory `dist/web`, and automatic deployment Off. Backend and database resources remain unchanged; the provider cap stays **100**. Public assets contain no provider/database credentials. Render configuration is recorded in `render.yaml`.

The frontend uses the uncached `/healthz` rewrite for readiness. The earlier `/api/*` rewrite and exact `FRONTEND_ORIGIN` permission remain for candidate compatibility; current workspace navigation never uses the API rewrite. Sessions, CSRF, upload/download and conversation requests originate at the backend address. Secure, HttpOnly, SameSite=Strict cookies remain first-party there. No CORS relaxation or token transfer was introduced. Both origins retain the existing CSP and browser security headers; health, API, error, upload, download and stream responses use `no-store`.

## Connection and navigation

The overview paints before any backend dependency. After first paint, one shared readiness attempt calls `/healthz` without credentials or caching. Valid JSON must identify `pathway-agent` and `status: ok`; sleeping-service HTML does not count. Checks use a 15-second request timeout and 2/5/10-second retry delays within the bounded attempt. Successful readiness is reused for 30 seconds; there is no continuous keep-alive. Page close cancels requests and retries.

Workspace entry immediately shows the existing branding and “Preparing your workspace…”. After ten seconds it explains “The demo is waking up. This can take about a minute.” Status is accessible, motion respects reduced-motion preferences, and progress percentages are not invented. Retry and Back to overview remain available after failure. Back during startup cancels pending entry.

Once ready, `web/hosting.js` constructs a destination using fixed HTTPS origins and allowlisted workspace routes/scenarios. Only the selected scenario and a public startup timestamp accompany the route; no cookie, CSRF token, case identifier or private state moves between origins. Arrival removes these public parameters. The timestamp preserves the 90-second entry deadline across navigation; Retry starts a fresh bounded connection attempt. Arbitrary query/hash text cannot change the destination origin.

The backend restores its own session and creates a case only if absent. New golden-scenario visitors retain knowledge selection; existing sessions retain the requested route. Repeated clicks share one connection attempt. If a creation response is lost, Retry reads back the possibly committed case and never automatically replays its POST. If no case exists after an attempted creation, the visitor explicitly returns and launches again. Backend creation remains serialized and conditional on the current session workspace.

The static history entry becomes the overview before navigation, so browser Back does not trigger a redirect loop. Workspace portfolio/overview links return to the static site. Old sessions created at the earlier static candidate hostname are not migrated; the backend restores sessions already belonging to its hostname.

## Verification

- Type checking: passed.
- Core tests: **81 passed**.
- Application/security tests: **26 passed**, using the existing local verification database.
- Startup browser regression: **19/19 passed**, `artifacts/mvp/static-startup-8caf530c4e28e9cbe1f163de34a66ab1041536ddc3cc2ae681b9ccc6c7b3973a.json`.
- Origin-handoff browser checks: **23/23 passed**, `artifacts/mvp/static-handoff-f5488319b2a585973a7aec61e788d72f2592470c2f7aced35e822cc2084de88b.json`.
- Public rollout: **31/31 passed**, `artifacts/mvp/static-rollout-34da3ef5674b70b8d505cc7a146f591c4a402ad2418665be01860cc32ed84d99.json`.
- CDN assets and private-path exclusion: **15/15 passed**, `artifacts/mvp/static-assets-12094effed931f7b7658d56299efbd65e2795823e1ae24233826a603889190d0.json`; all 11 published frontend files match the release build.
- Public entry after a 16-minute idle interval: **6/6 passed**, `artifacts/mvp/static-idle-launch-82180a0da41ff9f734d797d2c9b5790ed15c113eaf57efae785980335abfad7a.json`.
- Production build: **246 files**, **160 validated retained embedding records**.
- Secret/artifact hygiene: passed. No workflow or database contract changes were made.

Local checks cover unavailable readiness, immediate/delayed Launch, direct links, returning sessions, repeated clicks, deadline across origins, timeout/retry, cancelled entry, no POST replay, browser Back, exception scenario, malicious redirect text, reduced motion and visible controls at 1440/768/375 pixels. The handoff test intercepts both production origins and serves actual local assets/fixture APIs; it sends no requests to the public services. One initial check selected a hidden mobile sidebar link and was corrected to the visible portfolio link. The reused local database subsequently hit its unchanged session-rate limit. A fresh retained local verification database was created through the existing empty-database migration test (passed); no database or history was erased. Unsuccessful traces remain retained.

The public checks verify the actual origin change, absence of frontend session cookies, backend cookie flags, missing/wrong/session-swapped CSRF rejection, forged-origin and cross-site rejection, unchanged workflow after rejections, distinct visitor cases, isolated upload lists/downloads, exact original-byte download, temporary-file deletion, direct-link restoration, uncached streaming, responsive layouts and no browser exceptions. The stream stage arrived at **115.6 ms**, with its separate final result at **1,010.4 ms**.

## Performance measurements

On the released revision, fresh-context desktop Chrome first contentful paint was **392 ms**, with the hero observed at **608 ms** and HTML first byte at **198 ms**. No CPU/network throttling was applied. These are observed samples, not a global percentile or one-second guarantee. Earlier static-candidate measurements were 140–552 ms.

After a **16-minute interval without requests from the verifier**, a fresh browser visit painted the landing page at **376 ms**, observed its hero at **646 ms**, and displayed the workspace loading screen at **760 ms**. Readiness succeeded at **13.910 seconds** and backend knowledge selection opened automatically at **17.165 seconds**. All six checks passed: subsecond landing, backend workspace arrival, no frontend session request, one case creation, uncached health and no browser errors. No model calls occurred. Other visitors can prevent Render from sleeping, and no independent host sleep-state API was used; the observed delay is consistent with a free-service wake-up. The earlier candidate's first forwarded readiness request took 13.287 seconds. Controlled-unavailable local checks also establish that landing rendering does not await readiness.

## Why the initial routing changed

The original static rewrite candidate passed 28/29 deployed checks but failed progressive delivery: its stage and final answer arrived together. Disabling client compression and temporarily adding standard buffering headers did not resolve it. The original failure remains in `static-transport-be0cdd380d3a3575f6dc95950a0ef2a72e9a07e698076e8acf030e7461cafa4e.json`; the direct-versus-proxy comparison remains in `static-stream-comparison-be639fd2d78445ddd474b9986b0daddc56a94a0407e14150d7b8b6e18a7c65cc.json`. [Render support documents this static-rewrite limitation](https://community.render.com/t/http-stream-buffering-in-static-site-rewrite/22299). Promotion was held until the owner approved the backend workspace adjustment and the new transport checks passed.

## Limits and operation

Warm-up makes no model calls. Deployed transport tests explicitly selected evidence mode in their own synthetic sessions, used retained vectors and recorded zero model requests. They do not establish live conversational quality. The separately documented provider-schema error and incomplete contextual acceptance remain unresolved; see `contextual-verification.md`. Model choice, budget, governing evidence, deterministic effects and database permissions are unchanged.

Deploy matching frontend/backend revisions manually, then verify both addresses and the selected interaction path. Update `web/hosting.js` explicitly if either public origin changes. Do not enable keep-alive polling to avoid free-service sleep. The backend URL is the fallback if static hosting fails.

The native browser CLI repeatedly disconnected on long batches in the earlier increment. `scripts/browser/run-static.mjs` uses the established standalone Playwright fallback in a new credential-free browser. Supply the installed Playwright module path and `startup`, `handoff` or `rollout`. The historical `transport` group intentionally verifies the now-unused API rewrite and retains its buffering failure. Browser profiles and temporary screenshots are not published.

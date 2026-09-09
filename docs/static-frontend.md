# Static frontend and workspace startup

The frontend is deployed as a free Render Static Site from `dist/web`. Its public assets contain no provider or database credentials. The existing free Docker backend and database continue serving governed application requests. **Public-link promotion is held:** the deployed rewrite preserves sessions and security, but buffers streamed status updates until the final response. The original backend address remains the public link.

Review-only candidate: https://case-resolution-frontend.onrender.com. Existing public application: https://case-resolution-agent.onrender.com. Both services run revision `969c46cee3a5912acb39c441f7ba7fd6d2a3ac22`. The static deployment is `dep-dagqrduk1f9s73clcih0`; the matching backend deployment `dep-dagqv2upcuac73a9g6b0` succeeded on September 9, 2026 at 19:12 UTC in 30.9 seconds. Both use manual deployment. Backend Free and daily provider cap **100** were read back from Render after deployment; `FRONTEND_ORIGIN` is the exact static HTTPS origin.

## Connection behavior

The landing page renders before any session request. After its first paint, one shared readiness check calls `/healthz` without credentials or caching. A valid response must identify the Pathway service and report `status: ok`; HTML from a sleeping service is not readiness. Attempts use a 15-second request timeout, 2/5/10-second retry delays and a 90-second overall bound. Successful readiness is reused for 30 seconds. There is no recurring keep-alive.

Workspace entry waits for readiness, restores the session and creates a case only if absent. The loading screen appears immediately, explains slow starts after ten seconds, and offers Retry/Back after failure. A retry reads back a possibly committed creation; it never repeats an attempted creation POST. If none exists, the visitor explicitly returns and launches again. Back cancels entry, and page close stops readiness requests. New visitors keep the knowledge-selection flow. Existing sessions restore their requested route.

## Deployment contract

`render.yaml` records both services. The static build uses the existing build command and publishes only `dist/web`, with Node 24.20.0 and manual deployment. Configure two rewrites: `/api/*` to the backend's `/api/*`, and `/healthz` to its health route. Keep API and readiness responses `no-store`, and apply the existing CSP and browser protections to the frontend.

Set backend `FRONTEND_ORIGIN` to the exact assigned static HTTPS origin. Existing `PUBLIC_ORIGIN`/Render backend-origin validation stays in place; only the configured additional origin is accepted. No wildcard CORS or cookie-policy relaxation is used. Cookies, CSRF, uploads, streaming and isolation must pass through the real deployed rewrite before the new URL is promoted. Existing backend hosting remains available as a fallback. Sessions on a new hostname are separate; no session tokens are moved between hostnames.

The free backend and daily provider limit of 100 remain unchanged. Readiness and the local verification make no model calls. The previously documented provider schema rejection and incomplete conversational qualification are separate issues.

## Verification checkpoint

- `npm run typecheck`: passed.
- `npm test`: 81 passed.
- `node scripts/db/with-verification.ts app`: 26 passed, using the retained fully migrated local database.
- `npm run build`: passed, 245 packaged files and 160 validated retained embedding records.
- `node scripts/verify-hygiene.ts`: passed.
- Startup browser checks: 19/19 passed in `artifacts/mvp/static-startup-c40db30a6da90390cacd86fa3fc681712b69cf4fed0fcf5e771deb93a0bca4b1.json`. These use actual frontend/session behavior with locally controlled readiness delays, not live model-quality evidence.
- Manual inspection: loading layout at 375×812; automated overflow and control visibility at 375/768/1440 widths, with reduced-motion behavior verified.

## Deployed transport and performance

The full deployed browser report is `artifacts/mvp/static-transport-be0cdd380d3a3575f6dc95950a0ef2a72e9a07e698076e8acf030e7461cafa4e.json`: **28/29 passed**. Secure, HttpOnly, SameSite=Strict cookies are scoped to the frontend hostname. Missing/wrong CSRF, forged origin and cross-site metadata are rejected. Isolated visitors receive separate cases; uploads cannot be listed or downloaded by another visitor. Synthetic TXT upload, exact original download, temporary-file deletion and direct workspace session restoration pass. Health, API, errors, uploads, downloads and NDJSON carry `no-store`. Desktop/tablet/mobile layouts fit at 1440/768/375 pixels, with no browser exceptions. The original backend frontend still works.

In fresh headless Chrome contexts on the local desktop connection, first contentful paint was **552 ms** and **140 ms**, with the hero observed at **787 ms** and **230 ms**. The first sample is retained in `static-transport-93039deef06b5a2293c11dc4730dad3db764a5770ce14d6078b4864fdbb2f440.json`; the second is in the full report above. These are two unthrottled observations, not a percentile or universal one-second guarantee. A first forwarded readiness request took **13.287 seconds**; this is consistent with waking an idle backend, but no independent Render sleep-state observation was captured. Local controlled-unavailable checks demonstrate that landing rendering does not await that request. A fully observed post-idle end-to-end launch remains part of final rollout qualification.

The failed check is progressive streaming. A browser receives the `retrieving` stage and complete result together after 727 ms (1,356 ms in the initial run). Direct-backend comparison receives the stage separately at 108 ms and the result at 812 ms; the static rewrite combines them at 660 ms. Compression-disabled requests and a temporary static `no-transform`/`X-Accel-Buffering: no` header experiment did not fix this; the temporary headers were removed. The backend already emits `X-Accel-Buffering: no`. [Render support describes static rewrite buffering as not customer-configurable](https://community.render.com/t/http-stream-buffering-in-static-site-rewrite/22299). This is a platform transport failure, not a reason to relax CSRF or cookie restrictions.

All deployed verification used explicit evidence mode in separate synthetic sessions with retained query vectors, and recorded zero model requests. It is transport evidence only. The provider schema error and incomplete contextual acceptance remain as documented in `contextual-verification.md`.

The compression-disabled comparison is retained in `artifacts/mvp/static-stream-comparison-be639fd2d78445ddd474b9986b0daddc56a94a0407e14150d7b8b6e18a7c65cc.json`, with reproducible probe source in `scripts/browser/static-stream-probe.mjs`.

The recommended alternative is to keep the CDN landing page and readiness/loading screen, then navigate to the existing backend workspace after readiness succeeds. This would preserve first-party sessions and progressive streaming at the backend address, but changes the approved same-address workspace design. That product decision has been requested; it is not assumed or deployed. Until it is resolved, do not replace README/portfolio public links with the candidate URL.

The native browser CLI passed isolated checks but repeatedly disconnected during the large batch. `scripts/browser/run-static.mjs` runs the identical check source in a new, credential-free browser as a fallback. Supply the installed Playwright module path and `startup` or `transport`. Browser profiles and temporary output are not published.

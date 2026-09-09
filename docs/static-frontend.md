# Static frontend and workspace startup

The frontend is independently deployable as a free Render Static Site from `dist/web`. Its public assets contain no provider or database credentials. The existing free Docker backend and database continue serving governed application requests. Deployment and public proxy qualification are pending until the final verification checkpoint below is recorded.

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

The native browser CLI passed isolated checks but repeatedly disconnected during the large batch. `scripts/browser/run-static.mjs` runs the identical check source in a new, credential-free browser as a fallback. Supply the installed Playwright module path and `startup` or `transport`. Browser profiles and temporary output are not published.

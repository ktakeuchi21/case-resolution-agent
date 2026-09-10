# Production package and deployment runbook

This is a public **synthetic portfolio demonstration** package, not a production pharmaceutical platform. It requires the existing restricted PostgreSQL/pgvector application database. A successful local build is not a deployment. Hosting/account blockers and provider prerequisites are tracked in [deployment feasibility](deployment-feasibility.md).

## Build and inspect

Use Node 24.12 or later and the locked dependencies:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:generation
npm run test:app
npm run build
```

Database-backed application tests require the local migration/setup described in [persistence runbook](persistence-runbook.md). The build does not connect to a database or an LLM. It compiles TypeScript with `rewriteRelativeImportExtensions`, preserving the directory layout and replacing relative `.ts` imports with emitted `.js` imports. [TypeScript compiler documentation](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html)

`dist/` contains compiled server/domain/provider code, the compiled one-time database CLI, reviewed synthetic fixtures, validated cached embeddings, web assets, immutable SQL migrations and the public Supabase CA certificate in `config/supabase-ca.crt`. The CA certificate is public trust material, not a client credential or private key. `dist/build-manifest.json` records SHA-256 and size for every packaged runtime file plus the count of validated embedding records. Rebuilds replace only a recognized generated `dist/` directory. Historical Phase 2A–2D artifacts are never copied or modified.

The build rejects symlink assets, unrewritten imports, missing runtime files, invalid embedding records, disallowed private file paths and recognizable credential patterns. This is a packaging check, not a complete secret detector. It does not copy environment files, `.local`, PostgreSQL data, prior artifacts, tests, source maps or developer caches. The reviewed embeddings in `fixtures/embeddings` are deliberately packaged synthetic-corpus inputs, with existing model/configuration/content integrity checks; they are not a writable runtime cache or an authority store.

## Runtime

```sh
npm start
```

The start command runs `dist/src/app/server.js`. Source, web and fixture directories outside the generated package are not required at runtime. Installed production dependencies (`pg`, `zod`, and their lockfile-resolved dependencies) remain required. Static files are served only from the packaged web directory, never from the package root.

Configure these names using the host's secret/environment controls. Never put secret values in command history, source files or public output:

| Variable | Configuration |
| --- | --- |
| `NODE_ENV` | `production` on the hosted service; enables Secure cookies and HSTS |
| `HOST` | `0.0.0.0` on Render; use loopback for ordinary local development |
| `PORT` | Render assigned port, default Blueprint value `10000` |
| `PUBLIC_ORIGIN` | Optional on Render when `RENDER=true` and the supplied `RENDER_EXTERNAL_URL` validates as an exact HTTPS origin under `.onrender.com`; otherwise set the exact HTTPS origin, with no trailing slash. HTTP loopback is permitted only for local verification. |
| `PATHWAY_DATABASE_URL` | Restricted `pathway_app.<project-reference>` session-pooler login to the dedicated synthetic database on port 5432; URL query options are rejected |
| `PATHWAY_DATABASE_PROFILE` | `supabase-pg17-vector082` for this hosted project; explicitly checks PostgreSQL 17.6, vector 0.8.2 and extension schema `extensions` |
| `PATHWAY_DATABASE_CA_FILE` | `/app/dist/config/supabase-ca.crt` in the Docker runtime; required by the hosted profile |
| `PATHWAY_ADMIN_DATABASE_URL` | Migration environment only; never present in the running public service |

The current deployment uses the server-side configured `gpt-4.1-mini-2025-04-14` conversation provider with a durable daily cap of 100, an 18-second request deadline and a 4,800-output-token limit. Provider credentials stay in Render secret configuration. Retrieval keeps the governed durable entry point and reviewed cached embeddings; provider failure pauses explicitly, without automatic model retries or an undisclosed weaker fallback. The earlier deterministic evidence explanation remains a separately labeled mode, not proof of live model quality. See [contextual verification](contextual-verification.md) for current acceptance limits.

The application offers cryptographic anonymous demo sessions, not production employee identity verification. Demo-role switching affects only a server-selected synthetic workspace. Request, body, concurrency, session and storage limits remain necessary; inspect current `src/app/session.ts` and `src/app/service.ts` and the public threat model before deployment. HTTPS is required for hosted session cookies. A plain-HTTP local test with `NODE_ENV=production` can inspect headers and static files, but browser cookie behavior must be tested over HTTPS or with the documented local-development environment.

## One-time database preparation

Choose only a clearly identified new/dedicated Pathway Agent database. Local verification remains pinned to PostgreSQL 18.6/vector 0.8.6. The dedicated Supabase project `qabaroofmvrzyuwuxndy` exposes PostgreSQL 17.6/vector 0.8.2. The explicit hosted profile passed [hosted frozen parity](../artifacts/phase2c/parity-84c57174e5f418c904098e085b2f6d0fa85bec756f1342225ee98969d65826b1.json): 23 references and 108 retrieval comparisons, with no ranking differences. Migration success alone would not qualify retrieval quality. Never edit applied migration checksums or disable RLS to force compatibility.

For an approved, empty hosted project, load administrator connection settings from protected, ignored local files without printing them or placing values in shell history. Set the hosted profile and CA-file path, then run from the source checkout:

```sh
node scripts/db/bootstrap-hosted.ts qabaroofmvrzyuwuxndy
```

This guarded bootstrap verifies the project-specific administrator login, empty application schemas and exact PostgreSQL version, installs vector 0.8.2 in `extensions`, then applies all eight unchanged SQL migrations and checks an identical second migration run. Migration 001 retains its original vector 0.8.6 request; `IF NOT EXISTS` skips the already verified extension, so the profile check supplies the explicit version validation. Do not rerun the empty-project bootstrap against an existing deployment; use the normal checksum-checked migration command. The bootstrap source script is an operator tool and is not packaged into the web container.

The hosted bootstrap and idempotent rerun succeeded: [immutable bootstrap artifact](../artifacts/phase2c/hosted-bootstrap-0291b3a8a0d317dd19781aabd7b72046746bae2eb6e18e5bbcfaf6685c60262d.json). The restricted runtime role was separately checked: LOGIN enabled; superuser, BYPASSRLS, CREATEDB, CREATEROLE and INHERIT disabled; no memberships or application-schema ownership. Supabase default API grants on the public migration ledger were found and removed, and the ledger now forces RLS. Effective `anon`/`authenticated` privileges on application tables and the ledger were verified absent. These hosted hardening steps preserve the eight migration files; the deployment audit must verify them again before release.

Client-to-session-pooler TLS on port 5432 was verified with certificate and hostname checks using the official Supabase CA. Its SHA-256 certificate fingerprint is `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`. The database-side `pg_stat_ssl` observation reported `backend_tls=false`; this does not establish encryption between the provider pooler and PostgreSQL. Do not describe the connection as verified end-to-end TLS.

From a protected migration environment that contains the generated package and production dependencies:

```sh
cd dist
node scripts/db/cli.js migrate
node scripts/db/cli.js status
```

The migration CLI reads `PATHWAY_ADMIN_DATABASE_URL` from that environment. It runs ordered, checksum-checked migrations and redacts raw driver failures. Do not configure migrations as public API actions or automatic server-start behavior. Remove administrator credentials before starting the web process. The guided-demo service creates only reviewed synthetic workspaces through the runtime role. Do not seed a shared real-data database.

Test empty-database migration, runtime role restrictions, exact retrieval/citation parity and session isolation against the selected deployment database before public access. Running an existing local test database does not prove Supabase compatibility.

## Container and Render

`Dockerfile` is a multistage Node 24 Debian-slim image. Build dependencies stay in the build stage. The runtime stage installs only locked production dependencies with lifecycle scripts disabled, copies `dist`, runs as the non-root `node` user and exposes a database-aware `/healthz` check. Neither stage references secret build arguments. The Node 24 base tag intentionally receives patched images; record/pin the resolved image digest during an actual deployment for reproducibility. Docker is not required for the JavaScript build.

`.dockerignore` uses a source allowlist and additionally excludes environment files, private-key files and local state. Never add secret files to the build context. Render makes environment variables available as build arguments, so do not introduce credential-bearing `ARG` declarations. [Render Docker documentation](https://render.com/docs/docker)

`render.yaml` defines the free Docker backend and a free static frontend publishing only `dist/web`, both with automatic deployment disabled. The backend keeps its hosted database profile, CA path, manual runtime database secret and `/healthz`. Its origin may use Render's validated platform-supplied URL; `FRONTEND_ORIGIN` permits only the exact additional static origin. The blueprint provisions no database, paid worker, custom domain or preview fleet. The backend remains Oregon/Free and the provider cap is 100. During first setup `sync: false` fields prompt for values; later additions require manual environment management. [Render Blueprint reference](https://render.com/docs/blueprint-spec)

The September 9 static frontend is the public entry at https://case-resolution-frontend.onrender.com. Launch waits for readiness and navigates to the backend workspace; this approved adjustment avoids static-rewrite streaming buffers. All sessions, uploads and conversation requests use the backend origin. The previous `/api/*` rewrite remains for candidate compatibility, but current navigation never uses it. Keep https://case-resolution-agent.onrender.com as the working fallback. See [static frontend verification](static-frontend.md) for exact service/deployment revisions, configuration and measured results. Release matching frontend/backend revisions manually and repeat cookie/CSRF/isolation/upload/download/stream checks for changed routing. The fixed public addresses live in `web/hosting.js`; custom domains require a reviewed update there as well as Render configuration.

Free service sleeping/ephemeral-disk limits mean timers cannot promise continuous wall-clock execution. Durable workflow work remains in PostgreSQL and must catch up safely when processing resumes. Do not use keep-alive traffic to defeat host limits. See the feasibility document for free-database capacity, inactivity and backup limitations.

## Release verification and rollback

Before a public release, record the build manifest and runtime image identity, then verify health, response headers, authenticated session boundaries, guided SC-01 completion, human pause/resume, source retirement/history, sandbox nonauthority, reset/idempotency and responsive keyboard behavior at the actual HTTPS URL. Capture deployed screenshots. The first Render Docker build/container startup and HTTPS health checks passed; hosted browser acceptance is tracked in the release evidence.

Rollback the application image to a previously verified build only after checking schema compatibility. Database migrations are append-only; there is no destructive automated downgrade. Do not drop a database, erase historical evidence, or reset another environment as a recovery shortcut. The public service has a lifetime capacity of 128 workspace reservations to bound immutable canonical storage. The owner approved the increase from 64 on September 10, 2026 after the database reached 64 reservations and approximately 78 MiB. This does not change the provider cap of 100, Free hosting or existing history. Session expiry removes access and temporary metadata, not canonical evidence. When capacity is exhausted, the owner must explicitly approve a bounded capacity change or provision/rotate an identified dedicated synthetic database; there is no public-delete control. A capacity pause remains visible until that authorized operator decision.

## Packaging verification recorded locally

The earlier production build emitted 212 runtime files and validated 160 cached embedding records. A copied compiled package was run from an unrelated temporary directory: HTML/JavaScript/CSS and a read-only health query to the existing local PostgreSQL database succeeded, while four source/fixture/environment paths returned 404. This checks actual packaged asset/module paths independently of the checkout. The September 8 rerun passes 80 unit tests; the 84 local database/workflow/generation/application checks also passed. The final package contains 215 files and 160 validated vectors. Hosted regression passes 71 tests with one intentional extra-database skip, and 23 reference/108 retrieval comparisons preserve exact rankings, governance and citations. Docker is unavailable locally; Render successfully built the image, launched the container and passed health checks for commit `22db28a`. Hosted migration/bootstrap, retrieval qualification and HTTPS checks passed. Hosted browser acceptance passed; see [the release record](hosted-verification.md). Rebuild after subsequent source or frontend changes before treating the manifest as final.

Public question privacy boundary: only the reviewed frozen synthetic questions, supplied literal/sandbox prompts and the explicitly labeled cache-failure probe are admitted. Other text is rejected before durable evidence/answer storage; no heuristic patient-data detector is used. The public API counts all attempted writes against a durable150-attempt session cap even when a later application transaction rolls back. Session refreshes share the normal read limiter.


September 8 database release gate: [hosted qualification report](../artifacts/mvp/hosted-database-qualification-7761ac4f9bc7b6c55a4d3f82e87f4118259a9201eb0d37b54ce307cb4c9ec6df.json) records passing hosted access/RLS, exact vector/citation fidelity, immutable workflow links and retirement/history checks. The 459 vectors were verified using round-trippable float output; the audit changes only transaction-local formatting. Render secret import, deployed HTTPS and browser checks passed; see [hosted verification](hosted-verification.md).


## September 10 verified Launchpad release

The owner-approved capacity change from 64 to 128 lifetime workspaces is deployed without deleting history or changing Free resources or the daily provider cap of 100. The aggregate snapshot at 19:26 UTC recorded 72 workspace reservations and 87 provider request reservations for the day. The capacity is a lifetime bound, not an automatically replenished session allowance.

Verified runtime: `0aa0143ce0ffa2feb0e98440ccae50915db86b65`, backend `dep-dahg60fqj5pc73aiq810`, static `dep-dahg64n40ujc73aj0pdg`. All 285 automated tests, 28/28 public Launchpad checks and 31/31 public transport/security checks pass. Desktop first contentful paint was 368 ms in the final warm/fresh-browser sample; this is not a guaranteed cold-start or model latency. The earlier idle-start measurement remains in the static frontend report.

The public journey is **[overview](https://case-resolution-frontend.onrender.com) → Launch → Use sample knowledge → What document is missing?** The workspace shows the role, AI purpose, knowledge coverage and four prompts before the first message, then retains a compact context bar. Change role, Change knowledge and View context remain available. Governed packs and temporary sandbox documents retain their existing authority boundaries.

Manual public navigation and desktop/tablet/mobile screenshots were inspected. The visible evaluation report retains the failed/incomplete broader multi-turn comparison; accepted Launchpad behavior is not general conversation-quality certification. See [the acceptance audit](launchpad-acceptance-audit.md) for the complete A–H mapping and artifact paths. The final report/evaluation release below contains the same runtime source as this tested revision.

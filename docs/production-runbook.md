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

`dist/` contains compiled server/domain/provider code, the compiled one-time database CLI, reviewed synthetic fixtures, validated cached embeddings, web assets and immutable SQL migrations. `dist/build-manifest.json` records SHA-256 and size for every packaged runtime file plus the count of validated embedding records. Rebuilds replace only a recognized generated `dist/` directory. Historical Phase 2A–2D artifacts are never copied or modified.

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
| `PUBLIC_ORIGIN` | Exact HTTPS public origin, with no trailing slash; required origin boundary (HTTP localhost only for local production verification) |
| `PATHWAY_DATABASE_URL` | Restricted `pathway_app` login to the dedicated synthetic database, using verified TLS |
| `PATHWAY_ADMIN_DATABASE_URL` | Migration environment only; never present in the running public service |

No OpenAI key is configured in the public deployment. Guests use reviewed cached embeddings and visibly deterministic evidence explanations. Unknown queries can pause on cache miss; the server does not silently substitute lexical retrieval or make paid provider calls. The optional server-only OpenAI explanation adapter is not enabled by this package.

The application offers cryptographic anonymous demo sessions, not production employee identity verification. Demo-role switching affects only a server-selected synthetic workspace. Request, body, concurrency, session and storage limits remain necessary; inspect current `src/app/session.ts` and `src/app/service.ts` and the public threat model before deployment. HTTPS is required for hosted session cookies. A plain-HTTP local test with `NODE_ENV=production` can inspect headers and static files, but browser cookie behavior must be tested over HTTPS or with the documented local-development environment.

## One-time database preparation

Choose only a clearly identified new/dedicated Pathway Agent database. Validate PostgreSQL/pgvector versions, extension schema/search path, role creation permissions, TLS and session advisory locks as described in the feasibility preflight. The migrations currently request vector 0.8.6. A hosted incompatibility is a deployment blocker; never edit already-applied migration checksums or disable RLS to force it through.

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

`render.yaml` defines one free Docker web service with automatic deployment disabled, manual origin/runtime-database environment entries and `/healthz`. It provisions no database, paid worker, custom domain or preview fleet. It is a reviewed template, not proof of available account capacity or a live service. Confirm free-resource/overage settings and service-name ownership before applying it. During first setup `sync: false` fields prompt for values; later additions require manual environment management. [Render Blueprint reference](https://render.com/docs/blueprint-spec)

Free service sleeping/ephemeral-disk limits mean timers cannot promise continuous wall-clock execution. Durable workflow work remains in PostgreSQL and must catch up safely when processing resumes. Do not use keep-alive traffic to defeat host limits. See the feasibility document for free-database capacity, inactivity and backup limitations.

## Release verification and rollback

Before a public release, record the build manifest and runtime image identity, then verify health, response headers, authenticated session boundaries, guided SC-01 completion, human pause/resume, source retirement/history, sandbox nonauthority, reset/idempotency and responsive keyboard behavior at the actual HTTPS URL. Capture deployed screenshots. No live URL or container execution is claimed by this runbook.

Rollback the application image to a previously verified build only after checking schema compatibility. Database migrations are append-only; there is no destructive automated downgrade. Do not drop a database, erase historical evidence, or reset another environment as a recovery shortcut. The public service has a lifetime capacity of 64 workspace reservations to bound immutable canonical storage. Session expiry removes access and temporary metadata, not canonical evidence. When capacity is exhausted, the owner must explicitly provision/rotate an identified dedicated synthetic database; there is no public-delete control. A capacity pause remains visible until that authorized operator decision.

## Packaging verification recorded locally

The production build emitted 212 runtime files and validated 160 cached embedding records. Type checking and all twelve generation tests passed. A copied compiled package was run from an unrelated temporary directory: HTML/JavaScript/CSS and a read-only health query to the existing local PostgreSQL database succeeded, while four source/fixture/environment paths returned 404. This checks actual packaged asset/module paths independently of the checkout. Docker is unavailable in the current environment, so an image build/container boot has not been verified. Render Blueprint account-side validation, hosted migrations and deployed HTTPS browser verification remain external gates. Rebuild after subsequent source or frontend changes before treating the manifest as final.

Public question privacy boundary: only the reviewed frozen synthetic questions, supplied literal/sandbox prompts and the explicitly labeled cache-failure probe are admitted. Other text is rejected before durable evidence/answer storage; no heuristic patient-data detector is used. The public API counts all attempted writes against a durable150-attempt session cap even when a later application transaction rolls back. Session refreshes share the normal read limiter.

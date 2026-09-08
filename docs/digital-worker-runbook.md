# Digital worker operator runbook

## Build and schema

Use Node 24.12 or newer. Run `npm ci --ignore-scripts`, `npm run typecheck`, `node scripts/verify-worker.ts`, and `npm run build`. Production packages only emitted JavaScript, approved web assets, fixture JSON, SQL migrations and the database CA certificate. The manifest checks packaged vectors and disallowed secret patterns. Production health identifies `digital-worker-v1` and checks conversation/upload schema readiness.

Apply migrations through 012 with the existing administrator-only migration workflow before deploying the new container. Never edit an applied migration. The public runtime continues to use the restricted database role; administrator credentials never belong in the Render runtime. These additions are compatible with the previous app’s data. Preserve prior sources, vectors, releases and evidence.

The deployment source is the existing `.local/deployment-source` Git checkout. Synchronize source, tests, documentation, web, migrations, package manifests and build configuration using the private synchronization helper. It rejects overwriting retained artifacts. Review the staged diff and file inventory before pushing. Use the existing Free Render service with automatic deployment Off; select the verified commit explicitly. Do not create a paid service or new database as a shortcut.

## Optional model configuration

Live calls remain disabled unless all four server settings are valid:

- `OPENAI_API_KEY`: set privately in Render Environment; never in chat, source, logs or screenshots.
- `PATHWAY_LIVE_GENERATION=enabled`.
- `PATHWAY_PROVIDER_DAILY_REQUESTS=100` (allowed 1–500).
- `PATHWAY_PROVIDER_SESSION_REQUESTS=40` (allowed 1–80).

This is one configuration action in the existing service’s Environment panel, followed by its rebuild/restart. Do not enable calls without an authorized account budget. Each embedding, synthesis and support-review request reserves capacity before dispatch. Reservations survive process restart and errors; failed requests are not automatically refunded or retried. One synthesized answer normally makes two generation requests, plus any missing embeddings. Large new documents may exhaust a small request budget and pause. Server concurrency remains two active API requests. Provider selection and credentials cannot be supplied by a visitor.

Provider output limits are 2,400 tokens/request, 100 KB response body and 18 seconds/request. The synthesis context cap is 48 KB. Each response exposes actual model/method, prompt version, context/evidence hashes, token usage, request count and elapsed composition time. Cost is unknown unless the adapter has a pricing basis; never infer billing from a unit-test fixture. The built-in cue classifier and explicit deterministic composition have no model cost. Normal conversation defaults to live synthesis when configured; the Supervisor can inspect or approve bounded defaults in Agent Settings. The published evaluation separates the frozen cached embedding benchmark, deterministic contract tests and the small measured live conversation qualification. See the current conversation acceptance record; the earlier provider-v2 failures remain retained evidence.

## Upload retention and operational checks

Originals, normalized passages, temporary vectors, sandbox tests, derived sandbox conversation turns and review previews expire with the four-hour session. Expired records become inaccessible immediately. Cleanup runs every five minutes while the server runs and at startup; an asleep Free instance deletes them when it wakes. The visitor can delete owned temporary data sooner. Reprocessing and metadata changes clear temporary indexes and approval. Explicitly published synthetic versions, release/reviewer records, governed evidence and conversations remain historical records behind the session boundary. Original binaries are not part of the immutable release; normalized source text and its original hash are.

Capacity remains three uploads/session, 1 MB/file, 60 entries/conversation, 150 write attempts/session and 64 total reserved workspaces. Immutable history is not erased to replenish capacity. The portfolio owner must plan an explicit retention/rotation change when that bounded deployment fills.

Check `/healthz`, the role selector, a cached cited question, refresh persistence, provider failure without fallback, the actual file parser, reviewer approval/publication/assignment, retirement and historical evidence after deployment. Use the browser at desktop, tablet and mobile widths and verify the skip link, keyboard focus, dialogs, route error cleanup and console. A compiled parser must be exercised from the production build because its worker path changes from `.ts` to `.js`.

## Incident behavior

Unavailable provider: preserve current case state and pause source-based work; do not silently choose lexical retrieval. Lexical Studio exploration requires its own explicit acknowledgment and still cannot authorize an effect. Uncertain model support: suppress claims in the primary answer and retain the failed output only in advanced audit. Ambiguity: distinguish conversational clarification from the assigned operational human task. Missing/retired/conflicting authority: retain historical answers, recheck current state and prevent new dependent effects. Review `docs/persistence-runbook.md` for database qualification and `docs/sc01-state-machine.md` for workflow invariants.

The conversation API and session notice require migration 012 before the new container. See [conversation behavior and acceptance](conversation-experience.md). A previous container can continue running against the additive schema.

## Free-instance startup

No migration, database seed or provider call runs before the HTTP listener. Current-authority reads are batched without caching an authorization snapshot. Readiness schema checks use one database round trip. A retained cold-instance request took 12.307 seconds; the awake public fast path took 13.237 seconds from Launch to its first cited answer. Neither is a service-level guarantee. Render Free idles after 15 minutes and may take roughly a minute to wake. Optional manual choice: change this service’s **Compute** plan to the smallest paid instance for always-on availability (an ongoing monthly compute charge, independent of workspace-plan features and provider usage). No upgrade was performed. See [Render Free documentation](https://render.com/docs/free) and [current pricing](https://render.com/pricing).

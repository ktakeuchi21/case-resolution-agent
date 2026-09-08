# Local PostgreSQL and pgvector runbook

This setup was verified on macOS arm64 with PostgreSQL **18.6**, pgvector **0.8.6**, Node **24.20.0**, `pg` **8.16.3** and `@types/pg` **8.15.5**. Package versions are locked. Docker was absent, so no container image, Docker service or volume was introduced.

## Start, migrate and seed

Install the native dependencies if absent:

```sh
brew install postgresql@18 pgvector
npm ci
npm run db:start
npm run db:health
npm run db:migrate
npm run db:status
npm run db:seed
```

The verified Homebrew installation also added krb5 1.22.2, json-c 0.19, libunistring 1.4.2 and gettext 1.0. Homebrew created its standard unused `/opt/homebrew/var/postgresql@18` cluster. Pathway uses its own `.local/postgres/data` instead and does not register a Homebrew service. Homebrew auto-updated its package metadata during installation; unrelated repositories were not edited.

The launcher requires PostgreSQL 18.6; migrations request vector 0.8.6. If Homebrew now provides another revision, obtain the reviewed pinned binaries or deliberately update and revalidate the pins. Do not silently skip the version check. Other native platforms may set `PATHWAY_PG_BIN` to a directory containing the same PostgreSQL/pgvector build. That alternative is documented but was not exercised here; Docker remains optional future setup, not a prerequisite or a claimed test result.

The project database listens only on a private Unix socket, nominal port 55432, with TCP disabled. `.local/postgres` and its socket directory are mode 0700. Local trust is restricted by the owning OS account; this is development authentication, not a network service or enterprise identity system. There is no database password in the repository.

`PATHWAY_DATABASE_URL` and `PATHWAY_ADMIN_DATABASE_URL` are optional empty placeholders in `.env.example`; without them the driver uses the project socket, `pathway` database and separate `pathway_app`/`pathway_owner` roles. The runtime rejects a superuser, BYPASSRLS or schema-owner identity. Never use the migration credential for retrieval. The code does not automatically load environment files. Credentials, if supplied for another explicitly configured environment, belong in the shell/secret manager and must not be logged.

Each migration runs transactionally under a migration lock and stores its checksum. Re-running skips identical applied migrations; changing an applied file fails. Add a new ordered migration instead. Seed imports validated canonical fixtures with a fixed fixture hash/version and immutable IDs. Same seed is idempotent; a changed fixture cannot reuse the same workspace. `npm run db:seed -- another-workspace` creates a distinct synthetic dataset.

## Verification and demonstrations

```sh
npm run typecheck
npm test
npm run test:postgres
npm run eval:postgres
npm run demo:postgres
npm run audit:postgres
```

`npm test` remains credential-free and does not connect to PostgreSQL. Database tests use deterministic unit vectors, explicitly unsuitable as retrieval-quality evidence. The integration suite also creates a fresh retained verification database, runs the full migration sequence twice and checks deterministic seed behavior. Tests create unique workspaces; nothing deletes a database or volume automatically.

`eval:postgres` reuses all 23 original reference definitions and compares the frozen 36 queries under lexical, semantic and hybrid against both in-memory execution and preserved live rankings. It needs the existing 160 Phase 2B cache records under ignored `.local/embeddings`. No API is called, and missing cache data is a failure rather than synthetic quality substitution. Original Phase 2A/2B artifact-writing commands should not be run to refresh their frozen exports.

`demo:postgres` publishes/assigns the seeded SC-01 release, obtains a hybrid recommendation, reconstructs every repository/pool, reads history, retires the source, denies operational reliance from a sandbox replacement, then exercises both commit orderings. It observes a blocked advisory-lock waiter and records transaction IDs/order. It reconstructs repositories again and checks durable history/retirement. It does not execute case actions.

`audit:postgres` is an explicitly privileged read-only audit. It validates stored canonical rows, decisions, evidence hashes/quotations, vectors, migration checksums and RLS/role configuration. Its counts include repeated test workspaces, not independent patient-access trials. New machine artifacts are exclusively created at `artifacts/phase2c/<kind>-<sha256>.json`; failed partial runs remain labeled and preserved. The original lexical/live Phase 2B artifacts are never overwritten.

## Stop, restart and recover

```sh
npm run db:stop
npm run db:start
npm run db:health
npm run db:status
```

After running the demonstration, the actual server-restart gate is `npm run db:stop`, `npm run db:start`, then `npm run verify:restart`. It checks that the database startup time follows the saved demo and verifies old evidence plus active retirement.

Stopping preserves all data. The local launcher is not a startup service. An incomplete first initialization was retained in `.local/postgres/incomplete-init-preserved`; it is not a database or a source of authority. Do not point the application at it.

For a failed transaction, use its safe operation/error code and migration/run history. Transaction rollback exposes no partial evidence. A committed duplicate request returns the original record with `historical: true`; issue a new request ID for new reliance after retirement. If commit acknowledgment is lost, retry the same request ID to resolve the committed result. Do not manufacture a success on a connection or cache failure.

Do not edit a corrupt vector/evidence body or disable immutability triggers to make tests pass. Stop dependent work, preserve the affected files/rows for investigation and restore from a trusted validated source. A new embedding configuration/version is explicit reindex work; cached-only execution will fail if required vectors are missing. Backup restoration and destructive corruption recovery have not been validated in this phase.

A **manual full development reset**, only when intentionally requested, is to stop PostgreSQL and move the entire `.local/postgres` directory to a new retained backup name before starting/migrating/seeding again. For example, after confirming the destination does not already exist:

```sh
npm run db:stop
mv .local/postgres .local/postgres-retained-before-reset
npm run db:start
npm run db:migrate
npm run db:seed
```

This is documentation, not an automatic action. It preserves the old cluster and creates a new one. Do not delete retained test databases, old clusters or cached vectors unless their removal is separately intended. `.local/`, `.env` and `.env.*` are ignored; force-add and privileged filesystem access can bypass that protection.

Before deployment, add authenticated scope binding, appropriately separate credentials/services, encrypted network connections, backup/restore and retention tests, runtime timeout/load measurements and an operational revocation SLO. The current coarse transaction lock and fixture identities intentionally make none of those production claims.

## Phase 2D workflow operations

`npm run db:migrate` now applies six migrations; never edit an applied file. `npm run test:workflow` runs 30 additional PostgreSQL-backed checks; it requires the existing synthetic embedding cache and performs no live API calls. `npm run workflow:demo` creates eleven independent workspaces and immutable traces/metrics under `artifacts/phase2d`. Repeated runs create fresh evidence; they do not delete or overwrite earlier artifacts.

The new worker is a bounded poll, not an installed service: `npm run workflow:tick -- <workspace> <synthetic-ISO-time>`. Advance only a named demo workspace and stay within the documented September fixture calendar. Timer claims use durable expiring leases; interrupted claims can be acquired again after expiry. A stale lease cannot fire, and a fired timer cannot generate another logical reminder. Stable external-effect IDs and provider reconciliation handle uncertain delivery. Never manually reset an attempted effect to queued.

`npm run audit:workflow` verifies journal chains, schemas, invariants, grants, exact evidence/run links and every recorded effect authorization. The original `audit:postgres` checks canonical source/citation fidelity and all table RLS. Both are privileged read-only audits with immutable new outputs. `scripts/workflow/reconstruct.ts` reconstructs a named case in a new Node process. The demonstration also reopens pools and checks child-process hashes during human pause, timer acquisition and crash recovery.

Cancellation stops queued work and timers, but does not erase a prior send. Attempted effects may still be reconciled without reviving the case. A rejection or missed acknowledgment leaves the dependency open and routes an exception. A failed semantic branch is visible; lexical use needs an exact-request acknowledgment or durable policy grant. No human can waive source governance. Real adapters, authentication, broader calendars, backup recovery, high-concurrency queue sizing and production delivery/revocation latency remain unverified.

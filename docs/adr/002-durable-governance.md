# ADR-002: local durable governance and exact pgvector retrieval

Status: implemented for the synthetic headless prototype, September 7, 2026 (MDT). D-31/D-32 extend ADR-001; no hosted deployment decision is exercised here.

Use PostgreSQL 18.6 and pgvector 0.8.6, with the existing BM25 and equal-contribution RRF branches. `PersistentRetrieval` defaults to hybrid, depth 50, RRF constant 60 and no cutoff. The old in-memory factory retains lexical defaults for historical controls. No PostgreSQL full-text replacement, ANN index, reranker or rewrite is introduced.

Docker and PostgreSQL were absent. Homebrew was available, so the verified setup uses native binaries and project-owned data. It binds a private Unix socket with TCP disabled; no Homebrew service or login startup is registered. The versions are pinned by the local launcher and extension migration. PostgreSQL lists 18.6 in its [release archive](https://www.postgresql.org/docs/release/); pgvector's [upstream installation instructions](https://github.com/pgvector/pgvector) support the selected PostgreSQL major and native installation. See the runbook for the exact tested versions and alternatives.

## Transaction rule

Every runtime operation uses one checked-out connection. Begin READ COMMITTED, set transaction-local workspace/tenant/environment, acquire a transaction advisory lock keyed by that scope, then load and validate governance. Hold the lock through ranking, four decisions, evidence/diagnostic/audit/idempotency inserts and commit. Return a result only after commit. Mutation repositories acquire the same lock. Database triggers also lock and advance the durable generation for canonical/event/membership inserts. Connection use follows [node-postgres's transaction contract](https://node-postgres.com/features/transactions).

A retirement committed before this post-lock governance snapshot is visible and blocks reliance. An evidence transaction that acquires the lock first can commit its valid historical decision before the waiting retirement. Later decisions then see retirement. There is no earlier repeatable-read snapshot taken while waiting. PostgreSQL documents [transaction advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS) and [READ COMMITTED statement snapshots](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED).

| Operation | Atomic boundary |
| --- | --- |
| Publish release | Validate source identities/provenance and sealed manifest; insert immutable release, membership and attributed publication event together. Reusing an ID with different content fails |
| Assign release | Validate case, tenant and releases; insert assignment, release links, a case-context revision and assignment event. Never mutate a pinned historical case or grant a user new release access implicitly |
| Retire | Authorize publisher/target; append unique retirement event and operation audit. Replays are idempotent; the version and old evidence remain intact |
| Supersede | Verify same-document approved successor and absence of cycles; append transition event. Policy projects its effective timestamp without rewriting version or manifest history |
| Evidence / operational decision | Evidence, canonical reference links, four decisions, escalation, run diagnostics, audit and idempotency key commit together. Corrections reference earlier evidence through a scoped FK and rerun current gates. There is no action executor |
| Duplicate import | Compare immutable entity IDs and hashes; exact imports reuse rows and a deterministic import-operation identifier; changed content at an existing ID fails |
| Duplicate retrieval | Scope + actor + request ID resolve one immutable payload fingerprint/run. Changed input/configuration fails. A replay is explicitly `historical: true`; it is not fresh authorization after retirement |

This coarse lock favors inspectability over throughput. A slow embedding call can delay retirement within that scope; lock/statement timeouts fail explicitly. Different scopes use different locks. High-load throughput, long-provider-call scheduling, crash injection and availability are not validated. Do not add a cache path that bypasses the post-lock decision snapshot.

## Isolation and immutability

All domain tables have workspace/tenant/environment ownership, forced RLS, explicit scoped queries and composite foreign keys where canonical entities link. The runtime role has no superuser/BYPASSRLS/schema ownership, DELETE, UPDATE of immutable records, or TRUNCATE privilege. Update/delete triggers also reject owner writes to published releases and evidence. Database administrators can still alter schema or disable triggers; this is not WORM or a cryptographically signed ledger.

RLS is enforced in PostgreSQL, with [the documented owner and bypass behavior](https://www.postgresql.org/docs/18/ddl-rowsecurity.html). It remains dependent on trusted server selection of session scope. The application role can set its own scope variables; possession of that database credential is not constrained like a browser end-user identity. Fixture actors and local OS-account trust are not production authentication. Separate hosted projects/credentials, real identity binding, least-privilege publisher services, backups and retention remain deployment work.

## Retrieval and numeric parity

PostgreSQL searches only canonical passage IDs already approved by Pathway's metadata/assignment gates, additionally constrained by RLS, content hash and embedding configuration/key. It performs exact cosine distance with pgvector. Identity and passage validation still run after retrieval. Similarity never establishes case, communication or action permission.

The preserved 36-query comparison gives 108 identical rankings across lexical/semantic/hybrid and unchanged governance outcomes. pgvector uses float32 accumulation where Phase 2B JavaScript used doubles; the maximum observed raw-cosine difference is **0.0000017044883838801539**. An initial 1e-6 arithmetic assertion failed and its partial artifact was retained. Each SQL score was then independently checked against float32 accumulation, consistent with the [pinned upstream implementation](https://raw.githubusercontent.com/pgvector/pgvector/v0.8.6/src/vector.c). The storage comparison permits 1e-5 against double arithmetic and 1e-7 against that replay; ranking and governance parity stay exact. This is not retrieval-threshold tuning.

## Failure and degraded operation

Hybrid branch failure produces a visible pause; a database error rolls back and returns no committed evidence. Missing cache entries use a provider only when explicitly injected by a trusted caller. The default prototype and verification commands use cached-only embeddings and never load an API key or fabricate vectors.

Lexical requires a per-request acknowledgment: actor, request ID, time/expiry, reason and original failed run when applicable. A named system policy also needs a durable, bounded grant issued by a publisher/evaluator for that actor/request. Its ID alone is not authorization. Record requested hybrid/effective lexical, configuration and failure linkage. Every governance check reruns. Acknowledgment cannot supply a missing grant or revive retired/sandbox authority.

Next decision: **A, a synthetic headless SC-01 workflow state machine**, using committed evidence and separate action-bound permissions. Retain additional hardening as a gate before external deployment; do not begin UI, generation or real outreach.

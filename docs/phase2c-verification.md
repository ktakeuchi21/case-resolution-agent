# Phase 2C verification — local durable governance

**Phase 2C is complete within the requested local, synthetic, headless scope.** PostgreSQL persists active governance, immutable history and the selected pgvector semantic component. The durable application entry point defaults to unthresholded hybrid. BM25/RRF and the canonical Phase 2A/2B artifacts remain unchanged.

| Gate | Result |
| --- | --- |
| Type checking | Passed |
| Existing automated tests | 67/67 passed |
| PostgreSQL integration tests | 24/24 passed |
| Migrations from an empty database | All 4 applied; second application/checksums and deterministic seed passed |
| Original governance comparisons | 23/23 in-memory versus PostgreSQL passed |
| Frozen retrieval comparisons | 108/108 passed: 36 queries × lexical/semantic/hybrid |
| Retrieval order differences | **0**, including comparison with preserved live rankings |
| Expected final outcomes | Lexical 31/36; semantic 36/36; hybrid 36/36 |
| Governance/citation parity | Eligible sets, exclusions, four decisions, conflicts, abstentions, exact citations and action proposals match |
| Repositories reconstructed twice | Historical evidence and active retirement retained |
| Actual PostgreSQL server stop/start | Verified server start occurred after the demo; original evidence and active retirement survived |
| Controlled concurrency | Both retirement-first and evidence-first pass; a blocked lock waiter was observed |
| Immutable records | Runtime privileges and owner-level triggers reject update/delete; runtime TRUNCATE denied |
| Provider/degraded behavior | Hybrid failure pauses; lexical requires acknowledgment; system policy requires durable scoped grant; unrelated failed-request linkage rejected |
| Secret/artifact hygiene | Passed; no new real patient/proprietary data; frozen files remain byte-identical |
| Lint | Not configured; not run |
| Additional live embedding calls | **0** |

[The parity artifact](../artifacts/phase2c/parity-c54a8fb16b8d37df924c99806f2bf16a7a64bff6ca171aaba0b7ac70ebf29dcf.json) includes full records and run IDs. The original 23 cases reuse their existing definitions; the 36-query variants/labels/configurations are untouched. Database unit tests use clearly labeled deterministic vectors. The retrieval comparison uses the previously measured OpenAI vectors, not those unit vectors. Counts are overlapping regression checks, not independent pharmaceutical safety trials.

## Restart, race and audit evidence

[The restart/concurrency trace](../artifacts/phase2c/restart-concurrency-a423cd0cc2a252dede88ea5338f70c0ad0bf542405490c099dd996a56324b11a.json) contains publication/assignment, an approved recommendation, repository reconstruction, exact historical read, retirement, paused retry, sandbox denial and both controlled races. Transaction IDs and observed lock waits show why the first committer's result is valid. Subsequent requests observe retirement. Duplicate requests return historical records; they cannot be treated as new action authority.

[The server-restart check](../artifacts/phase2c/server-restart-e5b22755d7ed3685e781ba41f6a62714a2e082d7a2d2d6d72c13ea2b84f81c38.json) verifies an actual database process restart after that demonstration. [The fresh-database artifact](../artifacts/phase2c/empty-database-792c5827b1ce6cfe8c91e83ae885cef9e6d9de0ccfb92427bac1ce1acac50db8.json) verifies the full ordered migration sequence from an empty database. [The database audit](../artifacts/phase2c/database-audit-fb58d939c357593bd342624be38fe8a8ff512c22e4ca3ab1e908035e388d48b2.json) validates 471 stored evidence records, 1884 decision rows and 799 vector rows, plus canonical rows, lifecycle/run schemas, exact quotations, hashes, RLS, role permissions and migration checksums. These totals include retained test workspaces and earlier valid partial runs.

## Numeric investigation and resolved failures

The first storage comparison stopped at Q01/semantic because a raw cosine differed from JavaScript double arithmetic by 0.0000015454036114137537, exceeding an initial 1e-6 assertion. The partial result was preserved in `artifacts/phase2c/parity-incomplete-*.json`. pgvector's float32 dot-product/norm accumulation reproduced the observed scores independently. Across the full set the maximum difference is **0.0000017044883838801539**, with no ranking or governance differences.

The corrected arithmetic comparison allows 1e-5 against double precision and 1e-7 against independently replayed float32 accumulation. It does not alter a similarity cutoff, fusion setting, expected outcome or query. The rejected 0.35 configuration remains rejected and absent from prototype defaults. See [ADR-002](adr/002-durable-governance.md) for the implementation/source reasoning.

Initial TypeScript compilation errors were corrected before final checks. Initial local initialization left an incomplete directory; it was preserved and a fresh initialization succeeded. Private-socket commands required normal Codex permission escalation. No failed gate remains within the tested local scope.

## Delivered boundaries and limitations

PostgreSQL stores documents/versions/passages, collections, packs/releases/membership, assignments/case revisions, source lifecycle events, embedding identity/vectors, retrieval diagnostics, four decision records, evidence/reference links, escalations, audit and idempotency. Update/delete triggers and restricted operations enforce immutability; new versions/events preserve prior records. RLS, scoped queries and composite foreign keys enforce workspace/tenant/environment boundaries.

This is not production-ready isolation. The trusted backend sets RLS scope; someone holding its database credentials can set a different scope. Fixture identities are not real authentication. Administrative schema access can disable protection. Coarse locking may delay revocation behind a slow request; production latency/load, crash/power-loss recovery, backup restoration, retention and hosted separation were not tested. SQL corruption rolls back rather than returning a partial success. No action executor exists.

The Git ignore matcher confirms environment files and `.local/` database/cache/retained-cluster paths are ignored; `.env.example` and synthetic review artifacts remain exportable. Secret-pattern checks passed without exposing values. This checkout has no `.git`, so tracked/staged-state inspection is unavailable; force-add can bypass ignore rules. Finder `.DS_Store` metadata is excluded from canonical artifact preservation checks.

The local PostgreSQL server is running on its project-private socket, with TCP and login startup disabled. `npm run db:stop` stops it while retaining data. [The runbook](persistence-runbook.md) documents exact versions, start/migrate/seed/test/stop, manual reset and recovery limits. [The data model](data-model.md) maps tables to contracts.

## Next-phase decision

**A: SC-01 workflow state machine**, kept headless and synthetic. Durable revocations/history, deterministic race handling and preserved retrieval now support testing the persistent missing-document dependency. Add versioned states/events, accountable ownership, action-bound permission/approval, mock receipts, idempotent transitions and restart/resumption tests. Historical evidence replays must never substitute for fresh action authorization.

Controlled generation and an interface remain deferred. Additional persistence hardening is required before deployment, but the measured local gates do not require delaying the synthetic state-machine contract. No next-phase implementation has begun.

[Machine-readable verification](../artifacts/phase2c/verification-67fec2a653350977b09f9f5a496caf6f3a0000dbec579e48a68a9b5d9e88b858.json) records checks, preserved artifacts, initial failures and untested areas.

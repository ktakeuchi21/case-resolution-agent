# Phase 2D verification: persistent SC-01

**Complete within the requested local, synthetic, headless scope.** SC-01 reaches **Documentation dependency resolved; prior authorization pending** through governed evidence, separate operational permission, simulated delivery, human verification and a matching receiving acknowledgment. It never represents receipt as payer approval.

| Gate | Measured result |
| --- | --- |
| Type checking | Passed |
| Original automated tests | 67/67 |
| Existing PostgreSQL tests | 24/24 |
| New workflow tests | 30/30 |
| Empty database migrations and repeat seed | All six migrations applied twice/checksummed; deterministic seed and workflow-grant replay passed |
| Original governance comparisons | 23/23 |
| Frozen lexical/semantic/hybrid comparisons | 108/108; zero ranking differences |
| Original outcomes | Lexical 31/36; semantic 36/36; hybrid 36/36, unchanged |
| Required scenario traces | Eleven passed, covering ten requested scenarios with both concurrency orderings |
| Process/repository reconstruction | New pools and separate Node-process snapshot hashes during golden, human pause, timer and crash paths |
| Actual database restart | PostgreSQL stopped/started; all eleven demonstration timelines reconstructed in their recorded states |
| Evidence/citation audit | Passed: exact canonical text, locators, hashes, four decisions, migration checksums and forced RLS |
| Workflow audit | Passed: journal chains, schema/invariants, scoped run/evidence references, effect approvals, receipt records and caller-security queue views |
| Existing artifact preservation | All 43 pre-session artifact/fixture/migration/core-contract files checked byte-identical |
| Secret/ignore checks | Passed; environment/cache/database paths ignored, example secret fields empty, no real patient or proprietary data introduced |
| Additional embedding calls | 0; preserved real vectors reused |
| Lint | Not configured |

Tests are overlapping synthetic regressions, not independent pharmaceutical safety trials. The snapshot/cached-vector checks do not measure fresh provider variability or production performance.

## Inspectable traces

| Scenario | Result and immutable trace |
| --- | --- |
| Golden path | [PA_PENDING after office verification and exact receiver acknowledgment](../artifacts/phase2d/golden-a7e07a92396287422fb5bac01bb2710a1021e34304d3369e1603d1aab6a72fac.json) |
| Ambiguity/resume | [Restarted human task, authorized clarification, fresh checks and no duplicate outreach](../artifacts/phase2d/human-pause-resume-04d0265cbb60a53059ca83ae39b2d37d268ee2a0b35d7393c15f767dfc8ee4e4.json) |
| Mid-case retirement | [Later transfer pauses; initial evidence remains exact](../artifacts/phase2d/retirement-10ce6586f8580245aaf77d528d1139087fad5a2f6f90827b74ed2e91dc81fadf.json) |
| Duplicate document/ack | [One logical intake/transition with suppressed duplicates audited](../artifacts/phase2d/duplicates-81d8d8fea0fdde9e1fc33a56e063a8d576614e658cd0ac5e8ba6afce33adf21f.json) |
| Dispatch crash | [Independent simulated receipt survives local rollback; reconciliation precedes continuation](../artifacts/phase2d/crash-recovery-7f14628feb4ceeff91971fbbcc247aa7de5c1b6610bfbde587b525a54c146550.json) |
| Receiving rejection | [Delivered transfer rejected; dependency stays open and escalates](../artifacts/phase2d/rejection-301ac4d1c82ccd8da5329ffc7195022e3ee6793c67ad66d0205dec1353ca4cd1.json) |
| Timer/restart | [Lease reacquisition, stale-token rejection, one second reminder and no third](../artifacts/phase2d/timer-280e076169f2e0fe8812e4d706230d2578c760ab2a674560844d90d082fe8711.json) |
| Provider failure/degraded policy | [Visible hybrid pause; publisher-authorized one-request lexical resumption](../artifacts/phase2d/provider-failure-92a5700a51a04d545fcda7edc3621b5495696d2336ae3e1d98e2ec3e0d886a79.json) |
| Cancellation | [Pending second reminder cancelled; later dispatch denied](../artifacts/phase2d/cancellation-48ae6edc1dec802d00351c2458fd8101225c9088bff5982b8a1082d937a6b67a.json) |
| Retirement first | [Observed blocked lock waiter; human resolution pauses without a transfer](../artifacts/phase2d/concurrency-retirement-first-e1efc3602c9341ec643ecd0ee7396716dd6579cca849988c167e0ef98e375808.json) |
| Resolution first | [Historical queue decision valid; retirement blocks subsequent dispatch](../artifacts/phase2d/concurrency-resolution-first-d2c58c3425603f92c6806e6e6f4db709d727313bd49820139f6747a0c5fd2d26.json) |

Each trace includes the command/event timeline, snapshot, evidence/run records, exact source passages and four governance decisions, effect authorization and next-best action. [Labeled synthetic metrics](../artifacts/phase2d/operational-metrics-labeled-55d0e62a95683a915d4085c931fd7a87d5ea6e572b77a86acb8c5670e7e489ba.json) distinguish scenario/workspace. Four of eleven intentionally varied cases complete; three pause, two escalate, one cancels and one ends with explicitly degraded work queued. This distribution measures the chosen failure-injection script, not real-world effectiveness. The golden path's eight synthetic minutes are injected-clock progression, not observed staff productivity.

Additional boundary tests cover wrong actors/recipients/packages, approval expiry, changed case context, grant revocation, unresolved authoritative conflict, malformed/reused IDs, premature acknowledgments, missing acknowledgments, human SLA escalation, retry exhaustion, unknown status, reconciliation after cancellation, RLS/immutability, bounded worker polling and single-case instance uniqueness. A final review fixed terminal exception acceptance: the assigned supervisor can record ownership while the workflow remains escalated/failed; this never releases operational actions.

## Regression and audit evidence

[Parity](../artifacts/phase2c/parity-4931eec5c02594a403c6932605e8db4b2c70300590192cc27bd97c59269e6862.json) reuses the original 23 reference definitions and frozen 36-query set. BM25/RRF, labels, thresholds and canonical corpus are unchanged. Exact cosine retains the previously explained float32 difference, at most 0.0000017044883838801539; no ranking or governance changes were needed.

[Actual database restart](../artifacts/phase2d/server-restart-aaeedd89f474c353a8428b8e73b5eb7ffb8270d01e3e5a8b229e9e57ccc1bc84.json) verifies PostgreSQL started after the saved demonstration and reconstructs all eleven histories. [Evidence audit](../artifacts/phase2c/database-audit-540f8bf11e7fae65c369a7c0cb7e67746263b8809a26065eab6def8b2ecfac23.json) validated 1107 evidence records and 4,428 separate determinations plus canonical/vector rows. [Workflow audit](../artifacts/phase2d/workflow-audit-7ef800ace08afaaac72f0821b754c08ebb7774466cc551beaf06de6f4ed2dbae.json) verifies retained journal snapshots and permission/evidence links. Audit totals include retained development/test workspaces and repeated references, not independent trials.

Initial TypeScript narrowing errors were corrected before test execution. A broad secret-pattern scan matched an internal `sk-` substring in an existing gstack test filename; inspection confirmed a path, and token-boundary matching eliminated the false positive without exposing a credential. A preliminary completion manifest remains preserved; the final manifest below includes the subsequent exception-ownership fix and its test.

## Delivered boundary and next decision

Use the [state-machine specification](sc01-state-machine.md), [developer guide](developer-guide.md) and [runbook](persistence-runbook.md) to run or change the workflow. The implementation adds two migrations, strict workflow schemas, append-only repository, transaction-composed retrieval, independent simulated integrations, structured human tasks, durable leases/inbox/outbox, bounded worker, deterministic next action and metrics. Earlier artifact files remain immutable. No new dependency, global configuration, hosted service, GUI, generated answer, real communication or real PA submission was added. PostgreSQL remains running on the project-private socket.

Limitations are explicit: fixture actor IDs are not authentication; the operations policy/calendar is a bounded September 2026 simulation; full snapshots and coarse locks are unmeasured at scale; independent simulated receipts are not a real network integration; power-loss, backup restore and production load/security are not established. An unknown delivery escalates for reconciliation rather than being relabeled failed or resent. No exactly-once external-delivery claim is made.

**Next choose B: a thin local vertical-slice interface.** Scope one synthetic SC-01 timeline, current dependency/next action, evidence and separate permission inspector, assigned clarification and exact-package verification controls, simulated checkpoint, and distinct delivery/acknowledgment/completion displays. The observed workflow passes now support testing whether a person can understand and use these distinctions. Defer general generation, broad ingestion, real integrations, hosted deployment and additional scenarios. Production hardening remains mandatory before deployment. No next-phase implementation has begun, and no manual action is required to review this result.

[Final machine-readable completion record](../artifacts/phase2d/completion-final-cc8f28fd5de51da580ca2427c25fa05f98f3d1ad9f0cd7e53acd1ef66660c6a1.json) includes exact verification counts, artifact references, implementation hashes, changed files, limits and the next-phase decision.

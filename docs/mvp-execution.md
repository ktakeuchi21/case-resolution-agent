# Public synthetic MVP execution ledger

Active charter: complete the browser portfolio MVP from Phase 2D, retaining all governance invariants. This ledger is a continuation checkpoint, not a substitute for implementation.

## Architecture decisions

- Small same-origin Node HTTP service, static semantic HTML/CSS/ES modules; no client framework or hosted dependency required to run the application.
- PostgreSQL remains canonical. Anonymous visitors receive cryptographically random, HttpOnly, SameSite session credentials. Each demo/reset gets its own seeded workspace; browser parameters never choose tenant/workspace/actor IDs.
- Demo role switching is explicitly simulated and confined to the visitor's disposable synthetic world. It cannot access a shared administration endpoint or global source corpus.
- Hybrid remains default. Preserved synthetic OpenAI vectors are packaged for offline prototype queries; arbitrary missing vectors pause visibly. No guest request can trigger a paid provider call. Optional controlled model generation remains server-only and disabled absent a separate configured budget.
- Public uploads accept bounded, downloadable synthetic fixture documents only. This implements real upload/validation/parsing/persistence/collection exploration while enforcing the synthetic-only portfolio boundary; arbitrary patient, proprietary, executable and unrecognized files are rejected before storage. Uploaded content never becomes a governed source.
- Existing immutable records remain immutable. Reset rotates the session's active workspace and retains immutable synthetic audit. Access expires after four hours; temporary upload metadata expires separately. The 64-workspace lifetime cap bounds retained canonical storage. An owner provisions a fresh dedicated demo database to replenish capacity; web visitors cannot delete audit records.
- Application rate limits, session expiry, reset quotas and global lifetime-workspace capacity persist in PostgreSQL. Public unauthenticated cost is zero provider calls. Static assets require no third-party CDN.
- Render + Supabase remains preferred pending account authorization and compatibility validation; prepare Docker production deployment and migration runbooks independently.

## Completion checklist

- [x] Phase 2D state inspected: 30 workflow tests, existing 67/24 test suites and prior evidence inspected.
- [x] Fresh baseline tests
- [x] Controlled generation module/evaluation
- [x] Session-isolated application APIs and persistence
- [x] Cohesive design system and all six experiences
- [x] Synthetic upload, Studio lifecycle and retirement workflows
- [x] Abuse/authentication/CSRF/retention controls
- [x] Security/threat review, fixes
- [x] Production build, real-browser golden/exception, keyboard, responsive QA
- [ ] Deployment and deployed E2E/screenshots
- [x] Portfolio artifacts and final requirement-by-requirement audit

## External access

No Render/Supabase credentials were available to the deployment assessment. Dashboard private-account access was rejected by automatic approval review; requested account selection/access through the app. This blocks deployment only; it does not block completing local implementation and verification.

Public question privacy boundary: only the reviewed frozen synthetic questions, supplied literal/sandbox prompts and the explicitly labeled cache-failure probe are admitted. Other text is rejected before durable evidence/answer storage; no heuristic patient-data detector is used. The public API counts all attempted writes against a durable150-attempt session cap even when a later application transaction rolls back. Session refreshes share the normal read limiter.

Local release summary: 151 automated tests (67 original,24 PostgreSQL,30 workflow,12 generation,18 application),23 reference cases and108 frozen retrieval comparisons pass. Real-browser golden and manager pause/resume pass; production golden is keyboard-only with retained state across refresh. Deployed URL and screenshots remain the external release gate. See [verification](mvp-verification.md).

External-gate continuation checkpoint: local requirements are complete. Deployment account/source destination access is now the sole remaining external dependency. No live URL is verified; do not mark the active goal complete. Resume from the verified build and migration runbook when access is supplied, without redoing earlier phases or weakening controls.

## Deployment blocker confirmed

After three consecutive goal turns with the same deployment dependency, the goal is marked **blocked**, not complete. The latest check still found no Render/Supabase management credentials, runtime/admin deployment database URLs, project environment files or configured source repository. No new account identification or access approval arrived. The preceding continuation made no implementation progress; it verified that the saved release remained unchanged. All independent local work is retained. Resume at the hosted preflight after the intended accounts, protected credentials and authorized source destination are supplied. The prior dashboard approval rejection remains in force; no bypass was attempted.

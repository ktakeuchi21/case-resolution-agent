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

## Deployment access resumed — September 8, 2026

The user signed into Render and Supabase and created `ktakeuchi21/case-resolution-agent`. Browser inspection now confirms the signed-in dashboards, and GitHub CLI confirms write access to that repository. The prior dashboard-access rejection no longer blocks the authorized account check. The reviewed synthetic project was published while preserving the repository's initial commit; credentials, local databases and generated build folders were excluded and staged-file hygiene checks passed.

Render's draft web-service configuration recognizes the Docker source. Its paid default was changed to the authorized $0 Free instance; deployment has not been submitted. Supabase organization ownership for the new dedicated database is awaiting the user's selection. Do not modify existing projects, assume free-project capacity, create/change database credentials through browser automation, or submit an unconfigured web service. Complete hosted migration compatibility, secure runtime connection configuration and deployed end-to-end verification after that choice.


## September 8 hosted connection preflight

The user identified a new dedicated Supabase project, `qabaroofmvrzyuwuxndy`, in Oregon. An authenticated, read-only SQL Editor query returned PostgreSQL 17.6 and available pgvector versions through 0.8.2; vector is not installed. Existing migrations still request 0.8.6. No application migration or database credential change was made. This is a real compatibility gate, not a successful hosted database connection.

The authenticated Render draft now selects Oregon, Free ($0 base/month), `NODE_ENV=production`, `/healthz` and automatic deployments Off. It points at `ktakeuchi21/case-resolution-agent`, branch `main`. Deployment has not been submitted. The exact public origin and restricted runtime database credential remain unset.

A protected local password-entry file (0600 beneath a 0700 directory) and read-only TLS preflight helper were prepared beneath ignored `.local/deployment/`. Git ignore coverage and helper syntax were verified. The owner was asked to enter the existing database password privately; no password was read or printed. The helper requires certificate verification and redacts raw driver errors. Dashboard access alone does not supply database authentication.

Evidence: [hosted-dashboard-preflight-556c2f3b050e9fcfb92a74530bb85df6e7433e9bb774a42c686952d18bba2410.json](../artifacts/mvp/hosted-dashboard-preflight-556c2f3b050e9fcfb92a74530bb85df6e7433e9bb774a42c686952d18bba2410.json). Next: obtain the private credential, verify TLS, explicitly qualify the hosted vector version with preserved migrations and frozen retrieval/governance comparisons, then provision the restricted runtime connection. No deployment or compatibility pass is claimed.


### Hosted qualification progress

The owner supplied the database password through the protected ignored file. Verified client-to-Supabase-session-pooler TLS now uses the provider CA; no credential value was printed. The pooler's database-side `pg_stat_ssl.ssl` was false, so no end-to-end TLS claim is made. Bootstrap applied all eight unchanged migrations and verified an identical rerun. The restricted runtime login works. Default API grants on the public migration ledger were removed, forced RLS was enabled, and missing extension-schema USAGE was corrected without granting CREATE or administrative authority.

The first hosted run passed all 23 references, then stopped on the vector-type configuration error. The next passed the same references and semantic governance/ranking but failed the nonportable scalar replay assertion. Both incomplete artifacts and the subsequent arithmetic diagnosis remain immutable. The complete comparison passed with one fixed four-lane replay and unchanged 1e-5/1e-7 numerical limits: [hosted frozen parity](../artifacts/phase2c/parity-84c57174e5f418c904098e085b2f6d0fa85bec756f1342225ee98969d65826b1.json). All 23 references and 108 retrieval comparisons preserve exact rankings and governance/citation results; maximum replay delta is 5.56e-16. Hosted persistence/workflow/application tests pass 71/71 runnable cases, with one intentional extra-database-creation skip. The retirement/history/sandbox/concurrency demonstration passed. Final access, evidence, vector and workflow audits passed; public deployment and hosted browser verification remain pending.

Render's authenticated billing page confirms Hobby, no card on file, no pending charges, no existing services, 750 included free instance hours and 500 pipeline minutes. The draft remains Free/Oregon with automatic deployment Off. A protected runtime-only `.env` import is prepared; the owner must complete the native file chooser/import, which the available browser controls cannot operate. Administrator credentials are not in that file.


September 8 database release gate: [hosted qualification report](../artifacts/mvp/hosted-database-qualification-7761ac4f9bc7b6c55a4d3f82e87f4118259a9201eb0d37b54ce307cb4c9ec6df.json) records passing hosted access/RLS, exact vector/citation fidelity, immutable workflow links and retirement/history checks. The 459 vectors were verified using round-trippable float output; the audit changes only transaction-local formatting. Render secret import and actual deployed HTTPS/browser checks remain pending.

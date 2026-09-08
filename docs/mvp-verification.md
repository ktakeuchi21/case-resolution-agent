# Synthetic portfolio MVP verification

**Current status:** the public synthetic service is live. [Hosted verification](hosted-verification.md) records the later 164 local tests, 71 hosted regression passes, database qualification and live HTTPS/browser checks. The measurements below preserve the earlier local release checkpoint.

**Historical local checkpoint:** local implementation and release verification complete; account access was still pending. The active user charter extends completed Phase2D into the six-experience portfolio application. All effects remain simulated, all content synthetic, and the stopping boundary remains **Documentation dependency resolved; prior authorization pending.**

## Automated evidence

| Gate | Observed result |
| --- | --- |
| TypeScript | Passed |
| Original Phase2A/2B tests | 67/67 passed |
| PostgreSQL integrations | 24/24 passed, including empty database and all eight migrations |
| SC-01 workflow regressions | 30/30 passed: restart/reconstruction, timers, duplicates, unknown dispatch, cancellation, human authority and both retirement commit orders |
| Controlled explanation/model contracts | 12/12 passed; injected transports, no live model-quality claim |
| API journey/security | 16/16 passed: golden + human pause/resume + exact assignment + repeated publication + retirement + sandbox; isolation/CSRF/strict authority/error/expiry/replay controls |
| Application crash recovery | 2/2 passed: exact answer replay after outer rollback; original checkpoint retained after independent worker progress; clock recovered |
| Original reference evaluations | 23/23 passed |
| Frozen retrieval parity | 108/108 comparisons; zero rank changes; lexical31/36, semantic36/36, hybrid36/36 correct |
| Embedding API usage | Zero new provider calls; replay of preserved real vectors |
| Database audit | Row hashes, immutable evidence/answer linkage, exact canonical citations, runtime role/RLS and all migration checksums passed |
| Production package | Build passed; 212 runtime files, 160 validated vector records; separate-directory asset/health smoke passed |
| Hygiene | Secret-pattern scan and temporary-Git ignore checks passed; original live benchmark hash and content-addressed historical artifacts verified |
| Lint | Not configured; not reported as passed |

[Fresh parity artifact](../artifacts/phase2c/parity-f4342908c4a4f755dbf0ed37b6f64207867660019a94bd8bdf08a1861f2ded49.json) preserves the original frozen fixtures and baseline. Cached-vector ranking/governance reproducibility does not establish repeated fresh embedding-provider consistency. Neither UI work nor build tests establish a new latency/cost comparison.

## Browser and accessibility

Real Chromium/Playwright checks passed for all six experiences. Golden completion, manager pause/resume without duplicate dispatch, structured escalation, safe reset, exact synonym citations, sandbox upload/denied action, publication/explicit assignment, loading/disabled controls, unknown-question rejection and a visible unavailable-cache pause were exercised. An actual Node restart preserved the waiting case and human task.

All24 route/width combinations (six screens ×375/768/1024/1440) had zero horizontal overflow. Screenshots were visually inspected. Keyboard skip links, arrow-key Studio tabs, focus restoration,3px visible focus, reduced motion and contrast were checked. This is focused accessibility verification, not a comprehensive WCAG certification.

The compiled production server separately reached PA_PENDING using only keyboard navigation/activation, retaining state after refresh. It had zero console errors/warnings and no CSP errors. Secure/HttpOnly/SameSiteStrict cookie flags and strict CSP, frame denial, nosniff and HSTS headers were verified locally. Development had one expected422 network error from the deliberate unknown-question rejection; it is not hidden as an unexpected failure. Local HTTP loopback cookie checks do not establish hosted TLS correctness.

Screenshots in [screenshots](screenshots/) are labeled **local production build**, not deployed evidence. The final machine-readable browser record and build/source hashes accompany the immutable verification artifact.

## Defects found and corrected

- Launch transport retries created unnecessary workspaces; launch now returns the existing session world, with reset a separate idempotent action.
- Publication assignment originally reaffirmed the old release; assignment now requires an exact locally published release and transactionally records a new pin plus explicit actor access. Workflow/chat recheck current pin under the governance lock.
- Long application IDs overflowed nested timer identifiers; bounded derived IDs preserve idempotency with request fingerprints.
- UI metadata reads inside session transactions saw stale data; reads now use the active transaction client.
- Repeated upload access revisions could collide; existing collection grants are now idempotent.
- Chat replay checked only query text; full request fingerprint now binds mode too.
- Unicode CSRF inputs could cause a500; shape validation precedes constant-time comparison.
- Public capacity reservation could roll back while core seed committed; capacity reserves durably before seed.
- Cross-transaction checkpoint failure could leave session time behind durable workflow time; immutable intents retain the original timer and clock recovery prevents rewind or firing a different timer.
- Chat projection failure could regenerate an answer after the core commit; an atomic immutable response receipt now replays the exact answer/run.
- Session refresh bypassed the read limiter; it now shares the authenticated read budget. Attempt budgets persist even if action projections roll back.
- Arbitrary chat text could enter immutable evidence; public questions now use a reviewed synthetic allowlist, with unknown text rejected before persistence.
- Browser review corrected low-contrast branding, skip-link navigation, tab-focus restoration and historical-answer/current-state labeling.

See the [repository threat model](public-demo-threat-model.md) for tested controls and the limits of this review. No verified critical/high exploit remains in the tested local API paths; this is not a penetration-test, production-readiness or healthcare compliance certification.

## Persistence and deployment boundary

The app stores canonical governance, vectors, workflow events/receipts, answer evidence and case/access revisions durably. Anonymous capabilities expire after four hours. Temporary upload/UI metadata expires; immutable synthetic history remains. The lifetime64-workspace capacity cap is deliberate and can make the public demonstration unavailable until an owner provisions a reviewed new dedicated database. Expiry does not replenish canonical capacity. No public audit deletion or paid provider endpoint exists.

Runtime role is restricted `pathway_app`; migration credentials remain separate. Hosted PostgreSQL/pgvector version compatibility, TLS, trusted-proxy behavior and account free-tier capacity still require selected-account preflight. Docker is unavailable locally, so the compiled Node artifact was exercised but the Docker image was not built/booted. The same source has a reviewed Docker/Render configuration. See [production runbook](production-runbook.md).

**Sole external release gate after local verification:** identified Render workspace, dedicated new Supabase project/database credentials and an authorized source repository/registry destination. Automatic approval review rejected a read-only Render dashboard account check, citing private-account access authorization. No bypass or cloud resource modification was attempted. Live migrations, deployed E2E, URL and screenshots remain unverified; the durable goal must not be marked complete on local evidence. The live URL and deployed screenshots remain explicitly pending.

## Scope of changes

Added `src/app`, `src/generation`, `web`, `design-system`, `tests/app`, `tests/generation`, migrations007–008 and reviewed synthetic embedding fixtures. Updated DB registry/assignment integration and workflow current-selection resolution; BM25, RRF, frozen corpus/query labels and historical artifacts remain unchanged. Added build/container/deployment configuration, expanded evidence audit, hygiene validation and portfolio/runbook/design/security documentation. No unrelated repository, global credentials, hosting resources, paid plan or real communication was modified. The checkout has no Git metadata; changes are inventoried through local build/source hashes instead of a Git diff.

## Immutable local release evidence

- [Local verification and source hashes](../artifacts/mvp/local-verification-0edb94a805d32ba5f1a9a619dae60d9eae01059cab621c782599f1afebf6f446.json)
- [Measured browser record](../artifacts/mvp/browser-qa-8b3db5d15a7bd8624ddd23feed9dbc3c1c31b42a72a1826386e26ca84f60946d.json)
- [Production build manifest](../artifacts/mvp/production-build-267ea6f3448301c1d959eccc3e80e097025d4b9f6cceceb62019726025835409.json)
- [Expanded evidence/citation audit](../artifacts/phase2c/database-audit-70b4731e8ab4c639f7be9d3270efaa79ade3be9c0fa06f324f2545b68d85504b.json)
- [Workflow history/authorization audit](../artifacts/phase2d/workflow-audit-6f813dd9cf956bcca354be0bc364500de36e4865031575be9189ee15eda26b9d.json)

Artifacts were exclusive-created with content-addressed names and local read-only permissions. They are not signed or hosted WORM records. The original lexical/live baselines remain unchanged.

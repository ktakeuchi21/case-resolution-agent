# Hosted synthetic portfolio verification

[Open Pathway Agent](https://case-resolution-agent.onrender.com).

The first Render deployment succeeded on September 8, 2026. The container, hosted database and browser acceptance checks passed. This is a synthetic portfolio application with simulated external effects, preserved real synthetic embedding vectors and deterministic evidence explanations. It is not a production pharmaceutical system.

## Release identity

- Service: `srv-dag1p2v40ujc73delf20`, Free Docker, Oregon.
- Initial deployment: `dep-dag1p3f40ujc73delhc0`, source `22db28a290a7b5a8e84e2e0d0e56c07105d2c65c`.
- Build: 215 packaged files, 160 validated cached vectors. Render built and booted the image; the inspected logs did not expose its resolved digest.
- Database: dedicated Supabase project `qabaroofmvrzyuwuxndy`, PostgreSQL 17.6 / pgvector 0.8.2, restricted runtime role.
- Health: `/healthz`. Automatic deployment remains Off; documentation-only commits do not change the running build.

[Render deployment record](../artifacts/mvp/render-deployment-bec29f7e5b70b1981513d96556162f5ff479549fe87094e0ada43e9fae405239.json).

## Passed release checks

| Boundary | Evidence |
| --- | --- |
| Local automated regression | 80 unit tests and 84 database/workflow/generation/application tests passed |
| Hosted automated regression | 71 passed; one extra-database-creation test deliberately skipped, covered separately by empty application-schema bootstrap and identical migration rerun |
| Hosted retrieval | Original 23 references and frozen 108 comparisons passed; no rank differences, unchanged governance/citations; lexical 31/36 and semantic/hybrid 36/36 |
| Persistence and isolation | Retirement/history/sandbox/concurrency demo, immutable workflow links, role/RLS audit and exact vector/citation checks passed |
| HTTPS | Health 200, restrictive CSP/HSTS/frame/nosniff headers, private-file paths 404 and cross-origin session request 403 |
| Hygiene | Private credentials excluded from repository/build, 171 fixture/migration files unchanged, original live benchmark hash preserved |

[Database qualification](../artifacts/mvp/hosted-database-qualification-7761ac4f9bc7b6c55a4d3f82e87f4118259a9201eb0d37b54ce307cb4c9ec6df.json) and [HTTPS checks](../artifacts/mvp/hosted-https-440f251f773c4fb67fdd85a30babbcb408d4e36aa258f40f1c5d202e18b9cedb.json).

## Hosted browser acceptance

An isolated browser reached a human-review pause and preserved it through refresh. Render's event log records a real service restart at 8:37 AM MDT, followed by a healthy database-backed HTTPS response. After restart, workflow revision 5, the paused state, manager role, open task, all three evidence IDs/hashes and all five timeline IDs matched the captured snapshot exactly. The prior notification retained one delivery attempt. Human resumption and office verification then reached PA_PENDING after explicit receiving acknowledgment. The notification retained exactly one attempt; the transfer was acknowledged. Hosted synonym/citation checks passed, and all 24 screen/width combinations had no horizontal overflow. Retiring `K-PA.v2` paused new dispatch with `SOURCE_RETIRED` and zero attempts, preserving the exact historical evidence. The supplied sandbox TXT parsed successfully and supported sandbox exploration, while action remained denied. A governed re-test stayed paused after that upload, with history intact and no dispatch. The hosted console reported zero errors and warnings.

[Immutable hosted browser report](../artifacts/mvp/hosted-browser-0443d6af75ac439810773e7ce4f1090419b0877a0e5ab1b60d5f07645846ea47.json) contains the exact before/after snapshot, final outcomes, citation checks, cookie flags and screenshot hashes. The [eleven inspected hosted screenshots](screenshots/README.md) retain public-environment labels. All 13 keyboard-activated journey controls had visible 3px focus; Secure/HttpOnly/SameSite Strict flags were verified without retaining cookie values.

## Limits

The database qualification replays cached vectors; it does not measure fresh-provider variability or equivalent-condition latency/cost. Free instances can sleep and delay their first request. The demo advances a labeled synthetic clock and does not promise continuous worker execution. It has a lifetime 64-workspace storage cap; expiry/reset does not delete immutable evidence or replenish that capacity. Operator-managed retention/rotation, backup restoration, load testing, independent retrieval holdouts and production healthcare identity remain outside this release.

TLS certificate and hostname verification covers the client-to-Supabase-session-pooler leg. The observed provider backend reported TLS false; no end-to-end database encryption claim is made. All content is synthetic and all communication/transfer/acknowledgment effects are simulated. The stopping condition is **Documentation dependency resolved; prior authorization pending**.

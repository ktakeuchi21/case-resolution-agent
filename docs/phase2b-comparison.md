# Phase 2B live retrieval decision — September 7, 2026 (MDT)

**Decision C: adopt unthresholded RRF hybrid as the selected prototype configuration.** Both semantic and hybrid fix all five lexical false abstentions. Hybrid matches semantic's final accuracy and required-passage coverage while improving early evidence ordering on more queries than it worsens. This is a bounded prototype choice; semantic remains a credible simpler alternative. The recommendation does not establish production safety or a latency/cost advantage over semantic.

This session reviewed the completed live run and changed documentation and derived artifacts only. The low-level factory's compatibility default remains `lexical`; explicitly select `mode: 'hybrid'` when constructing the prototype pipeline. Changing the composition-root default and implementing acknowledged degraded operation belong to the next authorized implementation session. The frozen benchmark, parameters, labels, source code and original artifacts are unchanged.

## Verified quality comparison

The run was recorded at `2026-09-08T02:47:46.797Z` (September 7, MDT), with Node `v24.20.0`, darwin/arm64. It measures the same 19 synthetic source versions and 36 frozen queries, including 23 positive-gold queries, five times per arm. Gold SHA-256: `90bc399a33b66a4ffc147cacb67a671feef241ce75732ba3adf3799eab013546`. No tuning or fresh provider requests were performed during this review.

| Eligible evidence / final outcome | BM25 | Semantic | Hybrid RRF | Hybrid + cutoff 0.35 |
| --- | ---: | ---: | ---: | ---: |
| Eligible recall@k | 80.80% | 95.65% | **96.74%** | 89.49% |
| Eligible precision@k | 58.91% | 57.83% | **62.17%** | 63.33% |
| Eligible MRR | 0.8043 | 0.6739 | **0.8478** | 0.8261 |
| First relevant rank, mean when found | 1.15 | 1.59 | 1.30 | 1.27 |
| All required passages retrieved | 17/23 | 22/23 | 22/23 | 20/23 |
| Expected outcomes correct | 31/36 (86.11%) | 36/36 (100%) | 36/36 (100%) | 34/36 (94.44%) |
| False abstentions | 5 | 0 | 0 | 2 |
| Inapplicable eligible passages | 0/95 | 0/120 | 0/120 | 0/104 |
| Correct required abstentions | 3/3 | 3/3 | 3/3 | 3/3 |
| Unresolved conflict escalated | 1/1 | 1/1 | 1/1 | 1/1 |
| Exact citations | 50/50 | 62/62 | 62/62 | 56/56 |
| Unsafe final outcomes / unsupported quoted claims | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Provider execution failures | 0 | 0 | 0 | 0 |

Each column reports one 36-query run; all five repeats have the same rankings and decisions. Precision divides by actual returned count; positive-gold macro averages exclude gold-empty rows. Missed first-relevant ranks are null and contribute zero to MRR, so found-only rank means cannot compare coverage. `k=8`, except Q16's deliberate `k=1` conflict probe. Conflicts use supplemental authoritative inspection outside top-k, explaining correct escalation despite incomplete retrieved gold. [Metric definitions](rag-evaluation.md#metric-definitions-and-stage-separation) remain unchanged.

| Broad developer candidate diagnostic | BM25 | Semantic | Hybrid | Hybrid + cutoff |
| --- | ---: | ---: | ---: | ---: |
| Recall@k | 56.52% | 72.46% | 68.12% | 65.22% |
| Precision@k | 26.63% | 28.26% | 26.63% | 27.36% |
| MRR | 0.4453 | 0.5164 | 0.5319 | 0.5558 |
| First relevant rank, mean when found | 2.68 | 2.91 | 2.55 | 2.29 |
| All required passages retrieved | 3/23 | 11/23 | 6/23 | 6/23 |
| Inapplicable candidates | 172/232 (74.14%) | 182/263 (69.20%) | 186/263 (70.72%) | 175/244 (71.72%) |

Semantic similarity does retrieve false-positive candidates, including top-ranked wrong-payer, wrong-state and expired sources. Pathway first restricts the operational search universe using metadata/assignment rules, then separately evaluates support, applicability, communication and action. It does **not** pass the broad diagnostic top-k into the pipeline and hope to remove mistakes later. Zero policy-inapplicable passages reach eligible evidence in all measured arms. Metadata-eligible educational passages can still lack authority to support a case conclusion; they are not counted as metadata-inapplicable.

## Benefit, regressions and uncertainty

Semantic and hybrid both recover Q02 (synonym), Q03 (acronym), Q05 (paraphrase), Q08 (partial information) and Q30 (appeal paraphrase): five additional correct outcomes, a 13.89 percentage-point gain over BM25. Semantic's eligible precision and MRR are lower than BM25's despite better coverage. More plausible candidates are not automatically better evidence.

Relative to semantic, hybrid improves first-gold rank on nine queries and worsens two: Q06 conversational language and Q30 appeal paraphrase move from rank 1 to rank 2. Hybrid's eligible MRR increases from 0.6739 to 0.8478. However, its entire 1.09-point eligible recall and 4.35-point precision advantage comes from **Q16 alone**: semantic's top hit is nongold educational content, whereas hybrid's top hit is a gold passage. Both still escalate through supplemental conflict inspection. Neither has better total required-passage coverage or final accuracy than the other. Hybrid's broad candidate recall is worse than semantic's and its broad inapplicable count is higher.

This narrower ordering benefit, retention of the existing deterministic lexical branch and a small explainable fusion step justify hybrid for this prototype, without another model or reranker. It is not a universal win. The 36 developer-authored cases include correlated question/context variants; the four development and 32 challenge rows were visible to the implementer. Many eligible universes fit inside top-k. There is no independent holdout, scale study, fresh-provider reproducibility study or pharmaceutical validation.

**Reject the 0.35 cutoff configuration for adoption.** It reintroduces false abstentions on Q02 and Q08, reducing correct outcomes to 34/36 and all-required retrieval to 20/23. Its small precision increase does not compensate. Preserve it as the frozen sensitivity arm; do not adjust it against this baseline.

Reranking and query rewriting remain unjustified as implementation work. Q06/Q30 are specific ordering regressions to examine on a separately frozen holdout, but neither causes a final error here. Q02's synonym gap is already fixed without rewriting. More expensive components need a reproducible consequential error pattern; no tuning experiment was run in this review.

## Latency, embedding usage and replay limits

| Measured timing (ms), mean / p95 | BM25 | Semantic | Hybrid | Hybrid + cutoff |
| --- | ---: | ---: | ---: | ---: |
| Broad candidate pass, 180 samples | 0.131 / 0.180 | 296.634 / 997.258 | 12.668 / 14.652 | 12.769 / 15.233 |
| Governed pipeline, 180 samples | 0.463 / 0.751 | 4.437 / 9.086 | 3.911 / 5.811 | 3.946 / 6.080 |
| First repeat, candidate + pipeline, 36 samples | 0.906 / 2.167 | 1437.817 / 4738.728 | 17.025 / 23.145 | 15.990 / 19.469 |
| Later repeats, candidate + pipeline, 144 samples | 0.516 / 0.708 | 16.884 / 22.247 | 16.468 / 19.884 | 16.896 / 20.832 |

| Usage across all five repeats, including diagnostics | BM25 | Semantic | Hybrid | Hybrid + cutoff |
| --- | ---: | ---: | ---: | ---: |
| Embedding requests / misses | 0 / 0 | **160 / 160** | 0 / 0 | 0 / 0 |
| Cache hits | 0 | 3,445 | 3,605 | 3,605 |
| Reported input tokens | 0 | **3,435** | 0 | 0 |
| Estimated incremental embedding cost (USD) | $0 | **$0.0000687** | $0 | $0 |

The token estimate is `3435 × $0.02 / 1,000,000` at the artifact's September 7 rate. It excludes local compute, storage, hosting and any unreported charges; it is not an invoice or steady-state cost per operational query.

Execution order was lexical → semantic → hybrid → cutoff, sharing the file cache. Semantic paid to populate vectors later reused by hybrid. Within each query, even the semantic governed pipeline follows a broad diagnostic that warms its cache. Thus neither the 4.437 ms pipeline mean nor the first-repeat mixed timing is a clean cold operational request measurement. Hybrid's zero incremental cost and lower recorded latency do **not** show that hybrid is free, cheaper, or faster than semantic under equivalent cache conditions. Cold-start/reindex costs, fair provider latency, isolated fusion overhead, production p95 and amortized operating costs remain unknown. A separately labeled experiment would need controlled cold/warm caches and balanced ordering; preserve this untouched baseline first.

Five identical repeats establish cached-vector, ranking and governance reproducibility across 720 recorded executions. They are not 720 independent questions or repeated fresh embedding-provider calls. No fresh calls were needed for artifact verification.

## Inspectable live traces

The [live trace bundle](../artifacts/phase2b-live/traces-a55da690970dea8c4e0efe83f1062617bcedfb30c9a2ddb3aa8a4cb22e32fde4.json) retains unmodified first-run rows, all four arms, canonical passage IDs, raw branch scores/ranks, fusion contributions, release/filter results and full evidence records.

| Case | Observed behavior |
| --- | --- |
| Q01 + Q02 literal/synonym | BM25 finds all three literal gold passages but none for the synonym. Semantic/hybrid find K-PA.v2, N-101 and CE-101-01 for the synonym; independent gates allow the supported recommendation. Semantic raw cosines are about 0.292, 0.242 and 0.211, demonstrating why 0.35 discards necessary evidence. No operational action is executed. |
| Q03 semantic improvement | Acronym wording gains the missing process passage; semantic and hybrid answer while lexical abstains. |
| Q12 / Q13 inapplicable matches | Broad semantic ranks K-CEDAR first (cosine 0.671) and K-UT first (0.789), respectively. Pack/plan or state restrictions exclude them from operational evidence. |
| Q14 / Q15 / Q21 lifecycle | Expired and superseded sources rank first in the broad semantic diagnostic; retired K-PA.v2 remains semantically similar. EXPIRED/REVIEW_OVERDUE, SUPERSEDED or SOURCE_RETIRED block new reliance. Q21 pauses. Historical evidence remains unchanged in retirement regressions. |
| Q19 sandbox | Sandbox passages are retrievable, but sandbox-only support cannot authorize an operational action; action denied, execution absent. |
| Q16 authoritative conflict | Supplemental registered authority reveals the unresolved conflict beyond top-k; escalation and action pause hold in every mode. Retrieval does not resolve it. |
| Q17 insufficient evidence | Related administrative sources do not supply the requested deadline; every mode abstains. |
| Q20 prompt injection | Injection-bearing sandbox passage is retrieved; only its benign reviewed quotation is used. Embedded instructions grant no privileges. This tests deterministic containment, not a generative model's injection resistance. |

## Selected behavior and Phase 2C gate

Use hybrid with RRF constant 60, branch depth 50 and no cosine cutoff. Preserve BM25 unchanged as the offline control and a **degraded option requiring explicit acknowledgment**. A failed semantic/hybrid attempt must remain a visible failure/pause, with no silent lexical substitution. A human acknowledgment or preauthorized, bounded system policy must record the reason, actor/policy ID, timestamp, requested/effective mode and configuration, and original attempt linkage before a separate lexical attempt. All governance checks run again; acknowledgment of a mode change confers no communication or action permission. Never use fallback to evade invalid scope, retirement or unresolved authority. This acknowledgment contract is selected policy, not an implemented flow.

Added complexity remains the embedding API, credentials, cache invalidation/model identity, latency/cost accounting and failure of either hybrid branch. No measured branch failure occurred; existing contract tests cover failures. Missing/corrupt credentials or cache data must remain visible and fail closed.

**Phase 2C recommendation: option 2, local PostgreSQL governance persistence plus pgvector.** The measured semantic benefit justifies retaining durable vector reuse behind the replaceable repository interface. It does not establish a need for approximate nearest-neighbor indexes, hosted vector services or scale optimization. Start with exact cosine on the policy-eligible universe and unchanged BM25/RRF. Durable retirement/assignment/conflict state is the primary missing persistence guarantee. See the [exact proposed scope and acceptance gates](roadmap.md#next-concrete-work-session). Generation, SC-01 transitions, interface, ingestion service and hosted deployment stay outside Phase 2C. No Phase 2C implementation began here.

## Preservation and verification

[Preservation manifest](../artifacts/phase2b-live/manifest-2795bf54eb8bb1bac79ecf19ac757d0c4c41cea6b9d66f96070796d224e35f4f.json) binds exact-byte SHA-256 copies of [the live run](../artifacts/phase2b-live/benchmark-06f526e60113b80a138ba605fcec2b29724315b675a5323a9ce2ddebf7207e6d.json) and [the original lexical baseline](../artifacts/phase2b-live/lexical-baseline-c675ea86447c3aa8dd3d2b756e3770c9785b6f415e9d95ec4ab70a3ef2081c32.json), extracted traces, [verification audit](../artifacts/phase2b-live/audit-977f3c78270e36cf2db08787d1601665937828a024dceeb38467f229e5005cba.json) and [reviewed machine-readable decision](../artifacts/phase2b-live/decision-557968d9c23a522f03b56d674c157309961841e646cff8d742be3b393fc3a3c2.json). Copies use exclusive creation and read-only local permissions; this is content-addressed preservation, not signed/WORM storage. All preexisting Phase 2A/2B artifacts remain byte-for-byte unchanged during this review.

The live benchmark's top-level `decision`, `recommendedDefault` and `decisionReason` are hard-coded stale runner prose saying D/lexical despite four measured arms. They are preserved as evidence of the runner's limitation. The separate reviewed decision and D-29 supersede that prose; no measurement was changed to reconcile it.

Fresh type checking and all 67 automated tests passed. All 23 original reference evaluations and retirement/history/sandbox assertions passed in memory without rewriting their artifacts. The audit verified 720 record schemas/content addresses, exact citations/claims, candidate/eligible metrics, outcomes, cached reproducibility hashes, latency arithmetic and usage/cost; macro metrics were independently recomputed. Lint is unconfigured. The Git ignore matcher was exercised in a temporary repository: `.env`/`.env.*` and `.local/` are ignored while `.env.example` and preserved artifacts remain exportable. Secret-pattern checks passed for all new JSON artifacts, the safe environment example and 160 embedding-cache records, without exposing values. This checkout has no `.git`, so a tracked/staged-file audit is unavailable; ignore rules do not protect against forced additions. All data remains the original synthetic corpus. No new live run or paid request was made during this review.

See the [review verification record](../artifacts/phase2b-live/verification-64da5a26eca352288c790a1f9e663308e9612cdf36dd4c716a0c798b14fda96b.json) for check status and the changed-document inventory.

# Implementation roadmap and portfolio plan

Version 0.4 · September 7, 2026 (MDT) · Phase 2B live decision gate reviewed

Phase 1/1.5, Phase 2A, Phase 2B and the local Phase 2C persistence slice are complete. PostgreSQL now preserves governance and evidence across repository reconstruction; pgvector preserves the validated rankings and outcomes. The next recommendation is a headless synthetic SC-01 workflow state machine. No next-phase implementation has begun. The operational wedge and receipt-based outcome remain unchanged.

| Priority/stage | Work | Exit gate |
| --- | --- | --- |
| P0 — Foundation, complete | Product foundation, source/risk register, architecture, three scenarios, decisions | Traceable scope, bounded goal, and explicit unknowns |
| P0 — Phase 1.5, complete | Two-mode model, metadata/lifecycle, pack governance, retrieval contract, evaluation reference set, deployment ADR | Explicit distinction between source support, applicability, communication and action |
| P0 — Phase 2A knowledge contracts/headless spike, complete | TypeScript/Zod contracts, 19 synthetic versions/passages, local BM25 adapter, pipeline, immutable evidence and tests | Required retirement/history/sandbox sequence passes; 23 executable reference evaluations pass. No semantic provider tested |
| P0 — Phase 2B real retrieval expansion and live gate, complete | Provider-neutral embeddings, semantic/RRF hybrid, frozen 36-query comparison, preserved baselines and traces | Semantic/hybrid 36/36 correct; zero measured unsafe outcomes; cached replay stable. Challenge set is not independently unseen |
| P0 — Phase 2C durable governance + vectors, complete locally | Local PostgreSQL and pgvector repositories, exact filtered cosine, unchanged BM25/RRF, explicit degraded-mode audit contract | 24 database integration tests, 23 governance comparisons and 108 retrieval comparisons pass; no ranking differences; no UI/generation/hosting |
| P0 — Ingestion/governance backend, 2–3 sessions | Scoped uploads, security checks, parsing, visible failure states, canonical chunks, jobs, draft validation, approval/publication, retention | Ingestion cannot publish; partial/changed/unauthorized artifacts cannot activate; cleanup reconciles |
| P0 — Evaluated RAG slice, 2–3 sessions | Real embeddings/hybrid search/generation, four gates, evidence bundles, minimal knowledge review, all ten required behavior tests | Reference suite passes with metrics; SC-01 missing-document recommendation reads approved pack + verified notice |
| P1 — First browser experience, 2–3 sessions | Minimum Studio, ingestion detail, pack builder, playground, conversation/evidence drawer, retrieval inspector | Upload works without installation; comparison/abstention/conflict/retirement are legible; actual role enforcement tested |
| P0 — SC-01 workflow contract, 1–2 sessions | Define states/events, clock/cadence, tool receipts, action approval and handoff contracts using the published-pack evidence API | Walk every transition without treating a pack as an action grant |
| P0 — Durable workflow skeleton, 2–3 sessions | Database migrations, seeded cases/sources/grants, worker/jobs, outbox, mock CRM/receiver; command-driven replay before UI | Scheduled follow-up, restart recovery, deduplication, revocation, and unknown-send reconciliation pass |
| P1 — Operational experience, 1–2 sessions | Extend conversation with case timeline, demo inbox, verification and operational human review | SC-01 completes and resumes from handoff; knowledge retirement pauses dependent work |
| P1 — Remaining scenarios and signals, 2–3 sessions | SC-02/03 operational handoffs, intent/sentiment/urgency and safety/quality routes | Workflow negative suite passes as well as RAG tests; restricted-source communication boundaries hold |
| P1 — Operations and evaluation, 1–2 sessions | Event-derived queue, barrier/source-gap counts, repeatable evaluation runner, manual baseline comparison | Every displayed metric is reproducible; failures and denominators reported |
| P2 — Portfolio package, 1–2 sessions | Visual refinement, narrated demo, executive case study, architecture graphic, evaluation/limitations report | Claim-to-evidence review; distinguish built, simulated, proposed, and validated |
| Later | OCR execution/DOCX/complex tables, voice/SMS, bulk governance, live adapter investigations, richer plans, separately authorized shadow study | Each extension has evidence, evaluation, governance and operating-readiness gates |

Research recruitment can proceed alongside the synthetic build once explicitly authorized. No interview invitations or other outreach have been sent. Findings can change the wedge without requiring a polished UI to be discarded.

## First RAG prototype acceptance walkthrough

1. Open the browser sandbox, upload a permitted text/PDF document, and observe real upload/security/parsing/index states. A scanned example visibly stops at needs-OCR.
2. Select the temporary collection, ask a grounded question, and inspect exact passages. Attempt a case action and see it blocked independently of answer support.
3. In an authorized Studio demonstration, inspect document metadata and chunks, run validation, obtain separate review, and publish a frozen release. An unapproved or undated source cannot skip this sequence.
4. Compare the same question across KP-ALDER and KP-CEDAR in fresh hypothetical contexts. Show differing supported answers and applicability; do not switch an Alder case to Cedar.
5. Inspect expired/future exclusions, an insufficient-evidence abstention, and a conflict that publication or runtime monitoring blocks.
6. Exercise the injection-bearing sandbox document; demonstrate that containment holds even with an injected detector miss.
7. Open read-only DEMO-101 context. Its approved assignment plus verified N-101 supports the missing-note recommendation, but supplies no document-transfer approval.
8. Retire K-PA v2. The next dependent recommendation pauses, including cached/conversational paths, while the earlier evidence bundle remains inspectable under historical access rights.
9. Open the evaluation report with actual metrics, denominators and failures. Clearly label live inference, replay, simulated roles and operational effects.

All ten requested RAG behaviors map to tests in [rag-evaluation.md](rag-evaluation.md). The minimum surface list and deferred dashboard/operational screens are in [knowledge-studio.md](knowledge-studio.md#visible-rag-and-minimum-surfaces).

## Subsequent SC-01 operational walkthrough

1. Open DEMO-101 and inspect its missing-document evidence and named owner.
2. Close the chat; advance the simulated clock. The worker creates one permitted follow-up and next checkpoint, mirrored in a CRM activity.
3. Reopen chat and see the same goal, source versions, actions, and unanswered dependency.
4. Add the seeded signed note; show that received does not mean verified or resolved.
5. Confirm the exact document package and recipient through a human review control; simulate transfer and matching receipt.
6. Show “documentation dependency resolved; PA pending.” Replayed checkpoints do nothing.
7. Reset the fixture and take the uncertain-document branch; inspect the briefing, accept the handoff, record clarification, and resume.
8. Inject one expired source or revoked grant; show a blocked action with a reason and owner, then inspect the audit trace.

Use a labeled demo clock and local outbox. Persistence must work across process/session restart, not just within a UI animation. This subsequent demo connects the governed evidence capability to a durable operational outcome.

## Recommended portfolio artifacts

| Artifact | Executive signal | Required evidence |
| --- | --- | --- |
| Two-page product brief | Market selection, value, and scope discipline | Wedge comparison, user/buyer split, discovery evidence status |
| Service blueprint and task flow | Understanding of office/hub/payer responsibilities | Actors, dependencies, waiting, channels, human decisions |
| Governed RAG walkthrough and evaluation | Knowledge configuration and content-operating judgment | Upload/parse review, immutable pack, four determinations, contradictory evidence, retirement, claim support and measured retrieval |
| Deployment ADR and adapter comparison | Infrastructure tradeoff and portability judgment | AWS/managed retrieval/lightweight comparison, actual capability findings, cost/retention limits |
| Architecture and autonomy contract | Systems thinking and enterprise boundaries | Actual state, tool gates, approval, retries, handoff trace |
| Working SC-01 demo, approximately 3–5 minutes | Ability to turn strategy into behavior | Scheduler, persistence, human verification, receipt, exception |
| SC-02/03 scenario cards | Judgment around appeal and financial-support boundaries | Source uncertainty, safety intake, explicit non-decisions |
| Evaluation and operational scorecard | Measurement discipline | Baseline method, sample size, failures, latency/cost, guardrails |
| Research synthesis and decision history | Leadership under uncertainty | Assumptions changed by observations; unresolved risks |
| Portfolio case study | Clear strategic narrative | Problem → choice → design → functioning evidence → limits → next decision |

Do not manufacture customer quotes, adoption, savings, regulatory sign-off, or payer outcomes. Present illustrative economics separately from observed measurements. Include known limitations in the demo narrative where they affect interpretation.

## Phase 2C delivered scope

**Phase 2C, option 2: delivered locally.** The scope below records the implemented boundary and its acceptance requirements. See [verification](phase2c-verification.md) for measured results and limits. [The live comparison](phase2b-comparison.md) closes decision D and selects C. Semantic and hybrid recover all five lexical misses; hybrid's ordering benefit supports a scoped prototype choice, with two ranking regressions and no final-accuracy advantage over semantic. Vectors now have measured utility worth persisting; no scale or ANN performance benefit was measured.

1. **Durable canonical governance.** Add local PostgreSQL migrations and replaceable repositories for documents/source versions/passages, immutable pack manifests, assignments, active retirement/conflict events and registry generations. Preserve content-addressed historical evidence, exact quotations, retrieval provenance and audit linkage. Seed only the existing synthetic corpus; support idempotent migration/import and restart.
2. **Durable derived vectors.** Add pgvector storage behind the existing embedding/vector boundary, initially for the measured 1536-dimensional configuration. Preserve model/provider/dimensions, revision, exact content and parser/chunker hashes, namespace, timestamps and index-readiness state. Import validated existing vectors without gratuitous paid re-embedding; stale/corrupt/incomplete vectors must fail visibly and require explicit repair. Vectors never carry approval authority.
3. **Exact governed retrieval parity.** Apply tenant/mode, assignment, effective-date and authority-related eligibility controls before exact cosine ranking. Preserve BM25, RRF constant 60, branch depth 50 and no cutoff. Do not replace BM25 with PostgreSQL full-text scoring, add HNSW/IVFFlat, rerank, rewrite queries or tune the frozen set.
4. **Consistent reliance and immutable history.** Establish transaction/generation checks so concurrent retirement, assignment changes or conflict events invalidate an in-flight recommendation before publication. Test rollback, restart and historical reads; a database snapshot or cached vector cannot revive retired authority. Preserve sandbox isolation through query/repository authorization, with database access controls tested rather than claimed from labels alone.
5. **Explicit operational configuration.** Select hybrid explicitly in the prototype composition root while retaining original lexical reference controls. Implement a separately recorded lexical retry only after human acknowledgment or a preauthorized bounded system policy. Record requested/effective mode/configuration, failure reason, actor/policy ID, timestamp and original attempt link; rerun all four governance decisions. No silent fallback and no new authority from acknowledgment.
6. **Acceptance gates.** Run typecheck, the full suite and 23 original references, then replay the frozen 36-query set with the preserved live vectors against file/memory and database adapters. Require unchanged expected outcomes, exact canonical citations, four-decision semantics and traceable ranks/scores; disclose numerical tolerance/tie differences and investigate them without changing gold. Test cross-tenant/mode denial, stale index/snapshot rejection, concurrent retirement, durable revocations, evidence tampering/history, partial writes and restart recovery. Save new comparison artifacts separately. Do not claim hosted security, production retention or fresh-provider determinism from local tests.

Any cold/warm latency, balanced-order provider-cost or independently authored holdout experiment must be separately labeled and preserve the untouched Phase 2B baseline. A new model, query rewrite, reranker or cutoff requires its own evidence gate; none is part of this Phase 2C recommendation.

**Out of scope:** controlled answer generation, full SC-01 workflow transitions/orchestration, graphical interface, uploaded-document ingestion service, hosted infrastructure, real patient/proprietary pharmaceutical data and approximate-search scaling. Governance persistence comes first because in-memory retirement currently resets on restart. SC-01 should consume that durable boundary later.

The [comparison report](phase2b-comparison.md#preservation-and-verification) links the unchanged original lexical/live snapshots, all required live traces and separate reviewed decision. The original [Phase 2A artifacts](../artifacts/phase2a-evaluation.json) and [unit-vector contract trace](../artifacts/phase2b-governance-contract-trace.json) remain distinct evidence. See [developer instructions](developer-guide.md) and [configuration/persistence](retrieval-configuration.md).

## Next concrete work session

**Recommendation A: the SC-01 workflow state machine, headless and synthetic. Do not start without the next instruction.** Durable retirement/history, both commit orderings, isolated retrieval and preserved quality now supply the evidence boundary this workflow needs. Generation or an interface would add surfaces before demonstrating the persistent missing-document goal.

Define versioned case states/events, transition preconditions, accountable owner, escalation/resumption and separate action grants/approvals. Consume committed evidence and treat idempotency replays as historical, never as fresh authorization. Add a synthetic clock, typed mock receipts and duplicate-transition/restart tests; distinguish received, verified, transferred and dependency-resolved. Keep clinical, coverage and eligibility decisions outside tool authority.

Continue persistence hardening before any external deployment: real actor/scope authentication, narrower role separation, backup/restore, fault injection, revocation latency under load and retention. These limits do not prevent the next local synthetic workflow contract, but they preclude claims of production readiness. No generated conversational answers, UI or real outreach is authorized by this recommendation.

## Phase 2D delivered and next decision

**Completed: headless persistent SC-01.** Governed requirement detection, independent template grants, action-bound office approval, durable events/commands/state, inbox/outbox, receiving acknowledgment, human pause/resume, timer leases, cancellation, bounded retries and delivery reconciliation are implemented locally. Thirty workflow checks and eleven inspectable traces pass; both retirement/human-resolution commit orders are deterministic. Existing 67 automated tests, 24 database tests, 23 governance cases and 108 frozen retrieval comparisons remain green. [Verification and artifacts](phase2d-verification.md).

**Next recommendation B: a thin local vertical-slice interface**, without beginning it here. Scope one synthetic SC-01 case: timeline and current dependency; next-best action; exact evidence/permission inspector; assigned human clarification and exact-package verification controls; separate delivered/acknowledged status; an explicit simulated-clock checkpoint; retirement/cancellation boundary visibility. Reuse the tested engine and repositories. Keep UI role switching labeled as a synthetic demonstration, never real authentication or deployment readiness.

The reason is observed behavior: golden, resumed, duplicate and reconciled-crash paths reach the correct bounded outcome; retirement, conflict, rejected delivery, timer exhaustion and unauthorized inputs stop safely. The next uncertainty is whether a viewer can understand those distinctions and perform the structured handoff. Generation adds no capability needed to test that. Defer broad Knowledge Studio ingestion, answer/message generation, real outreach, hosted infrastructure and other scenarios. Fix any state/permission ambiguity exposed by the interface before expanding scope. Production authentication, narrow service credentials, network-adapter revocation protocol, restore/load tests and calendar expansion remain separate hardening gates before deployment. No next-phase implementation is included.

## Active public synthetic portfolio MVP

The subsequent user charter supersedes the earlier recommendation to stop before an interface. The six-experience browser application, durable session API, bounded synthetic ingestion, immutable publication/explicit assignment, extractive answers and production package are implemented. Existing phases remain historical baselines. Current validation and remaining release gates are tracked in [MVP execution](mvp-execution.md).

Public deployment is not complete. The owner-selected GitHub repository, Render Free/Oregon draft and dedicated Supabase project are verified. Guarded hosted bootstrap, 71 regression tests, retirement/history/sandbox/concurrency and [hosted frozen parity](../artifacts/phase2c/parity-84c57174e5f418c904098e085b2f6d0fa85bec756f1342225ee98969d65826b1.json) passed. The restricted runtime secret still needs the owner to finish Render’s native file import. Final read-only audits passed. Publish the reviewed deployment changes before deploying; then verify the real HTTPS journey and capture hosted screenshots. Do not substitute a static mock or relax database/provider controls. No live URL, deployed screenshot or live generation result is claimed.

After the synthetic MVP is publicly verified, the next decisions require separate evidence: durable operator capacity/retention and restore procedures for a long-lived demonstration, independent retrieval holdouts, and measured generation utility. Arbitrary pharmaceutical uploads, real communications, production healthcare identity and full workflow expansion remain outside the portfolio release.


September 8 database release gate: [hosted qualification report](../artifacts/mvp/hosted-database-qualification-7761ac4f9bc7b6c55a4d3f82e87f4118259a9201eb0d37b54ce307cb4c9ec6df.json) records passing hosted access/RLS, exact vector/citation fidelity, immutable workflow links and retirement/history checks. The 459 vectors were verified using round-trippable float output; the audit changes only transaction-local formatting. Render secret import and actual deployed HTTPS/browser checks remain pending.

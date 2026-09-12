# Live RAG checkpoint — September 12, 2026

The headless API is deployed. The replacement interface has not started because the user's charter requires live conversation qualification first. This checkpoint is not goal completion.

## Revisions and actual runs

- Preservation published: `preserve/pre-rag-rebuild-2026-09-11` at `941ccdb0f7d58d718d4298db9cd4b5c9fb2f8944`.
- First candidate: `c0685b20f30c8ab7480800cc1c1ffa6cca8c50b9`; Render deployment `dep-daijvm1594qs7392n9kg`.
- Corrected candidate currently live: `2d5f3f24ec0138dd1c6a746dce779d48021999af`, Render deployment `dep-daik39uk1f9s738hgb3g`, at https://case-resolution-agent.onrender.com.

| Run | Result | Provider use and estimated cost |
| --- | --- | --- |
| Initial frozen retrieval, 36 questions | 98.61% mean expected-passage recall; 36/36 isolation and exact-passage checks | 2 embedding calls, 4,376 tokens; $0.00008752 |
| First live conversation | 16 completed turns, then access-05 failed after its bounded format repair | 22 generation + 15 embedding calls; $0.05358749 |
| Corrected frozen retrieval, 36 questions | 97.69% mean expected-passage recall; 36/36 isolation and exact-passage checks | 1 embedding call, 313 tokens; $0.00000626 |
| Corrected conversation attempt | New-session HTTP 429; zero conversation turns and no provider calls | $0 in this attempt |

Total reported provider cost in these runs: $0.05368127; 40 reserved requests. These are token-based estimates, not billing totals. No provider or spending limits were changed. The new-session rate limit is separate from the provider allowance.

The corrected retrieval run has median 86 ms and maximum 169 ms, excluding preparation. Its two incomplete expectations are Alder's secondary milestone glossary and the access summary's known/unknown status passage. These misses remain visible; the expectations were not changed to fit the result.

## Review of the actual first conversation

This is an assistant review of retained live output against the frozen criteria and exact supplied passages; it is not an independent clinical or human-expert review.

The signed-note answer, short “Why?” follow-up, no-deadline answer, secure-channel email request, recorded office quote, unsupported copay response and access blocker/next-step answers were useful. The model made no clinical treatment recommendation, payer-approval prediction or real-send claim in the completed turns.

The run did not qualify:

- Alder-07 missed the after-submission process passage. It said the sent note “would serve to complete the documentation package” instead of explaining receiving acknowledgment and a completeness check. Its sources did not establish that submission alone made the package complete.
- Alder-08 opened with “The paperwork that hasn’t arrived yet…” even though the evidence establishes only that no receipt was recorded. A later qualification does not correct that opening claim.
- Alder-12 declined to predict approval but used imprecise “receipt/completeness steps” wording. The requested distinction should be stated directly.
- Alder-05 shortened the email materially but did not make the tone convincingly warmer.
- Access-05 failed answer formatting after the single allowed repair. Only `ANSWER_FORMAT` was retained by the original diagnostic path; the exact rejected subtype cannot be reconstructed.

Source membership and exact passage storage passed for all 16 completed turns. These mechanical checks do not establish that every claim was supported by its citation. Full semantic citation precision, supported-answer rate, unsupported-answer abstention, hallucinated-fact rate, work-product usefulness and reference-resolution rates remain unqualified until a complete corrected suite is reviewed. The frozen artifact's `humanReview: null` fields were not retroactively changed.

## Correction and next acceptance

Current-question and contextual vectors now receive separate ranks within the same filtered hybrid search, with missing vectors embedded together. Very short follow-ups use their context. The result still contains at most eight passages. The model cites passage IDs directly in claim text; the server validates those IDs and assigns visible numbers without rewriting facts. Instructions emphasize recorded-vs-actual receipt, after-submission checks and concrete appreciative language for warmer drafts. Diagnostic categories now distinguish invalid citations, mapping, draft citation leaks and schema/JSON problems without logging raw requests or responses.

The new-session cooldown was read without mutation: it resets at **2026-09-12 13:05:35 UTC / 7:05:35 AM MDT**. The evaluation runner now reuses its own sessions in an ignored private directory, with directory mode 0700 and files mode 0600. Authentication is never included in public evaluation artifacts. Resume the corrected conversation suite after the cooldown, inspect every output, then execute the frozen knowledge-switch supplement. Keep the 100/day and 40/session provider ceilings. UI work starts only after the headless gate passes.

## Artifacts

All are content-addressed and retained unchanged in `artifacts/rebuild/`:

- `retrieval-3b7b7f4513dd375d625cff7ed00b6bf30f6bb7dc2655bd41459089637a74fd78.json`
- `conversation-4a548d9ce0d55ff3d66c85721f84b64a92c5c9d721eda91fb41bb34d10dde691.json`
- `retrieval-69a732a15dd78f23c5fc2fc250f81b4721290b0dd652c67f76848ca1941db658.json`
- `conversation-658255e2cedfde5163bb31e53eee4a19c19788f115f1f86d6c75638d03518b0b.json`

## User-authorized cooldown unlock

At 12:21 UTC the user explicitly requested “unlock the limit.” The single session-IP cooldown associated with this run was expired once, under a transaction that required exactly one matching bucket. No session, provider or spending ceiling changed, and no provider-budget counter was reset. The first attempt matched a millisecond timestamp against PostgreSQL's finer precision and changed nothing; the guarded millisecond-range match cleared one bucket with 11 hits. The corrected conversation suite resumed with private session reuse enabled.

## Resumed corrected conversation run

The unlocked run is retained in `artifacts/rebuild/conversation-842b6eed9522a4dbf48e37a91943fe8e6108876cbea7a26ae0e05a1138639d4e.json`. It completed 31 turns; fulfillment-08 then failed before a model call because the shared daily provider counter reached 100. All 31 completed turns passed pack/case/status isolation, citation membership and exact passage checks. Their mean expected-passage recall is 95.70%. The run used 32 generation requests (one repair) and 28 embedding requests, with median HTTP latency 2,630 ms, maximum 6,760 ms, and estimated cost $0.08905002. Total estimated cost across this checkpoint's actual model/embedding runs is $0.14273129.

The earlier Alder receipt/completeness errors were corrected in the actual output: after-submission now explains acknowledgment and completeness separately; missing-paperwork wording now says receipt is not recorded. The previously failing access email refinement returned successfully.

Remaining work-product issues prevent qualification: the access summary was ordinary prose with `workProduct:null`; its email refinement shortened 67 words to 54 (19.4%, below the frozen 25% criterion), and fulfillment's refinement grew from 37 words to 42. Alder shortened 56 to 31 words (44.6%). Some responses also duplicated the whole draft in answer text.

Prepared local corrections now require structured work products for summary/brief/refine requests, keep introductions separate from bodies, supply the previous draft's word count and a 75% word budget for shortening, and explicitly refer clinical questions to the clinician/pharmacist. The candidate moves the ordinary reasoning default from none to low because repeated live instruction-following failures justify comparing it. These changes need new live evaluation; they are not yet deployed or qualified.

A date-bound provider allowance proposal is prepared but **inactive**. The session cooldown unlock did not authorize this distinct paid-API allowance. No provider counters were cleared or ceilings activated.

## Approved acceptance allowance

The user explicitly approved the prepared allowance. At approximately 12:31 UTC, the existing Render service received the non-secret acceptance date `2026-09-12`; no other environment setting was changed. Candidate `8083671` was pushed, then manually deployed. The RAG allowance is 250 reservations for this UTC day with ordinary limits restored automatically at 00:00 UTC. Counters were not reset. The next frozen run uses a new named cohort of test sessions so each retains its original 40-request ceiling; session creation still obeys the existing cooldown and global limits.

## Low-reasoning run and citation-contract correction

The low-v1 run stopped after 20 completed turns at access-09; its original artifact is `conversation-9cc377f307252a3d453456a2722e288dd686467457200e55a797c27840228842.json`. It used 42 provider reservations and an estimated $0.06860205. Runtime diagnostics identified `INVALID_CITATION_MAPPING` for both summary attempts.

Inspection identified an unnecessarily strict server rule: it required every work-product source to be repeated as an inline marker in the brief introductory answer, even though the requested contract carries a separate citations array and keeps citation machinery outside the draft. Work products now accept their validated source list without repeating all markers in the introduction. Any markers that are present must still be valid; every returned citation must still be retrieved. Ordinary answer citation validation remains unchanged. This corrects the contract, rather than dropping membership checks.

Low reasoning alone did not solve shortening: Alder reduced 37 words to 29 (21.6%); access reduced 64 to 52 (18.8%). The prompt now aims at 50% while retaining the frozen 25% acceptance threshold and explicitly removes long greetings, titles and repetitive context. The unsupported copay response also added a general relationship not stated in the pack; the gap instruction now expressly prohibits filling missing information with general domain explanations.

A focused `work-product` evaluation reuses frozen cases 04/05 from each pack and access-09, with their original expectations. It is a seven-case regression subset, not a replacement benchmark. Run it using the existing default test visitors; use a new named cohort for the subsequent complete suite. No failed artifact or expected answer was edited.

## Focused regression and model-comparison approval gate

The seven-case work-product subset completed successfully with valid structured drafts/summaries, correct pack isolation and exact source membership. The access summary now returns a separate work product. Artifact: `work-product-e475939a80a294c9b58f1e9d6a720ee7f9a0aef9d1b071e105144653a7fc5f8d.json`; 7 generation plus 4 embedding requests, estimated $0.02146920. Current shared counter: 153 of the approved 250.

Mini still fails the frozen 25% shortening criterion. The optional gpt-5.4 quality comparison named in the original charter was prepared in Render, but **was not saved or deployed**. Automatic approval review rejected Save and deploy twice. The second attempt included the original model-strategy clause and verified remaining allowance; review still required explicit authorization for changing the shared service's paid-model configuration, separate from request-count approval. No alternative save/deploy mechanism bypassed the rejection. The live service remains d4236c3 with gpt-5.4-mini and low reasoning.

Remaining proposed action: set `PATHWAY_RAG_MODEL=gpt-5.4` in the existing Render service and save/deploy the same source revision for the quality comparison. Keep low reasoning, the 250-request allowance's UTC expiry, all existing counters, the 40-request session ceiling and one bounded format repair. The comparison can incur higher per-token API charges; no Pro model or new paid infrastructure is proposed. Resume the complete frozen suite with cohort label `quality-v1`, then the boundary supplement and browser work if the headless gate qualifies.

Focused shortening measurements: Alder 43 → 32 words (25.6%, passes); access 66 → 50 (24.2%, below threshold); fulfillment 68 → 58 (14.7%, below threshold). The unchanged frozen threshold is 25%. The unsaved gpt-5.4 environment edit was canceled after the approval-review rejection, so no pending model change remains in Render.

## Approved cheaper-model comparison

The user subsequently explicitly approved changing the model and clarified that cost efficiency is the requirement: no GPT-5.5, GPT-5.6, GPT-6 or more expensive flagship model. This supersedes the proposed GPT-5.4 comparison above. The candidate is now **GPT-4.1 mini**, with the same Responses API, strict answer schema, retrieval, frozen questions and quality criteria. Its documented standard prices are $0.40/M uncached input, $0.10/M cached input and $1.60/M output, verified 2026-09-12 in the [official model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini). It has no reasoning step, so the request omits the unsupported reasoning parameter. This is a cost-efficient candidate, not a claim that every cheaper model has been evaluated.

The application default and public session model label use the same constant. The allowlist now rejects full GPT-5.4 as well as Pro, 5.5, 5.6 and 6; previous GPT-5.4 mini remains available for reproducible comparison. Existing historical artifacts keep their original model and cost metadata. No request counters or spending caps are reset or increased: the approved 250-request UTC-day allowance and 40-request session cap remain in force. Deployment and actual results will be recorded after verification.

GPT-4.1 mini candidate `5cbcc487181bc3ea545b9fd670fd2d2c42f7e7a1` deployed successfully as `dep-daikr9fqj5pc73ahglh0`. The full 36-turn run is retained in `conversation-df0c6d394ed96701cb354e80510ea0c56d2bd9439c827fb4dadd733ac62b8da1.json`: all turns completed, 36/36 source membership/exactness and pack-isolation checks passed, expected-source recall 96.30%, median latency 3,189 ms, maximum 28,683 ms, 38 generation requests and 33 embedding requests. Estimated cost was $0.05358184, bringing this day's measured rebuild-run estimate to $0.28638438 and provider reservations to 224/250.

**The candidate does not qualify.** Assistant review of the retained output found: Alder-01/08 overstate absent receipt records as proof of nonreceipt; Alder-06 misattributes receipt confirmation to office communication; access-09 again returns `workProduct:null`; fulfillment-02 adds an unsupported compliance rationale; fulfillment-04/05 duplicate draft text in the introduction and imply future updates; fulfillment-08/10/12 assert nonshipment or nonreceipt more strongly than the snapshot supports. Email shortening is Alder 61→46 words (24.6%, below 25%), access 98→52 (46.9%, passes), fulfillment 56→47 (16.1%, fails). These findings are semantic review, separate from the successful transport and mechanical checks; the raw artifact remains unchanged.

The next inexpensive candidate is **GPT-5 mini**, whose standard token rates are $0.25/M input, $0.025/M cached input and $2/M output ([official documentation](https://developers.openai.com/api/docs/models/gpt-5-mini), verified 2026-09-12). Low reasoning, output limit, request caps and prompt remain the same as the earlier mini configuration. The `critical` evaluator selects 14 existing frozen cases covering the failed behaviors and their conversation context; it changes no questions, expected passages or review criteria. This focused comparison is not a replacement for the complete 36-turn qualification or knowledge-switch/browser acceptance. It reuses the `cheap-v1` visitor cohort without resetting counters. No later-phase UI is qualified by the GPT-4.1 mini run.

## GPT-5 mini verification and remaining gate

The first environment edit retained the masked GPT-4.1 mini value despite redeploying the newer source. The first attempted focused run therefore used GPT-4.1 mini and failed its first turn on two `INVALID_CITATION_MAPPING` attempts. Its artifact is `critical-6c9d2ed026ab933f3ac47293c0b372f7ef1e03d8479a0032ef134d3efa86d044.json`; it cost $0.00218440 and is **not** GPT-5 mini evidence. Editing the revealed, non-secret model field fixed the saved value. Deployment `dep-dail1dtg1s2s73fp9jgg` runs source `199bb11e4a59d2cfdb2f4f6821dbce98b397c4ca`; a no-generation session metadata check then confirmed `model:gpt-5-mini`. The evaluator now accepts an expected-model argument and stops before generation if the session reports another model.

Actual GPT-5 mini artifact: `critical-6d70ce1370c59f95695a845fcce5a1c155b579b973a118ba9918cc5f0ac9ae55.json`. Thirteen turns completed; fulfillment-12 was blocked before another provider call when the approved daily allowance reached **250/250**. Completed turns passed 13/13 source membership, exactness and isolation checks. Expected-source recall among completed turns is 97.44%; the raw report includes the failed turn and reports 90.48% across all 14 attempts. Median HTTP latency was 9,277 ms, maximum 20,704 ms. Fourteen generation requests (one repair) plus ten embedding requests cost an estimated **$0.02613581**. Total measured estimate across retained rebuild runs is **$0.31470459**; this is not an account bill.

All three shortening measurements pass the unchanged 25% threshold: Alder 70→39 words (44.3%), access 129→46 (64.3%), fulfillment 99→51 (48.5%). Semantic qualification still fails: Alder-08 opens with an unsupported assertion that the note has not arrived; access-09 returns its summary in answer with `workProduct:null`; access refinement has no fresh warm phrase; fulfillment's original draft calls consent “one last step” and commits to asking intake to re-check the record. The prompt needs improvement before the full suite, knowledge-switch test or UI gate can qualify. Nothing is relabeled as successful model quality merely because transport/citation membership passed.

The next prepared correction organizes the generation instructions into shorter sections, emphasizes record-based status language and noncommitment, and describes the answer/workProduct distinction directly on response-schema fields. A dynamic body-field description includes the existing word budget when a prior draft exists. It adds no classifier, intent-regex conversation engine, factual rewriting or extra model call. The same model, frozen questions and expected passages remain. Local verification passes: type checking, 20 RAG tests, all 89 core tests and production build. These checks do not establish live prompt quality.

Further live calls are blocked by the exhausted approved allowance. A separate inactive proposal allows 150 additional requests (400 total for September 12 UTC) only if the operator explicitly sets `PATHWAY_RAG_ACCEPTANCE_REQUESTS=400` while the existing acceptance day matches. No such setting has been activated. The 40-request session ceiling and UTC expiry remain unchanged. The complete rebuild, UI/browser work and final public acceptance remain unfinished.

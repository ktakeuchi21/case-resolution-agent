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

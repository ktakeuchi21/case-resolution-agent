# Live conversation review — September 12, 2026

This is an assistant review of retained live outputs, not an independent clinical or expert validation. The raw evaluation artifacts remain unchanged with their original `humanReview:null` fields.

## Complete run

Artifact: `conversation-21ab190586f623a0e9c521e7cf6823598ef8c4172bff6a0da837b1ded9a8b200.json`. Runtime `8a2cc08`, GPT-5 mini with low reasoning, frozen `rag-conversation-v1` suite. All 36 turns completed across three 12-turn conversations.

| Measure | Observed result |
| --- | --- |
| Eligible pack/case/current-source isolation | 36/36 turns |
| Cited IDs belong to actual retrieval | 115/115 citations |
| Retrieved/cited text equals canonical stored passages | 36/36 turns |
| Mean expected-passage recall | 98.61% |
| Median / maximum HTTP latency | 6,861 / 14,258 ms |
| Input / cached input / output tokens | 109,241 / 21,888 / 18,630 |
| Generation / embedding requests | 43 / 33 |
| Format repairs | 7; all completed within the single-repair bound |
| Estimated run cost including query embeddings | $0.05972259 |
| Structured drafts and summary returned | 7/7 requests |
| Unsupported amount/tracking questions | 3/3 identify the knowledge gap; no invented amount or tracking number |
| Clinical questions | 3/3 decline to advise; 2/3 explicitly refer to a clinician/pharmacist |
| Contextual why/after, evidence and refinement referents | 12/12 resolved in the selected conversation |

The recall miss is Alder-12's secondary milestone passage. The answer still retrieves the payer-decision boundary and does not predict approval. Mechanical citation precision is distinct from semantic claim support; it is not a claim that every formulation is perfect.

All three refinements retain the intended work product and are shorter than the frozen 75% length ceiling: Alder 66→31 words (53.0% shorter), access 129→63 (51.2%), fulfillment 113→59 (47.8%). More polite request wording and less formal greetings/sign-offs make them friendlier; the warmth is restrained.

## Reviewed wording issues and follow-up

- Alder-11 safely refuses dosing advice but omits the explicit clinician referral required by its review criterion.
- Fulfillment-08 correctly reports unconfirmed shipment but shortens “consent signature missing” to “consent form missing.” This is an imprecise supporting status statement.
- Fulfillment-04/05 introductions refer to the response field `workProduct`. The actual draft bodies contain no implementation metadata or citation markers.
- The earlier focused fulfillment draft assumed that the patient had used the same secure channel for enrollment. The complete run uses the supported generic program secure channel; the next prompt also explicitly prohibits presupposing a past submission channel.

The first two cases are partial passes against their full semantic review criteria, not clean passes: 34/36 meet those complete criteria in this run. Counting the imprecise consent-form statement as unsupported gives 35/36 answers without a material unsupported status formulation. These are answer-level assistant judgments, not a calibrated claim-level hallucination benchmark. No clinical recommendation, payer decision, assistance amount or delivery guarantee was produced.

The follow-up candidate adds precise consent-signature wording, explicit clinician/pharmacist referral and a prohibition on response-field names in prose. The four existing frozen wording cases passed on b698c39; artifact `wording-428ae4d709efd086900ab9386fe4176f5b2dbc95883dcd469c3a14b87339fc6c.json`, estimated $0.00544566. They do not alter the original questions, criteria or retained scores.

## Knowledge-switch qualification and attribution

The first supplement stopped at its fifth question because the server required inline markers for all source-list entries. The charter asks for a simple citations array, not a mandatory inline claim ledger. The corrected contract on `a6fe9cf` retains validated source IDs even when prose has no markers; the interface presents their exact passages under Sources used. Unknown IDs, duplicate IDs and invalid markers remain rejected. No factual prose is rewritten.

The repeated frozen six-step supplement passed: `boundary-d5582513e065633ac9985be499db5cac89cc23df4cca7421625d075438f85cfb.json`. All six completed with 100% expected recall, eligible pack/case isolation, exact source text and immutable historical snapshots. Six generation and three embedding requests cost an estimated $0.00843134; median 7,261 ms, maximum 19,107 ms. No format repair was needed. It changed from Alder's signed office note to fulfillment's consent signature and back, produced/refined the patient message, and explained the absent fulfillment information.

One formal draft includes a prospective offer to ask the intake team to confirm receipt. This is unsent copy for the case manager to review, not an executed action, but it illustrates why drafts need review and why the prompt's no-commitment preference is not a guarantee. Source membership does not establish perfect phrase-level support. The revised headless behavior qualifies implementation of the interface, while this limitation remains visible.

## Before-and-after trace examples

These are actual retained outputs from different evaluated model/prompt candidates, not controlled single-variable experiments.

### What document is missing?

Earlier GPT-4.1 mini answer:

> The missing document is the signed office note including the signature page. The submitted package PKG-1042 only contains a cover sheet, demographic form, and an unsigned office note. No signed note or signature page has been received or acknowledged yet, so the request N-101 for the signed office note remains open [1][2][3][4].

Later GPT-5 mini answer:

> The signed office note (including its signature page) is missing from the submitted package; the inventory lists an unsigned note and no signed note receipt is recorded [1][2][3].

Supporting source list: alder.INV-1042.1, alder.N-101.1, alder.INV-1042.2. Exact passage text and retrieval context remain in the cited raw artifact.

### Summarize this case for my next office conversation.

Earlier GPT-4.1 mini answer:

> Case ACC-2086 involves incomplete benefit verification because the member identifier on the Juniper Plan insurance card provided is unreadable. The office reported a blurry card image and indicated they can check the member number and send a clearer copy, but no legible identifier has been received yet. To proceed, the office needs to either confirm the member identifier or supply a clear copy of the insurance card via the secure channel. Benefit verification can only continue once this information is obtained. It is important to clarify that this next administrative step is distinct from a coverage or prior-authorization decision, which have not yet been initiated or recorded for this case. There is no specified deadline for this process. If issues remain unresolved, escalation should be directed to the benefit-verification team or payer as appropriate [1][2][3][4][5][6][7] [8].

Later GPT-5 mini answer:

> Below is a short, office-ready summary you can use for your next conversation about ACC-2086.

Returned separate summary:

> Case ACC-2086: The Juniper Plan insurance card image we received is unreadable and the member identifier cannot be confirmed. Because of this, benefit verification is incomplete and no benefit result, prior-authorization submission, or payer decision is recorded. The prescriber name and demographic form are on file, but active benefits, PA requirements, patient cost, specialty pharmacy and coverage outcome remain unknown. Please provide a legible copy of the Juniper card or confirm the member identifier through your established secure channel so benefit verification can proceed. This is an administrative step to enable verification, not a coverage approval.

Supporting source list: access.OFFICE-2086.2, access.BV-2086.1, access.BV-2086.2, access.BV-GUIDE.1, access.JUN-01.2. Exact passage text and retrieval context remain in the cited raw artifact.

## Final public review

The public ten-turn browser run completed with exact eligible sources, but two drafts contained unsupported modifiers (extra identifier fields and an assumed prior enrollment channel). The original artifact is `browser-b66d9308dbb1d1b617b21c3693d7b1e78a39660951c7e0c52ad0ffafb739886c.json`. Schema-field drafting guidance on `c346874` corrected those details in two new live drafts, retained in `browser-draft-c927cd94fe2850f3e909b02e38ac2adbbf7b365501b0234b17bc3497ac2c7579.json`. The final checks used the same user requests and canonical corpus in a fresh public browser; no factual postprocessing or extra review-model call was added. Prospective wording remains a review limitation, not a claim that actions occurred. See [the final report](final-report.md) for deployment, screenshots, browser acceptance and the remaining request allowance.

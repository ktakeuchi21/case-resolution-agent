# Pathway Knowledge Packs

Pathway’s three synthetic Knowledge Packs contain 42 documents, 110 section-sized passages and approximately 6,500 words. Each pack has 12 current, case-applicable documents plus two visible exclusion controls: a superseded document and a record for a different case. The knowledge browser and conversation sidebar calculate counts using current-source and case filters.

Version 1.1 adds 18 documents and 72 passages to the original 24-document, 38-passage corpus. All 38 original passages, including their IDs, metadata and exact text, remain unchanged. Existing answer traces retain their own source snapshots. Pack versions describe the catalog edition; individual source versions remain visible.

## Coverage

| Pack | Added material |
| --- | --- |
| Alder documentation | Signed-note quality checklist; submission/receipt reconciliation; missing or disputed note troubleshooting; ownership and handoff worksheet; office-email examples; ALD-1042 recorded briefing. |
| Coverage & access | Member-information reconciliation; returned-benefit review worksheet; conditional authorization-packet preparation; plan-change/discrepancy routing; office-call and email examples; ACC-2086 recorded briefing. |
| Specialty pharmacy fulfillment | Consent completion/receipt checklist; program-to-pharmacy handoff; conflicting consent and intake reports; shipment evidence; patient-message examples; FUL-3091 recorded briefing. |

Each new document has four focused sections. Questions can retrieve a specific checklist, troubleshooting step or example without sending the entire pack to the model. The existing hybrid retrieval still returns at most eight passages. Model, reasoning effort, request ceilings, ranking and case/status filters are unchanged.

## Source boundaries

These are authored fictional program procedures and worked examples, not imported medical literature, real payer rules or legal consent guidance. They do not establish new patient events, actual contact details, turnaround commitments, eligibility, clinical criteria or decisions. Case companions organize the supplied records without advancing their status. Conditional examples explicitly identify events that would have to occur before that wording applies.

The recorded blockers remain a missing signed office note for ALD-1042, an unreadable member identifier for ACC-2086, and a missing consent signature for FUL-3091. Historical deadlines and other-case outcomes stay excluded. Conversation text and generated drafts cannot update those snapshots.

## Verification

Type checking, 89 core tests, 32 RAG tests and the production build passed. Tests cover unchanged original-source hashes, all 18 expansion topics under the lexical control, exact citation validation, exclusion filters, session isolation and historical snapshots. The provider unit tests use synthetic transports.

Browser checks opened every new document across all three packs at 1440×900, 768×850 and 375×640. All nine pack/viewport combinations showed 14 sources and 12 applicable documents, four sections per added document, working keyboard disclosures and no horizontal overflow. A further 12 Chat/Email checks across all scenarios at 1440×900 and 375×520 confirmed visible composers, updated sidebar/drawer counts and Escape/focus restoration. The first immediate resize check sampled an unsettled viewport; waiting for the rendered bounds resolved that test timing issue without a layout change.

Live hybrid retrieval found the intended added guide for all **18/18 expansion topics**. All 54 retrieval traces (36 original probes plus 18 additions) used exact, current, case-applicable passages. Mean recall of the original probes’ specifically named old passage IDs was **68.98%**; newer guides and case companions often occupied those eight retrieval slots. This metric is deliberately retained rather than relabeling different passages as exact hits. It is not an answer-quality score. See the [retrieval trace](../artifacts/rebuild/knowledge-retrieval-d1127f45a733b7547da1f4bae16e78438565ce39466e913a17b73b03b31a0f46.json).

The initial 12-answer expansion check completed with valid citations, but semantic inspection found two briefing responses that contained only an introduction and no substantive briefing. The response instructions now require a complete direct answer whenever no work product is returned. The schema, model and repair count are unchanged. This follows the distinction in [OpenAI’s structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs#handling-mistakes): valid structure does not guarantee correct content. The [initial responses](../artifacts/rebuild/knowledge-conversation-f2676e2206017818b7825ea7d338b2d445eb7100600883893ff64d751a0cdeaa.json) remain available. An initial original-suite run stopped after ten completed answers on HTTP 503 while another evaluation was active; the application’s two-request concurrency ceiling was not changed. [Incomplete run](../artifacts/rebuild/conversation-4560b54a3c765e1a276e331bc2d99baffd46b5056c2a626f7c207790088ff505.json).

The answer-completeness follow-up completed all 12 questions across [eight Alder/access answers](../artifacts/rebuild/knowledge-conversation-e858225c4f370a30db88541fa5be6f4e0b0b985f2e3ecbe7bc14aa2a35648243.json) and [four fulfillment answers](../artifacts/rebuild/knowledge-conversation-8b1dd1c4f50e7cf919166ce8ff8f975c8880eecde3880f3175a61aedc812ec20.json). The first file stopped at a new-visitor rate limit; the remaining pack reused an existing authorized test session without changing limits. All three briefing questions now produced substantive content. Review also caught an unqualified receipt statement and a user-proposed consent report appearing among recorded facts.

A [focused regression](../artifacts/rebuild/knowledge-focused-7a4adcc7a26ad2e60f5bb561449101c9eb2bf3603ab6cffac13054d2b7504d0b.json) completed seven draft, refinement, summary and refusal answers; one final turn stopped before generation and is retained as failed. Access and fulfillment drafts and shorter rewrites were produced. An Alder clinical refusal added an unsupported requirement to document a new dose and rationale. The final prompt clarification keeps clinical questions from adding paperwork and keeps user-proposed events outside recorded case facts.

On the final deployed prompt, five targeted answers completed with exact, applicable source passages: [Alder dosing boundary](../artifacts/rebuild/knowledge-final-alder-ec4ec6d3c1006abdf043bab09fe2b02ca521899a00a0c25b8ad263d34c43ccfb.json), [Access briefing](../artifacts/rebuild/knowledge-final-access-17a631d9d06f654cdb190fe92778ae7413ee82272b2586fe5bdb11091d87a5c3.json), and [Fulfillment reconciliation, briefing and clinical boundary](../artifacts/rebuild/knowledge-final-fulfillment-29d05e7514aade2367853e00db9599b7f77678fab9776e56baf9ecbbb4a592ba.json). The Access briefing qualifies missing receipt as unrecorded. The Fulfillment briefing keeps its recorded-fact list limited to source records after a question proposing a signed-consent report. Both clinical answers refer medication decisions to a clinician or pharmacist, without the earlier new-dose/rationale documentation requirement.

These targeted checks do not constitute a completed new 36-turn semantic qualification. Drafts still need review: the final fulfillment briefing over-restricts sequencing by suggesting a pharmacy-stage query only after consent confirmation, although the guide allows asking about the current stage. The corpus expansion is verified; universal answer correctness is not claimed. The retained original version 1.0 evaluation remains separately labeled; its recall metric is not a claim about the larger corpus.

To repeat the explicit live checks within configured provider budgets:

```sh
node scripts/rag/evaluate-knowledge.ts https://case-resolution-agent.onrender.com retrieval
node scripts/rag/evaluate-knowledge.ts https://case-resolution-agent.onrender.com conversation
```

These commands call the live application and can consume API budget. They retain synthetic traces and answers in content-addressed reports. Source membership and source coverage require separate semantic review; they do not establish clinical or production suitability.


## Public release

Frontend revision `4a088119c89cbea75aa6ae841ac20f52ac3f11e6` deployed as Render `dep-dait19dg1s2s738l8llg`. Final backend revision `cad8eeb9374a9fb33cea0a8b7438528ff9a7a641` deployed as `dep-dait60rm8hqs73e6b2dg`. Both reported Live. The existing hosted database contains the additive 110-passage corpus; missing embeddings were indexed through the bounded provider, using two embedding requests for the 72 new passages.

The public static catalog and JavaScript match the tested build, and the backend catalog reports 42 documents, 110 passages and version 1.1 for each pack. All six public desktop/mobile pack checks passed. [Browser verification](../artifacts/rebuild/knowledge-browser-15e76455c634d7f01e6fee2ff908c88fa9c177fa030331a0391f74c842e937ce.json) also records the local checks. An existing saved answer remained unchanged after reload while its sidebar updated to 12 applicable documents; its original version 1.0 passages remained inspectable. README screenshots show that current workspace.

No model, reasoning, request-limit, retrieval-ranking, database-schema or hosting-plan change was made. Final type checking, 32 RAG tests, production build and hygiene checks passed; the 89 core tests passed during this change.

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

Browser checks opened every new document across all three packs at 1440×900, 768×850 and 375×640. All nine pack/viewport combinations showed 14 sources and 12 applicable documents, four sections per added document, working keyboard disclosures and no horizontal overflow.

Live hybrid retrieval, conversation review and public deployment verification will be recorded here after completion. The retained original version 1.0 evaluation remains separately labeled; its recall metric is not a claim about the larger corpus.

To repeat the explicit live checks within configured provider budgets:

```sh
node scripts/rag/evaluate-knowledge.ts https://case-resolution-agent.onrender.com retrieval
node scripts/rag/evaluate-knowledge.ts https://case-resolution-agent.onrender.com conversation
```

These commands call the live application and can consume API budget. They retain synthetic traces and answers in content-addressed reports. Source membership and source coverage require separate semantic review; they do not establish clinical or production suitability.

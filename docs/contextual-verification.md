# Contextual worker verification

Status: implementation and local verification complete; authenticated Render deployment and redesigned live acceptance remain pending. The Mac was locked when the native browser attempted to open the existing Render dashboard. The new goal is not complete until deployment, live A–M traces, semantic review and post-deployment smoke checks are recorded here.

## Change

The new conversation route uses model-led interpretation, fresh governed retrieval, complete answer/artifact composition and full-text validation. Recipient subject/body, operator context and evidence are separate. Shortening has a measurable word ceiling; SMS has a 250-character and content restriction. The case workspace distinguishes a currently eligible document finding from recorded follow-up preparation. Older turns compact, response stages contain no provisional factual text, regeneration is limited to two descendants, and scoped feedback is persistent. Details are in [the architecture contract](contextual-worker.md).

## Baseline and local evidence

The previous public revision was `acaabee`, with `pathway-synthesis-v5` runtime behavior. Its frozen twelve-prompt core run returned nine accepted turns, two unnecessary clarifications and one provider/support pause. The email grew from 72 to 76 words after “warmer and shorter” (a 5.6% increase). Median observed submission-to-answer latency was 6.242 seconds, maximum 9.262 seconds. Seventeen generation/review requests reported 17,750 input and 3,173 output tokens. The conservative token-only estimate is $0.0121768; this excludes embeddings and unreported failed requests and is not a bill.

Retained baseline core: `artifacts/conversation/contextual-baseline-c888e8d1b1bf0f2d2fb187cd21cd294675972bb14f182e5573066c8c31f271ee.json`. The boundary continuation is `contextual-baseline-047ce55766a630e047b151c5884bc2790a6be25724b774a2df6ae73e9cb29424.json`. It preserved exact history through knowledge switching and retirement but failed recipient clarification, payer-decision abstention and two coherence checks. That continuation is a reference trace; only the twelve-prompt core is treated as an exact conversational pair.

Local browser artifact `contextual-fixture-17c6072c1c569b696d8392fd7a25f4cf8a3417b3dafdf2c3c105143e98917ea6.json` passed 28 UI/API assertions: keyboard newline/send, retained failed input and retry, eight turns, accessible composer/newest answer, compact history, initially collapsed and expandable exact evidence, feedback persistence, fresh regeneration and its cap, desktop/tablet/mobile overflow, and no browser exceptions. This uses a clearly identified deterministic transport fixture and is **not** live model-quality evidence. Manual inspection of the actual 375×812 viewport confirmed the answer at y=174–283 and composer at y=642–812 immediately after a response.

## Commands

- `node scripts/verify-worker.ts`: full typecheck; core governance/retrieval; original generation; agent contracts; parsing/safety; PostgreSQL; workflow; application/Studio; reference evaluation; retirement demonstration; probes; cached PostgreSQL parity. All 240 tests and every listed command passed; prior frozen artifacts remained unchanged. Final artifact: `artifacts/digital-worker/verification-dcdf8d1da778df9506d461488fdd9dba8ae45fd39f9a866d5ff258cecfdd20fa.json`.
- `npm run build`: production build validated 244 files and 160 retained embedding records before the final source rebuild.
- `node scripts/verify-hygiene.ts`: passed; reviewed synthetic fixtures, ignored private credential/cache paths, content-addressed artifact checks. Pattern screening is not universal secret or patient-data detection.
- `npm audit --omit=dev --json`: zero reported production vulnerabilities on September 9, 2026.
- Native Playwright CLI via `python3 scripts/browser/run-contextual.py SESSION fixture ui`: 28/28 assertions, plus manual viewport inspection.
- Existing private redacting deployment wrapper running `scripts/db/cli.ts migrate`: additive `013_conversation_feedback.sql` applied at 2026-09-09T04:11:30.912Z, SHA-256 `b1025228b8035fad460db71bf78aba16f47fd7d99e47e1ba81690301e0ce9226`. Earlier migrations were unchanged.

## Pending live verification

Deploy the verified Git revision to the existing Render service `srv-dag1p2v40ujc73delf20`, then use a fresh browser for the frozen redesigned core and a separate isolated boundary scenario. Retain every pause or failure; inspect the full natural answers, recipient copy, citation entailment, uncertainty attribution and transformation counts against the frozen rubric. Record exact deployed revision and deployment ID. Recheck unchanged historical evidence, no unauthorized effects, public assets and health.

No configured provider, request quota or model has been silently replaced. On September 9 at the budget preflight, the hosted application had 47 reserved daily provider requests. Those reservations include more than this comparison's reported generation tokens. The configured budget must remain enforced; check remaining capacity before live execution.

## Limits and next phase

The new architecture has passed deterministic and local browser tests but its live language quality is not established yet. Full-text model review is fallible; exact-quote validation cannot formally prove English entailment. All data, identities, channels and effects are synthetic. No real communication, clinical recommendation, payer decision or production-readiness claim is made. After the required live acceptance is complete, the next useful phase is an independently authored synthetic holdout and adversarial full-text evaluation before adding operational integrations.

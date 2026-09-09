# Contextual worker verification

Status: the initial contextual releases were deployed and evaluated, but live acceptance failed. A subsequent prose-contract correction passes local verification and requires fresh live qualification. The goal remains incomplete; this report does not represent a successful A–M acceptance.

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

## Live findings and correction

Render deployed `12bd5c005e1e50de48b2cc469a56e07ab5adc1d8` in `dep-dagki661egvs73bfv3ig`, then `0f98855` in `dep-dagkkmu1egvs73bg6ogg`. Both succeeded on September 9. The first pilot paused because generated claim strings did not occur in their declared prose slots. Its committed answer was recovered after the browser transport could not read an NDJSON body; retained pilot `contextual-pilot-46c05192e9a786672c47f6f9273cd40c59888b1ee50fab5d220fb2a6b9486a9d.json` has server timing only.

The corrected capture runner reads committed API state and times submission through display. The exact twelve-prompt run at `0f98855` retained **one accepted turn, ten pauses and one unnecessary clarification**. It passed 49/70 assertions, including the then-current relative-panel newest-response checks, composer/overflow checks, exact evidence expansion, feedback persistence and no conversation effects. Subsequent manual actual-viewport inspection found the lead above the screen: the old assertion checked only panel-relative bounds. M therefore failed manual acceptance, and the assertion now requires actual viewport visibility. The UI correction aligns the entire chat workspace before scrolling the latest lead. The language gates failed. Its median latency was 7.726 seconds, maximum 14.663 seconds. Twenty-two reported generation requests used 45,203 input and 5,949 output tokens, for a conservative token-only estimate of $0.0275996, excluding embeddings and unreported failed-request tokens.

Full stored-output review found **two unsupported claims among the four displayed ledger claims** in the sole accepted answer: the missing note was asserted to cause the lack of follow-up preparation, and to prevent prior authorization/further decisions until receipt. All five exact quote checks passed, and the model reviewer incorrectly approved both causal claims. These results explicitly disprove treating a positive model review or exact quote match as an entailment guarantee. Most rejected turns instead failed claim-to-output alignment; drafting failures then prevented contextual refinements. The generated SMS with restricted document details was correctly paused.

Artifacts: `contextual-redesigned-65043419b9869a996cfecd169dab3e93d1204733cc682054edcc246ed1a53381.json`, manual Codex semantic review `semantic-review-244e1e01036291949cecd35728960f93de359928dfd82343d3fef007c95ce928.json`, and comparison `comparison-838cfd48cd7349a9232c8d1ad678fdbc1544ee97ae9bb7594d5590c2cb4f0f69.json`. The semantic review is not an independent human study. It also corrects a baseline mechanical false positive: the old generic SMS mentions the words patient/document without actually disclosing specific restricted details.

The subsequent correction writes complete prose once as ordered cited segments, derives exact ledger spans without rewriting text, constrains work products to requested deliverables, and makes current rationale and payer authority explicit typed facts. A deterministic guard rejects the observed documentation-dependent payer timing claim. Whole-text review still covers all prose, including anything labeled style. No failed wording is silently repaired, removed or replaced by a fallback.

`node scripts/verify-worker.ts` after this correction passed all **243 tests**, including 64 agent tests, with earlier artifacts unchanged: `artifacts/digital-worker/verification-228c97c2adb68eb3a216270ec8986b3e414c00667db48c6d5ff5a47055e86d02.json`. Production build and hygiene passed. Earlier 240- and 241-test artifacts remain retained. The model remains GPT-4.1 mini.

Fresh prose-contract live checks, boundary A–M completion and final public smoke remain required. At the latest budget check, 71 of 100 configured daily provider request slots were reserved. A temporary increase to 200 was requested for testing, with restoration to 100 afterward; no budget change has yet been authorized or applied.

## Limits and next phase

The initial contextual language evaluation failed; the prose correction has passed local tests but fresh live quality is not established yet. Full-text model review is fallible; exact-quote validation cannot formally prove English entailment. All data, identities, channels and effects are synthetic. No real communication, clinical recommendation, payer decision or production-readiness claim is made. After the required live acceptance is complete, the next useful phase is an independently authored synthetic holdout and adversarial full-text evaluation before adding operational integrations.


## Corrected viewport check

The stricter local UI run passed 28/28 checks in `contextual-fixture-7f7045e8258250fddf9ea62fc0f31420753ae374277eb0cc5497656aa40d5b0d.json`. Actual 375×812 inspection immediately after a fixture response put the direct answer at y=142–250 and composer at y=609–779, with the message field focused. This is UI evidence only, not live language quality. The final alignment also retains the worker identity above the direct answer.


## Focused prose run and subsequent schema correction

The focused live run at `cd2c94576a9b8a8a6269bbe6e0f297ea3591a7ca` is retained in `contextual-redesigned-b9d7d757c47623f3c2d393668069336d3a96640a4d6d26bf539a6879fdc5df29.json`. The next-action answer passed with coherent current rationale and exact materialized prose. Four other turns paused: the Why reviewer returned duplicate verdict IDs, a requested email and SMS returned null work products, and shortening then had no accepted artifact. This focused sequence is not a replacement for the complete frozen comparison. It reports eleven provider requests and preserves all failures.

The next schema correction requires a work-product object whenever the interpreted request needs one, and uses review objects keyed by the exact claim IDs/output slots, then materializes the same persisted review array. This prevents omitted work products and duplicate/missing review entries through the production response schema; runtime guards remain intact. Typecheck, all 66 agent tests, production build and hygiene passed after that change. Fresh live verification remains required.

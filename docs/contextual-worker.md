# Contextual case worker

The live conversation route uses `pathway-contextual-v1`: contextual interpretation, fresh governed retrieval, complete natural composition, deterministic validation, and an independent full-text support review. The model remains `gpt-4.1-mini-2025-04-14`. Explicit scope and execution boundaries are deterministic; ordinary intent, references, audience/channel/tone and length are interpreted by the model. The old claims-only composer remains for explicit evidence mode and compatible application commands, with its historical tests and artifacts intact.

## Contract and authority

`src/agent/turn-contract.ts` defines interpretation, complete proposed turn, material claims with output locations, and full-turn review. `conversation-provider.ts` owns the three prompts and request-specific reference enums. `contextual.ts` builds bounded memory, verifies references, and accepts or pauses the whole turn. `AgentResponse.turn` and `WorkProduct.subject` are optional additions so old immutable JSON still parses and hashes exactly as before.

Interpretation can identify a prior turn/artifact, propose an information need, request a material clarification, or recognize an operational request. It cannot execute one. The service uses `PersistentRetrieval` inside the same scoped transaction as the workflow revision and response commit. For common SC-01 questions the interpreter can reuse the canonical query embedding; every turn still rechecks current eligibility and creates a new EvidenceRecord. A cache hit is not fresh embedding-quality evidence.

A proposed answer includes full answer text, optional rationale, complete subject/body, audience/channel/tone/purpose, a claim ledger, uncertainties, and an operational descriptor that must remain null. Every claim must occur verbatim in its declared output slot and cite an exact current passage or typed fact. Source citations must match eligible, supporting, hash-verified evidence. Conversation facts can only support explicitly unverified uncertainty. The independent review must cover every nonempty answer, rationale, subject and body, including material statements omitted from the proposed claim list. A missing slot, unsupported claim, quality rejection or authority violation pauses the entire answer.

Deterministic checks prove schema, exact source quotation, reference eligibility, output-span presence, required literal facts, length bounds, and explicit channel/authority restrictions. They do **not** prove arbitrary English entailment. The model's whole-text review remains fallible, and generated copy requires human review. Structured output enforces the JSON contract, not factual truth. See [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Memory and work products

Memory includes the last eight relevant turns, the active artifact and latest recorded interaction, deduplicated and marked unverified. Governed facts, workflow facts, human decisions/effects, and conversation reports have separate provenance. Selection filters history by conversation and knowledge key before interpretation. Upload conversations inherit the upload's expiry and deletion. Old evidence remains historical; switching back or retiring a source triggers a new eligibility check and cannot revive retired authority.

Email subject/body, SMS and handoffs are model-written copy. Copy includes only subject and body. Operator next action, owner, checkpoint, completion boundary and review status live outside recipient copy. Exact sources and permission details are collapsed separately. Summaries may include operational context when appropriate for their internal audience, but external copy cannot contain internal labels. All work products remain generated, unsent, and review-required. Editing creates an explicitly unverified version; saved text does not become a workflow fact or CRM record.

A shorter refinement has a hard body-word ceiling of `floor(previousWords * 0.75)`. Tone cannot substitute for length. Required signed-note wording is preserved in non-SMS refinement when freshly supported. SMS permits at most 250 characters and only a generic workspace notification; restricted case/document/person/payer details are excluded. If validation fails, no pretend transformation is presented. A missing work product is not accepted as a completed draft. Constraint failures receive a specific server explanation where the violated word, required-content or SMS bound is known.

Clarification requires a material decision, why alternatives differ, and a concise question. Pronouns alone do not trigger it. The response retains the question/decision; a later answer links back and records resolution, with fresh evidence before composing dependent work.

## Workflow presentation

The SC-01 journal is unchanged. At RECEIVED, evidence may identify a missing note while no follow-up has been prepared. The workspace displays that finding only while its source versions remain eligible. It offers the separate preparation control rather than simultaneously calling the known dependency unassessed. Raw historical snapshots retain their original fields.

| Meaning | Authoritative record / presentation |
|---|---|
| Not assessed | No current eligible finding and no recorded identification |
| Identified by evidence | Current eligible notice/inventory identifies the note; no chat effect |
| Identified in workflow; prepared | `assess` records identification and an effect proposal |
| Authorized and queued | Existing grant checks and ordered authorization/queue events; OUTREACH_QUEUED |
| Simulated follow-up initiated / response pending | Separate dispatch and delivery receipt; AWAITING_RESPONSE |
| Document received / human verification required | Receipt event; VERIFICATION_REQUIRED and role-bound verifier task |
| Bound transfer prepared | Human verifies exact package/destination; TRANSFER_QUEUED |
| Receiving acknowledgment pending | Transfer delivered; AWAITING_ACK |
| Completion | Separate receiver acknowledgment; “Documentation dependency resolved; prior authorization pending.” |

Preparation and authorization are ordered events within the existing atomic command, not invented long-lived states. The model cannot invoke that command or infer payer approval. See [SC-01 state machine](sc01-state-machine.md).

## Interaction and persistence

The composer supports Enter, Shift+Enter, retained failed input, and idempotent retry. Recent turns remain expanded; older turns compact into expandable summaries. After a response, its direct answer stays in view and the composer remains accessible. Evidence expansion stays inside the transcript. No session acknowledgment or style configuration is required to chat; confirmation remains per upload.

`POST /api/conversation` retains JSON compatibility and optionally accepts `application/x-ndjson`. Only four fixed stage identifiers are streamed before commit: understanding, retrieving, composing, validating. No provisional factual text is streamed. The final record appears only after validation and transaction commit. Interrupted clients retry with the same idempotency key to recover a committed result.

Regenerate uses the original question and its original conversational context with fresh retrieval and validation. A root answer permits two regenerated entries across refreshes, enforced under the session transaction lock. New entries link to the original; history is not rewritten. Provider failures still consume reserved request budget. Explicit regeneration is separate from transport retry.

`POST /api/agent-feedback` records one helpful/not-helpful vote per available entry in the session workspace. Migration 013 links feedback to the actual governed or temporary answer. A conflicting repeat does not overwrite the first vote. Temporary feedback cascades when its parent upload-derived entry is deleted. Feedback grants no authority and does not mutate an answer.

## Verification and limits

The frozen core catalog is `scripts/browser/contextual-cases.json`, SHA-256 `b69c46bfc4ddda87afbe57c3b225d2b59cecd613692b60dbd1884a736e93ae26`. The previous public revision is `acaabee` (runtime v5). Core comparison uses the exact same twelve prompts, with separate isolated visitors. The earlier boundary continuation is retained as a reference trace; a separate boundary group avoids conflating session budgets with model quality. Browser runners retain failures, raw accepted/paused responses, elapsed browser time and provider usage. Semantic rubric review remains separate from mechanical assertions. See the final verification report for live results; local fixtures are never labeled live model quality.

The three model phases add latency and request cost; staged UI does not remove that cost. The existing daily/session caps remain. No API key, provider response headers, cookies or database passwords are exposed. No automatic retry, weaker retrieval fallback, real communications, payer decision, clinical recommendation or enterprise readiness is claimed. The selected model supports strict structured output and streaming; the application uses validated stages rather than token streaming. See [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). At the published September 9, 2026 rates, a conservative token estimate is input tokens × $0.40/M plus output tokens × $1.60/M, ignoring cached-input discounts. It is not a billing record and excludes unreported failed requests and embeddings.

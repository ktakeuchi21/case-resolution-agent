# Headless rebuild verification checkpoint

This is an implementation checkpoint, not completion or a model-quality claim.

## Executed checks

- Preservation branch `preserve/pre-rag-rebuild-2026-09-11` and exact local archive recorded in the rebuild charter.
- Three packs, 24 documents and 38 exact section passages implemented and seeded locally and in the existing Supabase project through additive migration 014. The previous schema and its historical artifacts remain unchanged.
- Type checking passes. All 89 original core tests pass. All 15 new RAG unit, real PostgreSQL persistence and HTTP tests pass.
- Production build passes: 260 packaged files and 160 validated legacy embedding-cache records. Those legacy vectors are not evidence about new-corpus retrieval.
- Secret-hygiene check passes over 386 text files and validates 122 retained content-addressed artifacts. This is a pattern/packaging check, not a universal secret detector.
- Frozen suite has 36 cases, 12 per scenario. Lexical-control mean expected-passage recall is 87.5%; pack/case/status filtering passes. Source corpus, expected cases and control results are frozen in `artifacts/rebuild/frozen-3081f906a31a888c17f262a8ac44cdd5d85914fc6938074a4e5b3db7224dc599.json`.

## Focused implementation review

The repository's deployment routing selects Security Best Practices. The service uses native Node HTTP and TypeScript; the installed skill has no native-HTTP backend reference. Its general secure defaults and vanilla-JavaScript frontend guidance apply. New model output will be rendered using safe DOM text nodes; raw model HTML must never become markup.

The new API inherits exact origin checks, cross-site rejection, CSRF checks, HttpOnly/SameSite/Secure production cookies, a two-request concurrency ceiling and persistent attempt/rate limits. Sessions expire after four hours; RAG conversations and turns cascade with session deletion. PostgreSQL row-level policies require the server-selected session context. Client requests cannot select session identity, model, arbitrary source passages or operational permissions.

Runtime passage access is read-only except server-generated embeddings. The administrator seeds canonical passage content. Hashing uses canonical JSON so PostgreSQL JSONB key reordering does not invalidate correct text. Current-pack, current-case and current-source filtering precedes ranking; results are checked again before use. Historical turns retain exact retrieved passage snapshots and citation mapping.

Every embedding and generation request reserves the existing shared provider allowance. Rebuild limits are capped at 100 daily / 40 per session or the configured lower value. No retry refunds; at most one schema/citation repair with unchanged retrieval. The model has no execution tools. Logs contain bounded event identifiers and technical codes, not secrets, raw provider responses or submitted text.

Observed and corrected during local review: canonical JSONB hashing mismatch; possible global request-ID collision silently failing to save a turn; test-only HTTP header typing. No known critical issue remains in the reviewed headless paths. Live model grounding and UI rendering remain unqualified until their acceptance runs.

## Approved headless deployment

The user explicitly approved the precise repository/main push, preservation branch publication and existing-service deployment on September 12. Both branches were pushed successfully. Render deployed revision `c0685b20f30c8ab7480800cc1c1ffa6cca8c50b9` in deployment `dep-daijvm1594qs7392n9kg`; the dashboard reported Live after 40.8 seconds. The public synthetic catalog returns three packs and 38 passages.

The initial automatic approval rejection was respected; no alternative path bypassed it. The retry followed new explicit user authorization.

Frozen live retrieval completed: 36/36 pack/case/status isolation checks and exact passage checks passed. Mean expected-passage recall is 98.61%, compared with 87.5% in the frozen lexical control. The one miss is the secondary milestone glossary for Alder's payer-approval question; retrieved evidence still contains the explicit payer-decision boundary. Corpus/query preparation used two embedding calls, 4,376 tokens, estimated $0.00008752. Retrieval median 85 ms, maximum 186 ms excludes preparation. Artifact: `artifacts/rebuild/retrieval-3b7b7f4513dd375d625cff7ed00b6bf30f6bb7dc2655bd41459089637a74fd78.json`.

Live conversations and knowledge switching must be reviewed before UI implementation.

## Initial model configuration and pricing basis

This section records the initial checkpoint. The current cheaper candidate is GPT-5 mini; its actual results and unresolved quality issues are in [the live review](live-review-2026-09-12.md). Full GPT-5.4 is no longer allowed by the rebuilt application.

Default generation: `PATHWAY_RAG_MODEL=gpt-5.4-mini`; supported optional comparison `gpt-5.4`; `PATHWAY_RAG_REASONING=none` unless evaluation supports low. Server-only Responses API with structured output, `store:false`, 2,400 output tokens and a 30-second deadline. Embeddings: `text-embedding-3-small`, 1,536 dimensions. No Pro model is accepted.

Official model documentation: [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [embedding model](https://developers.openai.com/api/docs/models/text-embedding-3-small). Mini estimates use $0.75/M input, $0.075/M cached input and $4.50/M output; embeddings use $0.02/M tokens. Estimates are not bills and exclude other account traffic.


## Earlier local continuation verification — September 12

The initial goal turn made concrete implementation progress. This continuation inspected the actual checkout and confirmed it is still ahead of the deployment remote; the requested repository approval has not arrived. It did not retry the rejected push.

Independent improvements now retain token/request measurements on failed bounded repairs, report missing provider usage as unknown rather than zero, and include corpus/query embedding preparation in evaluation cost totals. Provider request ceilings and the one-repair limit are unchanged. The usage latency now includes retrieval/embedding time within the provider instance, while the evaluation runner also measures HTTP elapsed time.

A frozen six-step knowledge-switching supplement exercises Alder → fulfillment → Alder, repeats the same missing-document question, drafts/refines a fulfillment message and verifies historical citation snapshots. Its manifest is `artifacts/rebuild/boundary-frozen-a819d6c1bb4de703e7a5f4fd4109d09158545467e60ab6e386dcfc84ef4b6073.json`. This is an unexecuted live-test definition, not a result. Local PostgreSQL tests separately prove unchanged historical answer/source snapshots across switches.

Independent checks at that checkpoint: 15/15 RAG tests; type check, 260-file production build and secret hygiene pass. Live retrieval, live conversation, browser UI and deployment gates remain incomplete. The original 36-case frozen suite is unchanged.

Read-only public verification returned HTTP 401 for `/api/rag/catalog`; the new candidate route returns the public synthetic catalog before session authentication, so the candidate is not live. No provider request or session creation was made by this check.

## First live conversation findings

The first run stopped at access-05 after its bounded format repair failed. Sixteen completed turns and one failed turn are retained unchanged in `artifacts/rebuild/conversation-4a548d9ce0d55ff3d66c85721f84b64a92c5c9d721eda91fb41bb34d10dde691.json`. It used 22 generation and 15 embedding requests, estimated $0.05358749. This candidate did not qualify the conversation gate.

Review found that a long earlier document subject crowded out evidence for new topics; Alder's after-submission answer missed the receipt/completeness passage and blurred those milestones. The paraphrase answer also opened with an unsupported assertion that the note had not arrived before qualifying the recorded status. Email shortening was achieved but warmth was weak. Runtime logs identified the failed access refinement as `ANSWER_FORMAT`; the original implementation did not retain the individual validation category, so its precise subtype is unknown.

The correction ranks a separate current-question vector alongside the contextual vector (batched embedding request, cached independently). Very short follow-ups rely on context. Filtering still precedes ranking and the limit remains eight passages. Generation now references passage IDs directly in claim text; the server converts validated IDs to readable numbers. This removes model arithmetic from citation formatting without changing prose or evidence. Bounded diagnostic categories identify future format failures without logging request text or model output. Instructions explicitly distinguish unrecorded receipt from proven absence and require an appreciative tone when warming a draft. New actual live results are required; these fixes are not yet model-quality evidence.

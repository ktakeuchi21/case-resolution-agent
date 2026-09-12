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

## Pending external gate

Candidate source is committed locally in the deployment checkout at `8a4d7f7` (implementation `12f81e3`). Automatic approval review rejected the push because it requires trusted explicit authorization for `ktakeuchi21/case-resolution-agent` and its `main` branch. A precise approval request is pending. No alternative path was used to bypass the rejection.

After approval: push the reviewed candidate and preservation branch; deploy the existing Free Render backend; run frozen live retrieval; inspect failures; run live multi-turn conversations; review all actual outputs before UI implementation. Keep every failed attempt as evidence.

## Model configuration and pricing basis

Default generation: `PATHWAY_RAG_MODEL=gpt-5.4-mini`; supported optional comparison `gpt-5.4`; `PATHWAY_RAG_REASONING=none` unless evaluation supports low. Server-only Responses API with structured output, `store:false`, 2,400 output tokens and a 30-second deadline. Embeddings: `text-embedding-3-small`, 1,536 dimensions. No Pro model is accepted.

Official model documentation: [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [embedding model](https://developers.openai.com/api/docs/models/text-embedding-3-small). Mini estimates use $0.75/M input, $0.075/M cached input and $4.50/M output; embeddings use $0.02/M tokens. Estimates are not bills and exclude other account traffic.


## Continuation verification — September 12

The initial goal turn made concrete implementation progress. This continuation inspected the actual checkout and confirmed it is still ahead of the deployment remote; the requested repository approval has not arrived. It did not retry the rejected push.

Independent improvements now retain token/request measurements on failed bounded repairs, report missing provider usage as unknown rather than zero, and include corpus/query embedding preparation in evaluation cost totals. Provider request ceilings and the one-repair limit are unchanged. The usage latency now includes retrieval/embedding time within the provider instance, while the evaluation runner also measures HTTP elapsed time.

A frozen six-step knowledge-switching supplement exercises Alder → fulfillment → Alder, repeats the same missing-document question, drafts/refines a fulfillment message and verifies historical citation snapshots. Its manifest is `artifacts/rebuild/boundary-frozen-a819d6c1bb4de703e7a5f4fd4109d09158545467e60ab6e386dcfc84ef4b6073.json`. This is an unexecuted live-test definition, not a result. Local PostgreSQL tests separately prove unchanged historical answer/source snapshots across switches.

Current independent checks: 15/15 RAG tests; type check, 260-file production build and secret hygiene pass. Live retrieval, live conversation, browser UI and deployment gates remain incomplete. The original 36-case frozen suite is unchanged.

Read-only public verification returned HTTP 401 for `/api/rag/catalog`; the new candidate route returns the public synthetic catalog before session authentication, so the candidate is not live. No provider request or session creation was made by this check.

# Controlled evidence explanations

The application explains already-governed evidence; generated text cannot determine source authority, case applicability, communication permission, action permission, or a workflow transition. The server uses `generate(record, query, options)` from `src/generation/index.ts`. A query must match the question that produced the evidence. The caller authenticates and authorizes historical evidence access, then persists the returned result through its immutable application audit boundary.

The default path is deterministic extractive explanation, visibly labeled **“no language model was called.”** It retains all approved exact claims and citations. This is the no-credential experience, not an assertion of live model quality. Choosing a provider explicitly enables model selection of claim order and one bounded explanatory paragraph. It cannot invent, paraphrase, omit, or add a supported claim. The full claim set is checked again after structured-output parsing. A provider failure pauses the explanation and never falls back silently.

The explanation reports its evidence timestamp and is historical context only. It cannot make old evidence current after retirement. Every new operational action must still use the workflow engine's current governance recheck. Citation text is untrusted display content and must be rendered as text, never raw HTML. No external tools, action executor, registry mutator, or database connection is exposed to generation.

## OpenAI provider

`src/generation/openai.ts` implements the provider-neutral selection interface using the Responses API, `store: false`, strict JSON Schema, and pinned `gpt-4.1-mini-2025-04-14`. Current official documentation was fetched on September 7, 2026: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [GPT-4.1 mini model](https://developers.openai.com/api/docs/models/gpt-4.1-mini). These documents establish Responses/structured-output support, the snapshot identity, refusal handling, and published standard input/output prices. This narrow task does not need reasoning tools or broad generation privileges.

The API key is read only by the server constructor from `OPENAI_API_KEY` or an explicit server argument; the private field is not serialized. There is no configurable endpoint, redirect following, client bundle import, key logging, provider error-body logging, or automatic retry. Model responses with refusal, incomplete status, unexpected model, unsupported fields in the selection, malformed usage, or changed claim sets fail closed.

Reuse one provider instance per server. Defaults are one in-flight request, three attempts per rolling minute, ten attempts per process lifetime, a twelve-second request timeout, a 16,000-character input bound, at most twelve claims, 512 output tokens, and a 64 KiB response limit. Limits can only be configured within bounded schema ranges. These process controls are defense in depth, not durable billing protection: the application must enforce authenticated, durable global/session quotas before exposing paid generation publicly. A process restart resets this provider's counters. Do not create an instance per request. No automatic retry avoids duplicate cost when a timeout leaves the provider's billing outcome unknown.

The audit contains prompt version and prompt/input hash, provider/model, evidence ID/hash/timestamp, query hash, disposition and reasons, requests, token counts when available, estimated cost, latency, retry policy, and `execution: none`. Cost uses published standard input $0.40/M and output $1.60/M as an estimate and does not credit prompt-cache discounts. Failed attempts report unknown cost; preflight rate rejection reports zero attempts and zero cost. This module makes no claim of measured live language-model quality.

## Fail-closed cases

- Conflicting authoritative evidence pauses before any model request.
- Missing, unsupported, unrelated, or inapplicable evidence abstains.
- Communication denial prevents source-based answers.
- Retired/provider-paused evidence remains paused.
- Sandbox answers remain explicitly sandbox-only and retain denied operational permission.
- Exact claim/citation mismatch pauses.
- Model-authored assertions, permissions, commands, invented IDs, duplicate IDs, and omitted claims are rejected.
- Only reviewed claim strings reach the model; surrounding uploaded instructions do not. A defense-in-depth instruction detector blocks suspicious approved claim text, but the detector does not establish source trust or applicability.

## Verification

Run `node --test tests/generation/*.test.ts` and `npm run typecheck`. Tests cover exact citations and immutable input, permitted reordering, malicious output fields, missing/duplicate/invented claims, conflicts and insufficient evidence, communication and applicability controls, evidence/query binding, altered/ineligible citations, injected instructions, sandbox authority separation, the Responses request contract, credential redaction, refusal/malformed responses, timeout/body limits, process request caps, and explicit failure without fallback. All provider tests use injected HTTP transports; none spend tokens or establish live model quality.

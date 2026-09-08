# Running the headless retrieval spikes

September 8 conversation increment: see [the conversation-first experience, contracts and verification status](conversation-experience.md) and [execution record](conversation-execution.md). Earlier phase sections below retain their historical scope.

## Phase 2D: persistent headless workflow

Read [SC-01 execution contract](sc01-state-machine.md), [verification](phase2d-verification.md) and the [runbook](persistence-runbook.md). With the local database running and the preserved Phase 2B embedding cache available:

```sh
npm run db:migrate
npm run typecheck
npm test
npm run test:postgres
npm run test:workflow
npm run eval:postgres
npm run workflow:demo
npm run audit:postgres
npm run audit:workflow
```

The demo creates unique synthetic workspaces, provisions the explicit SC-01 grant, executes eleven independent scenario traces and writes exclusive content-addressed artifacts under `artifacts/phase2d`. It reuses real cached vectors and performs no provider calls. Missing cache data causes a visible pause/failing positive-path demonstration, never fake vectors or automatic lexical fallback. Original artifact-writing `eval`/`demo`/`benchmark` commands remain frozen; use the parity command above.

`WorkflowEngine.execute(actor, command)` validates typed commands and persists rejected/duplicate results. `WorkflowRepository.read` reconstructs and validates the complete chain. Supply stable command IDs for retries; a different payload under an existing ID is rejected. `prepareDispatch` records the attempt before `dispatch`; recovered attempted/unknown work calls `reconcile`, never a blind resend. Read `nextBestAction(snapshot)` to explain state; it does not authorize an effect.

`WorkflowWorker` performs one bounded queue poll, using durable leases and fresh action gates. To advance an existing demo workspace explicitly, use `npm run workflow:tick -- <workspace-from-trace> <September-2026-ISO-time>`. The clock must not move backward. It handles due work and simulated outbox operations only; no daemon, real CRM or messaging service is installed. New process reconstruction can be checked with `node scripts/workflow/reconstruct.ts <workspace> SC-01`.

Actors are trusted synthetic fixtures: Avery verifies/approves a package, Morgan clarifies, the supervisor owns exceptions, `agent.sc01` runs bounded commands, and `receiver.sc01` reports matched acknowledgments. These strings are not authentication tokens. Only the publisher provisions/revokes workflow grants or a bounded system degraded-policy grant. An unresolved conflict, missing authority, sandbox mode or revoked grant cannot be overridden by a human task response.

## Phase 2C: durable headless prototype

Use the [local database runbook](persistence-runbook.md) for installation, start/migrate/seed, integration tests, restart and recovery. [The data model](data-model.md) and [ADR-002](adr/002-durable-governance.md) define transaction/isolation guarantees. `PersistentRetrieval` is the application entry point; it selects hybrid by default. Existing `KnowledgePipeline`/`Registry` and the lexical CLI remain memory-backed controls.

```sh
npm run db:start
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run test:postgres
npm run eval:postgres
npm run demo:postgres
npm run audit:postgres
npm run db:stop
```

The durable service loads a Zod/hash-validated scoped snapshot after acquiring the transaction lock. Use `GovernanceRepository` for lifecycle changes; mutating a detached in-memory Registry does not persist an event. Retrieved results escape only after evidence, diagnostics, decisions, audit and idempotency commit together. Duplicate request IDs return labeled historical results; use new IDs for new operational reliance.

Cache-only embeddings are the durable prototype's default; `.local/embeddings` supplies the preserved live vectors to parity/demo commands. Ordinary tests use explicitly labeled unit vectors and make no external API calls. A new live provider must be deliberately injected by a trusted caller; a missing cache entry does not trigger an automatic API call or lexical fallback. Lexical operation requires an acknowledgment bound to actor/request/time, and a named system policy additionally requires a durable scoped grant.

No retrieval thresholds, BM25 behavior, RRF behavior or frozen fixtures changed. See [verified results and remaining limits](phase2c-verification.md).


## Phase 2B: semantic/hybrid evaluation (live gate reviewed)

Read [the comparison report](phase2b-comparison.md) and [retrieval configuration/contracts](retrieval-configuration.md). Real OpenAI embedding, exact cosine and reciprocal-rank-fusion implementations are available. The completed live comparison selects hybrid for the prototype (D-29): semantic/hybrid 36/36 correct versus lexical 31/36. The factory compatibility default is still lexical in unchanged code; explicitly configure hybrid for prototype use. Cache warming prevents an equal cold latency/cost comparison. Lexical degradation requires recorded human acknowledgment or preauthorized bounded system policy; that flow is not yet implemented. No generated conversational answers, hosted infrastructure or UI was added.

```sh
npm run typecheck
npm test
npm run benchmark
npm run trace:contracts
```

**Preserve the live baseline before running artifact-writing commands.** The current benchmark CLI refreshes convenience `artifacts/phase2b-*.json` files and its top-level decision prose is hard-coded D/lexical. The [reviewed comparison and preservation manifest](phase2b-comparison.md#preservation-and-verification) are authoritative for the decision. Future runs should use an isolated copy/output location with separately labeled artifacts; do not overwrite frozen exports or change their labels/configuration. `npm run typecheck` and `npm test` are safe read-only verification commands for those exports.

Without `--live`, `benchmark` runs the frozen 36-query set five times under BM25, reruns all 23 Phase 2A references and the retirement demo, and writes Phase 2B reports/traces plus ignored local evidence and content-addressed run snapshots. The semantic/hybrid arms are explicitly `not_run`; offline completion is not a successful four-mode comparison. `trace:contracts` uses prominently labeled handcrafted unit vectors for adversarial governance mechanics. Its results are never imported into the quality benchmark.

For a separately authorized new real comparison in the isolated experiment location, export `OPENAI_API_KEY` in the current shell using your normal secret-management process, then run:

```sh
npm run benchmark -- --live --require-all-modes
```

The example `.env.example` contains no key; Node does not automatically load it. Never paste keys into project files or commit an actual `.env`. Live mode sends synthetic fixture passages and query strings to the documented embedding endpoint and incurs usage charges. It never loads Codex/Claude credentials. Without `--live`, the benchmark makes no provider calls even if a key exists. Without a key, `--require-all-modes` exits 1 and preserves explicit missing-measurement rows. Transport failure also exits nonzero without lexical substitution.

`.local/embeddings` caches actual vectors. Repeated arms/runs share compatible cache entries, so later semantic/hybrid measurements can be warm; reports expose cache hits/misses, first/later timings and billed-token estimates per arm. Repeats establish cached replay reproducibility, not independent fresh API determinism. Change the embedding identity revision to intentionally refresh vectors; do not relabel fabricated vectors as cache data. A changed gold/corpus file invalidates the experiment checksum: create a new version with new labels/configuration rather than tuning the frozen challenge rows.

The factory accepts all three modes. Phase 2A `eval`, `demo`, `probes` and their expected outputs remain lexical controls; they do not follow a global mode override. Lint remains unconfigured. The complete suite now contains 67 tests (44 preserved, 23 added); the handcrafted contract trace adds independently executed assertions. Test counts and reference queries are not independent real-world safety trials.

## Historical Phase 2A baseline

Phase 2A implements executable knowledge contracts and a local retrieval/governance pipeline. It proves the source-retirement boundary with fictional administrative fixtures. It does not implement the browser product, document uploads, an SC-01 state machine or an action executor.

## Run

Use Node.js **24.12 or later** and npm. Install the exact dependencies from the lockfile once; subsequent tests and demonstrations run locally without credentials or network calls. Node runs TypeScript through native type stripping; `tsc` separately checks types. The runtime contracts use Zod 4.

```sh
npm ci
npm run typecheck
npm test
npm run eval -- --out artifacts/phase2a-evaluation.json
npm run demo -- --out artifacts/phase2a-retirement-trace.json
npm run probes -- --out artifacts/phase2a-retrieval-probes.json
```

`npm run check` runs type checking, all unit/integration tests, evaluations and the demo. Linting is not configured. The demo additionally writes content-addressed evidence files under `.local/evidence/`, which is ignored by Git. Repeating an identical run is safe; an existing evidence file with different content is rejected. Each CLI supports only its optional `--out path.json` argument; evaluation or assertion failures exit nonzero.

The fixtures and simulation clock are fixed at September 10, 2026, 16:00 UTC (10:00 America/Denver). This is independent of today's date. Retirement is recorded at 16:05 and the next attempt runs at 16:06. Interval starts are inclusive; expiry, supersession and review boundaries are exclusive of further use. Active retirement wins even if a test clock is rewound. There is no request-supplied clock override.

## What the demo proves

| Step | Result | Evidence |
| --- | --- | --- |
| Approved SC-01 attempt | Answer; recommendation permitted | K-PA.v2 process, N-101.v1 request and CE-101-01.v1 missing-item inventory agree |
| Publisher retires K-PA.v2 | Append a retirement; original source and release stay unchanged | Attributed retirement record and changed registry hash |
| Next operational attempt | Pause; action paused | `SOURCE_RETIRED`; educational content cannot replace payer authority |
| Read earlier evidence | Same record hash and exact source excerpts | Historical access check and source locator resolution |
| Ask the sandbox replacement | Sandbox quotation allowed; operational action denied | `SANDBOX_ACTION_DENIED` |
| Retry the operational request | Still paused | No sandbox passage is used; historical evidence still matches |

The replacement document is preseeded in a separate owned collection. Querying it after retirement stands in for offering a similarly worded replacement; upload and restore endpoints are not implemented. All actions and escalations are proposals, explicitly `not_executed` / `proposed_not_dispatched`. A permitted recommendation does not mean a document was sent or a dependency resolved.

The complete four-record sequence is in [the retirement trace](../artifacts/phase2a-retirement-trace.json). [The evaluation report](../artifacts/phase2a-evaluation.json) lists expected eligible sources, actual retrieved sources, exclusions with reasons, evidence, the four decisions, disposition and pass/fail for each reference case. [The retrieval probes](../artifacts/phase2a-retrieval-probes.json) expose a known lexical recall gap separately from governance correctness.

## Code map

| Module | Responsibility |
| --- | --- |
| [contracts.ts](../src/contracts.ts) | Strict runtime schemas and inferred types for sources, versions, passages, collections, packs/releases, assignments, context, requests, decisions, evidence, proposals, escalations and audit |
| [build-fixtures.ts](../scripts/build-fixtures.ts), [corpus.json](../fixtures/knowledge/corpus.json) | Rebuildable synthetic sources, exact locators, annotations, manifests, roles and assignments |
| [registry.ts](../src/registry.ts), [integrity.ts](../src/integrity.ts) | Reference and checksum validation, immutable corpus, release manifests, trusted identity directory, retirements and vetted conflict findings |
| [provider.ts](../src/providers/provider.ts) | Provider-neutral indexing/search contract with exact eligible canonical IDs |
| [local-lexical.ts](../src/providers/local-lexical.ts) | BM25 candidate retrieval over the authorized subset, deterministic tie-breaking |
| [policy.ts](../src/policy.ts) | Tenant/case/assignment/pack access and source scope/date/use/channel filters |
| [support.ts](../src/support.ts) | Domain-specific authority, annotated conflicts, task evidence requirements and eligible claim selection |
| [pipeline.ts](../src/pipeline.ts) | Ordered governance gates, provider-result validation, source support, applicability, communication, action and evidence composition |
| [evidence-store.ts](../src/evidence-store.ts) | Frozen content-addressed snapshots, exclusive creation, integrity and historical-access checks |
| [evaluation.ts](../src/evaluation.ts), [cli.ts](../src/cli.ts) | Reference evaluations, retirement sequence and diagnostic queries |
| [contracts.test.ts](../tests/contracts.test.ts), [integration.test.ts](../tests/integration.test.ts) | Boundary, race, tampering, filtering and reproducibility tests |

`npm run fixtures:build` deterministically regenerates the corpus. It is a development fixture builder, not an approval or publication endpoint. `reseal` in the evaluation helpers likewise models a separately reviewed fixture revision; operational callers cannot invoke it through a retrieval request. Editing published content or metadata without rebuilding its manifest is rejected.

## Pipeline and trust boundary

The caller supplies a typed administrative task, question, selection and requested action. `KnowledgePipeline.run(actorId, request)` resolves the actor and case from the trusted fixture directory. The actor argument models server-authenticated identity; it is **not an authentication service**. Never expose this library directly as a public endpoint accepting arbitrary actor IDs. Requests cannot supply roles, grants, approval flags, case attributes or an as-of clock. Task interpretation is explicit; no natural-language intent classifier exists.

Pathway authorizes the case and assignment, checks mandatory pinned releases, intersects release and document scopes, and compiles exact canonical passage IDs **before retrieval**. Unknown scope/context is not a wildcard. A verified `not_applicable` declaration permits generic guidance such as SC-03 intake without making a coverage determination. Provider candidates must return permitted IDs, correct source hashes and sequential ranks. Invalid, out-of-scope, stale or unavailable provider output fails closed. A retirement during a search invalidates that attempt before evidence is released.

BM25 uses actual question terms with stop-word filtering and positive-score results. It has no embeddings, synonym expansion, query rewriting, second reranker or hidden fixture-answer lookup. Only retrieved passages can establish answer support. A full scan of eligible reviewed statements, plus explicitly registered and still-applicable conflict findings, can block that support even outside top-k. Supplemental conflict passages may appear in conflict evidence although they are excluded from the selected pack's answer-candidate set; they never authorize an answer. This is structured conflict checking, not general prose interpretation.

The composer quotes only reviewed statements with the required authority and task kind from the selected evidence. SC-01 requires agreement between process requirement, verified case request and package inventory. It does not infer absence from a guide. Communication can permit a bounded abstention explanation while source support remains missing. Document-transfer approval is independently required even when a quotation may be communicated; the spike has no mechanism to grant that approval or perform a transfer.

Each EvidenceRecord includes request/context snapshots, corpus and registry hashes, release IDs/manifest hashes, provider configuration, eligible/retrieved/excluded sources, exact citation text/hash/locators, authority findings, four structured decisions, answer/action/escalation proposals and ten audit events. IDs are SHA-256 hashes of canonical JSON. Locations use JavaScript string offsets (UTF-16 code units), with end-exclusive ranges and one-based lines; they are **not byte or PDF-page offsets**. Table fixtures retain headers, rows and limiting footnotes. No PDF parser or OCR is exercised.

## What remains simulated or untested

- Identities, approvals, provenance verification, metadata confirmation and statement annotations are trusted, authored fixture records. Their presence tests rules; it does not prove human review occurred. All 19 versions and 19 passages are fictional, without patient records.
- The local index contains the small synthetic corpus in one process. Tenant/mode boundaries are enforced logically in the pipeline and search subset. Separate deployed data projects, network isolation, real authentication and external-provider authorization remain untested.
- Source/pack retirement and conflict events are held in memory per Registry instance. A new harness starts a fresh scenario. File-backed evidence survives reopening, but runtime governance events do **not** survive a registry restart. Durable revocation storage and transactional checks are required before a service can serve operational requests across restarts.
- Evidence is append-only through this API and tamper-evident on reads/writes. A filesystem owner can still alter/delete files. There is no signed audit ledger, production immutable storage, retention scheduler, hard deletion/tombstone implementation or backup lifecycle.
- Prompt-injection fixtures are untrusted content; there is no interpreter, model or executor to obey their instructions. The benign quotation is separately annotated and the original malicious text remains in the auditable source. These tests prove containment in this architecture, **not LLM injection resistance** or successful security scanning of arbitrary uploads.
- Phase 2B adds actual embedding calls and semantic/hybrid evaluation, superseding the original Phase 2A no-provider limitation. There is still no generative answer model, independently held-out quality set, balanced cold-provider latency/cost study, fresh-provider repeatability study or hosted cost estimate. The live report separates cached replay from new embedding usage.

## Phase 2A recommendation (superseded by the Phase 2B gate)

Choose **A: expand real retrieval**. The two-query diagnostic retrieves all three gold passages with literal fixture vocabulary, but zero with “Which clinician-authenticated encounter narrative remains outstanding?” The latter safely abstains. This is a concrete capability gap, not a representative accuracy estimate.

Add one real semantic/hybrid adapter behind the same eligible-universe contract; evaluate paired literal/paraphrased questions and unseen synthetic examples with source-level gold sets. Preserve the local provider as the offline control. Require locator fidelity, retirement rejection, conflict escalation and the four decisions to hold unchanged. Measure retrieval recall separately from governance failures. Before any model or external deployment, add its specific conformance tests and persist active revocations. These findings do not yet justify expanding SC-01 transitions or designing the Studio interface.

## Browser portfolio development

After `npm ci`, start the local database and apply migrations with `npm run db:start` and `npm run db:migrate`. Run `node src/app/server.ts`, then open `http://127.0.0.1:3000`. Launch seeds an isolated synthetic workspace. Refresh and server restart retain the case. No OpenAI key is needed; arbitrary uncached questions pause rather than creating paid requests. Only the downloadable synthetic TXT fixtures are accepted for upload.

Use `npm run typecheck`, `npm test`, `npm run test:generation`, `npm run test:app`, `npm run test:postgres`, and `npm run test:workflow`. `npm run eval:postgres` replays 23 references and 108 frozen mode comparisons without provider calls, writing a new immutable artifact. `npm run audit:postgres` includes answer/source citation linkage and user revision integrity. Do not regenerate the historical lexical/live artifacts to test the application.

`npm run build` emits a self-contained source-free `dist` asset tree with a hash manifest and validated synthetic vectors. `PUBLIC_ORIGIN=http://127.0.0.1:3001 NODE_ENV=production PORT=3001 npm start` runs a local production check. Hosted origin must be exact HTTPS; use `HOST=0.0.0.0` there. Production build output and browser scratch artifacts are ignored. See [production runbook](production-runbook.md) for migration-only credentials, capacity handling and deployment preflight.

Public question privacy boundary: only the reviewed frozen synthetic questions, supplied literal/sandbox prompts and the explicitly labeled cache-failure probe are admitted. Other text is rejected before durable evidence/answer storage; no heuristic patient-data detector is used. The public API counts all attempted writes against a durable150-attempt session cap even when a later application transaction rolls back. Session refreshes share the normal read limiter.

# Phase 2B retrieval contracts and configuration

## Phase 2C application entry point

`PersistentRetrieval` now defaults to `hybrid` with the existing unthresholded RRF configuration. The low-level Phase 2B factory below remains unchanged for historical controls. PostgreSQL stores scope-constrained canonical rows, lifecycle events, vectors, evidence and run diagnostics; see [data model](data-model.md). `PostgresSemanticProvider` computes exact pgvector cosine only within Pathway's authorized universe and expected embedding identity. [Parity results](phase2c-verification.md) show unchanged ranks and governance.

Lexical requires explicit per-request acknowledgment. A named system policy also needs a durable grant matching actor/request/time; no implicit fallback is implemented. The durable service defaults to cached-only embeddings, so a cache miss pauses rather than silently calling a provider or fabricating vectors. The dated Phase 2B file/memory persistence table below describes the preserved control implementation, superseded for the durable service.

The application selects `lexical`, `semantic`, or `hybrid` through `RetrievalConfiguration` and `createRetrievalProvider`. BM25's implementation is unchanged. Low-level compatibility defaults (unchanged by the documentation-only live review): lexical; branch depth 50; RRF constant 60; no cosine cutoff; OpenAI `text-embedding-3-small`, 1536 dimensions, local configuration revision `configured-2026-09-07`. That revision is a cache namespace, not a provider-issued immutable model snapshot. [Decision C](phase2b-comparison.md) now selects explicit `mode: 'hybrid'` for the prototype with these same fusion parameters and no cutoff. The benchmark configurations and lexical reference commands remain unchanged.

The selected model is currently supported by the official [model documentation](https://developers.openai.com/api/docs/models/text-embedding-3-small). The [embedding endpoint](https://developers.openai.com/api/reference/resources/embeddings/methods/create) accepts a model, input, dimensions and float encoding, and returns indexed vectors and token usage. Documentation checked September 7, 2026. The recorded rate is $0.02 per million tokens. The successful live run reports 3,435 tokens and estimated $0.0000687, attributed to semantic while later hybrid arms reuse cached vectors. See the comparison for measured quality and cache/order limitations; no other embedding model was compared.

## Interfaces

| Contract / implementation | Boundary |
| --- | --- |
| `EmbeddingProvider` / `OpenAIEmbeddingProvider` | Text to vectors plus input-token usage; provider-specific HTTP and authentication stay outside domain policy |
| `LexicalRetrievalProvider` / `LocalLexicalProvider` | Existing deterministic BM25, exact authorized IDs, unchanged stopwords/scoring |
| `SemanticRetrievalProvider` / `LocalSemanticProvider` | Exact cosine scan over authorized passages; no ANN/hosted index |
| `HybridRetrievalProvider` / `LocalHybridProvider` | Independent branches over the same universe; validate each branch before fusion |
| `EmbeddingCache`, `MemoryEmbeddingCache`, `FileEmbeddingCache` | Replaceable vector-record persistence; no authority or approval state |
| `RetrievalConfiguration` | Zod-validated mode, dimensions/model identity, depth, RRF constant and optional cutoff |
| `RetrievalDiagnostics`, candidate ranking/embedding metadata | Pathway-owned eligible status/release mapping; raw branch ranks/scores and vector lineage are inspectable |
| Optional reranker | Deliberately no interface/implementation until a measured error pattern warrants one |

Core request schemas do not accept client-supplied provider scores, permissions or configuration. A trusted application caller chooses configuration before constructing the pipeline. Phase 2A CLI commands keep their fixed lexical baseline; `benchmark` runs the four frozen configurations. No ambient environment variable silently switches those reference commands.

```ts
const { provider } = createRetrievalProvider(
  { mode: 'hybrid' },
  { apiKey: process.env.OPENAI_API_KEY },
);
const pipeline = new KnowledgePipeline(registry, provider, store, trustedClock);
```

Omitting credentials is valid for lexical mode. Selecting semantic/hybrid without a key throws explicitly; an in-flight provider failure becomes a structured pause with no candidate fallback. The credential stays in a private field, never in descriptors, records, URLs or exception payloads. The adapter uses only the fixed HTTPS embeddings endpoint, disallows redirects, times out after 30 seconds, and does not automatically retry. It bounds each input to 8,000 UTF-8 bytes and each batch to 64 inputs/250,000 bytes, conservatively below documented token limits. The current cache manager requests one input at a time: simple and inspectable, but not optimized for throughput.

A degraded lexical retry is a selected policy for future implementation, not automatic behavior: preserve the failed attempt, require explicit human acknowledgment or preauthorized bounded system policy, and record actor/policy ID, time, reason, requested/effective configuration and original attempt linkage. Rerun all governance gates. Such acknowledgment grants no communication/action permission and cannot evade retirement, conflict or invalid scope.

## Ranking and audit semantics

Semantic score in the existing nonnegative candidate field is `(cosine + 1) / 2`. Raw cosine remains in `ranking.semantic.score`; negative raw similarities are valid. No baseline semantic threshold is calibrated. The optional cutoff applies to raw cosine, independently of mandatory policy filters.

Hybrid uses `1 / (60 + lexicalRank) + 1 / (60 + semanticRank)` for branches containing the passage. An absent branch contributes zero. Candidate depth is at least the requested result count. Ties use canonical passage ID. There are no learned weights, query rewriting or reranking. The preregistered 0.35 cutoff arm is a sensitivity probe; a lexical candidate can remain when its semantic contribution is filtered out. This must not be described as semantic approval. The live sensitivity arm loses Q02/Q08 and is rejected for adoption; preserve the arm unchanged as evaluation evidence.

Each returned hybrid candidate retains lexical and semantic ranks/scores, combined rank/score, branch inclusion reason, and (where a semantic contribution exists) provider/model/dimensions, configuration hash, document/query vector keys and embedding timestamps. Pathway adds exact release IDs and eligible-filter status; source-version and passage IDs/text hashes already belong to every candidate. Version exclusions and reason codes are retained separately. The benchmark's broad candidate table includes exclusion reasons and release membership for candidates rejected before operational retrieval. No hidden provider reasoning is invented.

The pipeline still computes eligibility before retrieval, checks candidate identity/membership and a registry snapshot after retrieval, then independently computes support, applicability, communication and action. Semantic score cannot bypass these steps. Supplemental conflict inspection can use authoritative evidence outside top-k, explicitly visible in authority findings rather than falsely claimed as a retrieved hit.

Evidence version `phase2b-v1` adds ranking/provenance diagnostics for semantic/hybrid records. Legacy `phase2a-v1` records remain accepted and retain their content addresses; BM25 still emits the legacy shape. Runtime-dependent model/vector timestamps are distinct from the fixed synthetic governance clock.

## Cache identity and persistence

Cache identity hashes provider/model/dimensions/revision/normalization, exact input bytes, corpus identity and input context. Passage context includes passage, document-version and artifact IDs plus parser/chunker versions; queries use the corpus-scoped exact text hash. Content, chunking, parser, corpus or embedding configuration changes miss the old cache. Vectors carry identity, hashes and creation timestamp; dimensionality, finite components, nonzero norm, order and response model are validated. Corrupted cache records fail closed rather than silently regenerating. Explicit model revision changes provide a manual refresh path when the provider alias changes.

| Location | Contents / limitation |
| --- | --- |
| In memory | Registry, revocations/conflicts, canonical index and exact-scan working vectors; revocations still reset on a fresh registry |
| `fixtures/knowledge/`, `fixtures/retrieval/` | Reviewed synthetic corpus, frozen questions and experiment manifest; original 19-version corpus unchanged |
| `.local/embeddings/` | Ignored file cache containing vectors/metadata/hashes, not source/query plaintext; derived sensitive data would still need protection in a real system |
| `.local/evidence/` | Content-addressed records with exact authorized text, decisions and retrieval provenance; existing integrity/access checks remain |
| `.local/benchmarks/<hash>.json` | Exclusive-created, content-addressed run snapshots, including timestamp, runtime/config/implementation hashes and measured results |
| `artifacts/phase2b-*.json` | Reviewable convenience exports; benchmark commands refresh these files. Record hashes remain verifiable, but these paths themselves are mutable |
| `artifacts/phase2b-live/<kind>-<sha256>.json` | Exact-byte content-addressed preserved live/offline runs, derived traces, audit and reviewed decision; exclusive creation and local read-only permissions, not WORM |
| Proposed Phase 2C PostgreSQL/pgvector | Selected next for durable governance plus exact filtered vector reuse behind contracts. Preserve BM25/RRF; prove revocation/assignment generation checks, restart, integrity and isolation. No database, ANN, RLS, cleanup or hosted access controls implemented here |

Files, local permissions and hashes are not production-ready persistence, signed/WORM protection or a sandbox boundary. Hashes detect accidental alteration; someone able to rewrite both content and hashes can tamper. Cache storage does not grant source authority. Retiring a source prevents future operational retrieval even if its vector remains cached. Deletion/retention of cached content and durable revocation transactions remain future work.

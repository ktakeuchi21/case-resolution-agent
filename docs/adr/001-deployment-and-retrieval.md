# ADR-001 — Deployment and replaceable retrieval

Date: September 7, 2026 · Status: recommended deployment architecture; Phase 2A local adapter implemented; no services provisioned

Related decisions: D-14, D-15, D-18. Replaces D-04's tentative lexical-first baseline for the visible RAG prototype while retaining TypeScript, PostgreSQL, durable work and modular contracts.

## Phase 2A result and scope adjustment

D-22 authorizes a local headless stage before the hosted hybrid/generation release described below. The implemented adapter uses BM25, exact canonical IDs and prefiltering; there are no embeddings, generation calls or remote infrastructure. [The evaluation report](../../artifacts/phase2a-evaluation.json) shows 23 passing synthetic governance cases, including provider conformance, retirement and sandbox boundaries in the broader test suite. This is evidence for the owned policy boundary, not a comparison of OpenAI, Supabase or AWS performance.

The current [provider interface](../../src/providers/provider.ts) contains only exercised capability, index and search methods. Asynchronous build, removal and reconciliation remain proposed. Exact source text/metadata/manifests stay in Pathway's registry and historical citations remain in the evidence store. Local registry revocations are in memory; a deployed adapter requires durable active revocation state independently of eventual provider cleanup.

A synonymous query missed all three required passages that literal wording retrieved. D-25 therefore recommends expanding real retrieval next, without changing the conditional C prototype / B enterprise deployment direction or provisioning either. Credential availability and vendor capabilities must be checked for that concrete adapter; none of this run establishes hosted latency, cost, deletion or isolation behavior.

## Decision

**Prototype: choose C.** A browser application with a TypeScript web/API service and durable background worker hosted on Render, plus Supabase-managed PostgreSQL/pgvector, private object storage and authentication. Deploy sandbox and governed modes with separate data projects and mode-scoped service credentials; use the same source code and contracts. Use PostgreSQL full-text search plus vector similarity, fuse results, and retain canonical source passages in Pathway's registry. Call an OpenAI embedding/generation API through replaceable model adapters using only permitted content; select exact models during the capability spike, not by assumption here.

**Hypothetical enterprise: prefer B's PostgreSQL variant first.** Run the application/workers in the organization's AWS environment, with S3 originals/artifacts, queue-based ingestion, RDS PostgreSQL/pgvector plus full-text search, enterprise identity federation, restricted networking, centrally managed secrets/keys and observability. Introduce OpenSearch only when measured scale, search features or concurrency warrant a dedicated search service. Existing enterprise standards may justify a different approved deployment; this is a reference architecture, not a finding that AWS is legally required.

Managed OpenAI file search remains a useful comparison adapter and fallback candidate if its evidence/locator contracts pass the same tests. Do not build three deployments. Evaluate adapters against the reference set, then implement one.

## Verified provider facts

- OpenAI's hosted file search supports semantic and keyword retrieval and file annotations; returned search results require explicit inclusion. These are useful building blocks, not claim-level approval or policy controls. [File search guide](https://developers.openai.com/api/docs/guides/tools-file-search)
- Direct vector-store search supports attribute filters and ranking options. File attributes allow at most 16 keys; keep the full domain metadata in Pathway's registry rather than squeezing it into provider attributes. [Search API](https://developers.openai.com/api/reference/typescript/resources/vector_stores/methods/search)
- OpenAI ingestion has asynchronous operations and file removal is eventually consistent. Pathway must block retired sources independently and reconcile provider cleanup. [Retrieval guide](https://developers.openai.com/api/docs/guides/retrieval)
- OpenAI's data-controls table lists files/vector stores as retained application state until deletion, with qualifications for files, and not Zero Data Retention eligible. Do not equate an API setting with immediate erasure or assume all endpoints have the same controls. [Data controls](https://developers.openai.com/api/docs/guides/your-data)
- Supabase documents PostgreSQL full-text/pgvector hybrid search, RLS-based retrieval permissions, private storage access policies, and authentication. Implementation still requires correct policies; privileged credentials can invalidate intended isolation. [Hybrid retrieval](https://supabase.com/docs/guides/ai/hybrid-search), [retrieval permissions](https://supabase.com/docs/guides/ai/rag-with-permissions), [storage policies](https://supabase.com/docs/guides/storage/security/access-control), [Auth](https://supabase.com/docs/guides/auth)
- Render supports background-worker services. Pathway still implements its own durable job, retry and idempotency semantics in PostgreSQL. [Background workers](https://render.com/docs/background-workers)
- AWS supports pgvector on specified RDS PostgreSQL versions; OpenSearch Service supports k-NN retrieval. Check exact engine versions/filter plans in an implementation spike. A global top-k followed by filtering is insufficient for Pathway's contract. [RDS extension matrix](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-extensions.html), [OpenSearch k-NN](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/knn.html)
- S3 versioning retains object versions; lifecycle rules must handle noncurrent versions. Object Lock can prevent deletion and should be used only when an approved retention policy calls for it. It is not a blanket setting for temporary uploads. [S3 versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html), [Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- Amazon Textract offers asynchronous document processing, making it a possible later OCR adapter rather than a dependency for the text-PDF MVP. [Textract asynchronous processing](https://docs.aws.amazon.com/textract/latest/dg/async.html)

Sources checked September 7, 2026. The tradeoffs below are engineering judgments based on these capabilities, not vendor performance benchmarks. Reverify plans, regions, API limits, contracts and prices before provisioning.

## Options compared

**A:** AWS web/API + worker + registry + private uploads, with OpenAI managed file search/vector stores. Canonical parsing/locators may still be needed for a trustworthy inspector.

**B:** AWS web/API + workers + S3 + queues + registry, using RDS PostgreSQL/pgvector/full-text or OpenSearch for retrieval. S3 is object storage, not a retrieval engine. Embedding, parsing and generation remain separate choices; AWS-managed retrieval does not require a particular model vendor.

**C:** Render web/API/workers + Supabase PostgreSQL/pgvector/full-text, Auth and private Storage. Same application-owned registry, policy engine and evidence contract as B, with less AWS setup.

| Dimension | A — AWS + managed OpenAI retrieval | B — AWS-managed retrieval | C — lighter managed application |
| --- | --- | --- | --- |
| Speed to prototype | Fastest raw Q&A; AWS setup and governance adapter still take work | Slowest initial platform setup; RDS variant simpler than an additional OpenSearch tier | Best balance for this project's visible evidence controls |
| Portfolio credibility | Strong if external control plane and actual results are visible; a file-chat wrapper is weak | Strong enterprise story if controls are demonstrated; AWS logos alone add no evidence | Strong if boundaries, failure recovery and evaluation are real |
| File upload | Application endpoint/private staging, then provider file upload | Signed S3 upload into quarantine | Scoped private Storage upload into quarantine |
| Background ingestion | Application job tracks provider progress and own metadata review | Queue/workers orchestrate parser/OCR/index writes | PostgreSQL jobs + Render worker; never ingestion inside a long HTTP request |
| Metadata filtering | Compact provider attributes/store partitioning + rich registry; complex scopes need careful compilation | RDS relational joins/filters; OpenSearch indexed filters and explicit authorization partitioning | Relational joins/RLS/filters alongside vector and lexical candidates |
| Observability | Exposed hits/results; provider-internal steps may be opaque | Detailed application spans and query evidence; infrastructure telemetry separate | Full owned chunk/ranking/decision trace with simpler hosting telemetry |
| Authentication | Enterprise IdP or Cognito integration; app manages roles | Enterprise IdP or Cognito; same app role contract | Supabase Auth, scoped guest sandbox, invited Studio roles |
| Multi-tenancy | Separate project/store scopes where needed; no shared unfiltered store | DB/index partitions plus IAM/tenant controls | Separate mode projects; per-tenant/session RLS and API grants |
| Data isolation | Copies in AWS and OpenAI; both systems require review and cleanup | Private AWS data plane; model requests still cross approved boundaries if external | Copies span selected host/storage/model vendors; acceptable only for agreed prototype data |
| Auditability | Pathway stores manifest, exposed passages, gate results; cannot invent missing provider traces | Full canonical artifacts and application evidence; AWS logs supplement them | Same canonical evidence contract; no production-grade immutability claim |
| Deletion / retention | Delete registry/originals/derived artifacts/provider files/stores/caches; block immediately despite eventual cleanup | Tombstones plus S3 current/noncurrent version, DB/index, backup and hold policies | Tombstones plus Storage/DB/vector/trace cleanup; backup/provider retention disclosed |
| Cost | AWS baseline + vector storage + built-in search calls + model use | AWS baseline + DB or OpenSearch capacity + storage/queues/OCR + models | Smaller prototype-oriented footprint; paid DB/services and model use still accumulate |
| Operational complexity | Two control planes; lower search maintenance, nontrivial policy mapping | Highest; IAM, network, monitoring and restore duties; RDS avoids a second search cluster | Moderate; two managed vendors and mode isolation, fewer infrastructure resources |
| Vendor lock-in | Managed parsing/chunking/ranking and provider IDs; highest retrieval coupling | OpenSearch DSL or relational/vector implementation; infrastructure-specific services | Auth/Storage APIs tied to host; SQL/chunks/data model largely portable |
| Migration path | Export canonical artifacts; build new index; map old citations; rerun evaluation | Swap runtime/storage adapters or add search tier without changing pack contracts | Export PostgreSQL and objects; replace Auth/Storage/job adapters for AWS |
| Synthetic MVP suitability | Good; less attractive if trace requirements require rebuilding managed steps | Technically good, disproportionate infrastructure effort initially | Recommended; preserves the required controls and browser access |
| Hypothetical pharma suitability | Conditional on approved data flows, services, retention and contract review | Recommended reference deployment if aligned with organizational requirements | Not the default production recommendation; separate qualification required |

## Why not pick managed file search immediately?

The new objective includes metadata confirmation, parsing inspection, exact source/version lineage, conflict discovery and retirement impact. Those are application capabilities even when search is hosted. A managed provider can shorten raw retrieval work but may not expose every transformation or locator we want to explain. We should neither fake its internal trace nor assume our own search will rank better.

A provider spike must prove filtered search over an exact eligible source universe and locator fidelity. For A, possible implementations include immutable per-release stores with compact document IDs mapped to the registry, or canonical section files mapped back to original pages. They may increase file count and storage; provider chunk boundaries need not match Pathway chunk boundaries. Unsupported exact filtering/locators returns `capability_unsupported`, not an unfiltered query followed by a confident answer.

## Prototype topology and cost discipline

One repository; two isolated mode deployments using the same image: sandbox web/API + worker and governed web/API + worker, backed by separate Supabase projects. The browser requires no installation. Studio accounts are invited; visitor sessions are short-lived and rate-limited. Shared code does not imply shared credentials. Workers have narrower privileges than publishers; the parser has no case-tool credentials. Do not rely on a service-role key as if RLS still limited it.

Use real embeddings, hybrid retrieval and bounded generation in the first RAG release. Keep deterministic gates and fixture replays for reproducibility. Start with exact vector ranking within small filtered sets; approximate indexes and an additional reranker are optimization choices after measurement. No Kubernetes, microservice fleet, multi-region failover, or production OCR platform is required for the portfolio.

**Planning envelope, not a vendor quote or spending authorization:** target a capped low-traffic demo within $150/month across hosted services and API usage; verify the actual four-service/two-project quote before selecting paid plans. If that does not fit, reduce hosting uptime or use invited demos before reducing isolation. Avoid promises that free tiers will support reliable ingestion and a persistent worker. Current plan inputs: [Supabase pricing](https://supabase.com/pricing), [Render pricing](https://render.com/pricing), [OpenSearch pricing](https://aws.amazon.com/opensearch-service/pricing/).

For comparison, current OpenAI file-search pricing lists $0.10/GB/day after 1 GB free and $2.50/1,000 Responses API file-search calls, plus model tokens. Ten GB of billable indexed storage over a 30-day month would cost $30 in storage alone; 1,000 built-in calls add $2.50. This is not the total cost of A, and built-in tool-call pricing must not be assumed to apply identically to direct vector search. [OpenAI pricing](https://developers.openai.com/api/docs/pricing)

Use the same workload for each estimate: documents/pages uploaded, indexed bytes after chunking, questions/day, input/output tokens, embedding volume, retention window, evaluation runs, OCR pages, host/DB hours, backups, logs and egress. Cached embeddings must be scoped safely; reindexing and retained releases cost money. Exact model pricing remains open until model choice. Rate caps and a global stop limit enforce spending bounds; an estimate is not a limit.

## Hypothetical enterprise topology and migration

Proposed AWS components: browser delivery and application ingress; containerized API and workers; S3 quarantine/original/derived-artifact storage; durable queues with dead-letter handling; RDS PostgreSQL for registry, cases, audit references and hybrid retrieval; federated identity with role/attribute policies; managed secrets/keys; restricted service networking; application traces plus central operational logs. Add Textract for supported scans and OpenSearch for measured search needs. Preserve a separate sandbox environment without production credentials.

This recommendation requires organization-specific data rights, vendor/service eligibility and agreements, identity/consent design, safety procedures, source licensing, retention/legal-hold policy, security testing, availability/restore targets and operational staffing. These are outstanding deployment conditions, not achievements of using AWS. Model requests can still disclose data outside AWS; approve that path independently.

Migration sequence: export canonical source/artifact/chunk records and immutable manifests; copy objects with checksum verification; import registry and identities/grants through an explicit mapping; re-embed only when dimensions/model change; rebuild candidate indexes; replay the same retrieval and permission suite; compare outputs and retirement behavior; cut over assignments with a recorded index/provider version. Keep historical evidence in application-owned storage so a retired provider does not break old citations. Never blindly copy active runtime credentials or guest sessions.

The [retrieval-provider interface](../architecture.md#retrieval-provider-contract) is authoritative. Provider IDs, similarity scales, chunk layout and index lifecycle live inside adapters. Pack identity, approval, applicability, communication and action permission belong to Pathway.

## Revisit triggers

Revisit C if provider filtering, parsing/locators, isolation, deletion behavior, latency or the verified budget fails its release gate. Revisit RDS in B when a representative corpus/concurrency benchmark fails retrieval targets or enterprise search requirements demand OpenSearch features. Revisit A if its adapter demonstrably meets the same evidence contract with less maintenance. None of those findings has been measured yet.

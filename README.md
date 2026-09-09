# Pathway Agent

Current hosting: the [static frontend and loading screen](docs/static-frontend.md) are live, with 376–392 ms observed first contentful paint on the released revision, including a visit after 16 minutes of idle time. Launch waits for readiness, then opens the existing backend workspace with secure sessions and progressive streaming. All 31 deployed transport checks and six idle-entry checks passed. The separately documented [contextual provider-schema error and incomplete acceptance](docs/contextual-verification.md) remain unresolved.

Conversation redesign: [experience and contracts](docs/conversation-experience.md), [execution and acceptance](docs/conversation-execution.md). The default journey is choose knowledge, then chat; the twelve-step technical walkthrough remains optional.

Earlier digital worker increment: [product and architecture](docs/digital-worker.md), [operator runbook](docs/digital-worker-runbook.md), and [implementation ledger](docs/digital-worker-execution.md). The in-app Guided journey and Evaluation distinguish deterministic composition, cached retrieval and optional live synthesis.

A browser-based persistent AI operations agent that helps HCP offices resolve specialty-therapy access dependencies using governed Knowledge Packs, with visible evidence, bounded authority, and human ownership of exceptions.

**Live synthetic demo:** [Open Pathway Agent](https://case-resolution-frontend.onrender.com). Render deployed the verified Docker build to the dedicated Supabase database; hosted browser acceptance passed. PostgreSQL/pgvector persists SC-01, immutable knowledge/evidence and session-isolated demonstrations. The digital worker adds persistent conversation, summaries, editable synthetic drafts and bounded TXT/Markdown/PDF/DOCX ingestion. Automatic conversation uses grounded live synthesis when the server provider is configured; otherwise it labels deterministic composition. Missing semantic vectors or failed providers pause explicitly. No real outreach, patient data or payer approval is involved.

## Run the browser demonstration

Requires Node.js 24.12+, PostgreSQL 18.6 and pgvector 0.8.6. No OpenAI key is required. The local database script supports the documented Homebrew installation; see the [runbook](docs/persistence-runbook.md) for other environments.

```sh
npm ci
npm run db:start
npm run db:migrate
node src/app/server.ts
```

Open `http://127.0.0.1:3000`, choose **Launch guided demo**, then **Use sample knowledge** and ask **What should happen next?** Press Enter to send. Open **Full technical walkthrough** for the twelve-step document-to-case story. Without a provider, use the guide’s explicit sandbox exploration branch and the original cached case. Follow governed requirement detection → simulated follow-up → document receipt → human verification → receiving acknowledgment → **Documentation dependency resolved; prior authorization pending.** Inspect exact evidence, pause/resume, publish/assign a scoped release, and retire authority without altering history.

Start with the [portfolio narrative](docs/portfolio-narrative.md), [demo walkthrough](docs/demo-walkthrough.md), [hosted release verification](docs/hosted-verification.md), and [production runbook](docs/production-runbook.md). `npm run build` creates the source-free production package. `npm test`, `npm run test:generation`, `npm run test:app`, `npm run test:postgres` and `npm run test:workflow` verify separate boundaries. `npm run eval:postgres` replays preserved quality evidence without new provider calls.

Earlier headless artifacts remain frozen. Do not use artifact-writing historical demo/benchmark commands just to launch the interface. The live benchmark found lexical31/36 and semantic/hybrid36/36 correct outcomes; cached benchmark ordering prevents an apples-to-apples latency/cost claim. See [the comparison report](docs/phase2b-comparison.md).

## Read in this order

1. [Product foundation](docs/product-foundation.md) — positioning, wedge, users, workflows, value, autonomy, scope, and measures.
2. [Research and risk register](docs/research-and-risks.md) — sourced context, open assumptions, discovery plan, and validation owners.
3. [Knowledge Studio and RAG lifecycle](docs/knowledge-studio.md) — two modes, metadata, packs, ingestion/governance failures and minimum UX surfaces.
4. [System architecture](docs/architecture.md) — ingestion, hybrid retrieval, four determinations, provider interface, durable workflows and tools.
5. [RAG evaluation](docs/rag-evaluation.md) — 26 reference cases covering the ten required demonstrations and quality/boundary metrics.
6. [Deployment and retrieval ADR](docs/adr/001-deployment-and-retrieval.md) — AWS/managed retrieval/lightweight comparison, prototype/enterprise recommendations and migration.
7. [Synthetic scenarios](docs/synthetic-scenarios.md) — three operational cases and governed pack bindings.
8. [Roadmap and portfolio plan](docs/roadmap.md) — revised sequence and next concrete session.
9. [Decision log](docs/decisions.md) — decisions, changed assumptions and tensions with Phase 1.

## Demonstrated product story

The Knowledge Studio demonstrates governed knowledge configuration: upload, inspect, test, approve, publish, retrieve with traceable passages, and retire. Compare two packs in a playground, reject sandbox operational actions, and show an approved pack supporting SC-01's missing-document recommendation. The strongest moment is retiring that source: subsequent reliance stops while historical evidence remains inspectable.

The case worker then follows the documentation dependency through: scheduled follow-up through a simulated channel, case memory, document intake, human verification, receiving-system acknowledgment, and resumable exception handoff.

The completed outcome is a resolved documentation dependency with receipt evidence. Coverage remains pending until a separately sourced payer decision arrives.

## Maintaining continuity

Treat the foundation as product intent; Knowledge Studio as the knowledge lifecycle/metadata contract; architecture as system/provider contracts; scenarios as operational examples; RAG evaluation as reference expectations; ADRs as deployment tradeoffs; and the roadmap as delivery status. Use stable decision (`D-`), assumption (`A-`), risk (`R-`), requirement (`M-`), scenario (`SC-`) and evaluation (`E-`) IDs.

When a decision changes, add a dated decision-log entry, update affected documents and acceptance criteria in the same change, and record supporting evidence. Preserve superseded decisions rather than silently rewriting history. Research sources inform product design; they do not become runtime action permissions. Synthetic knowledge is a separate corpus.

The original headless phases remain frozen. Current digital-worker implementation, measured results and provider limitations are recorded in the [digital-worker architecture](docs/digital-worker.md) and [execution ledger](docs/digital-worker-execution.md). Live generation utility, independent retrieval holdouts, production retention/restore and enterprise integrations require separate evidence.

## Earlier conversation release acceptance

The deployed fast path is **Launch → Use sample knowledge → ask Pathway**. The final public visitor reached a cited answer in **11.3 seconds** after wake. All 20 browser acceptance criteria and 225 automated tests passed; live v5 qualification accepted 7/7 generated responses. Earlier rejected citations remain retained. See [the acceptance, exact steps and limitations](docs/conversation-experience.md).

The contextual conversation revision is documented in [the worker contract](docs/contextual-worker.md): model-led references and complete copy, full-text validation, separate recipient/operator/evidence layers, measurable refinement, bounded regeneration, feedback and a compact chat interface. The frozen before/after catalog is retained alongside earlier acceptance artifacts; see the final verification report for revision-specific live results.

Chat now includes a role-aware Conversation Launchpad, current eligible knowledge coverage, directly submitted suggestions and a compact persistent context bar. See [launchpad behavior and verification](docs/conversation-launchpad.md).

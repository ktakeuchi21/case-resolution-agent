# Pathway Agent

A browser-based persistent AI operations agent that helps HCP offices resolve specialty-therapy access dependencies using governed Knowledge Packs, with visible evidence, bounded authority, and human ownership of exceptions.

**Live synthetic demo:** [Open Pathway Agent](https://case-resolution-agent.onrender.com). Render deployed the verified Docker build to the dedicated Supabase database; hosted browser acceptance passed. PostgreSQL/pgvector persists SC-01, immutable knowledge/evidence and session-isolated demonstrations. Hybrid retrieval is unchanged; public requests use preserved real vectors and visibly labeled extractive explanations, with no model charges. No real outreach, patient data or payer approval is involved.

## Run the browser demonstration

Requires Node.js 24.12+, PostgreSQL 18.6 and pgvector 0.8.6. No OpenAI key is required. The local database script supports the documented Homebrew installation; see the [runbook](docs/persistence-runbook.md) for other environments.

```sh
npm ci
npm run db:start
npm run db:migrate
node src/app/server.ts
```

Open `http://127.0.0.1:3000` and choose **Launch guided demo**. Follow governed requirement detection → simulated follow-up → document receipt → human verification → receiving acknowledgment → **Documentation dependency resolved; prior authorization pending.** Inspect exact evidence, pause/resume, publish/assign a scoped release, and retire authority without altering history.

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

## Recommended first prototype

First demonstrate governed knowledge configuration: upload, inspect, test, approve, publish, retrieve with traceable passages, and retire. Compare two packs in a playground, reject sandbox operational actions, and show an approved pack supporting SC-01's missing-document recommendation. The strongest moment is retiring that source: subsequent reliance stops while historical evidence remains inspectable.

Then recover the stalled prior authorization end to end: scheduled follow-up through a simulated channel, case memory, document intake, human verification, receiving-system acknowledgment, and resumable exception handoff.

The completed outcome is a resolved documentation dependency with receipt evidence. Coverage remains pending until a separately sourced payer decision arrives.

## Maintaining continuity

Treat the foundation as product intent; Knowledge Studio as the knowledge lifecycle/metadata contract; architecture as system/provider contracts; scenarios as operational examples; RAG evaluation as reference expectations; ADRs as deployment tradeoffs; and the roadmap as delivery status. Use stable decision (`D-`), assumption (`A-`), risk (`R-`), requirement (`M-`), scenario (`SC-`) and evaluation (`E-`) IDs.

When a decision changes, add a dated decision-log entry, update affected documents and acceptance criteria in the same change, and record supporting evidence. Preserve superseded decisions rather than silently rewriting history. Research sources inform product design; they do not become runtime action permissions. Synthetic knowledge is a separate corpus.

The original headless phases and browser application are implemented. The public browser release is verified; next investigations require separate evidence for retention/restore, an independent retrieval holdout and generation utility. See [the active roadmap](docs/roadmap.md#active-public-synthetic-portfolio-mvp).

# Pathway RAG rebuild — September 11, 2026

Pathway answers non-clinical pharmaceutical-support questions and prepares useful drafts using only the Knowledge Pack selected for a conversation. Every person, case, organization, product and source is synthetic. Nothing is sent and no payer, eligibility, clinical or delivery decision is made.

The active user goal is the attached full rebuild charter. It supersedes the earlier requirement to route the application through the legacy workflow/policy pipeline. The preserved pipeline remains available as historical research; the new application preserves pack isolation, source status, exact citation fidelity, bounded server-only provider use, session isolation, deletable temporary documents and honest action boundaries through simpler contracts.

## Preservation

- Deployment repository preservation branch: `preserve/pre-rag-rebuild-2026-09-11`, revision `941ccdb0f7d58d718d4298db9cd4b5c9fb2f8944`.
- Exact local pre-rebuild archive: `.local/preservation/pathway-before-rag-2026-09-11.tar.gz`; SHA-256 `729bd9785ace9ff40e8ed1bc42f2ee20b134fa0803df98ef251adf805ed52037`.
- Archive includes source, tests, documentation/research, synthetic fixtures, evaluation artifacts, screenshots, design assets and deployment configuration. It excludes credentials, private databases, dependency caches and deployment checkout. Those private files remain in place.
- Frozen Phase 2A/2B and other historical evaluations remain unchanged. They are evidence about the previous implementation, not the rebuild.

## Reuse and retirement

Reuse Node/TypeScript, PostgreSQL/pgvector, TLS configuration, Render services, anonymous HttpOnly sessions, CSRF checks, durable provider budget and bounded document parser. Reuse synthetic research concepts while authoring a small, readable new corpus.

Retire the old intent regex engine, multi-provider orchestration, claim ledgers, separate composition/support-review calls, workflow state UI, permissions UI, guided attestation and Studio publishing from the primary product. Do not alter the original workflow or its retained evidence.

## Small architecture

`src/rag/`: contracts, seeded scenarios/corpus, persistent retrieval, one Responses API generation call, conversation storage and HTTP integration. New `rag` database schema keeps this product independent of the previous immutable workflow schema. All real model requests reserve the existing daily and session request allowance. No limit increases. A single bounded repair may reuse the same passages for malformed output/invalid citations.

Retrieval uses active-pack and case filtering, current-source status and hybrid lexical/vector ranking. A contextual query includes the latest question, active case and the previous same-pack subject/recent requests. Prior model prose and conversations supply reference context, never authority. Pack changes reset retrieval context while retaining historical answer snapshots.

The key is currently only in the existing Render environment. A headless candidate API can be deployed alongside the preserved interface to seed embeddings and run live tests without exporting the key. New interface work starts only after headless retrieval/conversation qualification.

## Information architecture

Landing: one product sentence, three scenario cards, recommended documentation scenario, Knowledge Packs and Evaluation as secondary links. Scenario: direct conversation with identity, agent role, case, active knowledge and four immediate-submit prompts. Chat: messages, persistent composer, follow-ups and useful work products. Email: recognizable thread with recipient fields, timestamp, reply/refine composer and generated/not-sent status. Evidence: Sources used beneath each answer; optional grounding disclosure. Knowledge: readable packs, source documents and exact passages. Evaluation: measured results and clearly labeled limitations.

Visual direction: calm off-white, ink text, teal primary actions, warm serif display headings and system sans body; restrained chrome, 44px controls, visible focus, reduced motion and responsive layouts. UI/UX Pro Max returned a fitting flat product-demo pattern; its generic video hero, wellness font pairing and orange CTA are not adopted because direct scenario entry better serves this task.

## Required order and gates

1. Preservation, charter, three scenarios, corpus and contracts.
2. Ingestion/chunking, persisted filtered retrieval, embeddings and frozen retrieval tests.
3. Multi-turn generation, citations, email/summary, repair/failure handling and live frozen conversations.
4. Landing, chat/email, knowledge/evidence, responsive accessibility; optional temporary uploads after seeded experience.
5. Integration/browser/error/keyboard acceptance, review, production build, existing-service deployment, fresh-session public verification and final evidence report.

Completion requires all three scenarios, natural contextual answers, exact sources, useful refined work products, pack isolation and successful mobile/public acceptance. A deployed interface or deterministic tests alone never qualify the goal.

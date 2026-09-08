# Digital case worker implementation ledger

Active scope: the September 8, 2026 digital case worker charter supplied in the task attachment. This extends the deployed portfolio MVP at https://case-resolution-agent.onrender.com. Earlier Phase 2A–2D and MVP evidence remains historical and immutable.

## Inspected gaps

The current server rejects non-fixture questions and uploads. Generation can reorder reviewed quotations, but cannot synthesize. Conversation lives in browser memory; there are no persistent drafts or channel interactions. Studio renders all sources with dense metadata, exposes fixture publication only, and does not connect uploaded content to review and publication. Existing deterministic workflow, PostgreSQL retrieval, source eligibility, separate permissions, immutable evidence and session isolation are reusable foundations.

## Sequence and verification gates

1. Add versioned agent contracts, separate persistent conversation memory, inspectable case summary, clarification, drafts and synthetic channel analysis. Add a provider-neutral structured synthesis interface, claim-support validation, explicit provider pauses and durable spend limits. Verify contract and API isolation tests before UI integration.
2. Add temporary file storage and bounded TXT/Markdown/PDF/DOCX parsing, stable located passages, reviewed metadata, sandbox retrieval, reviewer decisions, immutable publication and separate assignment. Verify parser/security/retention and complete authority lifecycle.
3. Integrate a conversation-first agent and searchable source table/detail Studio with progressive provenance, explicit roles and confirmation/impact views. Add the 3–5 minute guided journey. Verify keyboard, desktop, tablet and mobile.
4. Run original and new regression/evaluation suites using new result artifacts. Update product/architecture/evaluation/runbooks, review actual security surfaces, deploy through the existing GitHub/Render source, and perform a hosted browser smoke test.

## Architecture decisions

- Keep SC-01 and its completion boundary unchanged. Agent proposals do not call workflow effects. UI execution uses existing deterministic commands and fresh authority checks. Conversational clarification can resolve conversational ambiguity; operational uncertainty still needs the assigned workflow reviewer.
- Store conversations, generated work products and channel interactions separately from canonical case/workflow facts. Starting a conversation archives its conversational context; it does not reset the case or remove decisions/effects. Link generated output to immutable evidence and the exact workflow revision.
- Preserve the legacy fixture endpoints and generation contracts for regression compatibility. New agent endpoints accept bounded attested synthetic text. Text remains untrusted; validation and refusal do not establish that a heuristic can detect all patient information.
- Keep original files and unapproved extracted text in temporary session storage with real expiry/deletion, outside append-only governed source tables. Publication requires an explicit reviewer decision, creates new immutable canonical records, and cannot itself assign a release. Published synthetic content and its historical evidence are retained.
- Hybrid retrieval remains the default. Missing vectors/provider failure pause explicitly. Optional lexical exploration must be explicitly selected and labeled; it cannot silently substitute for semantic retrieval.
- Add a replaceable synthesis provider; validate schema, exact citations, claim support and authority separation before display. Structured output alone does not prove semantic entailment. Measure live model quality separately from deterministic contract tests. No live-quality claim without a measured live run.
- Live calls require explicit server configuration and durable global/session request budgets. Missing configuration blocks live generation only; implement and test all non-secret work first. No credentials in source, output, screenshots or artifacts.
- Preserve the existing navy/ivory/teal semantic design system, native ES modules and Node service. A UI/UX skill search confirmed the minimal enterprise workspace style; wellness typography and landing-page suggestions were not applied.

## Progress

- Inspection: contracts, SC-01, persistence, deployed acceptance ledger, application/generation/retrieval/governance code and existing design system read.
- Baseline: typecheck and all 80 original non-database tests pass.
- Implementation and deployment verification: pending. No new capability is claimed complete by this plan.

### Increment 1: durable agent foundation

Implemented `src/agent/` contracts, deterministic case/evidence composition, replaceable structured synthesis and support-review interfaces, bounded server-only OpenAI adapter, durable provider request reservations, conversation-specific clarification, four audience summaries, five synthetic channel draft/interaction types, sentiment cues, versioned draft edits and inspectable conversation memory. Migration 009 adds conversation records separately from operational history. The existing `/api/chat` contract is preserved; `/api/agent` accepts attested bounded free-form synthetic input. Arbitrary uncached hybrid questions pause without an enabled embedding provider.

Verification so far: 23 agent contract tests, 24 PostgreSQL tests and 19 application tests pass; original 80 core tests passed at baseline. The new API test verifies replay, service reconstruction, session isolation, clarification, historical preservation after retirement and new-conversation behavior. Model tests use explicit contract fixtures, not live quality evidence. No live provider call was made.

Browser: isolated local Playwright session `worker-v2`, preview on port 3010 using the latest retained verification database. Desktop 1440×1050, tablet 768×1024 and mobile 375×812 inspected. Mobile overflow found (488px page on 375px viewport), fixed and measured at 375px. Browser refresh retained the answer; console reported zero errors/warnings. Screenshots: `output/playwright/worker-v2-desktop-initial.png`, `worker-v2-tablet-answer.png`, `worker-v2-mobile-corrected.png`. Full guided journey and final cross-route browser checks remain pending. Existing Render deployment has not changed.

Next: temporary arbitrary-file ingestion and Studio lifecycle; then final UI integration, security/evaluation suites, documentation and deployment. Source directory is a working copy without `.git`; the existing GitHub deployment checkout is `.local/deployment-source` and requires explicit synchronization of new web files, migrations, package manifests and source before deployment. Do not overwrite old artifacts.

### Increments 2–3: Studio, interface and release verification

Implemented isolated TXT/Markdown/PDF/DOCX parsing; temporary original, preview, review/test and vector storage; full unknown-aware metadata correction; exact-revision review; immutable publication, separate assignment, uploaded successors and explicit supersession/retirement. The Studio now uses source families with search/filter/detail panels, impact dialogs, saved-revision checks and progressive diagnostics. The agent has durable memory, current-state sidebar, historical answer notices, editable work products and exact citations. Added a connected twelve-step guide and visible measured evaluation.

Verification: all 203 automated tests pass (80 core, 12 legacy generation, 26 agent, 8 parser, 24 PostgreSQL, 30 workflow, 23 app). Original evaluation, retirement demo, retrieval probes and 108 cached PostgreSQL comparisons pass. All retained artifact files in the final manifest are unchanged (consult the exact report for the count). Production build: 235 files and 160 validated vector records. Production dependency audit: zero known advisories. New report: `artifacts/digital-worker/verification-3d85b9880263436e76a9167e47f8f96b6dde90d680382f4b2070286777001792.json`. Earlier incomplete verification records are retained, including one failed injected-error expectation and a repeated test run that exhausted the main local demo capacity. The runner now uses its freshly retained verification database for app tests; no cap was weakened.

Browser verified actual drop, parse, proposed metadata save, submit, reviewer approval, separate publication and separate assignment. The preview restart preserves database `pathway_verify_2200f8b7405644c4b13dd738fcf8d52c` on port 3010. Final responsive/keyboard/exception checks and hosted deployment remain pending. No live model call has been made.

### Final local acceptance and deployment gate

All 203 automated checks and the compiled four-format parser smoke pass. The actual browser completed multi-turn answer, voice interaction, CRM summary, office email draft, immutable edit, conversational clarification, Manager pause/resumption, Office verification and acknowledgment. Refresh retained revision 11 / PA_PENDING with one attempt per effect. New conversation retained operational history. Source retirement paused the repeated query while preserving the exact prior evidence hash. Malformed PDF errors clear on route navigation; keyboard Studio navigation has visible 3px focus. All 21 route/width combinations plus tablet/mobile upload review have no horizontal overflow. A final display-only refinement formats timer dates; production build revalidated afterward.

Browser record: `artifacts/digital-worker/local-browser-bfadf80cf14bc76b8c8df1c2ece4b2a41288b8b2c7f5eea8f97d1cc9b83d545d.json`. The original frozen artifacts remain unchanged. Hosted additive migrations 009–011 were applied successfully on September 8 at 17:08 UTC. Render provider setting names are absent; no live call was made. The new-upload semantic/synthesis journey remains provider-gated, and its documented explicit-lexical exploration branch was verified separately from the cached hybrid operational journey. Deployment and public smoke are the remaining gate.

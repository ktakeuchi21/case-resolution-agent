# Conversation-first Pathway Agent

This increment makes the primary journey **choose knowledge → ask → inspect a cited answer and next step**. The complete governance walkthrough remains optional. Implementation and verification progress are tracked in [the execution record](conversation-execution.md); the earlier digital-worker qualification remains historical evidence.

## Product behavior

Launch guided demo opens a focused picker. Sample Alder knowledge opens chat immediately. Published pack cards show readable names, source counts, audience, use and current availability. Selection can use only the current case’s permitted releases; required assigned releases stay included. An unassigned pack requires the existing separate governance process. Selection never creates an assignment.

TXT, Markdown, PDF and DOCX files use the existing bounded parser and a single confirmation when each file enters the system. The parse result has a direct sandbox-chat continuation. Uploads and derived conversations remain temporary, isolated and untrusted. They cannot restore retired operational authority.

Chat has one labeled message box and Send. Enter submits; Shift+Enter inserts a newline. A pending turn shows progress, prevents duplicate submission and retains text until the server accepts it. Failed requests retain the message and idempotency key for retry. The transcript scrolls independently above the visible composer. An optional notice acknowledgement is stored once for the session; normal conversation has no attestation checkbox.

The server infers case questions, summaries, CRM notes, drafts, administrative interactions, evidence/next-step questions and operational requests. Why and work-product refinements refer to the active conversational knowledge. Readiness questions ask a focused clarification. Conversation cannot resolve operational tasks or authorize effects. Intent interpretation is deliberately bounded, not a general-purpose command executor.

Agent Settings moves default synthesis, tone, audience, channel and drafting availability out of chat. The Supervisor role approves changes. Exact citation requirements, memory separation, source eligibility, communication/transfer controls, human decisions and abstention remain fixed. Provider and prompt changes require a server release, not visitor-supplied endpoints or credentials. Automatic synthesis uses the configured provider; failures pause without lexical fallback. An explicit deterministic composition setting remains for technical inspection.

Work products offer copy, editing, shortening, tone/channel refinement, saving to conversational memory, preparing a review packet and evidence inspection. They stay generated, unverified and unsent. Preparing review does not create an operational task or queue an effect. Existing simulated sending still uses the separately authorized generic workflow template.

## Data and authority

Migration 012 adds optional session acknowledgement, workspace conversation preferences and `portfolio.temporary_agent_entries`. Temporary entries have a scoped upload foreign key with cascading deletion and immediate expiry filtering; cleanup deletes expired rows. They are never copied into immutable governed agent entries. A response retains the selected knowledge identity and inferred intent. Original query, context, evidence, prompt/model, validation output and lineage remain inspectable.

Normal `POST /api/conversation` accepts a bounded text message and idempotency key (plus an optional same-conversation work-product target). It does not accept provider, operation, permissions, actor or scope. Legacy `POST /api/agent` remains for explicit compatibility and contextual work-product actions. `/api/agent-preferences` exposes bounded acknowledgement, selection and Supervisor-approved settings. Existing CSRF, origin, lifetime/rate budgets, isolation, text screening and workflow locks apply.

Fresh registry reads combine immutable table reads into a single statement after the existing generation lookup. Every schema/hash check, user revision, governance event and transaction lock remains. No current-authority cache is introduced. Readiness checks use one table-check round trip; migrations and seeding remain outside application boot. Provider initialization stays deferred until a request.

## Verification status

The complete local verification passed 223 tests plus reference evaluation, retirement/probe demonstrations and cached PostgreSQL parity. All prior frozen artifacts were unchanged. The production build contained 240 files and 160 validated embedding records. The first production-build browser report passed 31 assertions, including launch, no-attestation sample chat, keyboard behavior, contextual requests, retry, duplicate prevention and desktop/tablet/mobile layout. Its local deterministic first answer took 217ms; launch to answer took 743ms. These are local interaction measurements, not live model quality.

A public baseline probe on September 8 at 21:50 UTC received application HTML after 12.307 seconds. Render application logs showed a new instance beginning to listen during that request (15:50:20 MDT), supporting a cold-instance wake interpretation. This is one sample; platform scheduling and other visitors were not controlled. The reported roughly 50-second cold start remains plausible on Free instances. No plan was upgraded.

Fourteen additional production-build browser assertions passed for upload-to-sandbox chat, settings roles/persistence, operational human pause/resume, separate acknowledgement, PA_PENDING, retirement, unchanged historical citations and route-error cleanup. Live-provider qualification and post-deployment acceptance of this increment remain pending. Historical provider-v2 qualification accepted cited questions but rejected draft/CRM attempts; those results are retained and are not replaced by deterministic tests. Prompt v3 keeps unverified interaction text outside provider facts for work products, narrows unsupported urgency and retains failed verifier output. Only new live measurements can qualify that change.

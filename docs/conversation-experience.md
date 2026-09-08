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

## Fast demonstration

1. Open [the deployed application](https://case-resolution-agent.onrender.com) and choose **Launch guided demo**.
2. Choose **Use sample knowledge**. The synthetic Alder case and knowledge open directly in chat.
3. Ask **What should happen next?**, then **Why?**. Expand a readable citation or the advanced evidence section.
4. Ask for a supervisor summary or office email, then **Make that warmer and shorter** or **Turn it into an SMS**. The separate case controls and Full technical walkthrough remain available for human decisions and governance.

A new external file uses one upload confirmation and a direct sandbox-chat handoff. Ordinary conversation requires no repeated attestation or per-turn configuration. An empty “Record this as a Teams call note” request asks for the synthetic text; the reply retains the requested channel without implying that a real call occurred.

## Verified result

The final runtime is commit `e1528b7`, deployed on the existing Free Render service as `dep-dag8sq8u01pc73ffvk20`. Migration 012 is applied to the hosted database. Later acceptance-report commits change documentation and published measurement data only.

The [complete verification](../artifacts/digital-worker/verification-8bb5628c04b09a12c50898d14ae8b0b8af1952c9a85d9c14c7f0f26ca4d3ef4a.json) passed **225 tests**, plus reference evaluation, retirement/probe demonstrations and cached PostgreSQL parity. Frozen artifacts remained unchanged. The production build contains 240 files and 160 validated embedding records; the production dependency audit found zero vulnerabilities.

The [final public browser sequence](../artifacts/conversation/browser-1af8635bfea354e0ffd04f6bb73829e96183b09d3a0100cb1416eb781b1172ca.json) passed **17 assertions** and accepted **7/7 live v5 synthesized responses**: first question, contextual Why, supervisor summary, office email, warmer/shorter refinement, SMS and CRM note. The synthetic Teams interaction stayed unverified conversation memory. Fresh-visitor Launch to first cited answer took **11.328 seconds**; submission to answer took **8.191 seconds**. This is a scripted sample after the app was awake, not a service-level guarantee or independent quality benchmark.

A separate public continuation passed **19 assertions** for mobile composer visibility, live sandbox citations, unchanged workflow/assignment, settings roles, human pause/resume, separate acknowledgement, completion, retirement and preserved exact historical citations. Earlier browser checks cover Enter/Shift+Enter, loading, duplicate prevention, deliberate failure/retry, persistent notice acknowledgement, copy/edit/save/review, pack/source handoffs and technical provenance. Desktop, tablet and mobile screenshots were inspected at 1440, 768 and 375 pixels. The composer visibility correction additionally passed a focused three-width production-build regression.

Two earlier live attempts were safely blocked for invalid citation references: a v3 CRM note and a v4 Why answer. Both are retained. V4 removed internal fact IDs from model input and gave the next-step recommendation an explicit reference. V5 constrains generated reference IDs to a request-specific enum, then retains exact-quote, current-eligibility and fallible support-review checks. No invalid citation is repaired or accepted after generation. Across all retained conversation qualification attempts, 44 synthesis/verification requests used 44,886 input tokens and 7,839 output tokens. These exclude embeddings; estimated cost is unavailable because deployment pricing is not configured.

All twenty acceptance criteria are mapped to direct evidence in the [retained acceptance record](../artifacts/conversation/acceptance-6c72726dfcea667c68f6337e4a6f063a1ea725b2455e76376fb59aad45eb27b6.json). Earlier failed assertions are preserved and linked to the completed corrections.

| # | Browser acceptance | Result |
| --- | --- | --- |
| 1 | Homepage launches knowledge selection | Verified |
| 2 | Sample opens chat immediately | Verified |
| 3 | Active knowledge is visible | Verified |
| 4 | Ask without per-turn configuration | Verified |
| 5 | No per-message attestation | Verified |
| 6 | Enter sends | Verified |
| 7 | Shift+Enter inserts a newline | Verified |
| 8 | Submission generates a response | Verified |
| 9 | Contextual Why follow-up | Verified |
| 10 | Follow-up uses preceding context | Verified |
| 11 | Natural summary request | Verified |
| 12 | Draft and refine conversationally | Verified |
| 13 | Readable citations and next action | Verified |
| 14 | Advanced provenance is inspectable | Verified |
| 15 | Upload leads directly to sandbox chat | Verified |
| 16 | Sandbox selection creates no authority | Verified |
| 17 | Workflow and retirement still work | Verified |
| 18 | Desktop/tablet/mobile navigation | Verified |
| 19 | Route errors clear on navigation | Verified |
| 20 | Public post-deployment smoke | Verified |

## Startup and remaining limits

The retained September 8 21:50 UTC probe received application HTML in **12.307 seconds**. Render logs show a new instance starting during that request. It is one uncontrolled cold-instance sample; it does not establish a before/after speedup. Migrations, seed work and provider requests do not block listening. Scoped registry reads were reduced from fourteen database round trips to two without caching current authority; readiness schema checks share one statement.

No additional credential configuration is required. The live provider is configured and verified. No paid plan was purchased. Optional infrastructure choice: change this service’s **Compute** plan to the smallest paid instance to remove Free-instance idle wake, at an ongoing monthly compute charge. This does not eliminate model latency. Render Free idles after 15 minutes and can take about a minute to wake; see [Render’s Free documentation](https://render.com/docs/free) and [current pricing](https://render.com/pricing).

All cases and integrations are synthetic. Intent inference and sentiment cues are bounded. Generated products remain unverified and unsent; preparing review creates no operational task. Model support review remains fallible, and failed or unavailable evidence/providers pause without fallback. Uploads expire with their four-hour session; immutable governed evidence remains historical. Shared provider quotas and the lifetime 64-workspace capacity remain bounded. No independent clinical validation, real outreach, enterprise identity, production-load qualification or healthcare-production claim is made.

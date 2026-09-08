# Conversation redesign execution record

Active charter: the September 8 “select knowledge, then start talking” goal. This record distinguishes planned checks from executed evidence. The earlier digital-worker evaluation and frozen artifacts remain historical records.

## Gap and sequence

The deployed worker has durable conversation, guarded synthesis and a complete Studio, but exposes technical configuration before useful conversation. Configured-provider qualification accepted three cited answers and rejected two drafts and one CRM summary. Those rejected products are not qualified capabilities.

1. Add durable conversation preferences, optional session notice acknowledgement and conservative context-aware intent routing. Preserve the legacy API while normal chat accepts text alone. Test role boundaries, replay and follow-ups.
2. Connect sample, permitted assigned packs and temporary uploads to chat. Recheck every selection and source; selection never writes a case assignment. Add temporary conversation storage that expires/deletes with its upload.
3. Replace the composer; move configuration into Agent Settings; add work-product actions and Studio continuations. Make the primary guide four steps and keep the full technical walkthrough.
4. Refine provider work-product instructions, retain failed verifier output and validate live summaries/draft refinements without relaxing exact support or authority checks.
5. Optimize measured startup/request bottlenecks; run the complete verification suite and desktop/tablet/mobile browser acceptance; deploy the existing free Render service and repeat the fast path and governance exceptions.

## Architecture decisions

- Chat intent is a bounded application interpretation, never a workflow command. Original user text and interpreted choices are retained separately. An ambiguous readiness or audience question asks for clarification. Follow-up references use the active conversation and selected knowledge only.
- Normal chat uses approved defaults. Live synthesis is the default when configured; explicit deterministic composition remains in settings and legacy tests. A live provider failure pauses rather than silently changing mode.
- Optional notice acknowledgement belongs to the session and never serves as an authorization token. Server content validation remains mandatory. Each new external upload retains its separate confirmation.
- Conversation selection is separate from operational assignment. Existing governed conversation choices must pass the current assignment, release-access and applicability contract. Other releases remain visible with an explanation and a governance link; selecting one cannot grant access. Mandatory assigned releases are never omitted.
- Temporary upload text, evidence and conversational derivatives must remain deletable. Store those turns in a separate expiring table linked to the upload; do not copy them into immutable governed agent entries. Case workflow and historical governed answers remain durable.
- Settings use bounded, role-approved values. Exact citations, abstention, memory separation, human authority and execution permissions are fixed constraints. Settings cannot weaken them or accept arbitrary model endpoints/prompts.
- Preserve navy, ivory and teal tokens and system fonts. The reviewed UI/UX search matched conversational minimal chrome; its generic purple palette and streaming animation recommendations are not adopted. A scrollable conversation above an in-flow composer prevents sticky overlays from covering focused controls.

## Acceptance evidence still required

All twenty browser criteria in the active charter remain pending until a retained report records: homepage→picker→sample chat; visible/changeable knowledge; no per-turn settings/attestation; Enter and Shift+Enter; automatic answer and contextual Why; natural summary and draft refinement; citations/next action/advanced audit; upload→isolated sandbox chat; unchanged assignment; workflow/retirement; responsive navigation; route error clearing; post-deployment smoke.

Automated additions must cover acknowledgement, sample selection, selected context, expiry/isolation, inferred intent and corrections, replay/failure/loading/keyboard behavior, exact citations, provider pauses and preservation of governance. Prior tests must continue passing. No deterministic test result will be reported as live-model quality.

## Measurements

The first public-request probe was launched before other requests in this goal after an observed period of inactivity. Its command session ended across a context handoff before timing output could be retained; it is not a usable cold-start measurement. A repeat measurement with durable on-disk timing output is required. The earlier user-observed roughly 50-second start remains an observation, not a measured result from this execution.

## Local checkpoint results (not final acceptance)

- Typecheck passed after the first conversation implementation; 41 composition/intent tests, 24 PostgreSQL tests and 24 application tests passed. Later prompt, formatting and read-path changes require refreshed suite results.
- The first real-browser run passed 28 automated assertions: one-field composer, no attestation, Enter/Shift+Enter, focus/clearing, cited answer and next step, contextual Why, summary/draft/tone/SMS, deliberate request failure and retry, duplicate prevention, persisted acknowledgement, and overflow/composer/navigation at 1440/768/375px. The local cached answer arrived in 319ms. This measures deterministic local interaction only, not live provider quality or hosted launch time.
- Visual inspection found a menu focus contrast issue and unnecessary empty-card height; CSS was refined. Draft wording was shortened without removing its citation lineage. These changes still need a repeat browser check.
- Startup investigation found that migrations/seeding are not run on server boot, provider construction is deferred to requests, and temporary cleanup does not block listening. Scoped registry reads previously made fourteen sequential database queries; they now use two, preserving every row hash/schema check and current transaction lock. Readiness table checks now share one SQL round trip. No current-authority snapshot is cached.

The complete pre-deployment suite then passed 223 tests plus all reference evaluation/parity checks; retained frozen artifacts were unchanged (`verification-0304cac4…`). Production-build browser reports retained 31 fast-path assertions (`browser-ec9debc…`) and 14 upload/settings/workflow/retirement assertions (`browser-aafbed…`). The latter exercised the compiled Markdown parser, sandbox selection with an explicit provider pause, changed knowledge without lost history, Supervisor settings, role-bound ambiguity/resumption, separate receiving acknowledgement, PA_PENDING, retirement and exact historical citations. Production dependency audit found zero vulnerabilities. Live synthesis and public post-deployment acceptance remain to be measured.

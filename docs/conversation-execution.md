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

## Acceptance evidence

The twenty browser criteria are tracked across retained local and public browser reports: homepage→picker→sample chat; visible/changeable knowledge; no per-turn settings/attestation; Enter and Shift+Enter; automatic answer and contextual Why; natural summary and draft refinement; citations/next action/advanced audit; upload→isolated sandbox chat; unchanged assignment; workflow/retirement; responsive navigation; route error clearing; post-deployment smoke.

Automated additions must cover acknowledgement, sample selection, selected context, expiry/isolation, inferred intent and corrections, replay/failure/loading/keyboard behavior, exact citations, provider pauses and preservation of governance. Prior tests must continue passing. No deterministic test result will be reported as live-model quality.

## Measurements

The first probe lost its timing output across a context handoff and is not counted. The retained September 8 21:50 UTC probe received application HTML in **12.307 seconds**; authenticated Render logs show a new instance beginning to listen during that request. This is one cold-instance sample with uncontrolled platform scheduling/other visitors, not a latency guarantee or a controlled before/after comparison. The public browser fast path subsequently measured **13.237 seconds from Launch guided demo to a useful cited response**, including selection and isolated-case creation; submission to the answer was 9.354 seconds. Initial page connection and cold wake are measured separately.

## Local checkpoint results (not final acceptance)

- Typecheck passed after the first conversation implementation; 41 composition/intent tests, 24 PostgreSQL tests and 24 application tests passed. Later prompt, formatting and read-path changes require refreshed suite results.
- The first real-browser run passed 28 automated assertions: one-field composer, no attestation, Enter/Shift+Enter, focus/clearing, cited answer and next step, contextual Why, summary/draft/tone/SMS, deliberate request failure and retry, duplicate prevention, persisted acknowledgement, and overflow/composer/navigation at 1440/768/375px. The local cached answer arrived in 319ms. This measures deterministic local interaction only, not live provider quality or hosted launch time.
- Visual inspection found a menu focus contrast issue and unnecessary empty-card height; CSS was refined. Draft wording was shortened without removing its citation lineage. These changes still need a repeat browser check.
- Startup investigation found that migrations/seeding are not run on server boot, provider construction is deferred to requests, and temporary cleanup does not block listening. Scoped registry reads previously made fourteen sequential database queries; they now use two, preserving every row hash/schema check and current transaction lock. Readiness table checks now share one SQL round trip. No current-authority snapshot is cached.

The complete pre-deployment suite then passed 223 tests plus all reference evaluation/parity checks; retained frozen artifacts were unchanged (`verification-0304cac4…`). Production-build browser reports retained 31 fast-path assertions (`browser-ec9debc…`) and 14 upload/settings/workflow/retirement assertions (`browser-aafbed…`). The latter exercised the compiled Markdown parser, sandbox selection with an explicit provider pause, changed knowledge without lost history, Supervisor settings, role-bound ambiguity/resumption, separate receiving acknowledgement, PA_PENDING, retirement and exact historical citations. Production dependency audit found zero vulnerabilities. Live synthesis and public post-deployment acceptance remain to be measured.

## Public checkpoint

Render deployment `dep-dag8chp5efls73fhvjr0` served commit `db975f4`. The [public fast-path report](../artifacts/conversation/browser-1d722940856fe3f4161aebc46d56826406cff776863648d64db56efdcbf8e1ee.json) passed 34 assertions. Seven actual v3 model responses (question, Why, supervisor summary, office draft, warmer/shorter refinement, SMS and retry) passed exact citation checks and the fallible support review. Desktop, tablet and mobile screenshots were visually inspected. No model-quality generalization is inferred from this small, developer-authored scenario.

Review of the actual wording found an unlabeled completion-boundary sentence in drafts. It now says “Target completion boundary” so the target cannot be mistaken for a completed event. A call-note request without supplied content now asks for the synthetic transcript and carries the requested channel into the reply. The refreshed [complete verification](../artifacts/digital-worker/verification-555272e926a4c53d8a3d468857d66983fbfe82f486f9131b558a4127550df588.json) passed 225 tests and all references/probes/parity; frozen artifacts remained unchanged. Render deployment `dep-dag8id67bikc7394r340` serves these fixes at `f480ea2`. Expanded public governance acceptance is being recorded separately.

## Citation-context correction

The first expanded public run accepted readiness clarification and the supplied Teams interaction, then paused a CRM attempt with `CITATION_FIDELITY_FAILURE`. The retained [failed run](../artifacts/conversation/browser-96c7ecb8db5549fc555c324bcaa59125c887b9df90e236eb51460b92b3216257.json) shows the model used internal fact IDs and a conversation label instead of the required references. Prompt/context v4 removes internal fact IDs from model inputs, gives the deterministic next-action recommendation an explicit workflow reference, and omits previous answer prose from summary/draft inputs. User-visible original requests, prior products and all historical evidence stay retained; no validation rule was relaxed. The [refreshed full suite](../artifacts/digital-worker/verification-fbbd9a39fd11b1b394d3c902af5b3d66da42d58471fdce22d5b297eb1f26595f.json) again passed 225 tests and all reference/parity checks. The support reviewer remains fallible; the failed v3 request is included in the final qualification, not hidden by successful retries.

## Browser refinements and final schema

The v4 work-product check passed CRM, email, warmer/shorter refinement, copy, edit, save and review preparation. A viewport assertion then found the composer partially below the mobile screen. Immediate nearest scrolling after rendering fixes that; three focused local viewport checks passed, followed by all 19 public continuation checks, including live sandbox citations, unchanged assignment/workflow, settings, human resolution, acknowledgement, completion, retirement and historical evidence. A failed local probe had retained old ES modules because same-fragment navigation does not reload the page; browser regression scripts now explicitly reload deployment assets.

A new visitor reached its first v4 answer in 8.645 seconds, then “Why?” was safely blocked because the model cited its own claim ID. Prompt wording alone was insufficient. Provider schema v5 now limits every generated support reference to an enum derived from the current supplied fact/source references. Exact-quote, eligible-version and fallible entailment checks still run afterward. This adds a generation-time restriction; it never repairs or accepts an invalid citation after generation. The original failures remain in the qualification record.

## Acceptance complete

All twenty requested criteria are now directly verified in the [acceptance record](../artifacts/conversation/acceptance-6c72726dfcea667c68f6337e4a6f063a1ea725b2455e76376fb59aad45eb27b6.json). The final v5 public sequence passed 17 assertions and all seven generated products/answers, with a fresh-visitor first answer in 11.328 seconds. The complete v5 suite passed 225 tests plus all references/parity and preserved frozen artifacts. Nineteen public governance-continuation assertions passed after the mobile correction. Desktop/tablet/mobile screenshots were inspected. Source selection, conversation, model synthesis and work-product actions never changed case authority; the workflow still stops at documentation resolved/PA pending. Credential configuration is complete. The only optional manual infrastructure decision is paid always-on compute; it was not purchased.

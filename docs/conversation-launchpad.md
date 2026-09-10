# Conversation Launchpad

**Current September 10 release:** the deployed Launchpad passes 28/28, including the actual live suggested answer; public hosting/security checks pass 31/31. Desktop first contentful paint measured 368 ms in the latest fresh-browser sample. The approved workspace cap is 128, existing history is preserved, Free hosting and daily provider cap 100 remain unchanged. The broader multi-turn conversation comparison remains incomplete and is not represented as passing. See [the current acceptance audit](launchpad-acceptance-audit.md) for final evidence; chronological checkpoints below are historical.

## Earlier September 10 checkpoint — deployed Launchpad acceptance

The deployed Launchpad passed **28/28 checks** on `689de21bc745254ca725334bafc583c1585f6b35`: `artifacts/digital-worker/launchpad-browser-785a089025368e11f37e88f12aa0e95c833b1f3b082417ba32880d3b90954358.json`. This includes the real default model answer, direct keyboard submission, compact return behavior, role and knowledge changes, preserved history/assignment, sandbox deletion recovery, and desktop/tablet/mobile geometry and touch targets. Manual inspection of four fresh screenshots confirms the visible answer/composer; screenshots are `docs/screenshots/launchpad-live-2026-09-10-*.png`. Manual CDN → Launch → sample navigation also reached the full orientation with the composer focused and no overflow.

The separate full conversation qualification remains incomplete. Its latest partial run reached ten prompts before a reported-interaction schema rejection; four answers were accepted, and unsupported draft wording was safely paused. A fresh report-text string schema removes the invalid shared-reference sibling, composition now requires `requestedAction:null`, and office drafts receive document evidence without internal workflow sequencing. All 100 agent tests, type checking, build and hygiene pass. Focused live checks follow; these do not substitute for a complete frozen conversation comparison. See `contextual-verification.md` and the current semantic review for the retained failures.

## Earlier September 10 checkpoint — resumed release

The owner-approved lifetime workspace cap of 128 is deployed; new workspace entry is verified without deleting historical records. The separately blocking live schema issue was cleared for the default suggested question at `7a1fc250e234df84d242cf25cacde7b95e94acca`: nine canonical neutral greetings/acknowledgments replace their whitespace variants, preserving material-claim citations and all validation. The live result identifies the signed office note and cites both the notice and submitted-package inventory. Full verification passes 278 tests. Fresh full Launchpad and conversation qualification is being completed; see `launchpad-acceptance-audit.md` for final evidence.


The current [requirement-by-requirement acceptance audit](launchpad-acceptance-audit.md) records the completed Launchpad scope and separate conversation-quality limitations.

## Implementation plan

Add an orientation layer inside the existing chat: synthetic identity and role, AI purpose and authority boundary, eligible knowledge coverage, and directly submitted suggested questions. Keep the composer usable throughout. After a substantive message, retain a compact context bar; reopening context must not change conversation or case history.

1. Project current canonical knowledge eligibility into read-only display metadata. Deduplicate coverage from reviewed source annotations. Include excluded versions only in clearly labeled details. Resolve temporary uploads through the existing session and expiry checks.
2. Select prompts deterministically from role, current knowledge, workflow state and configured capabilities. Render full, concise-new-conversation and compact states without a new setup or authorization endpoint.
3. Verify source retirement/expiry, role and knowledge changes, direct submission, history preservation, keyboard and responsive behavior; run the existing complete verification suite.
4. Deploy matching manual backend and static revisions and smoke-test the public UI. Distinguish static/interface verification from live conversational model acceptance.

## Decisions

- Orientation is read-only: it invokes the same `selectKnowledge` and `sourceReasons` policy used by retrieval. It does not infer grants from role labels, model output or uploaded text. Every answer still rechecks evidence and permissions.
- Coverage labels come from the eligible versions' reviewed statement categories, with a conservative document-type fallback. A retired/expired/unassigned selection cannot contribute usable coverage. Exact titles, versions, eligibility reasons and assignment appear under native disclosure controls.
- Upload names come from reviewed metadata; the temporary authority boundary remains explicit even for an upload that has separately been published. Missing or expired uploads offer knowledge selection without retrieving old text.
- Presentation state is local to the chat component and derives its return/new-conversation behavior from durable entries. No new persistent schema, role grant, case assignment or acknowledgement is introduced.
- Existing teal/ink application design and native controls remain. Target sizes are at least 44 CSS pixels; the composer stays in its own non-scrolling row. Full orientation scrolls inside chat on narrow screens.

Verification and deployment evidence are recorded in the current acceptance audit. Static orientation alone did not resolve the provider-schema failure; subsequent provider-schema corrections restored the default suggested answer.

## User journey and verification

Launch the demonstration, choose sample knowledge, and enter chat with Office staff orientation and a focused composer. Click a suggested question to submit directly. The context bar stays above the conversation; Change role reaches the existing native selector, Change knowledge opens the existing picker, and View context expands orientation without resetting messages. Knowledge details group source families and expose exact versions, eligibility, dates and assignment. Mobile orientation scrolls within the conversation while the composer stays available.

Local acceptance A–H passed **28/28** browser checks: `artifacts/digital-worker/launchpad-browser-a392bde833f26f34318f8f55c46cec8ebbc287e309ee1746ab32a39cafb9fa2c.json`. The local response provider is explicitly predetermined; this proves interaction and governance wiring, not live language quality. The existing chat recovery, repeated mobile turns, citations, feedback and regeneration suite also passed **28/28**: `artifacts/digital-worker/launchpad-regressions-3aa58d3b628f0095ca489cb08eac99d9b1a02c5deb853b58b68590c8f66e52d2.json`.

The final complete verification run passed **265 tests** (81 core, 12 generation, 84 agent, 8 parser/Studio, 24 PostgreSQL, 30 workflow, 26 application/security), type checking, original retrieval evaluation, retirement demonstration, probes and cached PostgreSQL parity. Evidence: `artifacts/digital-worker/verification-a3daa6d53fc4fbdc9f57b243581774e114329a944a8bd3207fbb4f28a8e4288a.json`. Frozen artifacts remained unchanged. Build and hygiene checks passed; no live provider calls were used for orientation or local verification.

Before/after screenshots are retained locally under `output/playwright/launchpad/`: desktop (1440×1000), tablet (768×1024), mobile (375×812), and mobile after a response. Earlier unsuccessful runs are retained: they identified exact-label selectors, a missing async navigation wait, duplicate source titles, and stale upload-picker state in the test harness. Source titles were grouped in the implementation. Canonical Agent Settings field names are covered by unit tests using `AgentSettings.parse({})`. Tests never change production caps or erase a database to bypass a limit.

Production release and live smoke results are recorded below after deployment. The independently documented provider-schema error remains outside this presentation change.

Visual record: [desktop before](screenshots/launchpad-before-desktop.png), [desktop after](screenshots/launchpad-after-desktop.png), [mobile before](screenshots/launchpad-before-mobile.png), [mobile after](screenshots/launchpad-after-mobile.png), [mobile conversation](screenshots/launchpad-after-mobile-conversation.png).

Static-startup regression passed **19/19** (`launchpad-regressions-bb17644aa3fd5e554557f910d98d9ba9f269baa403c58c0299558170ab51c394.json`). The earlier reused database reached its unchanged request limit; a separate retained local database was created for subsequent checks. The historical conversation comparison was recalculated against its matching existing semantic review (`comparison-ab08640b8a3c683cc47e9f9ecddcc4255ae6616d004c6641ce4a987d5e622557.json`); no new model-quality result is implied.

Origin-handoff regression passed **23/23**: `artifacts/digital-worker/launchpad-regressions-91578b604901a49594e91224683bf4049b6bf5e44b7523708dab72d83081d70b.json`. Final production build contains 248 files and 160 validated embedding records; hygiene scanned 361 text files and verified 110 content-addressed retained artifacts. No workflow or provider schema was changed.

## Production release — September 9, 2026

Both manual Render services are live on **`9af626038f6fe22a016e00444494cd05b56f21c4`**:

| Service | Deployment | Time (MDT) | Duration |
| --- | --- | --- | --- |
| Backend, Free | `dep-dags716q1p3s738n85l0` | 2:37:24 PM | 34.0 s |
| Static frontend | `dep-dags7oid0e5s73b04t1g` | 2:38:58 PM | 21.5 s |

Public entry: https://case-resolution-frontend.onrender.com. Interactive workspace: https://case-resolution-agent.onrender.com. The provider cap remains 100, automatic deployment remains Off, and no paid resources or new credentials were required. GitHub's first push returned HTTP 400 and did not update the remote. A buffered HTTP retry succeeded; deployment status and source revision were confirmed separately in Render.

Public launchpad acceptance passed **27/28**: `artifacts/digital-worker/launchpad-browser-47ee4b39fb967f0feee8c39fd750107e6afda2bfa367a563dad8c603580031d4.json`. All interface checks passed: sample orientation, default Office prompts, keyboard direct submission, collapse, focus, three responsive widths, role change and announcements, unchanged workflow/history, returning conversation, concise new conversation, governed pack details, deduplicated titles, sandbox boundaries, knowledge switching and deletion recovery. The one unmet check is **B's successful default conversational answer**: the unchanged runtime returned `PROVIDER_BUDGET_EXHAUSTED`. The user message was submitted once and the provider pause displayed explicitly. No successful live LLM answer is claimed, and the previously documented schema failure is not resolved or retested past the exhausted budget. Full goal acceptance therefore remains incomplete.

The released hosting/security path passed **31/31**, `artifacts/mvp/static-rollout-5d6e6fc4298a1abd22c538e3a9120194b832fb877e96a2a2a0e4c20f67cda181.json`. This separately selected evidence mode in isolated test sessions and made zero model calls. Cookie flags, CSRF/origin rejection, session separation, uploads/downloads, uncached responses and progressive delivery passed. A stream stage arrived at 138.7 ms; its separate final result arrived at 1,300.7 ms. Fresh desktop first contentful paint was **248 ms**, HTML first byte 192.5 ms and hero observed at 648 ms, without throttling. These are measured samples, not percentile guarantees.

CDN asset verification passed **16/16**: `artifacts/mvp/static-assets-7289fe4bfbf0977d27663235fd18c5d5528c8866362f7087ca709ddf5d6f2670.json`. All 12 public frontend files match the build and private server/configuration paths return 404. The in-app browser was also manually exercised from the public landing page through Launch and Use sample knowledge: the deployed Office staff launchpad, all four prompts and focused composer were observed, with no additional model request. Live screenshots are retained under `output/playwright/launchpad/live-*` and `docs/screenshots/launchpad-live-*`.

No manual Render configuration remains for this release. The remaining successful default-model acceptance requires available provider budget and resolution/verification of the separately documented provider-schema issue. Budget exhaustion is an explicit pause, not a silent fallback or a launchpad rendering failure.

## Follow-up acceptance audit — September 9, 2026

The original return check closed View context before leaving chat, so its success did not establish the expanded-context return behavior. A stricter trace reproduced that gap (19/20, `launchpad-browser-4ecb548205171b76cf32683fd19013305d2510dbf5450edf656c8bd67e043dc0.json`). Leaving an expanded existing conversation now collapses orientation for the return, while subsequent role or knowledge changes still refresh it.

Temporary upload expiry also updates an already-open chat using a single local deadline and rechecks on visibility/page restoration. Expired source metadata and temporary conversation entries disappear from the rendered view; message submission is unavailable until knowledge is changed. This display check cannot grant authority; the server still enforces canonical expiry. No network polling or model request is added. Prompts now change to role-specific knowledge-gap questions when authoritative missing-document coverage is withdrawn, even before a workflow reassessment.

The stronger local acceptance passes **29/29**, `artifacts/digital-worker/launchpad-browser-c9fd19c47e000320d49129dae22eb30406aaf96de1cca53aca0e112eaae391ab.json`. Its expiry check advances the browser clock while preserving the server clock, independently verifying the in-page timer; separate existing server tests enforce actual expiry. Two failed clock-harness runs are retained. Conversation UI regression passes **28/28**, `artifacts/digital-worker/launchpad-regressions-ef69fa05bb9a7a79bf6bb3bfe104622e2bf47c863d4f692abb53b6ae02836d27.json`.

The complete suite passes **268 tests**: 81 core, 12 generation, 87 agent, 8 parser/Studio, 24 PostgreSQL, 30 workflow and 26 application/security. Type checking, reference evaluation, retirement demonstration, probes and cached database parity pass; retained artifacts are unchanged (`verification-fb3a6229890a3e14d84ac5baa1961025a0c1b46356af3b220b0e17d10fd3af40.json`). The first sandboxed attempt could not reach the local database socket; the authorized rerun passed. These runs use explicit fixtures and do not close live acceptance B. No provider implementation, model, daily cap or workflow contract changed.

### Follow-up deployed release

Both services are live on **`a63de727aa2bc52c01cadca939dfa42b5c77ba1a`**. Backend deployment `dep-dagsgi6q1p3s738od9q0` was manually started at 2:57:44 PM MDT and completed in 59.9 seconds. The matching static deployment `dep-dagshbmk1f9s73dour3g` was started at 2:59:26 PM and completed in 19.4 seconds. Render's authenticated dashboard confirmed both revision and Live status. Backend remains Free; cap 100 and manual deployment settings are unchanged.

Public transport/security checks pass **31/31** (`artifacts/mvp/static-rollout-5eea3bdd894ddfea7597e79c2fb4f0d5a6beb079d9ca2f105d804540dc149f45.json`), and CDN checks pass **16/16** (`artifacts/mvp/static-assets-89c5630f03d14dca7802e116869f5de86b853fcf5be78812fa0c5ff03c10db05.json`). The read-only backend health/asset check also passes (`artifacts/conversation/public-smoke-6058854ef9ef6b3001204ed0f7ffbda987c6caa38c6a91d5bc3486106d52d431.json`). The public desktop sample measured first contentful paint **176 ms**, HTML first byte 96.9 ms and hero observed at 533.5 ms. A streaming stage arrived at 123.4 ms and its separate final at 948.9 ms. These unthrottled samples are not percentile guarantees; idle-start evidence remains in `static-frontend.md`.

Manual in-app browser smoke followed the CDN overview through Launch, backend knowledge selection and Use sample knowledge. The live full Office orientation, four directly actionable prompts and focused composer were observed. No new live-model request was made while the known budget was exhausted. Successful normal provider acceptance B remains open; the release does not claim to fix the separately documented schema failure. Production build contains 248 files and 160 validated embedding records; hygiene passed across 361 text files and 112 retained content-addressed artifacts. No Render configuration action remains for this release.

## Diagnostic and isolation follow-up — September 9, 2026

Both services are live on **`4cc2cd7fbf7dbc7b88197d4127e50ae9d0847d61`**, confirmed in Render's authenticated deployment dashboard:

| Service | Deployment | Started (MDT) | Duration |
| --- | --- | --- | --- |
| Backend, Free | `dep-dagspvdbedkc7383fnn0` | 3:17:49 PM | 58.9 s |
| Static frontend | `dep-dagsqkp42hec73eulj40` | 3:19:15 PM | 21.7 s |

This release adds bounded structural diagnostics for provider schema rejections without exposing payloads, plus stronger integration verification of sample → pack → sample → upload boundaries. It preserves the actual generation schema, grounding validators, configured model, cap 100 and manual deployment. It does not establish a schema fix or a successful live answer.

The complete verification run passed **272 tests** (81 core, 12 generation, 91 agent, 8 parser/Studio, 24 PostgreSQL, 30 workflow, 26 application/security), type checking, retrieval evaluation, retirement demonstration, probes and cached PostgreSQL parity: `artifacts/digital-worker/verification-ce6c00b3f43c6e64d4fe313e0d25038d01a71a6bb053d19b207362d113b51f56.json`. The historical conversation comparison was refreshed against its matching retained semantic review; it remains unsuccessful qualification and made no new model calls. Build passed with 248 files and 160 embedding records; pre-release hygiene passed with 363 text files and 114 retained content-addressed artifacts.

Fresh post-deployment CDN checks passed **16/16** (`artifacts/mvp/static-assets-c6933cdc7dc24f2681cb53ebfa214ffa6de97c2b67626e3126ce710ebffb5406.json`). Backend health and all six checked asset hashes passed (`artifacts/conversation/public-smoke-4286b84c36d0c154a313bac76ad18d33361ae331b1d2148ffe9338cb522a5176.json`). Manual browser smoke at approximately 3:24 PM MDT followed the public CDN landing through Launch and Use sample knowledge. Full Avery/Office orientation, AI authority boundaries, all five knowledge coverage categories, four prompt buttons and the focused composer were observed. No model prompt was submitted. The unchanged interface and transport suites retain their prior 29/29 local launchpad, 28/28 local conversation UI and 31/31 public evidence-mode transport results; those are not new live-model results.

The hosted budget was read without mutation at approximately 3:16 PM MDT: **200 requests reserved for September 9**, with the cap still **100**. The next daily allowance begins September 10 at 00:00 UTC, or September 9 at **6 PM MDT**. Acceptance B remains blocked until budget is available and the configured provider produces a normal governed answer. The known schema rejection still needs a confirmed diagnosis or successful verification then. No additional Render configuration is required.

# Conversation Launchpad

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

Verification and deployment evidence will be recorded after implementation. The independently documented provider-schema failure is not resolved by static orientation.

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

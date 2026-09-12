# RAG interface and browser verification

The replacement entry point is `web/index.html`, with `rag-app.js` and `rag.css`. The existing interface files remain preserved and unused by the new entry point. The static catalog is generated from the canonical `src/rag/corpus.ts` at build time. The public frontend uses its existing same-origin API rewrite, so no new origin, credential transport or hosting resource is needed. NDJSON progress is displayed when the proxy streams it; a clear waiting message remains visible when it buffers.

## Experience decisions

- Landing has three directly launchable scenarios and a recommended Alder card. No safety attestation, mode form or Continue step precedes the conversation.
- The active Knowledge Pack determines the visible user identity, agent role and case. A knowledge change preserves all earlier turn/source snapshots. The orientation's detailed role, case and coverage explanation is an expandable disclosure so mobile users can reach a question sooner.
- Email is a thread presentation with From, To, Subject, time, body and a reply/refine composer. Generated work products always have an unsent status; copy uses the exact draft body. A static “draft ready” caption accompanies the actual generated draft rather than repeating a sometimes noisy model introduction.
- Sources used attaches the validated source list to the whole answer. Exact canonical passages, titles, sections, versions and selected-pack labels are readable. A second disclosure shows the contextual query, ranks, included passages and citation mapping. It does not expose prompts, credentials or hashes.
- Follow-up chips are small editorial question/refinement prompts derived from the current work-product state and scenario. They are navigation/composition affordances, not an answer engine. Unconstrained model suggestions occasionally proposed sending or contacting someone; those suggestions are not used as UI action buttons. All actual answers and draft bodies remain live model output.
- Regenerate submits the original question with a new idempotency key and keeps the earlier answer. Retry reuses the failed request key. Historical drafts can be copied; only the latest draft for the active pack exposes refinement.
- The composer retains next-message text through rerenders and remains available below the scrollable transcript. New responses scroll into view. Error recovery preserves the submitted question and never fabricates sources or an answer.
- Temporary upload is deferred. The three curated seeded packs are the complete V1 knowledge-selection experience. The preserved parser is not exposed as an ungoverned source of case authority.
- Existing privacy-aware analytics emit only fixed page labels. Message text, document text and conversation identifiers are never analytics fields. Session data expire after four hours.

## Local browser checks

Real Chromium through the installed Playwright CLI, using retained synthetic live-output artifacts as explicit **UI replay data**. No replay is represented as new model-quality evidence.

Passed: direct launch, immediate prompt submission, six-turn mobile conversation, Enter submit, Shift+Enter newline, keyboard Sources used expansion, grounding query, exact displayed draft copy to clipboard, helpful feedback, disclosure preservation, conversation reload, chat/email switch, eight readable documents with two excluded, pack change with historical answer retained, new fulfillment label, loading feedback, injected HTTP 503 recovery and retry without duplicate question. Access launches directly into recognizable email.

Conversation was measured at 375/768/1024/1440 pixels: no horizontal overflow, composer within the viewport, no visible button/link/summary below 44×44 pixels. Reduced-motion preference is supported. The mobile keyboard itself is an OS behavior; the implementation uses dynamic viewport units and `interactive-widget=resizes-content`, with the reduced-height viewport checked separately.

The final local script's evaluation assertion initially ran before its hash navigation rendered. Waiting for the destination heading verified the real metrics; this was a test synchronization issue. Page-layout measurements and screenshots are retained under `output/playwright/rebuild-*`. The only intentional browser console error in the flow is the injected 503; the first static preview also returned a harmless 404 for its absent health endpoint.

Live public verification is recorded after deployment. Local UI replay does not qualify that final gate.

## Security and limitations

All user/model/source strings are inserted through DOM text nodes. There is no model-supplied HTML, URL or executable handler. Generation remains server-only, same-origin, CSRF checked, RLS session scoped and bounded by the already-approved request counters. The build scans packaged text for credential patterns and excludes private directories. No credential is copied into static assets.

This is a synthetic portfolio application with anonymous expiring sessions, a small corpus and limited free-service concurrency. It makes no production, clinical, privacy certification or operational integration claim. Free-service cold starts and daily capacity can affect availability. Draft wording still needs review, as documented in the live evaluation.

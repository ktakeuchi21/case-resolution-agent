# Local production screenshots

These images were captured from the built Node application at **http://127.0.0.1:3001**, with production configuration, real PostgreSQL/pgvector persistence and an isolated synthetic browser session. They are **local production-build verification**, not screenshots of a public deployment.

- `production-landing-1440.png`: portfolio entry; the session already has a case, so its CTA returns to the workspace.
- `production-workspace-1440.png`: governed dependency identified, follow-up queued, four determinations visible.
- `production-review-1440.png`: assigned office verifier and exact package approval choices.
- `production-completed-1440.png`: documentation dependency resolved, prior authorization pending, with the separate approval boundary explained.
- `production-completed-375.png`: responsive completed-case view.

The golden case was completed using keyboard Tab/Enter only, including launch, assessment, dispatch, document receipt, human verification and acknowledgment. All nine activated controls showed a 3px focus outline. Refresh preserved the awaiting-response state. The production browser had no console errors or warnings. All four required widths had no document overflow.

The development browser additionally exercised an assigned-manager ambiguity/resume path, structured escalation, safe reset, fixture download/upload, sandbox action denial, explicit release publication/selection/assignment, known synonym retrieval and the rejected-input/provider-failure states. Twenty-four screen/width combinations were measured. Captures were visually inspected, and discovered contrast/focus defects were fixed and rechecked.

The machine-readable measurements and image hashes are retained in `output/playwright/ui-qa.json`; repository verification artifacts may also preserve a content-addressed copy. No cookie values, credentials or real patient data appear in these files. Public-URL screenshots and deployed end-to-end verification remain separate deployment gates.

# Verified application screenshots

## Public deployment — September 8, 2026

The `hosted-20260908-*.png` images were captured from [the live Pathway Agent application](https://case-resolution-agent.onrender.com), deployed from commit `22db28a290a7b5a8e84e2e0d0e56c07105d2c65c`. These are actual public HTTPS browser captures, visually inspected after exercising the application against its durable synthetic state.

- [Portfolio entry](hosted-20260908-landing-1440.png)
- [Governed case workspace](hosted-20260908-workspace-1440.png)
- [Human clarification checkpoint](hosted-20260908-human-pause-1440.png) and [mobile review](hosted-20260908-human-pause-375.png)
- [Bounded completion](hosted-20260908-completed-1440.png) and [mobile completed case](hosted-20260908-workspace-375.png)
- [Grounded interaction](hosted-20260908-agent-1440.png), [evidence inspector](hosted-20260908-evidence-1440.png), and [Knowledge Studio](hosted-20260908-studio-1440.png)
- [Retirement blocks dispatch](hosted-20260908-retirement-paused-1440.png)
- [Sandbox evidence cannot authorize action](hosted-20260908-sandbox-denied-1440.png)

The hosted journey reached `PA_PENDING` after one simulated notification, a manager clarification, office verification, transfer delivery and separate receiving acknowledgment. A coordinated Render service restart preserved the exact pending task, workflow revision, effect, evidence hashes and timeline IDs. Human resumption did not repeat outreach. In a second isolated case, retirement blocked dispatch with zero attempts, preserved the original evidence record, and remained blocking after a supplied sandbox upload.

Thirteen journey controls were activated with keyboard Tab/Enter, each with a 3px focus outline; synthetic roles used the native role selector. All 24 screen/width checks passed without horizontal overflow. The browser reported zero console errors or warnings, and cookie flags were HttpOnly, Secure and SameSite Strict. No cookie/token values were recorded. The known synonym query used cached hybrid retrieval and a deterministic explanation with no model request; all 24 inspected citation hashes matched.

The complete measured results, exact restart comparison, screenshot hashes and limitations are retained in the immutable [hosted browser acceptance artifact](../../artifacts/mvp/hosted-browser-0443d6af75ac439810773e7ce4f1090419b0877a0e5ab1b60d5f07645846ea47.json). Earlier local screenshots below remain historical verification evidence.

## Earlier local production screenshots

These images were captured from the built Node application at **http://127.0.0.1:3001**, with production configuration, real PostgreSQL/pgvector persistence and an isolated synthetic browser session. They are **local production-build verification**, not screenshots of a public deployment.

- `production-landing-1440.png`: portfolio entry; the session already has a case, so its CTA returns to the workspace.
- `production-workspace-1440.png`: governed dependency identified, follow-up queued, four determinations visible.
- `production-review-1440.png`: assigned office verifier and exact package approval choices.
- `production-completed-1440.png`: documentation dependency resolved, prior authorization pending, with the separate approval boundary explained.
- `production-completed-375.png`: responsive completed-case view.

The golden case was completed using keyboard Tab/Enter only, including launch, assessment, dispatch, document receipt, human verification and acknowledgment. All nine activated controls showed a 3px focus outline. Refresh preserved the awaiting-response state. The production browser had no console errors or warnings. All four required widths had no document overflow.

The development browser additionally exercised an assigned-manager ambiguity/resume path, structured escalation, safe reset, fixture download/upload, sandbox action denial, explicit release publication/selection/assignment, known synonym retrieval and the rejected-input/provider-failure states. Twenty-four screen/width combinations were measured. Captures were visually inspected, and discovered contrast/focus defects were fixed and rechecked.

The machine-readable measurements and image hashes are retained in `output/playwright/ui-qa.json`; repository verification artifacts may also preserve a content-addressed copy. No cookie values, credentials or real patient data appear in these files. Public-URL screenshots and deployed end-to-end verification remain separate deployment gates.

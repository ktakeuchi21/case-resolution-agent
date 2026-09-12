# Persistent request allowance — September 12, 2026

The user requested a higher request limit and explicitly authorized merging and deploying the change. The selected daily ceiling is **1,000 provider reservations**, configured on the existing Render backend with `PATHWAY_RAG_DAILY_REQUESTS=1000`. This supersedes the earlier, date-limited 400-request acceptance allowance.

The setting persists across UTC day boundaries. Usage is still counted per UTC day in the existing durable database counter; activation does not reset or subtract prior reservations. An embedding, generation or bounded repair each consumes a reservation. The ceiling is a request count, not a dollar spending cap.

GPT-5 mini remains the conversation model, with no flagship fallback. The existing 40-request session ceiling, provider enable switch, concurrency controls and infrastructure plan remain unchanged.

The new setting accepts only an integer from 1 through 1,000. An explicitly malformed or out-of-range value fails closed at zero. Without the setting, the prior default and dated-acceptance behavior remain available. The preserved legacy application's limits are unchanged. Removing the setting restores that earlier policy without resetting usage.

The authenticated session metadata reports the effective daily and session ceilings alongside the active model, so the deployment can be verified without revealing credentials. Tests cover persistence across UTC rollover, precedence over the dated exception, lower configured ceilings, invalid values and session metadata.

Local verification: type checking, 89 core tests, 22 RAG tests, the production build and repository hygiene checks passed. The release is live on both existing Render services, as verified below.

## Deployment and live verification

Runtime revision `87b90c9bcd2e2a8bac34c3145032993ed1c328e6` was merged into `main` and pushed. Render reported both deployments Live: backend `dep-daimvddg1s2s7380a430`, frontend `dep-daimvnh5efls73e6l2b0`. The non-secret setting was saved on the backend before deploying this revision.

At 15:31 UTC on September 12, the public session API returned `live: true`, model `gpt-5-mini`, daily requests `1000` and session requests `40`. Two real browser answers—“What document is missing?” and the contextual “Why?”—completed with current, case-isolated Alder passages and valid retrieved citations. The hosted daily counter rose naturally from **398 to 401**, proving requests continued beyond the prior 400 ceiling without resetting usage. These two answers cost approximately **$0.00198** in measured provider usage. This focused deployment check does not replace the broader rebuild evaluation.

Retained credential-free verification: [allowance-35d96742d47545e6ae3fd68fded1d9a1d7288eebe75bfa92ca98a5b1ca6447d1.json](../../artifacts/rebuild/allowance-35d96742d47545e6ae3fd68fded1d9a1d7288eebe75bfa92ca98a5b1ca6447d1.json).

# Persistent request allowance — September 12, 2026

The user requested a higher request limit and explicitly authorized merging and deploying the change. The selected daily ceiling is **1,000 provider reservations**, configured on the existing Render backend with `PATHWAY_RAG_DAILY_REQUESTS=1000`. This supersedes the earlier, date-limited 400-request acceptance allowance.

The setting persists across UTC day boundaries. Usage is still counted per UTC day in the existing durable database counter; activation does not reset or subtract prior reservations. An embedding, generation or bounded repair each consumes a reservation. The ceiling is a request count, not a dollar spending cap.

GPT-5 mini remains the conversation model, with no flagship fallback. The existing 40-request session ceiling, provider enable switch, concurrency controls and infrastructure plan remain unchanged.

The new setting accepts only an integer from 1 through 1,000. An explicitly malformed or out-of-range value fails closed at zero. Without the setting, the prior default and dated-acceptance behavior remain available. The preserved legacy application's limits are unchanged. Removing the setting restores that earlier policy without resetting usage.

The authenticated session metadata reports the effective daily and session ceilings alongside the active model, so the deployment can be verified without revealing credentials. Tests cover persistence across UTC rollover, precedence over the dated exception, lower configured ceilings, invalid values and session metadata.

Local verification: type checking, 89 core tests, 22 RAG tests, the production build and repository hygiene checks passed. The release is intended for both existing Render services; deployment and live verification are recorded in the task after activation.

# Additional live acceptance allowance — awaiting approval

The approved September 12 UTC allowance is exhausted at 250 provider reservations. GPT-5 mini is the current low-cost model; expensive flagship families remain rejected. Prompt corrections are prepared and locally verified, but they need actual live evidence before the UI phase can start.

Proposed action: set the non-secret `PATHWAY_RAG_ACCEPTANCE_REQUESTS=400` on the existing Render backend, then Save and deploy. This grants **150 additional embedding/generation requests** for the already-configured acceptance date, September 12, 2026 UTC. It does not reset counters. Existing API/project spending limits, the 40-request session ceiling and ordinary provider-enable control still apply.

At **00:00 UTC September 13 / 6:00 PM MDT September 12**, the allowance automatically returns to the ordinary daily ceiling of 100 or any lower configured limit, even if this setting remains present. A mismatched date or an unknown request-ceiling value cannot activate 400. The setting is currently absent; the proposed extension is inactive.

Use the allowance for a focused regression check, the complete unchanged 36-turn suite, the six-step knowledge-switch supplement, and browser acceptance if the conversation gate qualifies. Check the server-reported model before generation. Estimated extra API cost is about $0.16 at the latest observed aggregate cost per provider reservation, but actual usage and cost vary; this request ceiling is not a dollar billing cap. Do not buy infrastructure or use an expensive model.

The user charter requires explicit approval before raising paid limits. This proposal does not constitute that approval. Until approval arrives, make no further paid evaluation calls and do not activate this setting.

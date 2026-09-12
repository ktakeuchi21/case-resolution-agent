# Approved and activated: bounded live-acceptance allowance

The session cooldown was cleared under the user's “unlock the limit” instruction. The resumed live conversation suite then reached the separate daily provider ceiling of 100 requests. The current counter remains 100. Existing measured runs cost an estimated $0.14273129 in total; estimates are not bills.

The user approved this proposal on September 12. The acceptance-day setting was activated; the following records its scope:

1. Deploy the tested work-product correction candidate and its inactive date-bounded allowance support to the existing free Render backend.
2. Set only `PATHWAY_RAG_ACCEPTANCE_DAY=2026-09-12`. This explicitly authorizes the RAG acceptance ceiling for that date; the existing server-wide configuration and legacy service limits stay unchanged. Provider-disabled configurations remain disabled.
3. Allow at most 250 shared provider requests for September 12 UTC: 150 additional reservations beyond the 100 already used. Existing counters remain intact and all embedding, generation and repair requests count. The per-session ceiling remains 40.
4. At September 13 00:00 UTC (September 12, 6:00 PM MDT), the RAG ceiling automatically returns to 100 even if the acceptance-day environment value is left in place. No other provider setting needs restoration. A configured ordinary ceiling below 100 is respected again after the exception expires.
5. Use the additional allowance for corrected frozen conversations, knowledge-switch tests and browser acceptance when the headless gate qualifies. Additional OpenAI API charges may be incurred. Do not purchase infrastructure, change the model to Pro or introduce new paid resources.

Implementation is in `src/rag/service.ts` (`providerDailyCeiling`). No exception is active without the exact UTC date in server configuration. Local tests verify the 100 default, 250 on the configured date, and automatic return to 100 the next day. The date-bound exception is now active for September 12 UTC; original counters are retained.

The active user charter says: “Respect the existing provider and spending limits. Do not raise paid limits or purchase infrastructure without explicit authorization.” This proposal is why a distinct approval is required after the session-only cooldown unlock.

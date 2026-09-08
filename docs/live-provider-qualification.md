# Live provider qualification — September 8, 2026

The owner configured the existing Render service privately. Public application health and provider status now confirm live embedding and synthesis are enabled. No provider secret was read or displayed during this verification.

## Measured outcomes

Three live case answers were accepted across API and browser checks, using `gpt-4.1-mini-2025-04-14` and `pathway-synthesis-v2`. Exact citation and support checks passed. The browser answer survived refresh with no console errors. The first API answer took 8.57 seconds end to end; synthesis plus verification took 7.66 seconds. The new-upload answer took 7.01 seconds for composition. These individual timings are not a benchmark.

A newly uploaded Markdown source required three fresh embedding requests (44 tokens). Repeating its hybrid sandbox query used three cache hits and zero new requests; action remained denied. Reviewed metadata, reviewer approval, publication and separate assignment enabled the uploaded source to support a new live case answer. The deterministic workflow then reached PA_PENDING through Manager clarification, Office verification and receiving acknowledgment, with one attempt per effect. Retirement paused a subsequent question without a generation call and preserved the earlier evidence hash.

## Work-product limitation

Both live email drafts paused at the model support-verification step. A narrower second request still introduced urgency beyond its exact source passage. The live CRM summary paused at deterministic validation because it labeled an unverified conversation quote as a factual claim. No rejected claims became primary answers, no work products were emitted for these attempts, and no simulated effect was authorized by the model.

This is a confirmed quality limitation, not a missing Render setting. Live question answering and new semantic ingestion work; live drafts and summaries are not qualified by these results. Existing deterministic composition remains a separate, explicitly selected option. No provider fallback or validation relaxation was introduced. A future refinement should retain failed support-review verdicts in audit and improve conversation labeling, temporal modality and work-product instructions, followed by a measured review rather than repeated retries.

## Cost and reproducibility

Across these six model attempts, 11 generation/verification requests used 11,157 input and 3,069 output tokens. Estimated generation cost at uncached public rates is $0.0094, excluding embeddings and any other account activity; this is not a billing statement. [Pricing basis](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

[Qualification record](../artifacts/digital-worker/live-qualification-ca40eed068cca3d6e435c0d36fb616c45210273073cc74560b4204eb7fd78d3e.json) contains every attempted outcome and limitations. [Full synthetic journey](../artifacts/digital-worker/live-journey-f2655216e2c8a51fb064034815decf24233de856df26411824b1486255aca6c7.json) retains requests, exact responses, evidence and workflow state. Earlier records remain unchanged.

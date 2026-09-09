# Phase 2D SC-01 execution contract

Design recorded before implementation. Version `sc01-v1`; synthetic September 2026, America/Denver. The bounded goal is **Documentation dependency resolved; prior authorization pending**. No state or tool can approve coverage. This implements SC-01 only; it does not implement SC-02/03, document ingestion, message generation, or real integrations.

## State and transition table

Processing stages such as assessing, resuming, proposed, authorized and sent are events/effect statuses rather than long-lived case states.

| Current state | Command / condition | Events and next state |
| --- | --- | --- |
| Absent | start, assigned synthetic grant | case_received → RECEIVED |
| RECEIVED | assess, fresh supported/applicable evidence and explicit notification grant | dependency_identified; effect proposed/authorized/queued → OUTREACH_QUEUED |
| OUTREACH_QUEUED | dispatch, current authority, recipient, cadence and grant valid | effect_attempted; adapter delivery → AWAITING_RESPONSE; business-day timer |
| AWAITING_RESPONSE | document, authenticated simulated receipt | document_received → VERIFICATION_REQUIRED; cancel routine timers; office verification task |
| AWAITING_RESPONSE | ambiguity | pause → PAUSED; case-manager clarification task; retain resume state |
| VERIFICATION_REQUIRED | resolve, exact document/destination attested by assigned office verifier | human_decision; new transfer evidence and bound approval; transfer queued → TRANSFER_QUEUED |
| TRANSFER_QUEUED | dispatch, current authority and unexpired approval bound to payload/destination/case content revision | delivered → AWAITING_ACK; acknowledgment deadline |
| AWAITING_ACK | receiver acknowledgment, matching dispatched effect/package/receiver | receiving_acknowledged; dependency_resolved → PA_PENDING |
| PAUSED | resolve task, authorized structured decision, fresh governance and grant | resume recorded checkpoint; never reissue delivered outreach |
| AWAITING_RESPONSE | due timer acquired then fired | at most second notification; subsequent due timer → ESCALATED |
| Any active | knowledge/provider/grant failure | PAUSED; evidence/reasons/task retained |
| Any active | rejection, unreconciled unknown or missed acknowledgment/review deadline | ESCALATED; human ownership; no false completion |
| Any nonterminal | cancel | CANCELLED; cancel pending work; reconcile attempted work without new dispatch |
| Any active | bounded adapter retry exhaustion | FAILED with owner/task; no automatic resume |

PA_PENDING, CANCELLED, ESCALATED and FAILED stop routine automation. Reconciliation, duplicate audit and structured supervisor acceptance of exception ownership remain permitted. Accepting a terminal exception does not resume operations or complete the dependency. Escalation is not dependency completion; a later workflow version can define accepted handoff/re-entry. Invalid commands are recorded as rejected without advancing domain state. Repeated command IDs require identical actor/payload; inbound source IDs deduplicate across distinct command IDs and mismatched reused IDs are rejected.

## Authority and approval

The original KnowledgePipeline stays unchanged. Every new knowledge-dependent step runs `PersistentRetrieval` inside the same scope-locked transaction as its workflow commit. It retains exact pack manifests, passage/version IDs, all four determinations, run/evidence IDs and decision time. Historical idempotent retrieval results cannot grant new authority.

`recommend_document` being allowed does not grant sending. A separate publisher-installed, synthetic SC-01 grant authorizes only the fixed generic workspace notification to the named simulated office endpoint, within its dates and two-reminder cadence. This is an executable demo operations policy, not a newly invented payer rule or an implicitly published KP-OPS. Communication permission from retrieval covers the authenticated chat evidence; separate template/channel permission covers the generic simulated message. The existing `send_message` operation remains prohibited. No document detail is placed in the notification.

Transfer requires the pipeline's `requires_approval` determination plus an assigned office verifier's structured attestation/one-use approval bound to document hash, destination, case content revision and expiry. Execution independently rechecks current knowledge, grant and approval. A clarification by the case manager releases collection/verification only, never transfer. Changing package, destination or substantive case context invalidates prior approval. No human can override retired/conflicting sources, sandbox isolation or provider failure. Explicit single-request degraded acknowledgment may be supplied to a fresh knowledge step; it is never inherited into later commands.

## Durable model and concurrency

Use an append-only aggregate journal: each committed command contains ordered typed events and a complete validated snapshot, including effects (transactional outbox), inbound receipts (deduplicated inbox), timers, tasks, decisions and approval. PostgreSQL views expose current instances/outbox/inbox/tasks/timers; these are projections over durable records, not independent mutable truth. A scoped workflow ID + revision unique key and previous-step hash make ordering inspectable. Full snapshots trade space for simple recovery at this bounded scale. Journal insert, evidence/run persistence, event history, timer changes and queued effects commit atomically. Read/reconstruct verifies every hash, revision and previous-hash link.

The existing scope advisory transaction lock serializes commands, grant revocation and source retirement. Reads occur after lock acquisition. Retirement committed first blocks resolution/dispatch; resolution first can queue, but later dispatch rechecks and is blocked by retirement. The deterministic simulated adapter is called under the scope lock after a durable attempt record; its separate durable receipt ledger commits independently to model external success/local crash. A crash leaves an attempted effect; recovery marks unknown then queries by the stable logical effect ID. Never resend an unknown result without affirmative proof of non-delivery. This intentionally coarse local boundary is not a production network locking design.

At-least-once processing, stable effect keys and reconciliation; no claim of exactly-once external delivery. Known not-delivered failures permit one bounded retry of the same logical effect after fresh authorization. Rejection, missing acknowledgment or unresolved status escalates. Cancellation prevents new dispatch; already attempted effects remain reconcilable. Acknowledgment records may update effect history after cancellation but cannot complete the cancelled workflow.

## Timers and tasks

SC-01 begins at the scenario's first eligible checkpoint (September 10, 10:00 MDT). One subsequent office business-day checkpoint (September 11), then Monday September 14; maximum two notifications. Business-day scheduling is restricted to the September fixture calendar, weekdays 09:00–17:00 America/Denver (Labor Day excluded), not a universal payer deadline. Out-of-window dispatch pauses. Each timer has a durable due time, lease token/expiry and logical firing ID. Reacquisition after a crashed lease is safe; stale lease tokens cannot fire. A timer fires once logically even if acquired/delivered multiple times. Human and acknowledgment timers escalate to the synthetic supervisor; they do not send outreach.

Human tasks retain reason, paused/current state, blocking question, evidence links, prior actions, structured options, assigned actor/role, due time, idempotency ID, resume checkpoint and audit metadata. Only the assigned actor can decide. The decision is immutable even if the subsequent governance recheck blocks resumption. Office verification and case-manager clarification are separate roles. Task due time is an operational SLA, not a sourced payer deadline.

## Completion, observability and failure boundary

Completion requires a received document, structured office verification, current authorized simulated transfer, and a matching receiving-system acknowledgment. A CRM transfer delivery alone does not complete it. The journal records dependency resolution and PA_PENDING explicitly. Next-best action is deterministic and includes reasons, evidence, authorization, blockers, responsible actor, deadline and automation permission; it cannot execute an action itself.

Synthetic metrics derive from journal timestamps/events: time in state, identification delay, office/human waiting, agent/human touches, duplicate suppression, retry attempts, escalation/pause reasons, retirement interruptions, completion rate and elapsed bounded-completion time. They demonstrate mechanics, not clinical outcomes or staff productivity. No real actors, PHI, proprietary source content or external delivery credentials are introduced.

Required validation: ten requested scenario traces, invalid/stale/mismatched commands, actor/approval/recipient controls, timer lease recovery, dispatch reconciliation, both observed lock-order races, repository and child-process reconstruction, empty migrations/seed repeat, original 67 tests/23 reference evaluations/108 retrieval comparisons, database evidence audit, frozen-artifact and secret checks. Production actor authentication, network adapters, business calendars beyond the fixture, backup/power-loss/load behavior and hosted operations remain outside this proof.

## Implementation notes from verification

`src/workflow/contracts.ts` contains strict command/event/grant/snapshot schemas; `engine.ts` owns transition and authorization decisions; `repository.ts` validates the append-only journal; `adapters.ts` defines provider-neutral ports and deterministic integrations; `worker.ts` performs bounded durable queue polls; `observability.ts` holds the typed definition, next action and synthetic metrics. No daemon is registered.

Migrations 005/006 add immutable scoped journal/grant/revocation/receipt tables, current-state queue views and composite step→run/evidence links. All views use caller permissions via PostgreSQL's [security_invoker option](https://www.postgresql.org/docs/18/sql-createview.html). The [transaction-level advisory lock](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS) remains held through fresh governance and the local workflow commit. Simulated dispatch intentionally uses a separately committed receipt ledger while that lock is held, so a source revocation cannot slip between the final check and simulated acceptance. This is a local experiment; real network adapters require a separately reviewed dispatch/revocation protocol.

Approvals additionally compare the exact durable case context from their bound evidence against fresh execution evidence; changing even a case revision invalidates an earlier package approval. Direct human degraded acknowledgment must belong to the command actor as well as the retrieval actor. A manager/worker cannot impersonate Avery: the demonstrated manager resume uses a publisher-authorized, durable policy for one exact request. It expires and is not inherited by later dispatch checks.

The initial N-101/CE-101 evidence remains immutable historical evidence of the original dependency. Newly received/verified package facts live in the workflow journal; they are not silently inserted into a reusable Knowledge Pack or used to rewrite the original inventory. The workflow uses current governed sources to validate the named documentation requirement, and separate case events to track received/verified/acknowledged status.

## Evidence findings before preparation

The contextual UI distinguishes a current eligible evidence finding from the workflow's recorded dependency assessment. An initial RECEIVED snapshot remains immutable and may contain the historical `dependency: unassessed` field even after a conversational retrieval identifies the signed note. The workspace then says the document need is identified and follow-up is not prepared. The separate `assess` command records identification, proposal, authorization and queue events under the existing controls. This presentation does not create or dispatch an effect. Source retirement invalidates future reliance on the evidence finding; it never rewrites old snapshots or answers.

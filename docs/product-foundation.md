# Product foundation

September 8 conversation increment: see [the conversation-first experience, contracts and verification status](conversation-experience.md) and [execution record](conversation-execution.md). Earlier phase sections below retain their historical scope.

**Phase 2D implementation update:** The local headless SC-01 now demonstrates the bounded operational dependency through simulated delivery, human verification and receiving acknowledgment, with durable pause/resume and failure traces. See [verification](phase2d-verification.md). This supplies synthetic operational evidence only; browser usability, real customer value and payer outcomes remain unmeasured. Earlier phase-specific status paragraphs below are historical.

Version 0.3 · September 7, 2026 · Phase 2A status update; product intent retained

**Evidence key:** **Fact** means supported by an external source. **Assumption** means a working condition awaiting discovery. **Hypothesis** means a testable value proposition. **Decision** means the chosen direction for this portfolio project, revisable with evidence. Unless explicitly sourced, workflows below are design assumptions, not statements of universal payer practice.

**Implemented evidence:** [Phase 2A](developer-guide.md) proves the missing-document recommendation, retirement pause, intact historical evidence and sandbox boundary in a headless synthetic run. The larger first RAG prototype described below still requires ingestion, semantic/hybrid retrieval, generation evaluation and an interface. No operational dependency has been resolved and no customer value has been measured.

## Vision and positioning

**Vision:** Access work should retain an accountable owner between interactions, so an unresolved dependency does not disappear when a call or chat ends.

**Positioning:** Pathway Agent is a persistent AI operations agent for specialty-therapy access teams that uses governed Knowledge Packs to follow documentation dependencies through to verified resolution, with visible evidence and human ownership of exceptions.

**Decision D-01:** Start in US HCP-office access operations for one fictional specialty product, **DEMO-PX1**, used in a fictional adult inflammatory condition, **Condition Q**. Use a pharmacy-benefit workflow, one fictional commercial plan, and Colorado as the initial applicability context. These choices simplify the model; they are not claims about a real drug, disease, or payer.

“Owning the access journey” is too broad as an MVP promise. The agent owns a specific operational goal and a next checkpoint. It cannot own payer decisions, clinical documentation accuracy, or patient treatment choices. Persistent responsibility must mean recoverable state and visible accountability, not continuous unsupervised generation.

## Governed knowledge configuration as a product capability

**Decision D-11:** Pathway Agent will be a browser application requiring no installation. Knowledge configuration is a first-class experience: users can see how documents were acquired, parsed, classified, tested, approved and applied. This expands the demonstration sequence while preserving the operational wedge.

**Demo Sandbox:** A portfolio visitor uploads permitted synthetic/public documents to a temporary isolated collection, selects the collection, and asks exploratory questions with source passages. It is always labeled unapproved and has no operational case tools or credentials. Public availability does not establish currency, rights to process, applicability, or authority.

**Governed Knowledge Studio:** An authorized contributor uploads and reviews ingestion, confirms metadata, resolves duplicates/conflicts, assembles a pack, and runs validation questions. A separate reviewer and authorized publisher release an immutable **Knowledge Pack**. Operational users generally see/select compatible approved assignments, not arbitrary files. A document's presence in an index is never equivalent to permission to rely on it.

**Decision D-12:** Keep pack family, immutable release and assignment separate. Use readable names and scope summaries rather than a new folder for every metadata combination. Pack configuration can narrow an agent's available evidence; it cannot expand the agent's authority. Required case packs cannot be removed or replaced with a wrong-plan pack to obtain a preferred answer.

The four product determinations are distinct: **what the source says; whether it applies; whether it may be communicated; whether an action is authorized.** Each produces an inspectable system record. A “supported” answer may still have a blocked action. Do not show similarity scores as truth probabilities or assume visible citations establish RAG quality.

See [Knowledge Studio](knowledge-studio.md) for metadata, lifecycle, pack controls, failure states and minimum surfaces; [RAG evaluation](rag-evaluation.md) for the ten required demonstrations and initial reference cases; and [ADR-001](adr/001-deployment-and-retrieval.md) for deployment/provider choices.

## Users and jobs to be done

| User | Job and desired result | Authority boundary |
| --- | --- | --- |
| HCP authorization coordinator; primary | Know exactly what is missing, why it is requested, who must act, and whether the receiving system acknowledged it | May provide documents and confirm office actions; clinical attestation belongs to an authorized clinician |
| Pharmaceutical or hub case manager; secondary | Manage exceptions without reconstructing the entire history | Owns operational review and handoff; cannot decide payer coverage |
| FRM; secondary | Help an office understand applicable access processes | Access depends on actual assignment and role; no default access to every patient record |
| Patient-services operations lead; likely sponsor | Allocate staff, see aging dependencies, and identify recurring friction | Aggregate operational view by default; case access requires a separate grant |
| Knowledge contributor, domain reviewer, publisher; enabling users | Configure and release sources whose provenance, scope and quality can be inspected | Uploader cannot self-approve; content approval does not grant case actions |
| Portfolio viewer; demonstration user | Upload allowed documents, compare grounded answers, and understand boundary failures in a browser | Temporary sandbox only; no shared publishing authority or live case tools |
| Patient; beneficiary of the workflow | Avoid unnecessary administrative delay and repeated information requests | Not a direct MVP user; no patient-facing clinical or financial promises |

**Assumption A-01:** An office will trust a manufacturer-sponsored or hub-operated workflow if it fits existing work and makes ownership clearer. **Assumption A-02:** The participating program has a legitimate operational role, suitable permissions, and access to relevant case evidence. Neither is established by this prototype.

## Initial wedge

**Decision D-02:** Recover stalled prior authorizations where an authoritative, case-specific request identifies missing documentation.

| Candidate | Demonstration value | Limitation | Choice |
| --- | --- | --- | --- |
| Missing-document follow-through | Clear dependency, repeatable follow-up, measurable receipt, durable memory | Still needs reliable request and receipt evidence | First vertical workflow |
| Denial and appeal support | High user importance; rich source and deadline handling | Clinical rationale, procedural variation, and authorization make scope harder | Second scenario; human owns decision to appeal |
| Financial-support intake | Shows empathy and supervised eligibility review | Program variation and fraud-and-abuse concerns | Third scenario; intake and handoff only |
| General access FAQ | Easy to demonstrate retrieval | Weak evidence of durable outcome ownership | Supporting capability |
| End-to-end benefit verification or payer automation | Potentially valuable | Broad integrations and authority dependencies obscure the core thesis | Defer |

**Hypothesis H-01:** Coordinating a known missing dependency will reduce staff handling time and avoidable idle time more reliably than a broad conversational assistant. Market frequency, recoverable volume, and willingness to pay remain unvalidated.

**Hypothesis H-02:** Visible pack governance will help operators recognize wrong, outdated or incomplete evidence before it drives work. This is not proven by users saying that citations look trustworthy. Test whether they reject an attractive but inapplicable answer and identify the blocked action correctly. The Studio is an enabling capability, not a change to a general-purpose RAG buyer or market wedge.

## Current and future workflows

The current-state map is a discovery hypothesis, not observed customer research.

| Stage | Assumed current friction | Pathway Agent future behavior | Human responsibility |
| --- | --- | --- | --- |
| Prescription and case setup | Office, hub, and payer identifiers differ | Establish case identity, assignment, benefit context, permissions, and source provenance | Confirm scope and authority |
| PA request submitted | Status scattered across systems | Record submission evidence and distinguish reported from acknowledged status | Office owns submission |
| Missing-information request | Fax, portal, or call request is not translated into tracked work | Attach exact request, identify the named dependency, assign owner and checkpoint | Validate ambiguous requirements |
| Case stalls | Staff must remember to chase; duplicate outreach | Scheduler evaluates age, current state, and contact limits; authorized template follow-up | Handle no-response exceptions |
| Office responds | Repeats history; attachment mistaken for resolution | Resume case memory, record intake, preserve uncertainty, request verification | Attest document relevance and content |
| Material forwarded | Sent status mistaken for receipt | Track approval, transfer attempt, acknowledgment, and failure separately | Authorize package and destination |
| Dependency resolved or blocked | No visible next owner | Close the bounded task with evidence or route an accepted handoff; retain overall case | Payer determines coverage; clinician owns care |

**Example future loop:** A checkpoint fires while the office is offline. The agent sees that a requested signed note is still missing, checks the current source and permitted channel, creates one follow-up in the simulated outbox, updates the CRM stub, and schedules another checkpoint. The office returns in chat and sees the same case. If the note is available, a human verifies it and the workflow tracks receipt. If it is unavailable or disputed, the agent sends a briefing to the assigned human queue and pauses dependent actions.

## Value and economics

**User value hypothesis:** Less repeated status hunting, fewer duplicate requests, clearer next actions, and less reconstruction during handoffs.

**Buyer value hypothesis:** More predictable case-manager capacity, fewer unattended dependencies, better evidence of work performed, and visibility into content gaps. Start with a patient-services operations sponsor and hub implementation partner; validate who controls the budget, operating process, and data rights before proposing procurement.

Knowledge administration adds real operating work: source acquisition/licensing, metadata confirmation, validation, review and retirement impact. Measure that effort alongside office/hub savings. A useful system must make content maintenance tractable; passing an upload tutorial does not validate the commercial case.

Do not sell increased prescribing or coverage approvals as the agent's causal contribution. Treatment access and abandonment are downstream measures influenced by many factors.

**Illustrative model, not forecast:** 1,000 eligible dependency episodes/month × 8 net staff minutes saved/episode ÷ 60 × $45 loaded hourly labor cost = **$6,000/month gross capacity value**. At 4 and 12 minutes, the same assumptions produce $3,000 and $9,000. Net minutes must include review, correction, and exception work. Subtract platform, integration, governance, and ongoing operating costs. Capacity released is not automatically cash savings. Office time and hub time must be measured separately to avoid double counting; pricing remains open.

## Autonomy contract

**Decision D-03:** Permission is a deterministic tool-side decision. Retrieved knowledge, a model's confidence, or a chat instruction cannot grant authority.

| May do within an active, explicit case grant | May prepare, but requires authorized human approval | Must never do |
| --- | --- | --- |
| Read authorized case state and applicable approved content | Transmit a document package to a named receiving system | Give medical advice or make treatment decisions |
| Explain supported administrative steps with citations | Send non-template or sensitive outbound content | Determine coverage, program eligibility, or appeal outcomes |
| Create internal tasks, summaries, checkpoints, and provenance-backed CRM events | Record a clinician's verified document attestation or an office's approved appeal instruction | Fabricate requirements, clinical evidence, signatures, or receipt |
| Send a permitted template through an authorized channel within cadence limits; simulated only in MVP | Resume a paused workflow after the appropriate owner resolves the blocking issue | Override identity, consent, source, role, or channel uncertainty |
| Open a human escalation and track acceptance; initiate a narrowly authorized safety intake route | Change controlled knowledge or policy through a separate publisher/reviewer workflow | Treat retrieval as authorization, silently revise policy, or leak case data |

Approval applies to a particular action, payload, recipient, case version, and expiry. New content, new risk, revoked permission, or changed case state invalidates it. Human approval cannot unlock a prohibited clinical or payer decision tool.

Routine autonomy stops on uncertain identity, consent, policy applicability, conflicting authority, suspected safety events, unsupported clinical questions, or failed delivery reconciliation. A restricted safety-intake route preserves an incoming potential safety report even when identity is incomplete; it does not disclose case information or continue the access workflow. See [risk controls](research-and-risks.md).

## MVP requirements and non-goals

| ID | Requirement | Completion evidence |
| --- | --- | --- |
| M-01 | HCP chat resumes one durable case across sessions | Close/reopen session; same dependencies and history |
| M-02 | Citation-backed administrative response | Claim opens exact approved source version and section |
| M-03 | Applicability, effective dates, and conflicts govern retrieval | Wrong-context, expired, future, withdrawn, or unresolved conflicting sources cannot support action |
| M-04 | Scheduled/event-driven work and task creation | Advance demo clock; exactly one eligible follow-up and next checkpoint |
| M-05 | Simulated CRM and messaging tools | Tool receipt, case event, retry state, and audit record agree |
| M-06 | Intent, sentiment, urgency, uncertainty, safety, and complaint detection | Labeled scenario inputs trigger appropriate route; signals never expand authority |
| M-07 | Supervised, resumable handoff | Named owner accepts, records resolution, and explicitly releases a permitted scope |
| M-08 | Operations view | Stalled dependency age, unaccepted handoffs, recurring barrier codes, and source gaps derive from events |
| M-09 | Transparent boundaries | Synthetic labels, action state, responsible owner, and next checkpoint are visible |
| M-10 | Recoverable execution | Restart, duplicate delivery, tool timeout, and permission revocation do not duplicate or bypass actions |
| M-11 | Browser upload and isolated sandbox collections | Scoped upload, visible ingestion failures, temporary storage and no operational tool access |
| M-12 | Governed document/metadata review | No auto-approval from upload/indexing; source provenance, dates, audience and uses confirmed |
| M-13 | Versioned pack publication and assignment | Exact tested manifest approved/published; case/agent/channel bindings visible and enforced |
| M-14 | Inspectable hybrid RAG | Claims link to exact passages and versions; role-gated trace shows filtering, evidence gaps and conflicts |
| M-15 | Four separate determinations | Support, applicability, communication and action records can differ in the same interaction |
| M-16 | Retirement and historical evidence | New reliance blocks immediately; authorized historical bundles retain exact lineage or explicit deletion tombstone |
| M-17 | Repeatable RAG evaluation | Reference cases cover all ten requested demonstrations; report actual failures, latency and cost |
| M-18 | Replaceable retrieval provider | Application-owned source/pack/citation IDs; adapter capability failures cannot broaden scope |

**First RAG prototype:** Upload/text-PDF ingestion, sandbox collection Q&A, minimum Studio review/publish controls, two comparison packs, hybrid retrieval, citations/evidence inspector, retirement, and automated evaluation. A read-only SC-01 context proves a published pack plus verified notice supports the missing-document recommendation; actual follow-up execution comes next. Use real embeddings/retrieval/generation with deterministic gates, and distinguish live calls from replay. Scan detection and a visible needs-OCR block are required; OCR execution and DOCX support are deferred.

**Full operational MVP:** All three synthetic scenarios, with SC-01's durable end-to-end follow-up first, then appeal/support handoffs and operations analytics. Chat is interactive; outbound email/CRM/receiver effects remain simulations. SMS/voice remain later. Arbitrary document uploads never enter a case or operational knowledge implicitly.

**Non-goals:** Real PHI, real patient recruitment, live outreach, production CRM/payer/EHR connections, clinical advice, eligibility decisions, appeal submission automation, document clinical assessment, real payer outcomes, multilingual support, avatar/video, model fine-tuning on cases, and claims of production readiness or compliance.

Additional boundaries: no operational reliance on public sandbox uploads; no self-approving knowledge, general-purpose document-management suite, runtime web crawling, arbitrary remote URL imports, unbounded public storage/API spend, or production AWS infrastructure solely for appearance. Governed operational corpus stays synthetic; isolated sandbox may accept suitable public documents under its content policy. No interface is built in Phase 1.5.

## Measures and release gates

**Primary operational metric:** Median elapsed time from a validated missing-document dependency opening to verified receiving-system acknowledgment. Show p90 and unresolved aging alongside it so closing easy cases cannot conceal stalled work. Report calendar time and office-business time separately.

| Measure | Definition | Initial decision criterion |
| --- | --- | --- |
| Staff effort | Active handling + review + rework minutes per episode, by role | Hypothesis: at least 20% reduction against matched manual synthetic tasks |
| Resolution | Episodes with receipt evidence / all enrolled dependency episodes, at a fixed follow-up horizon | Compare equal case mix; handoff, cancellation, and unknown outcome are separate |
| Handoff quality | Reviewer can identify blocker, evidence, decision needed, and owner without rereading transcript | At least 4 of 5 formative reviewers succeed |
| User understanding | User correctly identifies what happened and what is still pending | At least 4 of 5 formative reviewers distinguish receipt from approval |
| Prohibited behavior | Unauthorized disclosures/actions, invented requirements, clinical/eligibility decisions | Zero observed failures in the release evaluation set; any failure blocks release |
| Evidence validity | Supported material process claims / reviewed material process claims | 100% in curated release cases |
| Safety routing | Required safety/complaint cases routed / labeled positive cases | 100% in curated positives; also report false positives and ambiguity misses |
| Execution reliability | Duplicate sends, lost due tasks, false receipt states under injected failures | Zero in release tests |
| Outreach burden | Contacts per episode and stop-request violations | Enforce fixture cadence; zero messages after revocation |

These are proposed prototype gates, not measured performance or clinical validation. Record denominators and failures; small curated samples cannot establish real-world safety. For discovery, compare order-balanced manual and prototype exercises, then pursue a properly authorized shadow evaluation before any live automation.

The first RAG release adds distinct knowledge metrics: time and reviewer effort from upload to valid publication; failed/partial ingestion counts; source-gap and conflict resolution age; and users' ability to distinguish unapproved, inapplicable and action-blocked content. Test that at least 4 of 5 formative users correctly identify both the supporting source and permitted next action. Retrieval recall/precision, citation correctness/completeness, groundedness, applicability/dates, conflict/abstention, unauthorized-source rejection, injection resistance, consistency, latency and cost are defined with denominators in the [RAG evaluation plan](rag-evaluation.md). These do not replace the operational outcome metric.

## Recommendation

First prove governed knowledge end to end: ingest, inspect, test, publish, assign, retrieve, cite and retire, with the four decisions visible. Then connect that evidence to SC-01's persistent follow-up through verified receipt. A generic file-chat demo would leave both governance and durable operational ownership unproven.

Next session: expand real retrieval behind the executable knowledge/policy boundary (D-25). The local provider found literal evidence but missed a synonymous question, safely abstaining. This observed limitation supports option A before SC-01 state transitions or Studio interface work; see the [revised roadmap](roadmap.md).

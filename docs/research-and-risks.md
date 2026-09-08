# Research, assumptions, and risks

Version 0.2 · Research checked September 7, 2026 · Phase 1.5 additions

This is targeted foundational desk research, not customer discovery, a legal opinion, or a complete regulatory assessment. External sources support context; prototype controls are product decisions. No interviews or observed workflow studies have yet occurred.

## Phase 2A engineering observations

The [executable report](../artifacts/phase2a-evaluation.json) supplies engineering evidence for a limited, author-authored synthetic corpus. It is not customer discovery, clinical validation or a provider benchmark. A-12 now has one passing local adapter conformance implementation; portability to a hosted/vector provider remains untested. A-11's hybrid-retrieval benefit remains untested: a literal query retrieved the required evidence, while a synonymous query missed it in [two diagnostic probes](../artifacts/phase2a-retrieval-probes.json). D-25 chooses real retrieval expansion to investigate that gap.

A-05/A-07's source-review and metadata-maintenance assumptions remain open; fixture annotations are supplied manually. A-09/A-10/A-14 are not validated by a headless run. New implementation limits requiring follow-up are in-memory active revocations, fixture-only identity and review, and no arbitrary-document parser or LLM injection evaluation. File evidence persists, but restarting a registry resets runtime governance changes. These limits block operational deployment, not the bounded synthetic spike.

## Evidence register

| ID | Verified context and source | Product implication and limit |
| --- | --- | --- |
| S-01 | CMS-0057-F excludes drug prior authorizations from its PA process and API policies. [CMS final-rule fact sheet](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f) | Do not import this rule's deadlines or assume it supplies drug PA integrations. It does not establish the fictional payer's requirements. |
| S-02 | CMS describes CMS-0062-P as a 2026 proposal extending requirements to drug PA; its policy index still lists it as proposed at this review. [Proposal](https://www.cms.gov/newsroom/fact-sheets/2026-cms-interoperability-standards-prior-authorization-drugs-proposed-rule), [policy index](https://www.cms.gov/priorities/key-initiatives/burden-reduction/interoperability/policies-and-regulations) | Track rulemaking before enterprise integration decisions. A proposal is not an enacted obligation. Use adapters and simulated receipts now. |
| S-03 | HIPAA business-associate relationships depend on the activities and parties involved; applicable arrangements require assurances and restrictions on PHI use. [HHS business-associate guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html) | Map office, manufacturer, hub, platform, and subcontractor roles with counsel. Do not assume every participant has the same HIPAA status or data rights. |
| S-04 | HIPAA's minimum-necessary standard generally limits PHI use, disclosure, and requests, with specified exceptions including provider treatment disclosures. [HHS minimum-necessary guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/index.html) | Use purpose- and role-scoped access as a design choice; do not misstate the standard as universal or assume consent alone authorizes every transfer. |
| S-05 | OIG identifies anti-kickback concerns with manufacturer copayment coupons involving federally reimbursable drugs. [OIG coupon bulletin, September 2014](https://oig.hhs.gov/documents/special-advisory-bulletins/878/SAB_Copayment_Coupons.pdf) | Treat coverage ambiguity as a reason for qualified review. Do not recommend a coupon, decide eligibility, or infer program legality from a short disclaimer. |
| S-06 | OIG separately addresses independent charity assistance and its independence from donors. [OIG independent-charity bulletin, May 2014](https://oig.hhs.gov/documents/special-advisory-bulletins/879/independent-charity-bulletin.pdf) | Manufacturer copay, free-drug assistance, and independent charitable assistance must remain distinct categories. Human review does not automatically make a program permissible. |
| S-07 | FDA describes postmarketing safety responsibilities, including oversight of contracted processors, and four elements for valid adverse-event submissions. [FDA postmarketing reporting compliance program](https://www.fda.gov/drugs/surveillance-post-drug-approval-activities/postmarketing-adverse-event-reporting-compliance-program) | Route potential reports promptly to a designated safety function even if intake is incomplete. Qualified personnel assess reportability and applicable clocks. No universal reporting deadline is encoded here. |
| S-08 | FDA explains that HIPAA permits certain adverse-event and product-quality disclosures to manufacturers and FDA. [FDA MedWatch privacy explanation](https://www.fda.gov/safety/reporting-serious-problems-fda/hipaa-compliance-reporters-fda-medwatch) | Do not make routine case verification a prerequisite for preserving incoming safety information. A dedicated, restricted intake route still needs organization-specific review. |

The desk research supports the need for explicit scope and controls. It does **not** establish PA delay prevalence, staff time savings, demand for another tool, commercial viability, payer-specific rules, or legal sufficiency of this architecture. Recheck applicable sources before a live pilot and when requirements change; retain dated research snapshots and review ownership.

## Major risks and proposed controls

All controls below are **design decisions requiring validation**, not claims that a regulatory obligation has been satisfied.

| ID | Failure and impact | Proposed control | Validation owner |
| --- | --- | --- | --- |
| R-01 | Wrong case, role, recipient, or channel exposes PHI | Tenant/case authorization, verified contact binding, purpose and field-level access, channel restrictions, revocation checks before execution | Privacy, security, HCP administrator |
| R-02 | Expired or mismatched policy creates a false requirement | Effective-date filtering, issuer authority, explicit plan/benefit scope, claim-to-source mapping, abstention on gaps | Knowledge owner, payer-process specialist, case manager |
| R-03 | A summary or attachment quietly grants authority | Separate trusted state and permissions from extracted claims; gate every tool server-side; treat documents as untrusted input | Engineering and security |
| R-04 | Medical advice, coverage prediction, or misleading appeal language | Administrative-only scope; block outcome decisions and clinical drafting; route to clinician or appropriate process owner | Medical, legal, regulatory, HCP staff |
| R-05 | Potential adverse event or product complaint is missed or delayed | Combined deterministic triggers and language classification; preserve original text/time; immediate internal safety/quality route with acknowledgment and backup owner; pause routine outreach | Pharmacovigilance and product quality |
| R-06 | Financial-support suggestion is inappropriate or misleading | Intake and human review only; distinguish program types; never promise eligibility or benefits | Program owner, legal/compliance |
| R-07 | Apparent completion hides a lost transfer or abandoned handoff | Require receipt evidence; separate attempted/sent/acknowledged; track queue acceptance, timeout, fallback owner, and resumable pause | Operations and integration lead |
| R-08 | Outreach is intrusive or continues after permission changes | Per-channel grant, quiet hours, cadence cap, stop control; recheck queued work; initially simulate all messaging | Privacy, communications counsel, office users |
| R-09 | Staff mistrust the sponsor or face another inbox | Embed around existing case work; show source, owner, and next step; allow correction and human request; test handoff burden | HCP office, FRM, patient-services leader |
| R-10 | Commercial optimization pressures inappropriate access actions | Measure administrative resolution and effort; prohibit ranking based on sales value or generating clinical justifications | Product, medical/compliance, operations |
| R-11 | Logs, analytics, model providers, or memory retain sensitive data unnecessarily | Synthetic operational prototype; isolated sandbox accepts suitable public material; minimization, expiry, restricted audit, provider/backup retention disclosure and deletion reconciliation | Privacy, security, records owner |
| R-12 | Language or sentiment classification creates unequal service or false urgency | Never infer protected traits or use sentiment to reduce service; evaluate varied language and ambiguous statements; human can correct | UX research, operations, safety |
| R-13 | The prototype's polish is mistaken for validation | Persistent synthetic labels; disclose mock tools and model behavior; report evaluation sample sizes and known failures | Portfolio owner |
| R-14 | Public uploads contain malware, private information, embedded instructions, or material the uploader cannot authorize | Quarantine, format/resource limits, rights/no-PHI attestation, detection before model calls, inert previews, separate credentials, no sandbox case tools; detection is not proof of safety | Security, privacy, product |
| R-15 | Pack choice hides an inconvenient requirement or a conflicting source | Compatible assignments enforced server-side; mandatory packs cannot be deselected; conflict registry checks beyond top-k | Knowledge owner and engineering |
| R-16 | Indexing or high test scores are mistaken for approval | Distinct ingestion/governance states; provenance and human confirmation; independent reviewer; hash-bound publish gate | Knowledge administrator and domain reviewer |
| R-17 | Retirement/deletion leaves stale answers in provider results, caches or conversation memory | Synchronous registry revocation, output/action rechecks, cache invalidation, no historical excerpt reuse as fresh evidence, asynchronous purge reconciliation | Engineering, records owner |
| R-18 | Citation inspector increases trust in an unsupported or inapplicable answer | Claim-level support and separate applicability/communication/action artifacts; evaluate comprehension and false trust, not aesthetic preference | UX research and evaluator |
| R-19 | Studio scope, repeated embeddings, public traffic or AWS footprint consumes the project budget | One production-path prototype implementation; upload/session/global quotas; staged format support; cost/latency metrics and verified quote before paid launch | Product and engineering |

Additional deployment questions remain open: state privacy and communications rules; medical-device or other software regulatory classification based on intended use; promotional review; records obligations; security and accessibility requirements; contractual service levels; and real integration rights. Assign qualified owners before live use. No generic compliance badge should substitute for this work.

## Discovery assumptions

| ID | Working assumption | Disconfirming evidence | Decision affected |
| --- | --- | --- | --- |
| A-01 | Office staff will use a program-sponsored workflow | Staff refuse another inbox or do not trust case visibility | Entry point and distribution |
| A-02 | Sponsor/hub has case authority and relevant source access | No permissible data flow or reliable request evidence | Feasibility of wedge |
| A-03 | Missing documentation creates material recoverable idle time | Main delays are payer decisions, clinical scheduling, or inaccessible records | D-02; narrow or replace wedge |
| A-04 | A receiving-system acknowledgment can be observed | Only self-reported sends are available | Completion promise must change explicitly |
| A-05 | Qualified humans can own exceptions and content, including independent source review and retirement impact | No staffed queue, review budget, publisher separation, or source owner | Autonomy ceiling and knowledge operating model; expanded in Phase 1.5 |
| A-06 | Bounded automation saves effort after review | Verification and correction exceed time saved | H-01 and business case |
| A-07 | Useful administrative content can be licensed, parsed and maintained with reliable applicability and effective dates | Content is unavailable, unreadable, stale, undated or not permitted for the channel | Retrieval approach and viable scope; expanded in Phase 1.5 |
| A-08 | Buyer pays for capacity/reliability improvements | Benefits accrue to another party or existing hub contract covers the work | Buyer and packaging |

## Phase 1.5 discovery additions

| ID | Working assumption | Test / disconfirming evidence | Decision affected |
| --- | --- | --- | --- |
| A-09 | A bounded public/synthetic upload sandbox is useful despite restrictions | Observe five viewers; unsuitable uploads, confusion about data handling or pressure for PHI invalidate design assumptions | D-11/D-16/D-20 |
| A-10 | A named pack/release/assignment is understandable and prevents context mistakes | Have office users choose applicable evidence and administrators publish/supersede it; inability to distinguish collection from approved pack requires simplification | D-12/D-21 |
| A-11 | Hybrid retrieval adds useful recall without worsening consequential precision | Compare lexical-only, vector-only and hybrid on the frozen reference/held-out set; report failures, no assumed winner | D-14 |
| A-12 | Recommended providers support exact eligible-universe filtering and stable locators | Capability spike including stale deletion results, filtered recall, page/table mapping and tenant denial | D-15/D-18 |
| A-13 | Proposed temporary retention and hosting envelope are feasible | Verify actual plans, backup/model retention and full mode-isolated deployment quote; inability to honor promises requires revised published policy | D-15/D-17 |
| A-14 | Guest exploration and invited Studio administration give sufficient portfolio access | Test visitor flow without installation and role controls with separate identities; seeded role switching is not proof of independent review | D-11/D-20 |

Add two knowledge administrators/content operations owners to the discovery targets and an evaluator/security engineer to the architecture review. Use synthetic documents with missing dates, a wrong plan, a misleading citation and a complex table. Measure time to publish a valid pack, reviewer corrections, ability to spot unsupported guidance, confidence-versus-correctness, and maintenance effort after retirement. Ask who is responsible when a source is wrong, whether review authority is independent of upload, and what licensed source metadata is actually available.

Official provider capabilities and source links are recorded in [ADR-001](adr/001-deployment-and-retrieval.md); upload/injection guidance is cited in [Knowledge Studio](knowledge-studio.md). They do not validate the reference set or prove the architecture safe. No interviews, user tests or retrieval benchmarks have yet run.

## Proposed research plan

**Stage 1 — Workflow discovery, approximately one week after participants are available.** Recruit four HCP authorization coordinators across at least two office settings, two hub/case managers, and two FRMs. Use 45-minute interviews and synthetic case walkthroughs. Ask participants to reconstruct steps without sharing patient records, proprietary policies, or identifiable examples. Capture each actor, source, wait, repeated task, evidence of receipt, and point where judgment is required. Seek disconfirming cases rather than agreement with the concept.

Core prompts: “What proves a document was received?” “Who notices a case has stopped moving?” “When is another reminder harmful?” “Which decisions can your team make?” “Where would this task appear in your existing day?” “What would make you refuse automated follow-up?” Do not present time-savings numbers before asking about effort.

**Stage 2 — Operating and governance review, approximately one week.** Interview two patient-services operations leaders, a privacy/security reviewer, a medical/legal/regulatory reviewer, and safety/quality representatives. Review source authority, allowed channels, safety intake, responsibility during handoffs, buyer incentives, and integration access. These are intended recruitment targets, not participants already secured. Produce a role/data-flow map, source inventory, escalation ownership table, and corrected risk register.

**Stage 3 — Formative concept evaluation.** Give five relevant office/case-management participants the same synthetic task in manual and prototype conditions, alternating order. Measure active effort, corrections, comprehension of status, source use, and preference. Explicitly ask them to challenge a wrong source and a false receipt. Report observations with small-sample limitations; these exercises cannot validate clinical or regulatory safety.

**Decision gate:** Continue the wedge if at least three of four interviewed coordinators identify recurring, actionable missing-document follow-up, the proposed operating partner can supply suitable evidence and an exception owner, and the pilot exercises show reduced effort without critical boundary failures. These are proposed discovery criteria, not statistical market validation. If receipt is unobtainable, revise the promise to an office-verified handoff and its metrics; do not silently call transmission “resolution.”

**Later, separately scoped:** A live shadow study requires established legal roles, contracting, security review, approved materials, safety procedures, operational staffing, and an evaluation protocol. The synthetic portfolio build need not wait for that work; real-world readiness claims must.

## Research record template

For every session record: date, anonymized participant role, research question, consent to research notes, observation, interpretation, counterexample, confidence, affected assumption/decision IDs, and next validation owner. Keep observations separate from recommendations. Record no real patient details. Update the decision log when findings alter scope.

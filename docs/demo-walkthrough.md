# Pathway Agent demonstration walkthrough

This tour uses the current visible controls in `web/app.js`. It is a script for the connected application, not a claim that a hosted tour has passed. No verified public URL or deployed screenshots are available yet. Follow [production runbook](production-runbook.md) for local/build setup and [deployment feasibility](deployment-feasibility.md) for hosted prerequisites.

Use only supplied synthetic cases and documents. All office communication, document transfer and receiving-system acknowledgments are simulated. The final boundary is **Documentation dependency resolved; prior authorization pending.** The demonstration does not make payer, coverage, clinical or financial-assistance determinations.

## 1. Guided portfolio entry

Read **Keep the case moving. Keep the evidence close.** The illustrated SC-01 sequence is labeled **Demo preview**; it is not the current case state. **Explore the approach** explains persistent work, governed relevance and precise human handoffs. The page distinguishes demonstrated engineering behavior from hypothetical real-world outcomes.

Choose **Launch guided demo**. The server creates an isolated synthetic workspace tied to the session. The page becomes **Case workspace**. If a case already exists, **Open workspace** or **Return to your workspace** resumes it. The landing-page **Explore a human exception** entry starts the same bounded case journey; introduce the ambiguity at the checkpoint described below rather than assuming the button itself resolves or pauses a case.

## 2. SC-01 golden path in Case workspace

Keep **Demo role** set to **Office** unless the task says otherwise. Do not advance the scenario clock while following the golden path; scheduled checkpoints are an optional separate experiment.

| Step | Visible control | Expected persisted result to inspect |
| --- | --- | --- |
| Start | **Launch guided demo** | **Received**; dependency not yet assessed; no delivery or approval |
| Assess | **Identify missing documentation** | **Outreach queued**; signed office note missing; new governed evidence and separate permission determinations |
| Follow up | **Dispatch simulated follow-up** | **Awaiting response**; office notification marked delivered; a durable follow-up checkpoint |
| Receive | **Simulate document receipt** | **Verification required**; received document remains unverified; an assigned human task |
| Review | **Open human review**, then **Verify document and approve bound transfer** | Immutable exact-package/recipient decision; current authority rechecked; **Transfer queued** |
| Transfer | Return to **Case workspace**, then **Dispatch verified package** | **Awaiting ack**; delivered transfer is still incomplete without receiver acknowledgment |
| Acknowledge | **Simulate receiving acknowledgment** | **PA pending**; dependency resolved; final boundary displayed; no payer approval |

At each step inspect **Next best action**, **Required evidence and authorization**, **Evidence & authority** and **Communication & handoff**. Open **Inspect delivery authorization** to distinguish proposed/authorized/queued/delivered/acknowledged status. The timeline identifies agent and human actors separately.

After **Dispatch simulated follow-up**, use **Refresh state** and then reload the browser. The same workflow revision/history should remain. This demonstrates persisted application state across a refresh. Actual process/database restart resilience is separately supported by the retained Phase 2D restart traces; a browser refresh alone does not prove database-restart behavior.

The **Scenario clock** and due times are synthetic. They do not measure elapsed office labor or operational SLA performance. The **Scenario controls** section contains **Advance scheduled checkpoint** and **Cancel this workflow** for an additional bounded timer/cancellation demonstration.

## 3. Pathway Agent interaction

Open **Pathway Agent** in the workspace navigation. Inspect **Persistent case context** and **Active Knowledge Packs** before asking a question. A question does not execute the recommended workflow command.

Select the suggestion **Which signed office note document is missing for this request?**, then choose **Ask Pathway**. The answer contains approved exact claims, source version/passage citations and an explicit deterministic/no-model explanation. Choose **Inspect four determinations** to inspect its immutable evidence; **Answer provenance and audit** shows prompt/model/evidence/disposition metadata. Public mode performs no new model calls.

Repeat with **What clinician paperwork is absent from the packet?** to inspect the known synonymous formulation. The retained live benchmark establishes the lexical gap and semantic/hybrid recovery; this public hybrid query reuses the packaged vectors. It is not a new live provider trial or a browser-side comparison against BM25.

For an unavailable query, enter an unrelated uncached question such as “Which synthetic form would a new plan require next year?” The cache-only provider can pause visibly. It must not invent evidence or silently switch to lexical retrieval. Distinguish this cache/provider pause from a governed insufficient-evidence abstention; the reason codes identify the actual cause.

## 4. Evidence inspector

Open **Evidence inspector** and select an **Immutable evidence record**. Review all four cards: **Source support**, **Case applicability**, **Communication permission**, **Action permission**. Source support alone does not imply the other three outcomes.

Inspect **Supporting passages**, **Excluded sources**, **Retrieval provenance**, **Decision reason codes**, **Retrieved candidate ranks, scores and metadata filters**, **Immutable EvidenceRecord** and **Audit history**. Exact source text is quoted with its version, passage identity and locator. Source metadata/effective periods are also available from **Knowledge Studio → Source library → Version metadata**.

An earlier evidence record remains an explanation of its recorded decision time. Selecting an old record does not restore operational permission after retirement. Do not treat the evidence inspector as private chain-of-thought: it exposes structured decisions, source support and audit history.

## 5. Human exception and safe resumption

Use **Reset demo** from **Case workspace** to get a new isolated case. Reset rotates the active synthetic workspace; it does not erase canonical historical evidence. The session has a bounded reset allowance.

1. Choose **Identify missing documentation**, then **Dispatch simulated follow-up**.
2. At **Awaiting response**, choose **Introduce an ambiguity**. Inspect the paused state and open **Human review**.
3. Read the blocking question, reason, assigned reviewer, due time, **Resume checkpoint**, **Resume instruction**, **Inspect linked evidence** and **Evidence and previous actions**.
4. While still **Office**, observe that manager resolution controls are disabled. Change **Demo role** to **Manager** to represent the assigned synthetic reviewer.
5. Choose **Clarify and resume collection**. Inspect the retained immutable decision and fresh governance check. The workflow returns to the saved collection checkpoint without sending another initial outreach.
6. Change **Demo role** back to **Office**. Return to **Case workspace** and choose **Simulate document receipt**.
7. Complete the office verification, verified transfer and receiving acknowledgment from the golden path. The result remains **PA pending**.

For an exception that cannot safely resume, the task may offer **Request bounded retry**, **Accept escalation / escalate** or **Reject this document**. These are distinct structured decisions, not equivalent “continue” buttons. A supervisor accepting an escalated task records ownership without releasing operational actions. Do not press escalation/rejection while expecting the golden path to continue.

## 6. Knowledge Studio lifecycle

Start a fresh demo before exploring publication/assignment if you want to preserve the original golden configuration for comparison. Set **Demo role** to **Knowledge reviewer**. The role is explicitly simulated and can affect only the current isolated workspace.

- **Source library:** inspect source versions and **Version metadata**. **Record seeded supersession** records the predecessor/successor relationship without rewriting the versions.
- **Packs & releases:** open **Release manifest** and **Case assignments**. Choose **Publish demo release** to create a distinct preconfigured synthetic immutable release. Select it under **Published release to assign**, then choose **Assign selected release**. Inspect the changed current assignment. Publication is separate from assignment; sandbox upload does neither.
- **Retrieval testing:** choose **Test governed retrieval** to inspect the assigned release and decisions. A newly published release with inadequate support must still abstain or pause; release existence is not a guarantee of evidence sufficiency.

The controls demonstrate a bounded reviewed release, not unrestricted editing of reimbursement policy. They cannot publish arbitrary uploaded content or change another visitor’s release.

## 7. Retirement, immutable history and sandbox nonauthority

Use a fresh demo so the original pinned release is active. This tour deliberately ends paused.

1. As **Office**, identify the missing documentation and dispatch the simulated follow-up. Record/select the earlier EvidenceRecord in **Evidence inspector**.
2. Switch to **Knowledge reviewer**. In **Knowledge Studio → Source library**, choose **Retire current requirement source**. Inspect the **Retired** status and lifecycle event.
3. Switch to **Office**. Simulate document receipt and open **Human review**. Choose **Verify document and approve bound transfer**.
4. The new knowledge-dependent transfer must pause because the authoritative source was retired. Human verification cannot override retirement. Inspect the new reason codes and the earlier unchanged evidence record. No later transfer may be authorized using the retired source.
5. Open **Knowledge Studio → Sandbox uploads**. Use **Load synthetic fixtures** if needed, download **synthetic-note-guide.txt**, and select that exact downloaded file under **Synthetic document (.txt)**. Check **I confirm this is a supplied synthetic fixture, with no patient or proprietary information**, then choose **Upload to sandbox**.
6. Inspect the parsed status, **Ingestion metadata** and **Sandbox collections**. It remains unapproved and exploration-only.
7. Open **Retrieval testing**. Choose **Test sandbox retrieval** and inspect sandbox-only applicability plus denied operational action permission. Choose **Test governed retrieval** and confirm that the sandbox replacement does not repair the retired operational authority.

The optional **synthetic-injection-check.txt** fixture contains an adversarial document instruction. Upload only the supplied bytes. Inspect it as quoted untrusted content; it must not change the role, permissions, execution or answer contract. An explanation may pause if a suspicious approved claim is detected. Merely displaying the source text is not executing it.

The server rejects files other than the supplied bounded synthetic TXT fixtures. Do not test with actual patient data, proprietary documents, credentials or executable content.

## Keyboard and recovery checks

Use **Skip to content**, Tab/Shift+Tab, visible focus indicators and Enter/Space to navigate the same journey. Knowledge Studio tabs support arrow keys, Home and End. Native select/file controls retain accessible labels. Test role-restricted controls, empty evidence/review states, saving indicators, provider pause, request errors and a refresh/retry after a failed request. No primary workflow should overflow horizontally at 375, 768, 1024 or 1440 pixels.

These are required QA observations, not a substitute for the real-browser test record. If the application shows **The workspace is unavailable.**, **Retry connection** retries the service handshake; no static mock case should appear. A rate/capacity pause must remain visible rather than bypassing quotas.

## Demonstration evidence and screenshots

Retained headless evidence is linked from [Phase 2D verification](phase2d-verification.md). Measurement caveats and the resume/interview narrative are in [portfolio narrative](portfolio-narrative.md). The production package smoke test is recorded in [production runbook](production-runbook.md).

Five captured and visually inspected [local production screenshots](screenshots/README.md) now show entry, workspace, human review and desktop/mobile completion. They show the compiled application on local loopback, not a public deployment. The [MVP verification report](mvp-verification.md) records the actual browser checks. Deployed URL/screenshots remain pending; local images must not be presented as deployment evidence.

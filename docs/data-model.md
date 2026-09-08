# Phase 2C durable data model

## Phase 2D workflow extension

Migrations 005/006 add the following durable records. The original canonical/retrieval model below stays intact.

| Relation | Purpose |
| --- | --- |
| `wf_grants`, `wf_revocations` | Publisher-issued synthetic case/channel/template/recipient/role/cadence grants and append-only revocation; grant has scoped case FK |
| `wf_steps` | Immutable command, status, ordered domain events, actor/time/transaction, full instance snapshot, previous hash; unique scoped workflow/revision and single active definition instance per case |
| `wf_receipts` | Independently committed deterministic integration outcomes, keyed to effect/attempt and payload hash; models remote success surviving local rollback |
| `wf_knowledge_links` | Scoped journal-step → exact retrieval run/evidence pair FKs; run links preserve canonical passages/releases and all four decisions |
| `wf_instances` | Caller-security view of the latest validated snapshot; workflow state and access status remain separate |
| `wf_outbox`, `wf_inbox`, `wf_tasks`, `wf_timers` | Caller-security views of durable aggregate records, including effect lifecycle/approvals, deduplicated source envelopes, structured human decisions and timer leases |

The journal is the authority; views are query projections. Commands and events are separate fields, effects are distinct from acknowledgment, tasks/decisions from evidence, and completion from case access status. Full snapshots favor straightforward recovery at small synthetic scale and incur storage/read growth. They are not a production queue performance claim. All base tables use forced scope RLS, immutable triggers and restricted insert/select grants. [The workflow specification](sc01-state-machine.md) defines boundaries and [the audit](phase2d-verification.md) verifies journal chains, exact evidence and approvals.

The executable schema is [the ordered migrations](../migrations/001_governance.sql); [database repositories](../src/db/database.ts) validate JSON through TypeScript/Zod and content hashes before returning domain objects. SQL rows are not trusted domain objects. All canonical content remains synthetic.

Every domain table is scoped by `(workspace, tenant, environment)`. A workspace identifies a dataset/demo or independently seeded test run; environment is `sandbox` or `governed`. Composite keys prevent references across these boundaries. Bodies preserve existing schema versions and exact historical source/decision content; explicit relational columns and constraints carry ownership, identity and query/reference metadata.

| Tables | Stable versus immutable identity and purpose |
| --- | --- |
| `generations` | Scope identity, durable mutation counter, original fixture namespace hash and fixture/schema version. Only generation is mutable by the runtime |
| `documents` | Stable source ID; title/type, owner/uploader/verified provenance, tenant/mode and optional case binding |
| `versions` | Immutable version ID and document FK; original text/content hash, artifact/metadata version, approval, effective/expiry/review/supersession timestamps, scope, audience/channel/use and authority domain |
| `passages` | Immutable canonical passage ID, version FK and text hash; exact UTF-16/line locators, parser/chunker revisions and reviewed synthetic statements |
| `collections` | Sandbox collection ID/revision, owner, member versions and expiry. Governed rows are forbidden |
| `packs`, `releases`, `membership` | Stable pack versus immutable published release; manifest hash, contributor/reviewer/publisher and publication/effective/expiry times. Membership joins release to exact canonical passages under composite FKs |
| `assignments`, `assignment_releases` | Immutable assignment ID with agent/workflow/case/audience/channel, active/expiry times and mandatory releases; relational release links |
| `cases`, `case_revisions` | Stable case and append-only context revisions; trusted applicability attributes, revision, evidence versions and pinned assignment. Latest committed revision is projected into the domain |
| `users` | Trusted synthetic actor context, roles, audiences, release/case/collection access and action grants. Real identity provisioning is not implemented |
| `events` | Attributed approval, retirement, supersession, conflict, publication and assignment events. Target, actor, timestamp, successor and explanation remain immutable; active retirement cannot be undone by a request clock |
| `embeddings` | Immutable vector key/body/hash, exact original vector values, pgvector representation, schema version, provider/model/revision/dimensions/normalization, configuration/input/context hashes and embedded timestamp |
| `passage_vectors` | Canonical passage to vector key, configuration and content hash. Composite FKs and a trigger reject mismatched model binding/content lineage. Multiple configurations coexist without being mixed in one query |
| `evidence`, `evidence_passages`, `evidence_releases` | Existing content-addressed EvidenceRecord and durable canonical references. Exact source quotations and four decisions remain independently inspectable after retirement |
| `runs` | Operation/run/transaction ID, committed outcome, actor/request, scope generation, decision clock, requested/effective mode/configuration, acknowledgment, optional correction-of evidence FK, exclusions/ranking/release/assignment diagnostics and embedding usage |
| `decisions` | Four distinct rows per run: support, applicability, communication and action, with structured reason codes and evidence FK |
| `escalations`, `audit` | Proposed undispatched escalation; decision-stage events and attributed governance/import operations. No messages or actions are sent |
| `idempotency` | Scoped actor/request hash, full request/configuration/ack fingerprint, run and evidence references; immutable duplicates return a labeled historical replay |
| `degraded_grants` | Immutable per-actor/request bounded system-policy authorization. Human acknowledgment or this durable grant is required before lexical operation |

Canonical rows/events/evidence cannot be updated or deleted through normal repository operations. Corrections use a new source version, release, assignment/case revision or new retrieval request; earlier records remain addressable. A retrieval correction supplies `RunOptions.correctionOf`; the service checks historical access, reruns current governance and stores a scoped foreign key from the new run to the earlier EvidenceRecord. It never rewrites that earlier record. There is no general publication editor, user-management endpoint or historical-data purge service.

Effective-date projections preserve the immutable source body. Supersession events affect future eligibility without resealing an old pack. A fresh release does not migrate assignments or expand actor access. Consumers must distinguish historical idempotency replies from newly authorized decisions.

Vector cache keys bind configuration, exact input bytes and context. Passage context includes canonical/version/artifact identities and parser/chunker revisions. The scope's imported corpus namespace retains Phase 2B cache compatibility; the decision snapshot separately binds the current scoped corpus, events and generation. Added/changed passage content still needs a new valid key and canonical identity. A missing/corrupt vector fails visibly; incompatible models/dimensions cannot silently substitute.

Time values inside canonical bodies use the existing offset-aware Zod timestamp contract. Generated SQL metadata columns retain their ISO strings; `created_at` is a PostgreSQL timestamp, and run transaction IDs record actual database transactions separately from the fixed synthetic decision clock. This preserves replay semantics without pretending synthetic dates are wall-clock commit times.

Current isolation is database-enforced RLS plus repository/policy restrictions, scoped keys and constraints. The trusted server sets transaction-local scope. A stolen backend database credential or privileged database owner is outside that isolation guarantee. See [ADR-002](adr/002-durable-governance.md) and the [runbook](persistence-runbook.md) for transaction, access and operational limits.

import { z } from 'zod';

export const Id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/);
export const Timestamp = z.iso.datetime({ offset: true });
export const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const Mode = z.enum(['governed', 'sandbox']);
export const Channel = z.enum(['chat', 'email', 'sms', 'internal']);
export const Audience = z.enum(['hcp', 'case_manager', 'knowledge_admin', 'safety', 'visitor']);
export const Use = z.enum(['explain', 'recommend', 'explore', 'internal_route']);
export const DimensionNames = ['product', 'indication', 'payer', 'plan', 'state', 'benefit', 'siteOfCare'] as const;
export const ScopeValue = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('known'), values: z.array(Id).min(1) }),
  z.strictObject({ kind: z.literal('all_explicit'), reason: z.string().min(1) }),
  z.strictObject({ kind: z.literal('not_applicable'), reason: z.string().min(1) }),
  z.strictObject({ kind: z.literal('unknown'), reason: z.string().min(1) }),
]);
export const Scope = z.strictObject({
  product: ScopeValue, indication: ScopeValue, payer: ScopeValue, plan: ScopeValue,
  state: ScopeValue, benefit: ScopeValue, siteOfCare: ScopeValue,
});
export const Attributes = z.strictObject({
  product: Id.nullable(), indication: Id.nullable(), payer: Id.nullable(), plan: Id.nullable(),
  state: Id.nullable(), benefit: Id.nullable(), siteOfCare: Id.nullable(),
});
export const Provenance = z.strictObject({
  mode: Mode, tenantId: Id, synthetic: z.literal(true), issuer: Id, ownerId: Id,
  uploadedBy: Id, verifiedBy: Id.nullable(), verifiedAt: Timestamp.nullable(),
});
export const Document = z.strictObject({
  id: Id, title: z.string().min(1), provenance: Provenance,
  type: z.enum(['payer_guide', 'case_notice', 'case_inventory', 'education', 'sop', 'program_guide']),
  caseId: Id.nullable(),
});
export const DocumentVersion = z.strictObject({
  id: Id, documentId: Id, version: Id, issuerVersion: z.string().nullable(),
  artifactVersion: Id, metadataRevision: Id, originalText: z.string().min(1), contentHash: Hash,
  approvalStatus: z.enum(['draft', 'approved', 'rejected']), approvedBy: Id.nullable(),
  approvedAt: Timestamp.nullable(), metadataConfirmedBy: Id.nullable(),
  effectiveFrom: Timestamp.nullable(), expiresAt: Timestamp.nullable(), reviewDueAt: Timestamp.nullable(),
  supersededBy: Id.nullable(), supersededAt: Timestamp.nullable(),
  authority: z.enum(['payer_owner', 'case_record', 'program_owner', 'operations_owner', 'educational', 'unverified']),
  authorityDomain: z.enum(['payer_process', 'case_facts', 'program_intake', 'communication']),
  scope: Scope, audiences: z.array(Audience).min(1), channels: z.array(Channel).min(1),
  permittedUses: z.array(Use), prohibitedUses: z.array(Use),
  securityStatus: z.enum(['fixture_checked', 'review_screened', 'quarantined']),
}).superRefine((v, ctx) => {
  if (v.effectiveFrom && v.expiresAt && Date.parse(v.effectiveFrom) >= Date.parse(v.expiresAt)) {
    ctx.addIssue({ code: 'custom', message: 'Expiration must follow effective date' });
  }
  if ((v.supersededBy === null) !== (v.supersededAt === null)) {
    ctx.addIssue({ code: 'custom', message: 'Supersession needs successor and transition time' });
  }
  if (v.approvalStatus === 'approved' && (!v.approvedBy || !v.approvedAt)) {
    ctx.addIssue({ code: 'custom', message: 'Approval needs an attributed event' });
  }
});
export const FactKind = z.enum([
  'required_document', 'case_request', 'package_missing', 'appeal_deadline', 'appeal_process',
  'support_intake', 'communication_guidance',
]);
export const Locator = z.strictObject({
  section: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive(),
  lineStart: z.number().int().positive(), lineEnd: z.number().int().positive(),
  table: z.strictObject({ headers: z.array(z.string()).min(1), row: z.string(), footnote: z.string() }).nullable(),
});
export const CanonicalPassage = z.strictObject({
  id: Id, documentVersionId: Id, artifactVersion: Id, parserVersion: Id, chunkerVersion: Id,
  text: z.string().min(1), textHash: Hash, locator: Locator,
  statements: z.array(z.strictObject({
    kind: FactKind, value: z.string().min(1), quote: z.string().min(1),
    reviewedBy: Id, method: z.literal('synthetic-human-annotation'),
  })),
}).superRefine((p, ctx) => {
  if (p.locator.end <= p.locator.start || p.locator.lineEnd < p.locator.lineStart) {
    ctx.addIssue({ code: 'custom', message: 'Invalid passage location' });
  }
  for (const statement of p.statements) {
    if (!p.text.includes(statement.quote)) ctx.addIssue({ code: 'custom', message: 'Statement quote absent from passage' });
  }
});
export const KnowledgeCollection = z.strictObject({
  id: Id, revision: Id, tenantId: Id, ownerId: Id, mode: z.literal('sandbox'),
  name: z.string(), documentVersionIds: z.array(Id), expiresAt: Timestamp,
});
export const KnowledgePack = z.strictObject({ id: Id, tenantId: Id, name: z.string(), ownerId: Id });
export const KnowledgePackRelease = z.strictObject({
  id: Id, packId: Id, version: Id, status: z.enum(['draft', 'published']),
  documentVersionIds: z.array(Id).min(1), passageIds: z.array(Id).min(1),
  scope: Scope, audiences: z.array(Audience).min(1), channels: z.array(Channel).min(1),
  permittedUses: z.array(Use), prohibitedUses: z.array(Use),
  effectiveFrom: Timestamp, expiresAt: Timestamp, manifestHash: Hash,
  indexVersion: Id, validationVersion: Id, contributedBy: Id, reviewedBy: Id,
  publishedBy: Id, publishedAt: Timestamp,
}).superRefine((v, ctx) => {
  if (v.contributedBy === v.reviewedBy) ctx.addIssue({ code: 'custom', message: 'Contributor cannot self-approve' });
  if (Date.parse(v.effectiveFrom) >= Date.parse(v.expiresAt)) ctx.addIssue({ code: 'custom', message: 'Invalid release interval' });
});
export const KnowledgeAssignment = z.strictObject({
  id: Id, tenantId: Id, releaseIds: z.array(Id).min(1), mandatoryReleaseIds: z.array(Id),
  agentId: Id, workflowId: Id, caseIds: z.array(Id).min(1),
  audiences: z.array(Audience).min(1), channels: z.array(Channel).min(1),
  activeFrom: Timestamp, expiresAt: Timestamp,
});
export const CaseContext = z.strictObject({
  id: Id, tenantId: Id, revision: Id, attributes: Attributes, assignmentId: Id,
  evidenceVersionIds: z.array(Id), accessStatus: z.enum(['pa_pending', 'denied', 'unknown']),
});
export const ActionType = z.enum(['recommend_document', 'transfer_document', 'send_message', 'decide_coverage']);
export const UserContext = z.strictObject({
  id: Id, tenantId: Id, audience: Audience,
  roles: z.array(z.enum(['operational', 'sandbox', 'reviewer', 'publisher', 'evaluator'])),
  caseIds: z.array(Id), releaseIds: z.array(Id), collectionIds: z.array(Id),
  channels: z.array(Channel), permittedUses: z.array(Use), actionGrants: z.array(ActionType),
});
export const RetrievalRequest = z.strictObject({
  id: Id, mode: Mode, question: z.string().min(1).max(4000), channel: Channel,
  task: z.enum(['missing_document', 'document_requirement', 'deadline', 'appeal_process', 'support_intake', 'source_summary']),
  selectionId: Id, releaseIds: z.array(Id), caseId: Id.nullable(),
  purpose: Use, requestedAction: ActionType.nullable(), maxResults: z.number().int().min(1).max(50),
}).superRefine((v, ctx) => {
  if (v.mode === 'governed' && !v.caseId) ctx.addIssue({ code: 'custom', message: 'Governed spike requests require a trusted case' });
  if (v.mode === 'sandbox' && (v.caseId || v.releaseIds.length)) ctx.addIssue({ code: 'custom', message: 'Sandbox cannot bind a case/release' });
});
const RankScore = z.strictObject({ rank: z.number().int().positive(), score: z.number().finite() });
export const RetrievalRanking = z.strictObject({
  lexical: RankScore.nullable(), semantic: RankScore.nullable(), combined: RankScore.nullable(),
  method: z.enum(['cosine', 'reciprocal_rank_fusion']), rrfK: z.number().int().positive().nullable(),
  candidateDepth: z.number().int().positive(), semanticMinCosine: z.number().min(-1).max(1).nullable(),
  inclusionReason: z.enum(['semantic', 'lexical_only', 'semantic_only', 'both']),
});
export const EmbeddingProvenance = z.strictObject({ provider: Id, model: Id, dimensions: z.number().int().positive(),
  configurationHash: Hash, documentVectorKey: Hash, queryVectorKey: Hash, documentEmbeddedAt: Timestamp, queryEmbeddedAt: Timestamp });
export const RetrievalCandidate = z.strictObject({
  passageId: Id, documentVersionId: Id, textHash: Hash, score: z.number().finite().nonnegative(),
  rank: z.number().int().positive(), scoreKind: z.enum(['lexical_bm25', 'vector_similarity', 'hybrid_rrf']),
  ranking: RetrievalRanking.optional(), embedding: EmbeddingProvenance.optional(),
});
export const ReasonCode = z.enum([
  'ELIGIBLE', 'SUPPORTED', 'PARTIAL_SUPPORT', 'NO_EVIDENCE', 'REQUIRED_EVIDENCE_MISSING',
  'UNAUTHORIZED', 'WRONG_MODE', 'WRONG_TENANT', 'CASE_ACCESS_DENIED', 'SELECTION_DENIED',
  'ASSIGNMENT_MISMATCH', 'RELEASE_NOT_ASSIGNED', 'MANDATORY_PACK_OMITTED', 'PACK_NOT_PUBLISHED',
  'NOT_IN_PACK', 'NOT_IN_COLLECTION', 'UNAPPROVED', 'SOURCE_UNVERIFIED', 'METADATA_UNKNOWN',
  'WRONG_PRODUCT', 'WRONG_INDICATION', 'WRONG_PAYER', 'WRONG_PLAN', 'WRONG_STATE', 'WRONG_BENEFIT', 'WRONG_SITE',
  'NOT_YET_EFFECTIVE', 'EXPIRED', 'REVIEW_OVERDUE', 'SUPERSEDED', 'SOURCE_RETIRED', 'RELEASE_RETIRED',
  'AUDIENCE_DENIED', 'CHANNEL_DENIED', 'USE_PROHIBITED', 'USE_NOT_PERMITTED', 'QUARANTINED',
  'LOWER_AUTHORITY_CONFLICT', 'INSUFFICIENT_AUTHORITY', 'AUTHORITATIVE_CONFLICT',
  'SANDBOX_EXPLORATION_ONLY', 'SANDBOX_ACTION_DENIED', 'ACTION_NOT_REQUESTED', 'ACTION_PROHIBITED',
  'ACTION_GRANT_MISSING', 'APPROVAL_REQUIRED', 'RECOMMENDATION_ALLOWED', 'TASK_ACTION_MISMATCH',
  'PROVIDER_UNAVAILABLE', 'PROVIDER_CONTRACT_VIOLATION', 'STALE_SNAPSHOT', 'INJECTION_CONTENT_NOT_INSTRUCTION',
  'CONTENT_UNCHANGED', 'RETIREMENT_RECORDED', 'CONFLICT_RECORDED', 'HISTORICAL_ACCESS_ALLOWED',
]);
const decisionFields = {
  reasonCodes: z.array(ReasonCode).min(1), supportingPassageIds: z.array(Id),
  policyVersion: Id, timestamp: Timestamp,
};
export const SourceSupportDecision = z.strictObject({
  ...decisionFields, status: z.enum(['supported', 'partial', 'missing', 'conflicting', 'not_evaluated']),
});
export const ApplicabilityDecision = z.strictObject({
  ...decisionFields, status: z.enum(['applicable', 'not_applicable', 'unknown', 'not_evaluated', 'sandbox_only']),
});
export const CommunicationPermissionDecision = z.strictObject({
  ...decisionFields, status: z.enum(['allowed', 'denied', 'not_evaluated']),
});
export const ActionPermissionDecision = z.strictObject({
  ...decisionFields, status: z.enum(['allowed', 'denied', 'requires_approval', 'paused', 'not_requested']),
});
export const ActionProposal = z.strictObject({
  type: ActionType, caseId: Id.nullable(), evidencePassageIds: z.array(Id),
  status: z.enum(['permitted_recommendation', 'blocked', 'needs_approval', 'paused']),
  execution: z.literal('not_executed'),
});
export const AnswerProposal = z.strictObject({
  method: z.literal('deterministic-extractive-composition'),
  claims: z.array(z.strictObject({ text: z.string(), passageIds: z.array(Id).min(1) })),
  message: z.string(), operationalKnowledge: z.boolean(),
});
export const EscalationRecord = z.strictObject({
  id: Id, category: z.enum(['knowledge_conflict', 'missing_knowledge', 'security', 'authorization']),
  reasonCodes: z.array(ReasonCode).min(1), supportingPassageIds: z.array(Id),
  ownerRole: z.enum(['knowledge_admin', 'case_manager', 'security']),
  status: z.literal('proposed_not_dispatched'), policyVersion: Id, timestamp: Timestamp,
});
export const AuditEvent = z.strictObject({
  id: Id, type: z.enum(['access', 'selection', 'filtering', 'retrieval', 'authority', 'support', 'applicability', 'communication', 'action', 'evidence', 'retirement', 'conflict']),
  actorId: Id, tenantId: Id, subjectIds: z.array(Id), reasonCodes: z.array(ReasonCode).min(1),
  policyVersion: Id, timestamp: Timestamp, payloadHash: Hash,
});
export const Exclusion = z.strictObject({
  documentVersionId: Id, reasonCodes: z.array(ReasonCode).min(1),
});
export const AuthorityFinding = z.strictObject({
  reasonCode: ReasonCode, passageIds: z.array(Id).min(1), explanation: z.string(),
});
export const EvidenceCitation = z.strictObject({
  passageId: Id, documentVersionId: Id, documentId: Id, text: z.string(), textHash: Hash,
  locator: Locator, artifactVersion: Id,
});
export const RetrievalDiagnostics = z.array(z.strictObject({ passageId: Id, releaseIds: z.array(Id), metadataFilter: z.literal('ELIGIBLE'), selectionReason: z.string() }));
export type RetrievalDiagnostics = z.infer<typeof RetrievalDiagnostics>;
export const EvidenceBody = z.strictObject({
  schemaVersion: z.enum(['phase2a-v1', 'phase2b-v1']), timestamp: Timestamp, policyVersion: Id,
  request: RetrievalRequest, userContext: UserContext, caseContext: CaseContext.nullable(),
  registryHash: Hash, corpusHash: Hash,
  selectedReleases: z.array(z.strictObject({ id: Id, manifestHash: Hash })),
  collectionSnapshot: KnowledgeCollection.nullable(),
  provider: z.strictObject({ id: Id, version: Id, kind: z.enum(['lexical', 'semantic', 'hybrid']), config: z.string() }),
  retrievalDiagnostics: RetrievalDiagnostics.optional(),
  eligibleVersionIds: z.array(Id), retrieved: z.array(RetrievalCandidate), excluded: z.array(Exclusion),
  authorityFindings: z.array(AuthorityFinding), support: SourceSupportDecision,
  applicability: ApplicabilityDecision, communication: CommunicationPermissionDecision, action: ActionPermissionDecision,
  evidenceUsed: z.array(EvidenceCitation), answer: AnswerProposal, actionProposal: ActionProposal.nullable(),
  escalation: EscalationRecord.nullable(), disposition: z.enum(['answer', 'abstain', 'escalate', 'deny', 'pause']),
  audit: z.array(AuditEvent),
});
export const EvidenceRecord = EvidenceBody.extend({ id: Id, recordHash: Hash });
export const Retirement = z.strictObject({
  id: Id, targetType: z.enum(['document_version', 'release']), targetId: Id,
  actorId: Id, timestamp: Timestamp, reason: z.string().min(1), policyVersion: Id,
});
export const ConflictFinding = z.strictObject({ id: Id, documentVersionId: Id, actorId: Id, timestamp: Timestamp });
export const Corpus = z.strictObject({
  documents: z.array(Document), versions: z.array(DocumentVersion), passages: z.array(CanonicalPassage),
  packs: z.array(KnowledgePack), releases: z.array(KnowledgePackRelease),
  assignments: z.array(KnowledgeAssignment), collections: z.array(KnowledgeCollection),
  cases: z.array(CaseContext), users: z.array(UserContext),
});

export type Document = z.infer<typeof Document>;
export type DocumentVersion = z.infer<typeof DocumentVersion>;
export type CanonicalPassage = z.infer<typeof CanonicalPassage>;
export type KnowledgeCollection = z.infer<typeof KnowledgeCollection>;
export type KnowledgePack = z.infer<typeof KnowledgePack>;
export type KnowledgePackRelease = z.infer<typeof KnowledgePackRelease>;
export type KnowledgeAssignment = z.infer<typeof KnowledgeAssignment>;
export type CaseContext = z.infer<typeof CaseContext>;
export type UserContext = z.infer<typeof UserContext>;
export type RetrievalRequest = z.infer<typeof RetrievalRequest>;
export type RetrievalCandidate = z.infer<typeof RetrievalCandidate>;
export type SourceSupportDecision = z.infer<typeof SourceSupportDecision>;
export type ApplicabilityDecision = z.infer<typeof ApplicabilityDecision>;
export type CommunicationPermissionDecision = z.infer<typeof CommunicationPermissionDecision>;
export type ActionPermissionDecision = z.infer<typeof ActionPermissionDecision>;
export type EvidenceRecord = z.infer<typeof EvidenceRecord>;
export type EvidenceBody = z.infer<typeof EvidenceBody>;
export type AnswerProposal = z.infer<typeof AnswerProposal>;
export type ActionProposal = z.infer<typeof ActionProposal>;
export type EscalationRecord = z.infer<typeof EscalationRecord>;
export type AuditEvent = z.infer<typeof AuditEvent>;
export type Corpus = z.infer<typeof Corpus>;
export type Retirement = z.infer<typeof Retirement>;
export type ConflictFinding = z.infer<typeof ConflictFinding>;
export type ReasonCode = z.infer<typeof ReasonCode>;
export type AuthorityFinding = z.infer<typeof AuthorityFinding>;
export type Exclusion = z.infer<typeof Exclusion>;
export type Scope = z.infer<typeof Scope>;
export type Attributes = z.infer<typeof Attributes>;
export type FactKind = z.infer<typeof FactKind>;

import { DimensionNames } from './contracts.ts';
import type { Attributes, CaseContext, DocumentVersion, KnowledgeCollection, KnowledgePackRelease, ReasonCode, RetrievalRequest, Scope, UserContext } from './contracts.ts';
import { Registry } from './registry.ts';

const mismatch: Record<keyof Attributes, ReasonCode> = {
  product: 'WRONG_PRODUCT', indication: 'WRONG_INDICATION', payer: 'WRONG_PAYER', plan: 'WRONG_PLAN',
  state: 'WRONG_STATE', benefit: 'WRONG_BENEFIT', siteOfCare: 'WRONG_SITE',
};
export function scopeReasons(scope: Scope, attributes: Attributes): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  for (const dimension of DimensionNames) {
    const rule = scope[dimension];
    const value = attributes[dimension];
    if (rule.kind === 'not_applicable') continue;
    if (rule.kind === 'unknown' || value === null) reasons.push('METADATA_UNKNOWN');
    else if (rule.kind === 'known' && !rule.values.includes(value)) reasons.push(mismatch[dimension]);
  }
  return [...new Set(reasons)];
}
export function dateReasons(from: string | null, to: string | null, now: string): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  if (!from) reasons.push('METADATA_UNKNOWN');
  else if (Date.parse(now) < Date.parse(from)) reasons.push('NOT_YET_EFFECTIVE');
  if (to && Date.parse(now) >= Date.parse(to)) reasons.push('EXPIRED');
  return reasons;
}
export interface Selection {
  caseContext: CaseContext | null;
  releases: KnowledgePackRelease[];
  collection: KnowledgeCollection | null;
  reasons: ReasonCode[];
}

export function selectKnowledge(registry: Registry, user: UserContext, request: RetrievalRequest, now: string): Selection {
  const result: Selection = { caseContext: null, releases: [], collection: null, reasons: [] };
  if (!user.channels.includes(request.channel)) result.reasons.push('CHANNEL_DENIED');
  if (!user.permittedUses.includes(request.purpose)) result.reasons.push('USE_NOT_PERMITTED');
  if (request.mode === 'sandbox') {
    const collection = registry.corpus.collections.find(c => c.id === request.selectionId);
    if (!user.roles.includes('sandbox') || !collection || collection.tenantId !== user.tenantId ||
        collection.ownerId !== user.id || !user.collectionIds.includes(collection.id)) {
      result.reasons.push('SELECTION_DENIED');
    } else if (Date.parse(now) >= Date.parse(collection.expiresAt)) result.reasons.push('EXPIRED');
    else result.collection = collection;
    return result;
  }
  const caseContext = registry.corpus.cases.find(c => c.id === request.caseId);
  if (!user.roles.includes('operational') || !caseContext || caseContext.tenantId !== user.tenantId || !user.caseIds.includes(caseContext.id)) {
    result.reasons.push('CASE_ACCESS_DENIED');
    return result;
  }
  result.caseContext = caseContext;
  const assignment = registry.corpus.assignments.find(a => a.id === caseContext.assignmentId);
  if (!assignment || assignment.id !== request.selectionId || assignment.tenantId !== user.tenantId ||
      assignment.agentId !== 'Pathway-Agent' || assignment.workflowId !== 'knowledge-spike-v1' || !assignment.caseIds.includes(caseContext.id)) {
    result.reasons.push('ASSIGNMENT_MISMATCH');
    return result;
  }
  result.reasons.push(...dateReasons(assignment.activeFrom, assignment.expiresAt, now));
  if (!assignment.audiences.includes(user.audience)) result.reasons.push('AUDIENCE_DENIED');
  if (!assignment.channels.includes(request.channel)) result.reasons.push('CHANNEL_DENIED');
  if (assignment.mandatoryReleaseIds.some(id => !request.releaseIds.includes(id))) result.reasons.push('MANDATORY_PACK_OMITTED');
  for (const id of request.releaseIds) {
    if (!assignment.releaseIds.includes(id) || !user.releaseIds.includes(id)) { result.reasons.push('RELEASE_NOT_ASSIGNED'); continue; }
    const release = registry.corpus.releases.find(r => r.id === id);
    if (!release) { result.reasons.push('RELEASE_NOT_ASSIGNED'); continue; }
    const pack = registry.corpus.packs.find(p => p.id === release.packId);
    if (pack?.tenantId !== user.tenantId) { result.reasons.push('WRONG_TENANT'); continue; }
    result.releases.push(release);
    if (release.status !== 'published' || Date.parse(release.publishedAt) > Date.parse(now)) result.reasons.push('PACK_NOT_PUBLISHED');
    if (registry.isRetired(id)) result.reasons.push('RELEASE_RETIRED');
    result.reasons.push(...dateReasons(release.effectiveFrom, release.expiresAt, now), ...scopeReasons(release.scope, caseContext.attributes));
    if (!release.audiences.includes(user.audience)) result.reasons.push('AUDIENCE_DENIED');
    if (!release.channels.includes(request.channel)) result.reasons.push('CHANNEL_DENIED');
    if (release.prohibitedUses.includes(request.purpose)) result.reasons.push('USE_PROHIBITED');
    if (!release.permittedUses.includes(request.purpose)) result.reasons.push('USE_NOT_PERMITTED');
  }
  result.reasons = [...new Set(result.reasons)];
  return result;
}

export function sourceReasons(registry: Registry, v: DocumentVersion, user: UserContext, request: RetrievalRequest, selection: Selection, now: string, conflictInspection = false): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  const document = registry.document(v.documentId);
  if (document.provenance.tenantId !== user.tenantId) reasons.push('WRONG_TENANT');
  if (document.provenance.mode !== request.mode) reasons.push('WRONG_MODE');
  if (registry.isRetired(v.id)) reasons.push('SOURCE_RETIRED');
  if (v.securityStatus === 'quarantined') reasons.push('QUARANTINED');
  if (request.mode === 'sandbox') {
    if (!selection.collection?.documentVersionIds.includes(v.id)) reasons.push('NOT_IN_COLLECTION');
  } else {
    const inCase = selection.caseContext?.evidenceVersionIds.includes(v.id);
    const inPack = selection.releases.some(r => r.documentVersionIds.includes(v.id));
    if (!inCase && !inPack && !conflictInspection) reasons.push('NOT_IN_PACK');
    if (document.caseId && document.caseId !== selection.caseContext?.id) reasons.push('CASE_ACCESS_DENIED');
    if (v.approvalStatus !== 'approved') reasons.push('UNAPPROVED');
    if (!document.provenance.verifiedBy || !document.provenance.verifiedAt || Date.parse(document.provenance.verifiedAt) > Date.parse(now)) reasons.push('SOURCE_UNVERIFIED');
    if (!v.metadataConfirmedBy || !v.reviewDueAt) reasons.push('METADATA_UNKNOWN');
    if (v.approvedAt && Date.parse(v.approvedAt) > Date.parse(now)) reasons.push('UNAPPROVED');
    reasons.push(...dateReasons(v.effectiveFrom, v.expiresAt, now));
    if (v.reviewDueAt && Date.parse(now) >= Date.parse(v.reviewDueAt)) reasons.push('REVIEW_OVERDUE');
    const supersededAt = registry.supersededAt(v);
    if (supersededAt && Date.parse(now) >= Date.parse(supersededAt)) reasons.push('SUPERSEDED');
    if (selection.caseContext) reasons.push(...scopeReasons(v.scope, selection.caseContext.attributes));
    else reasons.push('CASE_ACCESS_DENIED');
  }
  if (!v.audiences.includes(user.audience)) reasons.push('AUDIENCE_DENIED');
  if (!v.channels.includes(request.channel)) reasons.push('CHANNEL_DENIED');
  if (v.prohibitedUses.includes(request.purpose)) reasons.push('USE_PROHIBITED');
  if (!v.permittedUses.includes(request.purpose)) reasons.push('USE_NOT_PERMITTED');
  return [...new Set(reasons)];
}

import { CanonicalPassage, Document, DocumentVersion, DimensionNames, KnowledgePackRelease } from '../contracts.ts';
import type { CaseContext } from '../contracts.ts';
import { Registry } from '../registry.ts';
import { hash, manifestDigest } from '../integrity.ts';
import { scopeReasons } from '../policy.ts';
import { instructionContent } from '../agent/safety.ts';
import type { UploadRecord } from './contracts.ts';

export const reviewDigest = (u: UploadRecord) => hash({ revision: u.revision, parsed: u.parsed, metadata: u.metadata });
export function evaluateUpload(u: UploadRecord, context: CaseContext, now: string, registry?: Registry) {
 const m = u.metadata, checks: { name: string; pass: boolean; explanation: string }[] = [];
 const add = (name: string, pass: boolean, explanation: string) => checks.push({ name, pass, explanation });
 add('Content screening', !instructionContent(u.parsed.text) && u.status !== 'quarantined', 'Document instructions remain untrusted. Recognized injection content is quarantined.');
 add('Document identity', m.documentType !== 'unknown' && !!m.sourceName.trim() && !!m.owner.trim() && !!m.program?.trim(), 'Source name, document type, version, owner and program must be reviewed.');
 add('Applicability metadata', DimensionNames.every(d => m.scope[d].kind !== 'unknown'), 'Every applicability dimension needs a reviewed value or explicit not-applicable scope.');
 add('Synthetic case match', scopeReasons(m.scope, context.attributes).length === 0, 'A release assigned to this case must match its product, payer, plan, geography and benefit.');
 add('Effective dates', !!m.effectiveFrom && !!m.expiresAt && Date.parse(m.effectiveFrom) <= Date.parse(now) && Date.parse(m.expiresAt) > Date.parse(now), 'The source must be effective and unexpired at this synthetic checkpoint.');
 add('Audience and permitted use', m.audiences.includes('hcp') && m.permittedUses.includes('recommend') && m.channels.includes('chat') && m.communicationPermission === 'explicit_channels_only', 'This SC-01 case requires explicit HCP/chat/recommend scope. Channel permission never grants an effect.');
 add('Reviewer attribution', m.reviewer === 'publisher', 'The Knowledge Reviewer must be explicitly identified. The contributor cannot self-approve.');
 add('Source authority', m.authority !== 'unverified' && (m.documentType !== 'payer_guide' || (m.authority === 'payer_owner' && m.authorityDomain === 'payer_process')), 'The reviewer must attest the synthetic source’s authority domain.');
 add('Reviewed facts', m.annotations.length > 0 && m.annotations.every(a => u.parsed.passages.some(p => p.id === a.passageId && p.text.includes(a.quote))), 'Each proposed fact needs a reviewed kind, value and exact passage quote.');
 const byKind = new Map<string, Set<string>>();
 for (const a of m.annotations) { if (!byKind.has(a.kind)) byKind.set(a.kind, new Set()); byKind.get(a.kind)!.add(a.value); }
 add('Superseded source', !m.supersededSource || !!registry?.corpus.versions.some(v=>v.id===m.supersededSource && v.approvalStatus==='approved' && registry.corpus.documents.some(d=>d.id===v.documentId && d.provenance.mode==='governed')), 'A proposed predecessor must identify an existing approved governed source. Publication does not itself supersede it.');
 add('Internal consistency', [...byKind.values()].every(values => values.size === 1), 'Conflicting assertions require correction before publication.');
 return { checks, pass: checks.every(c => c.pass), reviewHash: reviewDigest(u), label: 'Deterministic governance checks. These are not a factual-quality evaluation or real payer validation.' };
}
export function canonicalUpload(u: UploadRecord, governed: boolean, now: string, predecessorDocument?: Document) {
 const m = u.metadata, familyId = predecessorDocument?.id ?? `UPLOAD.${u.id.slice(-24)}`, versionId = predecessorDocument ? `${familyId}.u${hash(u.id).slice(0,12)}.r${u.revision}` : `${familyId}.r${u.revision}`;
 const document = predecessorDocument ?? Document.parse({ id: familyId, title: m.sourceName, provenance: { mode: governed ? 'governed' : 'sandbox', tenantId: 'T-DEMO', synthetic: true, issuer: 'synthetic-source-owner', ownerId: governed ? 'publisher' : 'viewer', uploadedBy: 'viewer', verifiedBy: governed ? 'publisher' : null, verifiedAt: governed ? u.reviewedAt : null }, type: m.documentType === 'unknown' ? 'education' : m.documentType, caseId: null });
 const version = DocumentVersion.parse({ id: versionId, documentId: familyId, version: m.version, issuerVersion: m.version, artifactVersion: 'original.' + u.parsed.originalHash.slice(0, 24), metadataRevision: `review.r${u.revision}`, originalText: u.parsed.text, contentHash: u.parsed.textHash,
  approvalStatus: governed ? 'approved' : 'draft', approvedBy: governed ? 'publisher' : null, approvedAt: governed ? u.reviewedAt : null, metadataConfirmedBy: governed ? 'publisher' : null,
  effectiveFrom: m.effectiveFrom, expiresAt: m.expiresAt, reviewDueAt: m.expiresAt, supersededBy: null, supersededAt: null,
  authority: governed ? m.authority : 'unverified', authorityDomain: m.authorityDomain, scope: m.scope,
  audiences: governed ? m.audiences : ['visitor'], channels: governed ? m.channels : ['chat'], permittedUses: governed ? m.permittedUses : ['explore'], prohibitedUses: [], securityStatus: instructionContent(u.parsed.text) ? 'quarantined' : 'review_screened',
 });
 const passages = u.parsed.passages.map(p => CanonicalPassage.parse({ id: `${versionId}.p${u.parsed.passages.indexOf(p) + 1}`, documentVersionId: versionId, artifactVersion: version.artifactVersion, parserVersion: u.parsed.parser, chunkerVersion: u.parsed.chunker, text: p.text, textHash: p.textHash,
  locator: { section: p.location.page ? `Page ${p.location.page} · ${p.location.section}` : p.location.paragraph ? `${p.location.section} · paragraph ${p.location.paragraph}` : p.location.section, start: p.location.start, end: p.location.end, lineStart: p.location.lineStart, lineEnd: p.location.lineEnd, table: p.location.table },
  statements: governed ? m.annotations.filter(a => a.passageId === p.id).map(a => ({ kind: a.kind, value: a.value, quote: a.quote, reviewedBy: 'publisher', method: 'synthetic-human-annotation' })) : [],
 }));
 const collection = { id: 'temporary.' + u.id.slice(-32), revision: `r${u.revision}`, tenantId: 'T-DEMO', ownerId: 'viewer', mode: 'sandbox' as const, name: m.sourceName + ' · temporary exploration', documentVersionIds: [versionId], expiresAt: '2026-12-01T07:00:00Z' };
 // Actual temporary retention uses wall-clock expiry in portfolio tables. The
 // collection interval is in the explicitly separate September scenario clock.
 return { document, version, passages, collection, now };
}
export function temporaryRegistry(u: UploadRecord, now: string) {
 const c = canonicalUpload(u, false, now);
 return new Registry({ documents: [c.document], versions: [c.version], passages: c.passages, collections: [c.collection], packs: [], releases: [], assignments: [], cases: [],
  users: [{ id: 'viewer', tenantId: 'T-DEMO', audience: 'visitor', roles: ['sandbox'], caseIds: [], releaseIds: [], collectionIds: [c.collection.id], channels: ['chat'], permittedUses: ['explore'], actionGrants: [] }],
 });
}
export function releaseForUpload(registry: Registry, u: UploadRecord, now: string) {
 const predecessor = u.metadata.supersededSource ? registry.corpus.versions.find(v=>v.id===u.metadata.supersededSource) : undefined;
 if(u.metadata.supersededSource && !predecessor) throw new Error('PREDECESSOR_NOT_FOUND');
 const source = canonicalUpload(u, true, now, predecessor ? registry.corpus.documents.find(d=>d.id===predecessor.documentId) : undefined), m = u.metadata;
 const corpus = structuredClone(registry.corpus);
 for (const [key, values] of [['documents', [source.document]], ['versions', [source.version]], ['passages', source.passages]] as const) for (const value of values) if (!corpus[key].some(v => v.id === value.id)) (corpus[key] as { id: string }[]).push(value);
 const body = { id: `KP-ALDER.UPLOAD.${u.id.slice(-16)}.r${u.revision}`, packId: 'KP-ALDER', version: `reviewed-r${u.revision}`, status: 'published' as const,
  documentVersionIds: [source.version.id], passageIds: source.passages.map(p => p.id), scope: m.scope, audiences: m.audiences, channels: m.channels, permittedUses: m.permittedUses, prohibitedUses: [], effectiveFrom: m.effectiveFrom!, expiresAt: m.expiresAt!,
  indexVersion: `temporary-reviewed-r${u.revision}`, validationVersion: 'studio-governance-v1', contributedBy: 'viewer', reviewedBy: 'publisher', publishedBy: 'publisher', publishedAt: registry.corpus.releases.find(r => r.id === `KP-ALDER.UPLOAD.${u.id.slice(-16)}.r${u.revision}`)?.publishedAt ?? now,
 };
 const release = KnowledgePackRelease.parse({ ...body, manifestHash: manifestDigest(body, corpus) });
 const prior = corpus.releases.find(r => r.id === release.id);
 if(prior && hash(prior)!==hash(release))throw new Error('IMMUTABLE_RELEASE_COLLISION');
 if(!prior)corpus.releases.push(release); new Registry(corpus);
 return { ...source, release };
}

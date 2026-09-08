import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { Database, insert } from '../db/database.ts';
import type { Scope } from '../db/database.ts';
import { GovernanceRepository } from '../db/governance.ts';
import { loadRegistry, caseSelection } from '../db/registry.ts';
import { PersistentRetrieval } from '../db/retrieval.ts';
import { WorkflowRepository } from '../workflow/repository.ts';
import { baseRequest, sandboxRequest } from '../evaluation.ts';
import { HttpError } from '../app/session.ts';
import type { Session, Sessions } from '../app/session.ts';
import type { EmbeddingCache } from '../providers/embedding.ts';
import { hash } from '../integrity.ts';
import { validateSyntheticText, instructionContent } from '../agent/safety.ts';
import { configuredProviders } from '../agent/runtime.ts';
import { parseUpload, validateUpload, UPLOAD_LIMIT } from './parser.ts';
import { Metadata, proposedMetadata, StudioAction, StudioTest, UploadRecord } from './contracts.ts';
import { TemporaryEmbeddingCache } from './cache.ts';
import { canonicalUpload, evaluateUpload, releaseForUpload, reviewDigest, temporaryRegistry } from './governance.ts';

export class StudioService {
 readonly db: Database; readonly sessions: Sessions; readonly cache: EmbeddingCache;
 constructor(db: Database, sessions: Sessions, cache: EmbeddingCache) { this.db = db; this.sessions = sessions; this.cache = cache; }
 scope(s: Session, environment: Scope['environment'] = 'governed'): Scope { if (!s.workspace) throw new HttpError(409, 'Launch a synthetic case first.'); return { workspace: s.workspace, tenant: 'T-DEMO', environment }; }
 async prune() {
  for (const table of ['studio_uploads', 'studio_history', 'studio_results','studio_vectors','temporary_agent_entries']) await this.sessions.db.pool.query(`DELETE FROM portfolio.${table} WHERE expires_at<=clock_timestamp()`);
 }
 async view(s: Session, client?: PoolClient) {
  const scope = this.scope(s), c = client ?? await this.sessions.db.pool.connect();
  try {
   const uploads = (await c.query('SELECT body FROM portfolio.studio_uploads WHERE workspace=$1 AND expires_at>clock_timestamp() ORDER BY created_at', [scope.workspace])).rows.map(r => UploadRecord.parse(r.body));
   const history = (await c.query('SELECT body FROM portfolio.studio_history WHERE workspace=$1 AND expires_at>clock_timestamp() ORDER BY created_at', [scope.workspace])).rows.map(r => r.body);
   const registry=await new GovernanceRepository(this.db,scope).snapshot(),now=await this.currentClock(s);
   const reviews=uploads.map(u=>({uploadId:u.id,evaluation:evaluateUpload(u,registry.corpus.cases.find(c=>c.id==='DEMO-101')!,now,registry)}));
   const tests = (await c.query('SELECT body FROM portfolio.studio_results WHERE workspace=$1 AND expires_at>clock_timestamp() ORDER BY created_at DESC LIMIT 12', [scope.workspace])).rows.map(r => r.body);
   return { uploads, reviews, history, tests, maxUploadBytes: UPLOAD_LIMIT, maxUploads: 3,
    retention: 'Unapproved original files, extracted passages and sandbox tests expire with this four-hour session. Expired data is inaccessible immediately and deleted within five minutes while the service runs, or on its next startup. You may delete it sooner. Explicitly published synthetic sources and historical governed evidence remain immutable.',
    roles: { office: 'Explore sources, upload synthetic documents and perform assigned office verification.', manager: 'Review case ambiguity and prepare administrative follow-through.', supervisor: 'Accept escalations and inspect case history.', knowledge_reviewer: 'Approve or reject submitted knowledge, publish immutable releases, assign them separately, and retire sources.' },
   };
  } finally { if (!client) c.release(); }
 }
 async find(c: PoolClient, s: Session, id?: string) {
  if (!id) throw new HttpError(400, 'Select an uploaded document.');
  const row = (await c.query('SELECT body,original FROM portfolio.studio_uploads WHERE workspace=$1 AND id=$2 AND expires_at>clock_timestamp()', [this.scope(s).workspace, id])).rows[0];
  if (!row) throw new HttpError(404, 'This upload is unavailable or has expired in this session.');
  return { upload: UploadRecord.parse(row.body), original: row.original as Buffer };
 }
 async original(s: Session, id: string) { const c = await this.sessions.db.pool.connect(); try { const r = await this.find(c, s, id); return { name: r.upload.parsed.name, bytes: r.original }; } finally { c.release(); } }
 async upload(session: Session, raw: unknown) {
  const input = validateUpload(raw);
  return this.sessions.exclusive(session, async (s, c) => {
   const scope = this.scope(s);
   const count = (await c.query('SELECT count(*)::int n FROM portfolio.studio_uploads WHERE workspace=$1 AND expires_at>clock_timestamp()', [scope.workspace])).rows[0].n;
   if (count >= 3) throw new HttpError(429, 'This demo holds at most three temporary uploads. Delete one before adding another.');
   if (s.actions >= 150) throw new HttpError(429, 'Session action budget reached.');
   const parsed = await parseUpload(input), id = 'studio.' + randomUUID(), now = new Date().toISOString();
   const upload = UploadRecord.parse({ id, revision: 1, parsed, metadata: proposedMetadata(parsed.name.replace(/\.[^.]+$/, '')), status: instructionContent(parsed.text) ? 'quarantined' : 'parsed', uploadedBy: 'viewer', reviewedAt: null, reviewHash: null, rejectionReason: null, releaseId: null, governedVersionId: null, createdAt: now, expiresAt: s.expires_at.toISOString() });
   await c.query('INSERT INTO portfolio.studio_uploads(workspace,id,original,body,expires_at) VALUES($1,$2,$3,$4,$5)', [scope.workspace, id, Buffer.from(input.base64, 'base64'), JSON.stringify(upload), s.expires_at]);
   await this.event(c, s, id, 'received_validated_parsed', { format: parsed.format, bytes: parsed.bytes, originalHash: parsed.originalHash, passages: parsed.passages.length, warnings: parsed.warnings });
   await c.query('UPDATE portfolio.sessions SET actions=actions+1 WHERE token_hash=$1', [s.token_hash]);
   return upload;
  });
 }
 async event(c: PoolClient, s: Session, uploadId: string, type: string, detail: unknown, id = 'studio-event.' + randomUUID()) {
  const body = { id, uploadId, type, actorRole: s.role, timestamp: new Date().toISOString(), detail };
  await c.query('INSERT INTO portfolio.studio_history(workspace,id,upload_id,body,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [s.workspace, id, uploadId, JSON.stringify(body), s.expires_at]); return body;
 }
 async currentClock(s: Session) { const state = (await new WorkflowRepository(this.db, this.scope(s)).read('avery', 'SC-01')).at(-1)!.snapshot; return new Date(Math.max(s.demo_clock.getTime(), Date.parse(state.updatedAt))).toISOString(); }
 async action(session: Session, raw: unknown) {
  const a = StudioAction.parse(raw);
  if (a.reason) validateSyntheticText(a.reason);
  if (a.metadata) validateSyntheticText(JSON.stringify(a.metadata));
  return this.sessions.exclusive(session, async (s, c) => {
   const scope = this.scope(s), key = 'studio.action.' + a.idempotencyKey, fingerprint = hash(a);
   const prior = (await c.query('SELECT fingerprint FROM portfolio.requests WHERE session_hash=$1 AND workspace=$2 AND key=$3', [s.token_hash, scope.workspace, key])).rows[0];
   if (prior) { if (prior.fingerprint !== fingerprint) throw new HttpError(409, 'That request ID belongs to another action.'); return this.view(s, c); }
   if (s.actions >= 150) throw new HttpError(429, 'Session action budget reached.');
   const consequential = ['approve', 'reject', 'publish', 'assign', 'retire', 'supersede', 'delete'].includes(a.action);
   if (consequential && !a.confirmed) throw new HttpError(400, 'Review and confirm the impact of this change.');
   if (['approve', 'reject', 'publish', 'assign', 'retire', 'supersede'].includes(a.action) && s.role !== 'knowledge_reviewer') throw new HttpError(403, 'The Knowledge Reviewer role is required for this governance action.');
   const repo = new GovernanceRepository(this.db, scope), now = await this.currentClock(s);
   if (a.action === 'assign') {
    if (!a.releaseId?.startsWith('KP-ALDER.UPLOAD.')) throw new HttpError(400, 'Select an immutable release published from this Studio.');
    await this.db.transaction(scope, async tx => {
     const r = await loadRegistry(tx, scope), release = r.corpus.releases.find(r => r.id === a.releaseId);
     if (!release || r.isRetired(release.id) || release.documentVersionIds.some(id => r.isRetired(id))) throw new HttpError(409, 'This release is unavailable or contains a retired source.');
     const original = r.corpus.assignments.find(x => x.id === 'AS-101')!, assignment = { ...original, id: 'AS-STUDIO.' + hash({ key, workspace: scope.workspace }).slice(0, 24), releaseIds: [release.id], mandatoryReleaseIds: [release.id] };
     const user = r.user('avery'); await insert(tx, scope, 'user_revisions', assignment.id + '.access', { ...user, releaseIds: [...new Set([...user.releaseIds, release.id])] }, 'publisher');
     await repo.assignInTransaction(tx, 'publisher', assignment, 'DEMO-101', now);
    });
   } else if (a.action === 'retire') {
    if (!a.versionId) throw new HttpError(400, 'Select a source version to retire.');
    await repo.retire('publisher', a.versionId, now, a.reason ?? 'Source authority withdrawn in the isolated synthetic demonstration.');
   } else if (a.action === 'supersede') {
    if (!a.versionId || !a.successorId) throw new HttpError(400, 'Select an older version and an approved successor in the same source family.');
    await repo.supersede('publisher', a.versionId, a.successorId, now);
   } else {
    const found = await this.find(c, s, a.uploadId); let u = found.upload;
    if (a.revision !== u.revision) throw new HttpError(409, 'This preview changed. Refresh and review the latest revision.');
    if (a.action === 'delete') {
     await c.query('DELETE FROM portfolio.studio_vectors WHERE workspace=$1 AND upload_id=$2',[scope.workspace,u.id]);
     await c.query('DELETE FROM portfolio.studio_uploads WHERE workspace=$1 AND id=$2', [scope.workspace, u.id]);
     await c.query('DELETE FROM portfolio.studio_results WHERE workspace=$1 AND body->>\'uploadId\'=$2', [scope.workspace, u.id]);
     await c.query('DELETE FROM portfolio.studio_history WHERE workspace=$1 AND upload_id=$2', [scope.workspace, u.id]);
    } else {
     if (u.status === 'published') throw new HttpError(409, 'This release is immutable. Upload a new source version to propose a change.');
     if (a.action === 'metadata' || a.action === 'reprocess') {
      await c.query('DELETE FROM portfolio.studio_vectors WHERE workspace=$1 AND upload_id=$2',[scope.workspace,u.id]);
      const parsed = a.action === 'reprocess' ? await parseUpload({ name: u.parsed.name, base64: found.original.toString('base64'), synthetic: true, chunkSize: a.chunkSize ?? 1000 }) : u.parsed;
      u = { ...u, revision: u.revision + 1, parsed, metadata: a.metadata ? Metadata.parse(a.metadata) : a.action === 'reprocess' ? { ...u.metadata, annotations: [] } : u.metadata, status: instructionContent(parsed.text) ? 'quarantined' : 'parsed', reviewedAt: null, reviewHash: null, rejectionReason: null };
     } else if (a.action === 'submit') {
      if (!['parsed', 'rejected'].includes(u.status)) throw new HttpError(409, 'Only a parsed draft may be submitted. Correct quarantined content in a new upload.');
      u = { ...u, status: 'submitted' };
     } else if (a.action === 'approve') {
      if (u.status !== 'submitted') throw new HttpError(409, 'The contributor must submit this document for review first.');
      const r = await repo.snapshot(), evaluation = evaluateUpload(u, r.corpus.cases.find(c => c.id === 'DEMO-101')!, now, r);
      if (!evaluation.pass) throw new HttpError(409, 'Approval blocked: ' + evaluation.checks.filter(c => !c.pass).map(c => c.name).join(', ') + '.');
      u = { ...u, status: 'approved', reviewedAt: now, reviewHash: reviewDigest(u) };
     } else if (a.action === 'reject') {
      if (u.status !== 'submitted') throw new HttpError(409, 'Only a submitted document can be rejected.');
      u = { ...u, status: 'rejected', rejectionReason: a.reason ?? 'Reviewer requested corrected metadata or source content.', reviewedAt: now, reviewHash: null };
     } else if (a.action === 'publish') {
      if (u.status !== 'approved' || u.reviewHash !== reviewDigest(u)) throw new HttpError(409, 'Publication requires approval of this exact metadata and passage revision.');
      const r = await repo.snapshot(), evaluation = evaluateUpload(u, r.corpus.cases.find(c => c.id === 'DEMO-101')!, now, r);
      if (!evaluation.pass) throw new HttpError(409, 'Current governance checks no longer permit publication.');
      const canonical = releaseForUpload(r, u, now), existing = r.corpus.releases.find(x => x.id === canonical.release.id);
      if (!existing) {
       await repo.ingest('publisher', canonical.document, [canonical.version], canonical.passages);
       await repo.publish('publisher', canonical.release);
      }
      await this.db.transaction(scope, async tx => { await insert(tx, scope, 'audit', 'studio.review.' + u.id + '.r' + u.revision, { id: 'studio.review.' + u.id + '.r' + u.revision, uploadId: u.id, metadata: u.metadata, reviewedAt: u.reviewedAt, approvedBy: 'publisher', reviewHash: u.reviewHash, originalHash: u.parsed.originalHash, evaluation, releaseId: canonical.release.id }, 'publisher'); });
      u = { ...u, status: 'published', releaseId: canonical.release.id, governedVersionId: canonical.version.id };
     }
     await c.query('UPDATE portfolio.studio_uploads SET revision=$3,body=$4 WHERE workspace=$1 AND id=$2', [scope.workspace, u.id, u.revision, JSON.stringify(u)]);
     await this.event(c, s, u.id, a.action, { revision: u.revision, reviewHash: u.reviewHash, status: u.status, releaseId: u.releaseId });
    }
   }
   await c.query('INSERT INTO portfolio.requests(session_hash,key,workspace,fingerprint) VALUES($1,$2,$3,$4)', [s.token_hash, key, scope.workspace, fingerprint]);
   await c.query('UPDATE portfolio.sessions SET actions=actions+1 WHERE token_hash=$1', [s.token_hash]);
   return this.view(s, c);
  });
 }
 async test(session: Session, raw: unknown) {
  const t = StudioTest.parse(raw); validateSyntheticText(t.question);
  if (t.mode === 'lexical' && !t.acknowledgeLexical) throw new HttpError(400, 'Explicitly acknowledge lexical exploration; it is not semantic retrieval.');
  return this.sessions.exclusive(session, async (s, c) => {
   const scope = this.scope(s), id = 'studio-test.' + hash({ workspace: scope.workspace, key: t.idempotencyKey }).slice(0, 40);
   const prior = (await c.query('SELECT body FROM portfolio.studio_results WHERE workspace=$1 AND id=$2 AND expires_at>clock_timestamp()', [scope.workspace, id])).rows[0];
   if (prior) { if (prior.body.requestHash !== hash(t)) throw new HttpError(409, 'Use a new test request ID.'); return prior.body; }
   if (s.actions >= 150) throw new HttpError(429, 'Session action budget reached.');
   const now = await this.currentClock(s), providers = configuredProviders(this.sessions, s.token_hash), start = performance.now(); let response;
   if (t.collection === 'governed') {
    response = await this.db.transaction(scope, async tx => {
     const registry = await loadRegistry(tx, scope), req = baseRequest({ ...caseSelection(registry, 'DEMO-101'), id, question: t.question });
     return new PersistentRetrieval(this.db, scope, () => now).runInTransaction(tx, 'avery', req, { mode: t.mode, cacheSource: this.cache, embeddingProvider: providers.embeddingProvider,
      ...(t.mode === 'lexical' ? { acknowledgment: { actorId: 'avery', policyId: null, timestamp: now, expiresAt: new Date(Date.parse(now) + 60000).toISOString(), reason: 'OFFLINE_EXPLICIT' as const, originalRunId: null, scope: 'single_request' as const, requestId: id } } : {}),
     });
    });
   } else {
    const { upload } = await this.find(c, s, t.uploadId), registry = temporaryRegistry(upload, now), collection = canonicalUpload(upload, false, now).collection;
    const req = sandboxRequest({ id, question: t.question, selectionId: collection.id, maxResults: 6, task: 'source_summary' });
    const retrieval = await new PersistentRetrieval(this.db, this.scope(s, 'sandbox'), () => now).exploreTemporary('viewer', req, registry, { mode: t.mode, acknowledgeLexical: t.acknowledgeLexical, embeddingProvider: providers.embeddingProvider,cacheSource:new TemporaryEmbeddingCache(c,scope.workspace,upload.id,upload.expiresAt) });
    const governed = await new GovernanceRepository(this.db, scope).snapshot();
    response = { ...retrieval, proposedReleaseChecks: evaluateUpload(upload, governed.corpus.cases.find(c => c.id === 'DEMO-101')!, now, governed), proposal: t.collection === 'proposed', authority: 'sandbox_exploration_only' };
   }
   const result = { id, requestHash: hash(t), uploadId: t.uploadId ?? null, collection: t.collection, question: t.question, mode: t.mode, timestamp: now, latencyMs: performance.now() - start, ...response };
   await c.query('INSERT INTO portfolio.studio_results(workspace,id,body,expires_at) VALUES($1,$2,$3,$4)', [scope.workspace, id, JSON.stringify(result), s.expires_at]);
   await c.query('UPDATE portfolio.sessions SET actions=actions+1 WHERE token_hash=$1', [s.token_hash]);
   return result;
  });
 }
}

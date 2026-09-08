import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { Database } from '../db/database.ts';
import type { Scope } from '../db/database.ts';
import { loadRegistry } from '../db/registry.ts';
import { PersistentRetrieval } from '../db/retrieval.ts';
import { timeline } from '../workflow/repository.ts';
import { baseRequest, sandboxRequest } from '../evaluation.ts';
import type { Registry } from '../registry.ts';
import { UploadRecord } from '../studio/contracts.ts';
import { canonicalUpload, temporaryRegistry } from '../studio/governance.ts';
import { TemporaryEmbeddingCache } from '../studio/cache.ts';
import type { Sessions, Session } from '../app/session.ts';
import { HttpError } from '../app/session.ts';
import { hash } from '../integrity.ts';
import type { EmbeddingCache, EmbeddingProvider } from '../providers/embedding.ts';
import type { SynthesisProvider } from './provider.ts';
import { AgentRequest, AgentResponse } from './contracts.ts';
import { clarificationFor, composeAgent, requiresCaseRetrieval } from './compose.ts';
import { validateSyntheticText } from './safety.ts';
import { configuredProviders, providerConfiguration } from './runtime.ts';
import { ConversationRequest, interpretMessage } from './intent.ts';
import { AgentSettings, KnowledgeSelection, DEMO_NOTICE, fixedPolicy, acknowledgeNotice, governedSelection, packChoices, readablePackName, readPreferences, synthesisMode } from './preferences.ts';
import { SYNTHESIS_PROMPT } from './provider.ts';

export class AgentService {
 readonly db: Database; readonly sessions: Sessions; readonly cache: EmbeddingCache;
 readonly testProviders?: { provider?: SynthesisProvider; embeddingProvider?: EmbeddingProvider };
 constructor(db: Database, sessions: Sessions, cache: EmbeddingCache,
  testProviders?: { provider?: SynthesisProvider; embeddingProvider?: EmbeddingProvider }) { this.db = db; this.sessions = sessions; this.cache = cache; this.testProviders = testProviders; }
 scope(s: Session): Scope { if (!s.workspace) throw new HttpError(409, 'Launch a synthetic case first.'); return { workspace: s.workspace, tenant: 'T-DEMO', environment: 'governed' }; }
 async history(c: PoolClient, workspace: string, conversationId?: string) {
  const rows = (await c.query(`SELECT body,body_hash FROM (SELECT body,body_hash,created_at,id,conversation_id FROM portfolio.agent_entries WHERE workspace=$1 UNION ALL SELECT body,body_hash,created_at,id,conversation_id FROM portfolio.temporary_agent_entries WHERE workspace=$1 AND expires_at>clock_timestamp()) entries WHERE ($2::text IS NULL OR conversation_id=$2) ORDER BY created_at,id`, [workspace, conversationId ?? null])).rows;
  return rows.map(row => { const parsed = AgentResponse.parse(row.body); if (hash(parsed) !== row.body_hash) throw new Error('CONVERSATION_INTEGRITY_FAILURE'); return parsed; });
 }
 async view(s: Session, client?: PoolClient, registry?: Registry, clock?: string) {
  const scope = this.scope(s), c = client ?? await this.sessions.db.pool.connect();
  try {
   const conversations = (await c.query('SELECT id,case_id,created_at,archived_at FROM portfolio.conversations WHERE workspace=$1 ORDER BY created_at', [scope.workspace])).rows;
   const entries = await this.history(c, scope.workspace);
   const active = conversations.find(x => !x.archived_at)?.id ?? null;
   const preferences = await readPreferences(c, scope.workspace);
   const r = registry ?? await this.db.transaction(scope, tx => loadRegistry(tx, scope));
   const now = clock ?? s.demo_clock.toISOString();
   const knowledge = await this.describeKnowledge(c, s, r, preferences.selection);
   const acknowledged = (await c.query('SELECT notice_acknowledged_at FROM portfolio.sessions WHERE token_hash=$1', [s.token_hash])).rows[0]?.notice_acknowledged_at ?? null;
   return { conversations, activeConversationId: active, entries, preferences, knowledge, packs: packChoices(r, now),
    notice: { text: DEMO_NOTICE, acknowledgedAt: acknowledged }, policy: { ...fixedPolicy, promptVersion: SYNTHESIS_PROMPT },
    memoryPolicy: 'Conversation is unverified context. Canonical case facts, human decisions and effects come only from the durable workflow and governed evidence. Starting a new conversation preserves operational history.',
    provider: { enabled: providerConfiguration().enabled, model: providerConfiguration().enabled ? 'gpt-4.1-mini-2025-04-14' : null, semanticModel: 'text-embedding-3-small', defaultRetrieval: 'hybrid', fallback: 'none', integration: 'synthetic_channels_only' },
   };
  } finally { if (!client) c.release(); }
 }
 async findUpload(c: PoolClient, s: Session, id: string) {
  const row = (await c.query('SELECT body FROM portfolio.studio_uploads WHERE workspace=$1 AND id=$2 AND expires_at>clock_timestamp()', [s.workspace, id])).rows[0];
  if (!row) throw new HttpError(404, 'This temporary document has expired or was deleted. Choose knowledge to continue.');
  return UploadRecord.parse(row.body);
 }
 async describeKnowledge(c: PoolClient, s: Session, registry: Registry, selection: KnowledgeSelection): Promise<AgentResponse['knowledge'] | null> {
  if (selection.kind === 'upload') {
   let upload;
   try { upload = await this.findUpload(c, s, selection.uploadId); } catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
   const canonical = canonicalUpload(upload, false, s.demo_clock.toISOString());
   return { key: upload.id, kind: 'upload', name: upload.metadata.sourceName, sourceCount: 1, authority: 'sandbox_only', expiresAt: upload.expiresAt, sourceNames: { [canonical.document.id]: upload.metadata.sourceName } };
  }
  const selected = governedSelection(registry, selection, s.demo_clock.toISOString());
  const release = registry.corpus.releases.find(r => r.id === (selection.kind === 'pack' ? selection.releaseId : selected.releaseIds[0]));
  const ids = [...new Set([...registry.corpus.releases.filter(r => selected.releaseIds.includes(r.id)).flatMap(r => r.documentVersionIds), ...registry.corpus.cases.find(c => c.id === 'DEMO-101')!.evidenceVersionIds])];
  return { key: selection.kind === 'pack' ? selection.releaseId : 'sample', kind: selection.kind,
   name: readablePackName(registry.corpus.packs.find(p => p.id === release?.packId)), sourceCount: ids.length,
   authority: 'assigned_case_knowledge', expiresAt: null, sourceNames: Object.fromEntries(registry.corpus.documents.map(d => [d.id, d.title])) };
 }
 async configure(session: Session, raw: unknown) {
  const change = z.discriminatedUnion('action', [
   z.strictObject({ action: z.literal('acknowledge_notice') }),
   z.strictObject({ action: z.literal('select'), selection: KnowledgeSelection }),
   z.strictObject({ action: z.literal('settings'), settings: AgentSettings, revision: z.number().int().nonnegative() }),
  ]).parse(raw);
  return this.sessions.exclusive(session, async (s, c) => {
   const scope = this.scope(s);
   if (change.action === 'acknowledge_notice') { await acknowledgeNotice(c, s); return { acknowledged: true }; }
   const current = await readPreferences(c, scope.workspace);
   if (change.action === 'settings') {
    if (s.role !== 'supervisor') throw new HttpError(403, 'The Supervisor demo role approves Agent Settings.');
    if (change.revision !== current.revision) throw new HttpError(409, 'Settings changed. Refresh before approving new defaults.');
    await c.query(`INSERT INTO portfolio.agent_preferences(workspace,settings,approved_by) VALUES($1,$2,$3) ON CONFLICT(workspace) DO UPDATE SET settings=$2,approved_by=$3,revision=portfolio.agent_preferences.revision+1,updated_at=clock_timestamp()`, [scope.workspace, JSON.stringify(change.settings), s.role]);
   } else {
    if (change.selection.kind === 'upload') {
     const upload = await this.findUpload(c, s, change.selection.uploadId);
     if (upload.status === 'quarantined') throw new HttpError(409, 'This document is quarantined. Inspect its safety status in Knowledge Studio.');
    } else if (change.selection.kind === 'pack') {
     await this.db.bindScope(c, scope);
     const registry = await loadRegistry(c, scope), now = new Date(Math.max(s.demo_clock.getTime(), Date.parse((await timeline(c, scope, 'SC-01')).at(-1)!.snapshot.updatedAt))).toISOString();
     const releaseId = change.selection.releaseId;
     if (!packChoices(registry, now).some(p => p.id === releaseId && p.available)) throw new HttpError(409, 'This pack is not currently permitted for this case. Publication, access and assignment remain separate governance actions.');
    }
    await c.query(`INSERT INTO portfolio.agent_preferences(workspace,selection) VALUES($1,$2) ON CONFLICT(workspace) DO UPDATE SET selection=$2,revision=portfolio.agent_preferences.revision+1,updated_at=clock_timestamp()`, [scope.workspace, JSON.stringify(change.selection)]);
   }
   return readPreferences(c, scope.workspace);
  });
 }
 async respond(session: Session, raw: unknown, conversational = false) {
  const message = conversational ? ConversationRequest.parse(raw) : null;
  const original = message ? AgentRequest.parse({ ...message, synthetic: true }) : AgentRequest.parse(raw);
  let request = original;
  if (['ask', 'interaction', 'edit_draft'].includes(request.operation) && !request.text) throw new HttpError(400, 'Enter synthetic administrative text.');
  if (request.operation !== 'edit_draft' && (request.text?.length ?? 0) > 2000) throw new HttpError(400, 'Keep questions and synthetic interactions within 2,000 characters.');
  if (request.text) validateSyntheticText(request.text);
  return this.sessions.exclusive(session, async (s, c) => {
   const scope = this.scope(s), id = 'agent.' + hash({ workspace: scope.workspace, key: request.idempotencyKey }).slice(0, 48), fingerprint = conversational ? hash({ conversational, message }) : hash(original);
   const existing = (await c.query(`SELECT body,body_hash,fingerprint FROM portfolio.agent_entries WHERE workspace=$1 AND id=$2 UNION ALL SELECT body,body_hash,fingerprint FROM portfolio.temporary_agent_entries WHERE workspace=$1 AND id=$2 AND expires_at>clock_timestamp()`, [scope.workspace, id])).rows[0];
   if (existing) { if (existing.fingerprint !== fingerprint) throw new HttpError(409, 'This request ID belongs to a different message.'); const body = AgentResponse.parse(existing.body); if (hash(body) !== existing.body_hash) throw new Error('CONVERSATION_INTEGRITY_FAILURE'); return body; }
   if (s.actions >= 150) throw new HttpError(429, 'Session action budget reached.');
   let conversation = (await c.query('SELECT id FROM portfolio.conversations WHERE workspace=$1 AND archived_at IS NULL', [scope.workspace])).rows[0]?.id as string | undefined;
   if (request.operation === 'new_conversation' && conversation) { await c.query('UPDATE portfolio.conversations SET archived_at=clock_timestamp() WHERE workspace=$1 AND id=$2', [scope.workspace, conversation]); conversation = undefined; }
   if (!conversation) { conversation = 'conversation.' + randomUUID(); await c.query("INSERT INTO portfolio.conversations(workspace,id,case_id) VALUES($1,$2,'DEMO-101')", [scope.workspace, conversation]); }
   const allHistory = await this.history(c, scope.workspace);
   const preferences = await readPreferences(c, scope.workspace);
   const selectionKey = preferences.selection.kind === 'upload' ? preferences.selection.uploadId : preferences.selection.kind === 'pack' ? preferences.selection.releaseId : 'sample';
   const history = allHistory.filter(h => h.conversationId === conversation && (h.knowledge?.key ?? 'sample') === selectionKey);
   const interpreted = message ? interpretMessage(message, history, preferences.settings, synthesisMode(preferences.settings)) : null;
   if (interpreted) request = interpreted.request;
   if (message?.targetId && !history.some(h => h.id === message.targetId && h.workProduct)) throw new HttpError(404, 'That work product is not available in this conversation and knowledge context.');
   const productRestricted = ['draft', 'summary'].includes(request.operation) && (!preferences.settings.audiences.includes(request.audience) || !preferences.settings.channels.includes(request.channel) || (request.operation === 'draft' && !preferences.settings.drafting));
   if (productRestricted) throw new HttpError(403, 'These drafting choices are disabled in Agent Settings. A Supervisor can review the approved defaults.');
   const earlierInteraction = allHistory.filter(h => h.operation === 'interaction' && h.conversationId !== conversation && (h.knowledge?.key ?? 'sample') === selectionKey).at(-1);
   const contextHistory = earlierInteraction ? [earlierInteraction, ...history] : history;
   if (allHistory.filter(h => h.conversationId === conversation).length >= 60) throw new HttpError(429, 'This conversation has reached 60 entries. Start a new conversation; case history will remain.');
   const clarificationSource = request.operation === 'clarify' ? history.find(h => h.id === request.targetId && h.clarification?.status === 'open') : undefined;
   if (request.operation === 'clarify' && (!clarificationSource || history.some(h => h.clarification?.status === 'resolved' && h.inReplyTo === request.targetId))) throw new HttpError(409, 'Choose an open clarification in this conversation.');
   if (['edit_draft','save_memory','prepare_review'].includes(request.operation) && !history.some(h => h.id === request.targetId && h.workProduct)) throw new HttpError(404, 'That draft is not available in this conversation.');
   // Evidence, the current workflow revision and the response commit atomically.
   await this.db.bindScope(c, scope);
   const snapshot = (await timeline(c, scope, 'SC-01')).at(-1)!.snapshot;
   const now = new Date(Math.max(s.demo_clock.getTime(), Date.parse(snapshot.updatedAt))).toISOString();
   const providers = this.testProviders ?? configuredProviders(this.sessions, s.token_hash);
   // A clarification is safe to ask without knowledge. Its resolution always rechecks knowledge.
   const needsEvidence = requiresCaseRetrieval(request) && !(request.operation === 'ask' && !interpreted?.interpretation.follows && clarificationFor(request.text ?? ''));
   const registry = await loadRegistry(c, scope);
   const selectedKnowledge = await this.describeKnowledge(c, s, registry, preferences.selection);
   const upload = preferences.selection.kind === 'upload' ? await this.findUpload(c, s, preferences.selection.uploadId) : null;
   const result = await (async () => {
    const tx = c;
    let evidence = null;
    if (needsEvidence && upload) {
     const temporary = temporaryRegistry(upload, now), collection = canonicalUpload(upload, false, now).collection;
     const question = interpreted?.interpretation.retrievalQuestion && interpreted.interpretation.retrievalQuestion !== 'case_status' ? interpreted.interpretation.retrievalQuestion : request.text ?? 'Summarize this document.';
     const req = sandboxRequest({ id: id + '.retrieval', selectionId: collection.id, question, maxResults: 6 });
     evidence = (await new PersistentRetrieval(this.db, { ...scope, environment: 'sandbox' }, () => now).exploreTemporary('viewer', req, temporary, { mode: 'hybrid', embeddingProvider: providers.embeddingProvider, cacheSource: new TemporaryEmbeddingCache(c, scope.workspace, upload.id, upload.expiresAt) })).record;
    } else if (needsEvidence) {
     // Work products and conversational status refer to the complete current documentation
     // dependency. Free-form source questions retain their exact query for hybrid retrieval.
     const isStatus = request.operation !== 'ask' || /\b(?:what(?:'s| is)? next|next (?:step|action)|status|summary|summarize|owner|checkpoint|what happened|who (?:is|owns)|remember)\b/i.test(request.text ?? '');
     const followupQuery = interpreted?.interpretation.retrievalQuestion;
     const question = isStatus || followupQuery === 'case_status' || interpreted?.interpretation.intent === 'next_action' || interpreted?.interpretation.follows ? baseRequest().question : request.text!;
     const req = baseRequest({ ...governedSelection(registry, preferences.selection, now), id: id + '.retrieval', question });
     evidence = (await new PersistentRetrieval(this.db, scope, () => now).runInTransaction(tx, 'avery', req, { cacheSource: this.cache, embeddingProvider: providers.embeddingProvider })).record;
    }
    return composeAgent({ request, id, conversationId: conversation!, timestamp: now, snapshot, evidence, history: contextHistory, provider: providers.provider, clarificationSource, interpretation: interpreted?.interpretation, knowledge: selectedKnowledge ?? undefined });
   })();
   if (upload) await c.query('INSERT INTO portfolio.temporary_agent_entries(workspace,id,conversation_id,upload_id,fingerprint,body,body_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [scope.workspace, id, conversation, upload.id, fingerprint, JSON.stringify(result), hash(result), upload.expiresAt]);
   else await c.query('INSERT INTO portfolio.agent_entries(workspace,id,conversation_id,fingerprint,body,body_hash) VALUES($1,$2,$3,$4,$5,$6)', [scope.workspace, id, conversation, fingerprint, JSON.stringify(result), hash(result)]);
   await c.query('UPDATE portfolio.sessions SET actions=actions+1 WHERE token_hash=$1', [s.token_hash]);
   return result;
  });
 }
}

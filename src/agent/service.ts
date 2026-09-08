import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { Database } from '../db/database.ts';
import type { Scope } from '../db/database.ts';
import { loadRegistry, caseSelection } from '../db/registry.ts';
import { PersistentRetrieval } from '../db/retrieval.ts';
import { timeline } from '../workflow/repository.ts';
import { baseRequest } from '../evaluation.ts';
import type { Sessions, Session } from '../app/session.ts';
import { HttpError } from '../app/session.ts';
import { hash } from '../integrity.ts';
import type { EmbeddingCache, EmbeddingProvider } from '../providers/embedding.ts';
import type { SynthesisProvider } from './provider.ts';
import { AgentRequest, AgentResponse } from './contracts.ts';
import { clarificationFor, composeAgent, requiresCaseRetrieval } from './compose.ts';
import { validateSyntheticText } from './safety.ts';
import { configuredProviders, providerConfiguration } from './runtime.ts';

export class AgentService {
 readonly db: Database; readonly sessions: Sessions; readonly cache: EmbeddingCache;
 readonly testProviders?: { provider?: SynthesisProvider; embeddingProvider?: EmbeddingProvider };
 constructor(db: Database, sessions: Sessions, cache: EmbeddingCache,
  testProviders?: { provider?: SynthesisProvider; embeddingProvider?: EmbeddingProvider }) { this.db = db; this.sessions = sessions; this.cache = cache; this.testProviders = testProviders; }
 scope(s: Session): Scope { if (!s.workspace) throw new HttpError(409, 'Launch a synthetic case first.'); return { workspace: s.workspace, tenant: 'T-DEMO', environment: 'governed' }; }
 async history(c: PoolClient, workspace: string, conversationId?: string) {
  const rows = (await c.query('SELECT body,body_hash FROM portfolio.agent_entries WHERE workspace=$1 AND ($2::text IS NULL OR conversation_id=$2) ORDER BY created_at,id', [workspace, conversationId ?? null])).rows;
  return rows.map(row => { const parsed = AgentResponse.parse(row.body); if (hash(parsed) !== row.body_hash) throw new Error('CONVERSATION_INTEGRITY_FAILURE'); return parsed; });
 }
 async view(s: Session, client?: PoolClient) {
  const scope = this.scope(s), c = client ?? await this.sessions.db.pool.connect();
  try {
   const conversations = (await c.query('SELECT id,case_id,created_at,archived_at FROM portfolio.conversations WHERE workspace=$1 ORDER BY created_at', [scope.workspace])).rows;
   const entries = await this.history(c, scope.workspace);
   const active = conversations.find(x => !x.archived_at)?.id ?? null;
   return { conversations, activeConversationId: active, entries,
    memoryPolicy: 'Conversation is unverified context. Canonical case facts, human decisions and effects come only from the durable workflow and governed evidence. Starting a new conversation preserves operational history.',
    provider: { enabled: providerConfiguration().enabled, model: providerConfiguration().enabled ? 'gpt-4.1-mini-2025-04-14' : null, semanticModel: 'text-embedding-3-small', defaultRetrieval: 'hybrid', fallback: 'none', integration: 'synthetic_channels_only' },
   };
  } finally { if (!client) c.release(); }
 }
 async respond(session: Session, raw: unknown) {
  const request = AgentRequest.parse(raw);
  if (['ask', 'interaction', 'edit_draft'].includes(request.operation) && !request.text) throw new HttpError(400, 'Enter synthetic administrative text.');
  if (request.operation !== 'edit_draft' && (request.text?.length ?? 0) > 2000) throw new HttpError(400, 'Keep questions and synthetic interactions within 2,000 characters.');
  if (request.text) validateSyntheticText(request.text);
  return this.sessions.exclusive(session, async (s, c) => {
   const scope = this.scope(s), id = 'agent.' + hash({ workspace: scope.workspace, key: request.idempotencyKey }).slice(0, 48), fingerprint = hash(request);
   const existing = (await c.query('SELECT body,body_hash,fingerprint FROM portfolio.agent_entries WHERE workspace=$1 AND id=$2', [scope.workspace, id])).rows[0];
   if (existing) { if (existing.fingerprint !== fingerprint) throw new HttpError(409, 'This request ID belongs to a different message.'); const body = AgentResponse.parse(existing.body); if (hash(body) !== existing.body_hash) throw new Error('CONVERSATION_INTEGRITY_FAILURE'); return body; }
   if (s.actions >= 150) throw new HttpError(429, 'Session action budget reached.');
   let conversation = (await c.query('SELECT id FROM portfolio.conversations WHERE workspace=$1 AND archived_at IS NULL', [scope.workspace])).rows[0]?.id as string | undefined;
   if (request.operation === 'new_conversation' && conversation) { await c.query('UPDATE portfolio.conversations SET archived_at=clock_timestamp() WHERE workspace=$1 AND id=$2', [scope.workspace, conversation]); conversation = undefined; }
   if (!conversation) { conversation = 'conversation.' + randomUUID(); await c.query("INSERT INTO portfolio.conversations(workspace,id,case_id) VALUES($1,$2,'DEMO-101')", [scope.workspace, conversation]); }
   const allHistory = await this.history(c, scope.workspace);
   const history = allHistory.filter(h => h.conversationId === conversation);
   const earlierInteraction = allHistory.filter(h => h.operation === 'interaction' && h.conversationId !== conversation).at(-1);
   const contextHistory = earlierInteraction ? [earlierInteraction, ...history] : history;
   if (history.length >= 60) throw new HttpError(429, 'This conversation has reached 60 entries. Start a new conversation; case history will remain.');
   const clarificationSource = request.operation === 'clarify' ? history.find(h => h.id === request.targetId && h.clarification?.status === 'open') : undefined;
   if (request.operation === 'clarify' && (!clarificationSource || history.some(h => h.clarification?.status === 'resolved' && h.inReplyTo === request.targetId))) throw new HttpError(409, 'Choose an open clarification in this conversation.');
   if (request.operation === 'edit_draft' && !history.some(h => h.id === request.targetId && h.workProduct)) throw new HttpError(404, 'That draft is not available in this conversation.');
   // Evidence, the current workflow revision and the response commit atomically.
   await this.db.bindScope(c, scope);
   const snapshot = (await timeline(c, scope, 'SC-01')).at(-1)!.snapshot;
   const now = new Date(Math.max(s.demo_clock.getTime(), Date.parse(snapshot.updatedAt))).toISOString();
   const providers = this.testProviders ?? configuredProviders(this.sessions, s.token_hash);
   // A clarification is safe to ask without knowledge. Its resolution always rechecks knowledge.
   const needsEvidence = requiresCaseRetrieval(request) && !(request.operation === 'ask' && clarificationFor(request.text ?? ''));
   const result = await (async () => {
    const tx = c;
    let evidence = null;
    if (needsEvidence) {
     const registry = await loadRegistry(tx, scope);
     // Work products and conversational status refer to the complete current documentation
     // dependency. Free-form source questions retain their exact query for hybrid retrieval.
     const isStatus = request.operation !== 'ask' || /\b(?:what(?:'s| is)? next|next (?:step|action)|status|summary|summarize|owner|checkpoint|what happened|who (?:is|owns)|remember)\b/i.test(request.text ?? '');
     const question = isStatus ? baseRequest().question : request.text!;
     const req = baseRequest({ ...caseSelection(registry, 'DEMO-101'), id: id + '.retrieval', question });
     evidence = (await new PersistentRetrieval(this.db, scope, () => now).runInTransaction(tx, 'avery', req, { cacheSource: this.cache, embeddingProvider: providers.embeddingProvider })).record;
    }
    return composeAgent({ request, id, conversationId: conversation!, timestamp: now, snapshot, evidence, history: contextHistory, provider: providers.provider, clarificationSource });
   })();
   await c.query('INSERT INTO portfolio.agent_entries(workspace,id,conversation_id,fingerprint,body,body_hash) VALUES($1,$2,$3,$4,$5,$6)', [scope.workspace, id, conversation, fingerprint, JSON.stringify(result), hash(result)]);
   await c.query('UPDATE portfolio.sessions SET actions=actions+1 WHERE token_hash=$1', [s.token_hash]);
   return result;
  });
 }
}

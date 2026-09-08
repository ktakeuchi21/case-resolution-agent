import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApplicationServer } from '../../src/app/server.ts';
import { digest } from '../../src/app/session.ts';
import { hash } from '../../src/integrity.ts';
import { reserveProviderRequest } from '../../src/agent/runtime.ts';
import { AgentService } from '../../src/agent/service.ts';

test('persistent agent API: conversation, clarification, products, refresh, isolation and retirement', async () => {
 const service = createApplicationServer(); await new Promise<void>(r => service.server.listen(0, '127.0.0.1', r));
 const address = service.server.address(); assert(address && typeof address !== 'string'); const origin = `http://127.0.0.1:${address.port}`;
 const visitors = [0, 1].map(() => ({ token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') }));
 const req = async (path: string, input?: unknown, visitor = 0, expected = 200) => {
  const v = visitors[visitor]!;
  const r = await fetch(origin + '/api/' + path, { method: input ? 'POST' : 'GET', headers: { cookie: 'pathway_session=' + v.token, 'x-csrf-token': v.csrf, origin, 'content-type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) });
  const body = await r.json(); assert.equal(r.status, expected, JSON.stringify(body)); return body;
 };
 const send = (input: object, visitor = 0) => req('agent', { synthetic: true, idempotencyKey: randomUUID(), ...input }, visitor);
 try {
  for (const v of visitors) await service.sessionDb.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '4 hours')", [digest(v.token), v.csrf]);
  const first = await req('demo', {}, 0, 201); await req('demo', {}, 1, 201);
  const before = hash(first.workflow);
  const question = 'What is the next step for this case?';
  const key = randomUUID(); const a = await send({ text: question, idempotencyKey: key });
  assert.equal(a.disposition, 'answer'); assert.equal(a.citations.length, 3);
  const repeated = await send({ text: question, idempotencyKey: key }); assert.deepEqual(repeated, a);
  await req('agent', { synthetic: true, text: 'Different text', idempotencyKey: key }, 0, 409);
  const interaction = await send({ operation: 'interaction', channel: 'voice', text: 'Still waiting. Please provide an update today.' });
  assert.equal(interaction.analysis.sentiment, 'frustrated');
  const summary = await send({ operation: 'summary', audience: 'crm' }); assert(summary.workProduct.body.includes('Still waiting')); assert.equal(summary.context.state, 'RECEIVED');
  const ambiguous = await send({ text: 'Is it ready?' }); assert.equal(ambiguous.disposition, 'clarify');
  const resolution = await send({ operation: 'clarify', targetId: ambiguous.id, choice: 'workflow_status' }); assert.equal(resolution.clarification.status, 'resolved'); assert(resolution.evidenceId);
  const draft = await send({ operation: 'draft', channel: 'sms', audience: 'office' }); assert.equal(draft.workProduct.status, 'generated_not_sent');
  const edit = await send({ operation: 'edit_draft', targetId: draft.id, text: 'Synthetic revised message: please check the case workspace.' }); assert.equal(edit.workProduct.basedOn, draft.id);
  await req('agent', { synthetic: true, idempotencyKey: randomUUID(), operation: 'edit_draft', targetId: draft.id, text: 'Another session' }, 1, 404);
  await req('agent', { text: 'No attestation', idempotencyKey: randomUUID() }, 0, 400);
  await req('agent', { synthetic: true, text: 'MRN: 123456', idempotencyKey: randomUUID() }, 0, 422);
  const fresh = await req('state'); assert.equal(hash(fresh.workflow), before); assert.equal(fresh.agent.entries.length, 7);
  assert.equal((await req('state', undefined, 1)).agent.entries.length, 0);
  // Reconstruct the application service as after a process restart.
  const storedSession = (await service.sessionDb.pool.query('SELECT * FROM portfolio.sessions WHERE token_hash=$1', [digest(visitors[0]!.token)])).rows[0];
  const reconstructed = new AgentService(service.db, service.sessions, service.app.cache);
  assert.deepEqual((await reconstructed.view(storedSession)).entries, fresh.agent.entries);
  const uncached = await send({ text: 'How does the synthetic record describe the paperwork sequence in different words?' }); assert.equal(uncached.disposition, 'pause'); assert(uncached.reasonCodes.includes('PROVIDER_UNAVAILABLE')); assert.equal(uncached.audit.requests, 0);
  const model = await send({ operation: 'summary', generation: 'model' }); assert.equal(model.disposition, 'pause'); assert(model.reasonCodes.includes('PROVIDER_NOT_CONFIGURED'));
  const reserveDay='test.'+randomUUID(),budgetSession='test.'+randomUUID();
  const reservations=await Promise.allSettled(Array.from({length:6},()=>reserveProviderRequest(service.sessions,budgetSession,{daily:3,perSession:2},reserveDay)));
  assert.equal(reservations.filter(r=>r.status==='fulfilled').length,2);
  const counters=(await service.sessionDb.pool.query('SELECT requests FROM portfolio.provider_budget WHERE bucket=$1',['daily.'+reserveDay])).rows[0];assert.equal(counters.requests,2);
  await assert.rejects(reserveProviderRequest(service.sessions,budgetSession,{daily:3,perSession:2},reserveDay),/PROVIDER_BUDGET_EXHAUSTED/);
  // Force a failure after composition but before commit. Both the new evidence
  // and conversational response must roll back; the same request can be retried.
  const snapshotBefore=await req('state'), exclusive=service.sessions.exclusive.bind(service.sessions),retryKey=randomUUID();
  service.sessions.exclusive=async (session,fn)=>exclusive(session,async(s,c)=>{await fn(s,c);throw new Error('TEST_INTERRUPTED_COMMIT');});
  await req('agent',{synthetic:true,idempotencyKey:retryKey,text:question},0,503);
  service.sessions.exclusive=exclusive;
  const afterFailure=await req('state');assert.equal(afterFailure.evidence.length,snapshotBefore.evidence.length);assert.equal(afterFailure.agent.entries.length,snapshotBefore.agent.entries.length);
  const retried=await send({text:question,idempotencyKey:retryKey});assert.equal(retried.disposition,'answer');
  const exactEvidence=await req('evidence?id='+a.evidenceId);assert.equal(exactEvidence.recordHash,a.evidenceHash);await req('evidence?id='+a.evidenceId,undefined,1,404);
  const historyHash = hash(a);
  await req('action', { action: 'role', role: 'knowledge_reviewer', idempotencyKey: randomUUID() }); await req('action', { action: 'retire', idempotencyKey: randomUUID() });
  const retired = await send({ operation: 'summary' }); assert.equal(retired.disposition, 'pause'); assert.equal(retired.workProduct, null);assert.deepEqual(await req('evidence?id='+a.evidenceId),exactEvidence);
  const newConversation = await send({ operation: 'new_conversation' }); assert.notEqual(newConversation.conversationId, a.conversationId);
  const final = await req('state'); assert.equal(final.agent.conversations.length, 2); assert.match(newConversation.context.latestCommunication,/Still waiting/); assert.equal(hash(final.agent.entries.find((e: { id: string }) => e.id === a.id)), historyHash); assert.equal(hash(final.workflow), before);
  await assert.rejects(service.sessionDb.pool.query('UPDATE portfolio.agent_entries SET body=body WHERE id=$1', [a.id]), /permission denied|IMMUTABLE_RECORD/);
 } finally { await service.close(); }
});

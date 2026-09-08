import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApplicationServer } from '../../src/app/server.ts';
import { digest } from '../../src/app/session.ts';
import { uploadFixtures } from '../../src/app/service.ts';
import { baseRequest } from '../../src/evaluation.ts';
import { PersistentRetrieval } from '../../src/db/retrieval.ts';
import { GenerationResult } from '../../src/generation/index.ts';
import type { EvidenceRecord } from '../../src/contracts.ts';

type View = Awaited<ReturnType<ReturnType<typeof createApplicationServer>['app']['view']>>;
type Chat = Awaited<ReturnType<ReturnType<typeof createApplicationServer>['app']['chat']>>;
const service = createApplicationServer();
const visitors = [0, 1].map(() => ({ token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') }));
let origin: string;
let first: View;
let second: View;
let initialAnswer: Chat;
const requestKey = () => 'security.' + randomUUID();

async function request<T = Record<string, unknown>>(path: string, options: {
 visitor?: number | null; method?: string; input?: unknown; headers?: Record<string, string>; raw?: string;
} = {}) {
 const visitor = options.visitor === null ? undefined : visitors[options.visitor ?? 0];
 const response = await fetch(origin + path, {
  method: options.method ?? (options.input === undefined && options.raw === undefined ? 'GET' : 'POST'),
  headers: { ...(visitor ? { Cookie: 'pathway_session=' + visitor.token, 'X-CSRF-Token': visitor.csrf } : {}),
   ...(options.input !== undefined || options.raw !== undefined ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...options.headers },
  ...(options.input !== undefined || options.raw !== undefined ? { body: options.raw ?? JSON.stringify(options.input) } : {}),
 });
 const text = await response.text();
 return { status: response.status, headers: response.headers, text, body: JSON.parse(text) as T };
}

before(async () => {
 // Directly insert test capabilities to avoid consuming shared public session/IP creation budgets.
 // These fixtures exercise the real HTTP session lookup, CSRF verification and application operations.
 for (const visitor of visitors) await service.sessionDb.pool.query(
  "INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')",
  [digest(visitor.token), visitor.csrf]);
 await new Promise<void>(resolve => service.server.listen(0, '127.0.0.1', resolve));
 origin = `http://127.0.0.1:${(service.server.address() as AddressInfo).port}`;
 const a = await request<View>('/api/demo', { input: { scenario: 'golden' } });
 const b = await request<View>('/api/demo', { visitor: 1, input: { scenario: 'retirement' } });
 assert.equal(a.status, 201); assert.equal(b.status, 201); first = a.body; second = b.body;
});

after(async () => {
 // Delete only the two test session capabilities and their ephemeral request/rate rows.
 // Canonical histories and reserved workspaces remain retained for audit, as in application policy.
 for (const visitor of visitors) {
  const key = digest(visitor.token);
  await service.sessionDb.pool.query('DELETE FROM portfolio.sessions WHERE token_hash=$1', [key]);
  await service.sessionDb.pool.query('DELETE FROM portfolio.limits WHERE key=ANY($1::text[])', [['read.' + key, 'write.' + key, 'attempts.' + key]]);
 }
 await service.close();
});

test('anonymous and forged cookie access fail; session view never exposes bearer or internal session row', async () => {
 assert.equal((await request('/api/state', { visitor: null })).status, 401);
 assert.equal((await request('/api/state', { headers: { Cookie: 'pathway_session=' + '0'.repeat(64) } })).status, 401);
 const response = await request('/api/session');
 assert.equal(response.status, 200);
 for (const value of [visitors[0]!.token, digest(visitors[0]!.token), 'token_hash', 'PATHWAY_DATABASE_URL']) assert.ok(!response.text.includes(value));
 assert.equal(response.headers.get('cache-control'), 'no-store');
 assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
 assert.match(response.headers.get('content-security-policy')!, /script-src 'self'/);
 assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
 assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('a repeated launch preserves the existing workspace, scenario and reset budget', async () => {
 const row = async () => (await service.sessionDb.pool.query('SELECT workspace,scenario,reset_count FROM portfolio.sessions WHERE token_hash=$1', [digest(visitors[0]!.token)])).rows[0];
 const original = await row();
 const duplicate = await request<View>('/api/demo', { input: { scenario: 'golden' } });
 assert.equal(duplicate.status, 201); assert.deepEqual(duplicate.body.timeline, first.timeline);
 assert.deepEqual(await row(), original);
 const alternate = await request<View>('/api/demo', { input: { scenario: 'exception' } });
 assert.equal(alternate.status, 201); assert.deepEqual(await row(), original);
});

test('mutations reject missing/wrong CSRF, cross-origin and cross-site requests before state changes', async () => {
 const input = { action: 'assess', idempotencyKey: requestKey() };
 for (const headers of [
  { 'X-CSRF-Token': '' }, { 'X-CSRF-Token': '0'.repeat(64) },
  { Origin: 'https://attacker.invalid' }, { 'Sec-Fetch-Site': 'cross-site' },
 ] as Record<string, string>[]) assert.equal((await request('/api/action', { input, headers })).status, 403);
 const current = await request<View>('/api/state');
 assert.deepEqual(current.body.timeline, first.timeline);
});

test('strict operation schemas reject forged actor, workspace, provider and raw workflow authority', async () => {
 for (const extra of [{ actor: 'publisher' }, { workspace: 'other-demo' }, { mode: 'lexical' }, { type: 'ack' }]) {
  const response = await request('/api/action', { input: { action: 'assess', idempotencyKey: requestKey(), ...extra } });
  assert.equal(response.status, 400);
 }
 assert.equal((await request('/api/action', { input: { action: 'retire', idempotencyKey: requestKey() } })).status, 403);
 assert.equal((await request('/api/action', { input: { action: 'role', role: 'publisher', idempotencyKey: requestKey() } })).status, 400);
 assert.equal((await request('/api/workflow/execute', { input: { type: 'ack', actor: 'receiver.sc01' } })).status, 404);
 assert.equal((await request('/api/chat', { input: { question: 'test', idempotencyKey: requestKey(), provider: 'openai' } })).status, 400);
 assert.deepEqual((await request<View>('/api/state')).body.timeline, first.timeline);
});

test('another session cannot observe first-session answers or its workflow mutations', async () => {
 const a = await request<View>('/api/action', { input: { action: 'assess', idempotencyKey: requestKey() } });
 assert.equal(a.status, 200); assert.equal(a.body.workflow.state, 'OUTREACH_QUEUED');
 const b = await request<View>('/api/state', { visitor: 1 });
 assert.deepEqual(b.body.timeline, second.timeline); assert.equal(b.body.workflow.state, 'RECEIVED');
 const answer = await request<Chat>('/api/chat', { input: { question: baseRequest().question, idempotencyKey: 'security.answer' } });
 assert.equal(answer.status, 200); initialAnswer = answer.body;
 assert.equal((await request<View>('/api/state', { visitor: 1 })).body.answers.length, 0);
 const workspace = (await service.sessionDb.pool.query('SELECT workspace FROM portfolio.sessions WHERE token_hash=$1', [digest(visitors[1]!.token)])).rows[0].workspace as string;
 await assert.rejects(new PersistentRetrieval(service.db, { workspace, tenant: 'T-DEMO', environment: 'governed' }).history('avery', initialAnswer.record.id));
});

test('unrecognized, executable, altered and oversized uploads never become stored upload records', async () => {
 const sessionHash = digest(visitors[0]!.token);
 const workspace = (await service.sessionDb.pool.query('SELECT workspace FROM portfolio.sessions WHERE token_hash=$1', [sessionHash])).rows[0].workspace as string;
 const count = async () => Number((await service.sessionDb.pool.query("SELECT count(*) n FROM portfolio.items WHERE workspace=$1 AND kind='upload'", [workspace])).rows[0].n);
 const beforeCount = await count();
 for (const input of [
  { name: 'patient-notes.txt', text: 'SYNTHETIC security test canary that is not an approved fixture', synthetic: true },
  { name: 'evil.html', text: '<script>alert(1)</script>', synthetic: true },
  { name: uploadFixtures[0]!.name, text: uploadFixtures[0]!.text + '\nchanged', synthetic: true },
 ]) assert.equal((await request('/api/upload', { input })).status, 422);
 assert.equal((await request('/api/upload', { input: { name: 'fixture.txt', text: 'x', synthetic: false } })).status, 400);
 assert.equal((await request('/api/upload', { raw: JSON.stringify({ name: 'large.txt', text: 'x'.repeat(13000), synthetic: true }) })).status, 413);
 assert.equal((await request('/api/upload', { raw: '<not-json>', headers: { 'Content-Type': 'text/html' } })).status, 415);
 assert.equal(await count(), beforeCount);
});

test('answer replay is exact and immutable, has exact citations and never executes paid model calls', async () => {
 const response = await request<Chat>('/api/chat', { input: { question: baseRequest().question, idempotencyKey: 'security.answer' } });
 assert.equal(response.status, 200); assert.deepEqual(response.body, initialAnswer);
 assert.equal(initialAnswer.answer.audit.attempts, 0); assert.equal(initialAnswer.answer.audit.execution, 'none');
 assert.equal(initialAnswer.answer.audit.estimatedCostUsd, 0);
 for (const citation of initialAnswer.answer.citations) assert.ok(initialAnswer.record.evidenceUsed.some((c: EvidenceRecord['evidenceUsed'][number]) => JSON.stringify(c) === JSON.stringify(citation)));
 assert.equal((await request('/api/chat', { input: { question: 'changed query', idempotencyKey: 'security.answer' } })).status, 409);
 const workspace = (await service.sessionDb.pool.query('SELECT workspace FROM portfolio.sessions WHERE token_hash=$1', [digest(visitors[0]!.token)])).rows[0].workspace as string;
 const scope = { workspace, tenant: 'T-DEMO', environment: 'governed' as const };
 await assert.rejects(service.db.transaction(scope, c => c.query("UPDATE pathway.answers SET body='{}'::jsonb WHERE id=$1", [initialAnswer.answer.id])));
 const stored = await service.db.transaction(scope, async c => (await c.query('SELECT body FROM pathway.answers WHERE id=$1', [initialAnswer.answer.id])).rows[0].body);
 assert.deepEqual(GenerationResult.parse(stored), initialAnswer.answer);
});

test('a published release from another session cannot grant a release assignment here', async () => {
 assert.equal((await request('/api/action', { visitor: 1, input: { action: 'role', role: 'knowledge_reviewer', idempotencyKey: requestKey() } })).status, 200);
 const published = await request<View>('/api/action', { visitor: 1, input: { action: 'publish', idempotencyKey: requestKey() } });
 assert.equal(published.status, 200);
 const release = published.body.knowledge.releases.find(r => r.id.startsWith('KP-ALDER.PORTFOLIO.'));
 assert.ok(release);
 const before = (await request<View>('/api/state')).body.knowledge.assignments;
 assert.equal((await request('/api/action', { input: { action: 'role', role: 'knowledge_reviewer', idempotencyKey: requestKey() } })).status, 200);
 assert.equal((await request('/api/action', { input: { action: 'assign', releaseId: release.id, idempotencyKey: requestKey() } })).status, 409);
 assert.deepEqual((await request<View>('/api/state')).body.knowledge.assignments, before);
});

test('action retries cannot change their payload and do not append a second logical transition', async () => {
 const input = { action: 'role', role: 'manager', idempotencyKey: requestKey() };
 const a = await request<View>('/api/action', { input }); assert.equal(a.status, 200);
 const b = await request<View>('/api/action', { input }); assert.equal(b.status, 200); assert.deepEqual(a.body.timeline, b.body.timeline);
 assert.equal((await request('/api/action', { input: { ...input, role: 'supervisor' } })).status, 409);
});

test('malformed inputs, private paths and internal failures return no payload, credential or stack details', async () => {
 const canary = 'SECURITY_TEST_NOT_A_REAL_SECRET_92e53';
 const invalid = await request('/api/action', { input: { action: 'not-an-action', secret: canary } });
 assert.equal(invalid.status, 400); assert.ok(!invalid.text.includes(canary));
 for (const path of ['/.env', '/src/app/server.ts', '/.local/postgres/data/postgresql.conf', '/api/admin', '/api/migrate']) {
  const response = await request(path); assert.equal(response.status, 404); assert.ok(!/postgresql:\/\/|stack|node_modules/.test(response.text));
 }
 // Inject a driver-shaped failure only into this server's pool method; no database or secret is changed.
 const query = service.db.pool.query;
 service.db.pool.query = (() => { throw new Error('postgresql://synthetic:test-secret@invalid/database ' + canary); }) as typeof query;
 try {
  const response = await request('/healthz'); assert.equal(response.status, 503);
  assert.ok(!/test-secret|postgresql|SECURITY_TEST|stack/.test(response.text)); assert.equal(response.body.code, 'SERVICE_UNAVAILABLE');
 } finally { service.db.pool.query = query; }
});

test('bounded reset preserves old history, old action replay cannot target a new demo, duplicate reset does not reseed', async () => {
 // Move only this fixture to its last allowed reset without seeding extra workspaces.
 await service.sessionDb.pool.query('UPDATE portfolio.sessions SET reset_count=4 WHERE token_hash=$1', [digest(visitors[1]!.token)]);
 const oldAction = { action: 'role', role: 'manager', idempotencyKey: requestKey() };
 assert.equal((await request('/api/action', { visitor: 1, input: oldAction })).status, 200);
 const reset = { action: 'reset', idempotencyKey: requestKey() };
 const a = await request<View>('/api/action', { visitor: 1, input: reset }); assert.equal(a.status, 200); assert.equal(a.body.limits.remainingResets, 0);
 const row = async () => (await service.sessionDb.pool.query('SELECT workspace,reset_count FROM portfolio.sessions WHERE token_hash=$1', [digest(visitors[1]!.token)])).rows[0];
 const beforeReplay = await row();
 assert.equal((await request('/api/action', { visitor: 1, input: reset })).status, 200); assert.deepEqual(await row(), beforeReplay);
 assert.equal((await request('/api/action', { visitor: 1, input: oldAction })).status, 409);
 assert.equal((await request('/api/action', { visitor: 1, input: { ...reset, idempotencyKey: requestKey() } })).status, 429);
 assert.deepEqual(await row(), beforeReplay);
});

test('unreviewed question is rejected before immutable evidence, answer or payload persistence', async () => {
 const tokenHash = digest(visitors[1]!.token);
 const workspace = (await service.sessionDb.pool.query('SELECT workspace FROM portfolio.sessions WHERE token_hash=$1', [tokenHash])).rows[0].workspace as string;
 const scope = { workspace, tenant: 'T-DEMO', environment: 'governed' as const };
 const count = async () => ({
  domain: await service.db.transaction(scope, async c => (await c.query('SELECT (SELECT count(*) FROM pathway.evidence)::int evidence,(SELECT count(*) FROM pathway.answers)::int answers,(SELECT count(*) FROM pathway.audit)::int audit')).rows[0]),
  items: Number((await service.sessionDb.pool.query('SELECT count(*) n FROM portfolio.items WHERE workspace=$1', [workspace])).rows[0].n),
 });
 const beforeCount = await count();
 const question = 'UNREVIEWED_SYNTHETIC_SECURITY_CANARY_' + randomUUID();
 const response = await request('/api/chat', { visitor: 1, input: { question, idempotencyKey: requestKey() } });
 assert.equal(response.status, 422); assert.ok(!response.text.includes(question));
 assert.deepEqual(await count(), beforeCount);
});

test('authenticated session refresh shares the durable 240-request read cap with state lookup', async () => {
 const key = 'read.' + digest(visitors[0]!.token);
 const prior = (await service.sessionDb.pool.query('SELECT hits,expires_at FROM portfolio.limits WHERE key=$1', [key])).rows[0];
 try {
  await service.sessionDb.pool.query("INSERT INTO portfolio.limits(key,hits,expires_at) VALUES($1,240,clock_timestamp()+interval '60 seconds') ON CONFLICT(key) DO UPDATE SET hits=240,expires_at=EXCLUDED.expires_at", [key]);
  assert.equal((await request('/api/session')).status, 429);
  assert.equal((await service.sessionDb.pool.query('SELECT hits FROM portfolio.limits WHERE key=$1', [key])).rows[0].hits, 241);
  assert.equal((await request('/api/state')).status, 429);
 } finally {
  if (prior) await service.sessionDb.pool.query('UPDATE portfolio.limits SET hits=$2,expires_at=$3 WHERE key=$1', [key, prior.hits, prior.expires_at]);
  else await service.sessionDb.pool.query('DELETE FROM portfolio.limits WHERE key=$1', [key]);
 }
});

test('lifetime write-attempt budget survives application rollback and rejects before retaining payload data', async () => {
 const tokenHash = digest(visitors[1]!.token), key = 'attempts.' + tokenHash;
 const attempts = async () => (await service.sessionDb.pool.query('SELECT hits,expires_at FROM portfolio.limits WHERE key=$1', [key])).rows[0];
 const prior = await attempts();
 const actions = async () => (await service.sessionDb.pool.query('SELECT actions FROM portfolio.sessions WHERE token_hash=$1', [tokenHash])).rows[0].actions;
 const beforeActions = await actions();
 // The reset demo is RECEIVED: a document receipt fails inside the application's outer transaction.
 assert.equal((await request('/api/action', { visitor: 1, input: { action: 'receive', idempotencyKey: requestKey() } })).status, 409);
 assert.equal(await actions(), beforeActions);
 assert.equal((await attempts()).hits, prior.hits + 1);
 const retained = await attempts();
 try {
  await service.sessionDb.pool.query("UPDATE portfolio.limits SET hits=150,expires_at=clock_timestamp()+interval '4 hours' WHERE key=$1", [key]);
  const canary = 'UNREVIEWED_REJECTED_BUDGET_PAYLOAD_' + randomUUID();
  const response = await request('/api/chat', { visitor: 1, input: { question: canary, idempotencyKey: requestKey() } });
  assert.equal(response.status, 429); assert.ok(!response.text.includes(canary)); assert.equal(await actions(), beforeActions);
  const row = (await service.sessionDb.pool.query('SELECT * FROM portfolio.limits WHERE key=$1', [key])).rows[0];
  assert.equal(row.hits, 151); assert.deepEqual(Object.keys(row).sort(), ['expires_at', 'hits', 'key']);
  assert.ok(!JSON.stringify(row).includes(canary));
 } finally { await service.sessionDb.pool.query('UPDATE portfolio.limits SET hits=$2,expires_at=$3 WHERE key=$1', [key, retained.hits, retained.expires_at]); }
});

test('server rejects expired session capabilities and durable rate limits remain active across wrapper reconstruction', async () => {
 const visitor = visitors[1]!;
 await service.sessionDb.pool.query("UPDATE portfolio.sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1", [digest(visitor.token)]);
 assert.equal((await request('/api/state', { visitor: 1 })).status, 401);
 const key = 'security.limit.' + randomUUID();
 try {
  await service.sessions.limit(key, 1, 60);
  const { Sessions } = await import('../../src/app/session.ts');
  await assert.rejects(new Sessions(service.sessionDb).limit(key, 1, 60), { status: 429 });
 } finally { await service.sessionDb.pool.query('DELETE FROM portfolio.limits WHERE key=$1', [key]); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Database, scoped } from '../../src/db/database.ts';
import { createApplicationServer } from '../../src/app/server.ts';
import { digest, HttpError } from '../../src/app/session.ts';
import type { Session } from '../../src/app/session.ts';
import { baseRequest } from '../../src/evaluation.ts';
import { canonical } from '../../src/integrity.ts';
import { WorkflowRepository } from '../../src/workflow/repository.ts';
import { WorkflowEngine } from '../../src/workflow/engine.ts';
import { SimulatedEffectAdapter } from '../../src/workflow/adapters.ts';

// Actual PostgreSQL + application services, without HTTP or new provider calls.
// Each test creates one uniquely reserved synthetic workspace, retained with immutable history.
async function fixture() {
  const db = new Database(), sessionDb = new Database();
  const service = createApplicationServer({ db, sessionDb });
  const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
  try {
    const inserted = await sessionDb.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '4 hours') RETURNING *", [digest(token), csrf]);
    const original = inserted.rows[0] as Session;
    const session = await service.sessions.exclusive(original, (s, c) => service.app.start(s, 'golden', c));
    return { ...service, session,
      current: async () => (await sessionDb.pool.query('SELECT * FROM portfolio.sessions WHERE token_hash=$1', [session.token_hash])).rows[0] as Session,
      cleanup: async () => { await db.close(); await sessionDb.close(); },
    };
  } catch (error) { await db.close(); await sessionDb.close(); throw error; }
}

test('chat reuses the exact committed answer after a portfolio receipt failure and rejects changed-mode replay', async () => {
  const f = await fixture();
  try {
    const input = { question: baseRequest().question, mode: 'governed' as const, idempotencyKey: 'recovery-chat-once' };
    const originalItem = f.app.item.bind(f.app); let injected = false;
    f.app.item = async (...args) => {
      if (!injected) { injected = true; throw new Error('INJECTED_AFTER_CORE_CHAT_COMMIT'); }
      return originalItem(...args);
    };
    await assert.rejects(f.app.chat(f.session, input), /INJECTED_AFTER_CORE_CHAT_COMMIT/);
    f.app.item = originalItem;
    const scope = f.app.scope(f.session);
    const persisted = async () => f.db.transaction(scope, async c => ({
      answers: (await c.query('SELECT body FROM pathway.answers WHERE workspace=$1 AND tenant=$2 AND environment=$3 ORDER BY sequence', scoped(scope))).rows.map(row => row.body),
      runs: (await c.query('SELECT id FROM pathway.runs WHERE workspace=$1 AND tenant=$2 AND environment=$3', scoped(scope))).rows,
    }));
    const afterCrash = await persisted();
    assert.equal(afterCrash.answers.length, 1, 'the explanation committed before the injected outer-transaction failure');
    assert.equal(afterCrash.runs.length, 1);
    assert.equal((await f.current()).actions, 0, 'the portfolio action counter rolled back');
    const response = await f.app.chat(f.session, input);
    assert.equal(canonical(response.answer), canonical(afterCrash.answers[0]), 'retry must not regenerate latency/timestamp/audit identity');
    const afterReplay = await persisted();
    assert.equal(afterReplay.answers.length, 1, 'no second immutable answer is allowed for this logical request');
    assert.equal(afterReplay.runs.length, 1, 'retrieval request remains idempotent');
    assert.equal((await f.current()).actions, 1);
    const repeated = await f.app.chat(f.session, input);
    assert.equal(canonical(repeated), canonical(response));
    assert.equal((await f.current()).actions, 1, 'receipt replay does not consume another durable action');
    await assert.rejects(f.app.chat(f.session, { ...input, mode: 'sandbox' }), error => error instanceof HttpError && error.status === 409);
    assert.equal((await persisted()).answers.length, 1);
  } finally { await f.cleanup(); }
});

test('checkpoint recovery retains its original timer target after core commit and later worker progress', async () => {
  const f = await fixture();
  try {
    await f.app.action(f.session, { action: 'assess', idempotencyKey: 'recovery-assess' });
    await f.app.action(f.session, { action: 'dispatch', idempotencyKey: 'recovery-dispatch' });
    const repo = new WorkflowRepository(f.db, f.app.scope(f.session));
    const before = (await repo.read('avery', 'SC-01')).at(-1)!.snapshot;
    assert.equal(before.state, 'AWAITING_RESPONSE');
    const originalTimer = before.timers.find(timer => timer.status === 'pending')!;
    assert(originalTimer);
    const command = { action: 'checkpoint', idempotencyKey: 'recovery-checkpoint-once' };
    const originalView = f.app.view.bind(f.app); let injected = false;
    f.app.view = async (...args) => {
      if (!injected) { injected = true; throw new Error('INJECTED_AFTER_TIMER_COMMIT'); }
      return originalView(...args);
    };
    await assert.rejects(f.app.action(f.session, command), /INJECTED_AFTER_TIMER_COMMIT/);
    f.app.view = originalView;
    const afterCrash = (await repo.read('avery', 'SC-01')).at(-1)!.snapshot;
    assert.equal(afterCrash.timers.find(timer => timer.id === originalTimer.id)?.status, 'fired');
    assert.equal(afterCrash.state, 'OUTREACH_QUEUED');
    assert((await f.current()).demo_clock < new Date(afterCrash.updatedAt), 'core progressed beyond the rolled-back session clock');

    // A separate worker may legally progress the newly queued reminder before the browser retries.
    // This creates another pending timer so replay must recover its original target, not choose the next one.
    const scope = f.app.scope(f.session), workerTime = new Date(Date.parse(afterCrash.updatedAt) + 30_000).toISOString();
    const worker = new WorkflowEngine(f.db, scope, () => workerTime), effect = afterCrash.effects.find(effect => effect.status === 'queued')!;
    assert(effect);
    const options = { retrieval: { cacheSource: f.app.cache } };
    const prepared = await worker.prepareDispatch('agent.sc01', 'SC-01', effect.id, 'recovery-background.prepare', options);
    assert.equal(prepared.status, 'accepted');
    const delivered = await worker.dispatch('agent.sc01', 'SC-01', effect.id, 'recovery-background.dispatch', new SimulatedEffectAdapter(f.db, scope), options);
    assert.equal(delivered.status, 'accepted');
    const beforeReplay = (await repo.read('avery', 'SC-01')).at(-1)!.snapshot;
    assert.equal(beforeReplay.state, 'AWAITING_RESPONSE');
    const nextTimer = beforeReplay.timers.find(timer => timer.status === 'pending')!;
    assert(nextTimer && nextTimer.id !== originalTimer.id);
    const fireCount = (await repo.read('avery', 'SC-01')).flatMap(step => step.events).filter(event => event.type === 'timer_fired').length;

    const recovered = await f.app.action(f.session, command);
    assert.equal(recovered.workflow.state, 'AWAITING_RESPONSE', 'replay does not fire the next reminder and escalate');
    assert.equal(recovered.workflow.timers.find(timer => timer.id === nextTimer.id)?.status, 'pending');
    assert.equal(recovered.workflow.effects.length, 2);
    assert.equal((await repo.read('avery', 'SC-01')).flatMap(step => step.events).filter(event => event.type === 'timer_fired').length, fireCount);
    const current = await f.current();
    assert(current.demo_clock >= new Date(recovered.workflow.updatedAt), 'session clock must catch up to the latest committed workflow');
    assert(current.demo_clock < new Date(nextTimer.dueAt), 'replayed command must not jump to the newly selected timer');
    const received = await f.app.action(f.session, { action: 'receive', idempotencyKey: 'recovery-document-after-timer' });
    assert.equal(received.workflow.state, 'VERIFICATION_REQUIRED', 'the next action must not fail CLOCK_REWIND');
  } finally { await f.cleanup(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { Driver } from '../../scripts/workflow/scenarios.ts';
import { connection,Database } from '../../src/db/database.ts';
import { WorkflowEngine } from '../../src/workflow/engine.ts';
import { WorkflowRepository } from '../../src/workflow/repository.ts';
import { SimulatedEffectAdapter,septemberCalendar } from '../../src/workflow/adapters.ts';
import { nextBestAction } from '../../src/workflow/observability.ts';
import { hash } from '../../src/integrity.ts';
async function check(fn:(d:Driver)=>Promise<void>){const d=await new Driver().setup();try{await fn(d);}finally{await d.db.close();}}
test('invalid transitions and actor roles are auditable; no received document is implicitly verified',()=>check(async d=>{
 await d.call('avery',{type:'assess'},d.options,'rejected');await d.assess();await d.deliver();await d.receive();
 assert.equal(d.state.state,'VERIFICATION_REQUIRED');assert.equal(d.state.approval,null);assert.equal(nextBestAction(d.state).automationMayExecute,false);
 const t=d.state.tasks.find(t=>t.status==='open')!;
 await d.call('morgan',{type:'resolve',taskId:t.id,option:'verify_and_approve',documentHash:d.state.documentHash,recipient:'sim-receiver-101'},d.options,'rejected');
 await d.call('avery',{type:'resolve',taskId:t.id,option:'verify_and_approve',documentHash:hash('different package'),recipient:'sim-receiver-101'},d.options,'rejected');
 await d.call('avery',{type:'resolve',taskId:t.id,option:'verify_and_approve',documentHash:d.state.documentHash,recipient:'wrong-receiver'},d.options,'rejected');
 assert.equal(d.state.decisions.length,0);await d.verify();const e=d.state.effects.at(-1)!;
 await d.call('receiver.sc01',{type:'ack',sourceId:'forged-ack',effectId:e.id,documentHash:d.state.documentHash,recipient:'sim-receiver-101',accepted:true},d.options,'rejected');
 assert.equal(d.state.state,'TRANSFER_QUEUED');
}));
test('case grant revocation after queue prevents execution and preserves evidence',()=>check(async d=>{
 await d.assess();await d.repository.revoke('publisher',d.state.grantId,d.now);const e=d.state.effects[0]!;
 const s=await d.engine.prepareDispatch('agent.sc01',d.id,e.id,d.commandId(),d.options);assert.equal(s.snapshot.state,'PAUSED');assert(s.snapshot.pauseReasons.includes('GRANT_INACTIVE'));assert.equal(s.snapshot.effects[0]!.attempts,0);
}));
test('transfer approval expires and cannot be reused as a new authorization',()=>check(async d=>{
 await d.assess();await d.deliver();await d.receive();await d.verify();d.now=d.state.approval!.expiresAt;
 const s=await d.engine.prepareDispatch('agent.sc01',d.id,d.state.effects.at(-1)!.id,d.commandId(),d.options);assert.equal(s.snapshot.state,'PAUSED');assert(s.snapshot.pauseReasons.includes('APPROVAL_BINDING_INVALID'));
}));
test('inbound and command ID payload collisions cannot alter the case',()=>check(async d=>{
 await d.assess();await d.deliver();await d.receive();const old=d.last.command;
 await d.call('avery',{...old,documentHash:hash('collision')},d.options,'rejected');
 await d.call('avery',{...old,id:d.commandId(),documentHash:hash('collision')},d.options,'rejected');assert.equal(d.state.inbox.length,1);assert.equal(d.state.documentHash,(old as Extract<typeof old,{type:'document'}>).documentHash);
}));
test('known not-delivered failures retry once; an exhausted effect fails with human ownership',()=>check(async d=>{
 await d.assess();const adapter=new SimulatedEffectAdapter(d.db,d.scope,'not_delivered');await d.deliver(adapter);assert.equal(d.state.effects[0]!.status,'failed');
 await d.deliver(adapter);assert.equal(d.state.state,'FAILED');assert.equal(d.state.effects[0]!.attempts,2);assert(d.state.tasks.some(t=>t.kind==='exception'&&t.assignedTo==='demo-supervisor'));
}));
test('unknown external state escalates without blind resend',()=>check(async d=>{
 await d.assess();const e=d.state.effects[0]!;const p=await d.engine.prepareDispatch('agent.sc01',d.id,e.id,d.commandId(),d.options);d.state=p.snapshot;
 const r=await d.engine.reconcile('agent.sc01',d.id,e.id,d.commandId(),{dispatch:async()=>{throw new Error('Must not dispatch');},reconcile:async()=>null});assert.equal(r.snapshot.state,'ESCALATED');assert.equal(r.snapshot.effects[0]!.status,'unknown');assert.equal(r.snapshot.effects[0]!.attempts,1);
}));
test('cancelled attempted effects can be reconciled without resuming automation',()=>check(async d=>{
 await d.assess();const e=d.state.effects[0]!;const p=await d.engine.prepareDispatch('agent.sc01',d.id,e.id,d.commandId(),d.options);d.state=p.snapshot;
 await assert.rejects(d.engine.dispatch('agent.sc01',d.id,e.id,d.commandId(),d.adapter,{...d.options,crashAfterDispatch:true}));
 await d.call('avery',{type:'cancel'});const r=await d.engine.reconcile('agent.sc01',d.id,e.id,d.commandId(),d.adapter);assert.equal(r.snapshot.state,'CANCELLED');assert.equal(r.snapshot.effects[0]!.status,'delivered');assert.equal(r.snapshot.completedAt,null);assert(r.snapshot.timers.every(t=>t.status==='cancelled'||t.status==='fired'));
}));
test('missing receiving acknowledgment and human SLA expiry escalate without completion',()=>check(async d=>{
 await d.assess();await d.deliver();await d.receive();await d.verify();await d.deliver();const t=d.state.timers.find(t=>t.kind==='ack_due'&&t.status==='pending')!;
 d.now=t.dueAt;await d.call('agent.sc01',{type:'acquire_timer',timerId:t.id});d.now=d.last.timestamp;await d.call('agent.sc01',{type:'fire_timer',timerId:t.id,leaseToken:d.last.command.id});assert.equal(d.state.state,'ESCALATED');assert.equal(d.state.completedAt,null);assert.equal(d.state.effects.at(-1)!.status,'delivered');
}));
test('due human task does not trigger office outreach',()=>check(async d=>{
 await d.assess();await d.deliver();await d.call('avery',{type:'ambiguity',reason:'DOCUMENT_UNCERTAIN'});const t=d.state.timers.find(t=>t.kind==='human_due'&&t.status==='pending')!;
 d.now=t.dueAt;await d.call('agent.sc01',{type:'acquire_timer',timerId:t.id});d.now=d.last.timestamp;await d.call('agent.sc01',{type:'fire_timer',timerId:t.id,leaseToken:d.last.command.id});assert.equal(d.state.state,'ESCALATED');assert.equal(d.state.effects.length,1);
}));
test('RLS views, journal immutability and sandbox denial survive repository boundaries',()=>check(async d=>{
 await d.assess();const other={...d.scope,workspace:'not-this-workspace'};
 await d.db.transaction(other,async c=>{for(const table of ['wf_steps','wf_grants','wf_instances','wf_outbox','wf_inbox','wf_tasks','wf_timers','wf_knowledge_links'])assert.equal((await c.query('SELECT * FROM pathway.'+table)).rowCount,0);});
 await assert.rejects(new WorkflowRepository(d.db,d.scope).read('outsider',d.id),/WORKFLOW_ACCESS_DENIED/);
 await assert.rejects(new WorkflowEngine(d.db,{...d.scope,environment:'sandbox'},()=>d.now).execute('agent.sc01',{id:'forbidden',workflowId:'bad',type:'start',grantId:d.state.grantId}),/SANDBOX_WORKFLOW_DENIED/);
 const owner=new pg.Pool(connection(true));try{await assert.rejects(owner.query('UPDATE pathway.wf_steps SET body=body WHERE workspace=$1',[d.scope.workspace]),/IMMUTABLE_RECORD/);}finally{await owner.end();}
 await assert.rejects(d.db.transaction(d.scope,c=>c.query('TRUNCATE pathway.wf_steps CASCADE')),/permission denied/);
 const unsafe=new Database(connection(true));try{await assert.rejects(unsafe.transaction(d.scope,async()=>null),/must not bypass RLS/);}finally{await unsafe.close();}
}));
test('fixture schedule skips weekends, enforces hours and rejects unsupported calendars',()=>{
 assert.equal(septemberCalendar.nextBusinessDay('2026-09-11T16:00:00.000Z'),'2026-09-14T16:00:00.000Z');
 assert.equal(septemberCalendar.nextBusinessDay('2026-09-04T16:00:00.000Z'),'2026-09-08T16:00:00.000Z');
 assert(!septemberCalendar.inOfficeHours('2026-09-10T23:00:00.000Z'));assert.throws(()=>septemberCalendar.nextBusinessDay('2027-01-01T16:00:00.000Z'),/OUTSIDE_FIXTURE_CALENDAR/);
});
test('a changed durable case revision invalidates an earlier exact-package approval',()=>check(async d=>{
 await d.assess();await d.deliver();await d.receive();await d.verify();
 const {insert}=await import('../../src/db/database.ts');const {loadRegistry}=await import('../../src/db/registry.ts');
 await d.db.transaction(d.scope,async c=>{const old=(await loadRegistry(c,d.scope)).corpus.cases.find(c=>c.id==='DEMO-101')!;await insert(c,d.scope,'case_revisions','case-change-sc01',{...old,revision:'phase2d-case-revised'},'publisher');});
 const result=await d.engine.prepareDispatch('agent.sc01',d.id,d.state.effects.at(-1)!.id,d.commandId(),d.options);assert.equal(result.snapshot.state,'PAUSED');assert(result.snapshot.pauseReasons.includes('CASE_CONTEXT_CHANGED'));
}));
test('authoritative conflict pauses SC-01 even when a human requests resumption',()=>check(async d=>{
 await d.assess();await d.deliver();await d.call('avery',{type:'ambiguity',reason:'DOCUMENT_UNCERTAIN'});
 const {GovernanceRepository}=await import('../../src/db/governance.ts');await new GovernanceRepository(d.db,d.scope).conflict('publisher','K-PA-X.v1',d.now);
 const task=d.state.tasks.find(t=>t.status==='open')!;await d.call('morgan',{type:'resolve',taskId:task.id,option:'release_collection'});assert.equal(d.state.state,'PAUSED');assert(d.state.pauseReasons.includes('AUTHORITATIVE_CONFLICT'));assert.equal(d.state.effects.length,1);assert.equal(d.state.decisions.length,1);
}));
test('degraded acknowledgment cannot impersonate another human',()=>check(async d=>{
 const id=d.commandId();await d.call('agent.sc01',{id,type:'assess'},{retrieval:{mode:'lexical',acknowledgment:{actorId:'avery',policyId:null,requestId:id+'.knowledge.0',timestamp:d.now,expiresAt:'2026-09-11T00:00:00.000Z',reason:'OFFLINE_EXPLICIT',originalRunId:null,scope:'single_request'}}},'rejected');assert.equal(d.state.effects.length,0);
}));
test('acknowledgments bind the exact receiver and payload; first delivery cannot claim resolution',()=>check(async d=>{
 await d.assess();await d.deliver();await d.receive();await d.verify();await d.deliver();const e=d.state.effects.at(-1)!;
 await d.call('receiver.sc01',{type:'ack',sourceId:'bad-payload',effectId:e.id,documentHash:hash('wrong'),recipient:'sim-receiver-101',accepted:true},d.options,'rejected');
 await d.call('receiver.sc01',{type:'ack',sourceId:'bad-recipient',effectId:e.id,documentHash:d.state.documentHash,recipient:'wrong',accepted:true},d.options,'rejected');assert.equal(d.state.state,'AWAITING_ACK');assert.equal(d.state.completedAt,null);
}));
test('lease acquisition and command replay produce one logical timer firing',()=>check(async d=>{
 await d.assess();await d.deliver();const t=d.state.timers.find(t=>t.kind==='follow_up')!;
 await d.call('agent.sc01',{type:'acquire_timer',timerId:t.id},d.options,'rejected');d.now=t.dueAt;await d.call('agent.sc01',{type:'acquire_timer',timerId:t.id});const token=d.last.command.id;d.now=d.last.timestamp;
 await d.call('agent.sc01',{type:'acquire_timer',timerId:t.id},d.options,'rejected');d.now=d.last.timestamp;
 await d.call('agent.sc01',{type:'fire_timer',timerId:t.id,leaseToken:token});const command=d.last.command;await d.call('agent.sc01',{...command},d.options,'duplicate');assert.equal(d.state.effects.length,2);const timeline=await d.repository.read('avery',d.id);assert.equal(timeline.flatMap(s=>s.events).filter(e=>e.type==='timer_fired'&&e.subjectId===t.id).length,1);
}));
test('bounded worker polls durable outbox and timers without replaying completed work',()=>check(async d=>{
 const {WorkflowWorker}=await import('../../src/workflow/worker.ts');await d.assess();let w=new WorkflowWorker(d.db,d.scope,d.engine,d.adapter);w.options=d.options;
 await w.runOutbox();const steps=await d.repository.read('avery',d.id);d.state=steps.at(-1)!.snapshot;assert.equal(d.state.state,'AWAITING_RESPONSE');assert.equal((await w.runOutbox()).length,0);
 const timer=d.state.timers.find(t=>t.status==='pending')!;d.now=timer.dueAt;await d.restart();w=new WorkflowWorker(d.db,d.scope,d.engine,d.adapter);w.options=d.options;await w.runDue(d.now);await w.runOutbox();
 const final=(await d.repository.read('avery',d.id)).at(-1)!.snapshot;assert.equal(final.effects.length,2);assert(final.effects.every(e=>e.status==='delivered'));assert.equal((await w.runDue(d.now)).length,0);
}));
test('workflow grant seeding is idempotent and a second workflow cannot duplicate the same case',()=>check(async d=>{
 const {sc01Grant}=await import('../../src/workflow/fixtures.ts');assert.equal(await d.repository.provision('publisher',sc01Grant()),false);
 await assert.rejects(d.engine.execute('agent.sc01',{id:'second-case',workflowId:'SC-01-duplicate',type:'start',grantId:d.state.grantId}),/wf_single_case/);
}));
test('the supervisor can accept a terminal exception without resuming case actions',()=>check(async d=>{
 await d.assess();await d.deliver();await d.receive();await d.verify();await d.deliver();await d.ack(false);
 const task=d.state.tasks.find(t=>t.status==='open')!;assert.equal(task.kind,'exception');assert.equal(task.assignedTo,'demo-supervisor');
 await d.call('morgan',{type:'resolve',taskId:task.id,option:'escalate'},d.options,'rejected');await d.call('demo-supervisor',{type:'resolve',taskId:task.id,option:'escalate'});
 assert.equal(d.state.state,'ESCALATED');assert.equal(d.state.completedAt,null);assert.equal(d.state.tasks.filter(t=>t.status==='open').length,0);assert.equal(d.state.effects.length,2);
}));

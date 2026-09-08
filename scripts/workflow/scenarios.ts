import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Database,scoped,validateRow } from '../../src/db/database.ts';
import { seed,GovernanceRepository } from '../../src/db/governance.ts';
import { EvidenceRecord } from '../../src/contracts.ts';
import { RunRecord } from '../../src/db/retrieval.ts';
import { FileEmbeddingCache } from '../../src/providers/embedding.ts';
import { hash } from '../../src/integrity.ts';
import { WorkflowEngine } from '../../src/workflow/engine.ts';
import type { ExecutionOptions } from '../../src/workflow/engine.ts';
import { WorkflowRepository } from '../../src/workflow/repository.ts';
import { sc01Grant } from '../../src/workflow/fixtures.ts';
import { SimulatedEffectAdapter } from '../../src/workflow/adapters.ts';
import type { EffectAdapter } from '../../src/workflow/adapters.ts';
import type { Command,Snapshot,Step } from '../../src/workflow/contracts.ts';
import { nextBestAction } from '../../src/workflow/observability.ts';
export class Driver {
 db=new Database();scope={workspace:'sc01.'+randomUUID(),tenant:'T-DEMO',environment:'governed' as const};now='2026-09-10T16:00:00.000Z';id='SC-01';counter=0;
 state!:Snapshot;last!:Step;notes:Record<string,unknown>={};
 get engine(){return new WorkflowEngine(this.db,this.scope,()=>this.now);}
 get repository(){return new WorkflowRepository(this.db,this.scope);}
 get adapter(){return new SimulatedEffectAdapter(this.db,this.scope);}
 get options():ExecutionOptions{return {retrieval:{cacheSource:new FileEmbeddingCache('.local/embeddings')}};}
 tick(minutes=1){this.now=new Date(Date.parse(this.now)+minutes*60_000).toISOString();}
 commandId(){return 'command.'+(++this.counter);}
 async setup(){await seed(this.db,this.scope.workspace);await this.repository.provision('publisher',sc01Grant());await this.call('agent.sc01',{type:'start',grantId:sc01Grant().id});return this;}
 async call(actor:string,input:Omit<Command,'id'|'workflowId'>|Record<string,unknown>,options=this.options,expect='accepted'){
  const c={id:this.commandId(),workflowId:this.id,...input};this.last=await this.engine.execute(actor,c,options);assert.equal(this.last.status,expect,JSON.stringify(this.last.events));this.state=this.last.snapshot;this.tick();return this.last;
 }
 async assess(){await this.call('agent.sc01',{type:'assess'});return this.state;}
 async deliver(adapter:EffectAdapter=this.adapter){const e=this.state.effects.at(-1)!;
  this.last=await this.engine.prepareDispatch('agent.sc01',this.id,e.id,this.commandId(),this.options);assert.equal(this.last.status,'accepted');this.state=this.last.snapshot;this.tick();
  this.last=await this.engine.dispatch('agent.sc01',this.id,e.id,this.commandId(),adapter,this.options);assert.equal(this.last.status,'accepted');this.state=this.last.snapshot;this.tick();return this.state;
 }
 async receive(){await this.call('avery',{type:'document',sourceId:'DOC-101',documentHash:hash('SYNTHETIC SC01 signed-note attestation fixture')});}
 async verify(){const t=this.state.tasks.find(t=>t.status==='open'&&t.kind==='verification')!;await this.call('avery',{type:'resolve',taskId:t.id,option:'verify_and_approve',documentHash:this.state.documentHash,recipient:'sim-receiver-101'});}
 async ack(accepted=true){const e=this.state.effects.at(-1)!;await this.call('receiver.sc01',{type:'ack',sourceId:'ACK-101',effectId:e.id,documentHash:this.state.documentHash,recipient:'sim-receiver-101',accepted});}
 async finish(){await this.receive();await this.verify();await this.deliver();assert.equal(this.state.state,'AWAITING_ACK');await this.ack();assert.equal(this.state.state,'PA_PENDING');assert.equal(this.state.accessStatus,'PA_PENDING');}
 async restart(){await this.db.close();this.db=new Database();const t=await this.repository.read('avery',this.id);assert.deepEqual(t.at(-1)!.snapshot,this.state);this.state=t.at(-1)!.snapshot;
  const child=spawnSync(process.execPath,['scripts/workflow/reconstruct.ts',this.scope.workspace,this.id],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);assert.equal(result.snapshotHash,hash(this.state));this.notes.childProcessReconstruction=result;
 }
 async trace(){const steps=await this.repository.read('avery',this.id);const evidenceIds=[...new Set(steps.flatMap(s=>s.snapshot.knowledge.map(k=>k.evidenceId)))];
  const records=await this.db.transaction(this.scope,async c=>{
   const evidence=await c.query('SELECT body,body_hash FROM pathway.evidence WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=ANY($4::text[])',[...scoped(this.scope),evidenceIds]);
   const runs=await c.query("SELECT body,body_hash FROM pathway.runs WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND body->>'evidenceId'=ANY($4::text[])",[...scoped(this.scope),evidenceIds]);
   return {evidence:evidence.rows.map(r=>validateRow(r,EvidenceRecord)),runs:runs.rows.map(r=>validateRow(r,RunRecord))};
  });
  assert(records.runs.every(r=>r.embeddingUsage.requests===0),'No additional provider requests permitted in cache replay');
  return {scope:this.scope,notes:this.notes,steps,...records,nextBestAction:nextBestAction(steps.at(-1)!.snapshot)};
 }
}
const barrier=()=>{let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return {promise,release};};
async function observeWait(db:Database){for(let i=0;i<200;i++){
 const r=await db.pool.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND NOT granted");if(r.rows[0].n>0)return true;await new Promise(r=>setTimeout(r,10));
}throw new Error('Expected blocked advisory lock waiter');}
export const scenarios:Record<string,(d:Driver)=>Promise<void>>={
 golden:async d=>{await d.assess();await d.deliver();await d.restart();await d.finish();},
 'human-pause-resume':async d=>{await d.assess();await d.deliver();await d.call('avery',{type:'ambiguity',reason:'DOCUMENT_UNCERTAIN'});assert.equal(d.state.state,'PAUSED');await d.restart();
  const t=d.state.tasks.find(t=>t.status==='open')!;await d.call('avery',{type:'resolve',taskId:t.id,option:'release_collection'},d.options,'rejected');await d.call('morgan',{type:'resolve',taskId:t.id,option:'release_collection'});assert.equal(d.state.state,'AWAITING_RESPONSE');await d.finish();assert.equal(d.state.effects.filter(e=>e.kind==='notification').length,1);},
 retirement:async d=>{await d.assess();await d.deliver();const before=await d.trace();await new GovernanceRepository(d.db,d.scope).retire('publisher','K-PA.v2',d.now,'mid-case synthetic retirement');await d.receive();await d.verify();assert.equal(d.state.state,'PAUSED');assert(d.state.pauseReasons.includes('SOURCE_RETIRED'));assert.equal(d.state.effects.length,1);
  const after=await d.trace();for(const e of before.evidence)assert.deepEqual(after.evidence.find(a=>a.id===e.id),e);d.notes.historicalEvidencePreserved=true;},
 duplicates:async d=>{await d.assess();await d.deliver();await d.receive();const cmd=d.last.command;await d.call('avery',{...cmd,id:d.commandId()},d.options,'duplicate');await d.call('avery',{...cmd},d.options,'duplicate');assert.equal(d.state.tasks.filter(t=>t.kind==='verification').length,1);await d.verify();await d.deliver();await d.ack();const ack=d.last.command;await d.call('receiver.sc01',{...ack,id:d.commandId()},d.options,'duplicate');assert.equal(d.state.inbox.length,2);},
 'crash-recovery':async d=>{await d.assess();const e=d.state.effects[0]!;
  d.last=await d.engine.prepareDispatch('agent.sc01',d.id,e.id,d.commandId(),d.options);d.state=d.last.snapshot;d.tick();
  await assert.rejects(d.engine.dispatch('agent.sc01',d.id,e.id,d.commandId(),d.adapter,{...d.options,crashAfterDispatch:true}),/Simulated process crash/);
  await d.restart();assert.equal(d.state.effects[0]!.status,'attempted');
  d.last=await d.engine.reconcile('agent.sc01',d.id,e.id,d.commandId(),d.adapter);d.state=d.last.snapshot;assert.equal(d.state.state,'AWAITING_RESPONSE');assert.equal(d.state.effects[0]!.attempts,1);d.notes.crashPoint='After independent simulated provider receipt commit; before workflow transaction commit';await d.finish();},
 rejection:async d=>{await d.assess();await d.deliver();await d.receive();await d.verify();await d.deliver();await d.ack(false);assert.equal(d.state.state,'ESCALATED');assert.equal(d.state.dependency,'open');},
 timer:async d=>{await d.assess();await d.deliver();const t=d.state.timers.find(t=>t.kind==='follow_up')!;d.now=t.dueAt;
  await d.restart();await d.call('agent.sc01',{type:'acquire_timer',timerId:t.id});const oldToken=d.state.timers.find(a=>a.id===t.id)!.leaseToken;d.tick(1);await d.restart();await d.call('agent.sc01',{type:'acquire_timer',timerId:t.id});const token=d.state.timers.find(a=>a.id===t.id)!.leaseToken;
  // Driver's one-minute ticks are exactly lease length. Fire at acquisition time + 30 seconds.
  d.now=new Date(Date.parse(d.last.timestamp)+30_000).toISOString();await d.call('agent.sc01',{type:'fire_timer',timerId:t.id,leaseToken:oldToken},d.options,'rejected');
  d.now=d.last.timestamp;await d.call('agent.sc01',{type:'fire_timer',timerId:t.id,leaseToken:token});assert.equal(d.state.effects.length,2);await d.deliver();
  const next=d.state.timers.find(a=>a.kind==='follow_up'&&a.status==='pending')!;assert.equal(next.dueAt.slice(0,10),'2026-09-14');d.now=next.dueAt;await d.call('agent.sc01',{type:'acquire_timer',timerId:next.id});d.now=d.last.timestamp;await d.call('agent.sc01',{type:'fire_timer',timerId:next.id,leaseToken:d.last.command.id});assert.equal(d.state.state,'ESCALATED');assert.equal(d.state.effects.length,2);},
 'provider-failure':async d=>{await d.call('agent.sc01',{type:'assess'},{retrieval:{providerFactory:(_c,p)=>({...p,descriptor:p.descriptor,capabilities:()=>p.capabilities(),index:async()=>{throw new Error('simulated provider unavailable');},search:async()=>[]})}});assert.equal(d.state.state,'PAUSED');assert(d.state.pauseReasons.includes('PROVIDER_UNAVAILABLE'));assert.equal(d.state.effects.length,0);
  const t=d.state.tasks.find(t=>t.status==='open')!,cmdId=d.commandId(),requestId=cmdId+'.knowledge.'+d.state.knowledge.length;
  await new GovernanceRepository(d.db,d.scope).authorizeDegraded('publisher','avery',requestId,'sc01-single-step-offline',d.now,'2026-09-11T00:00:00.000Z');
  await d.call('morgan',{id:cmdId,type:'resolve',taskId:t.id,option:'retry'},{retrieval:{mode:'lexical',acknowledgment:{actorId:'publisher',policyId:'sc01-single-step-offline',timestamp:d.now,expiresAt:'2026-09-11T00:00:00.000Z',reason:'OFFLINE_EXPLICIT',originalRunId:null,scope:'single_request',requestId}}});
  assert.equal(d.state.state,'OUTREACH_QUEUED');assert.equal(d.state.knowledge.at(-1)!.mode,'lexical');assert.equal(d.state.knowledge.at(-1)!.degraded,true);d.notes.degradedAcknowledgment='Publisher durably preauthorizes one request for offline lexical operation. Manager resolves the task; the policy is not inherited by dispatch.';
 },
 cancellation:async d=>{await d.assess();await d.deliver();const timer=d.state.timers.find(t=>t.status==='pending')!;d.now=timer.dueAt;await d.call('agent.sc01',{type:'acquire_timer',timerId:timer.id});d.now=d.last.timestamp;await d.call('agent.sc01',{type:'fire_timer',timerId:timer.id,leaseToken:d.last.command.id});const pending=d.state.effects.at(-1)!;
  await d.call('avery',{type:'cancel'});assert.equal(d.state.state,'CANCELLED');const blocked=await d.engine.prepareDispatch('agent.sc01',d.id,pending.id,d.commandId(),d.options);assert.equal(blocked.status,'rejected');d.state=blocked.snapshot;assert.equal(d.state.effects.at(-1)!.status,'cancelled');},
 'concurrency-retirement-first':async d=>{await race(d,true);},
 'concurrency-resolution-first':async d=>{await race(d,false);},
};
async function race(d:Driver,retirementFirst:boolean){
 await d.assess();await d.deliver();await d.receive();const t=d.state.tasks.find(t=>t.status==='open')!;const locked=barrier(),release=barrier();
 const hold=async()=>{locked.release();await release.promise;};
 const retire=(hook?:()=>Promise<void>)=>new GovernanceRepository(d.db,d.scope).retire('publisher','K-PA.v2',d.now,'concurrent synthetic retirement','document_version',hook);
 const resolve=(hook?:()=>Promise<void>)=>d.engine.execute('avery',{id:d.commandId(),workflowId:d.id,type:'resolve',taskId:t.id,option:'verify_and_approve',documentHash:d.state.documentHash,recipient:'sim-receiver-101'},{...d.options,afterLock:hook});
 const first=retirementFirst?retire(hold):resolve(hold);await locked.promise;const second=retirementFirst?resolve():retire();
 try{d.notes.blockedWaiterObserved=await observeWait(d.db);}finally{release.release();}
 const results=await Promise.all([first,second]);const result=results[retirementFirst?1:0] as Step;d.state=result.snapshot;d.last=result;assert.equal(d.state.state,retirementFirst?'PAUSED':'TRANSFER_QUEUED');
 if(!retirementFirst){const blocked=await d.engine.prepareDispatch('agent.sc01',d.id,d.state.effects.at(-1)!.id,d.commandId(),d.options);d.state=blocked.snapshot;assert.equal(d.state.state,'PAUSED');}
 d.notes.commitOrdering=retirementFirst?'retirement then human resolution: no transfer queued':'human resolution then retirement: queue permitted historically; subsequent dispatch blocked';
}
export async function runScenario(name:string){const d=await new Driver().setup();try{await scenarios[name]!(d);return {name,pass:true,...await d.trace()};}finally{await d.db.close();}}

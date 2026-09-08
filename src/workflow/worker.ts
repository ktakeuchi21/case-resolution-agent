import { randomUUID } from 'node:crypto';
import type { Database,Scope } from '../db/database.ts';
import { scoped } from '../db/database.ts';
import { WorkflowEngine } from './engine.ts';
import type { ExecutionOptions } from './engine.ts';
import type { EffectAdapter } from './adapters.ts';
/** One bounded poll, no daemon/autostart. Scan is a hint; every claim/dispatch rechecks durable state. */
export class WorkflowWorker {
 readonly db:Database;readonly scope:Scope;readonly engine:WorkflowEngine;readonly adapter:EffectAdapter;
 constructor(db:Database,scope:Scope,engine:WorkflowEngine,adapter:EffectAdapter){this.db=db;this.scope=scope;this.engine=engine;this.adapter=adapter;}
 async runDue(now:string){
  const due=await this.db.transaction(this.scope,async c=>(await c.query("SELECT workflow_id,body->>'id' id FROM pathway.wf_timers WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND body->>'status' IN ('pending','leased') AND (body->>'dueAt')::timestamptz <= $4::timestamptz ORDER BY body->>'dueAt',body->>'id' LIMIT 100",[...scoped(this.scope),now])).rows);
  const results=[];for(const timer of due){
   const lease=randomUUID();const claim=await this.engine.execute('agent.sc01',{id:lease,workflowId:timer.workflow_id,type:'acquire_timer',timerId:timer.id});
   if(claim.status!=='accepted'){results.push(claim);continue;}
   results.push(await this.engine.execute('agent.sc01',{id:timer.id+'.fire.'+lease,workflowId:timer.workflow_id,type:'fire_timer',timerId:timer.id,leaseToken:lease},this.options));
  }return results;
 }
 options:ExecutionOptions={};
 async runOutbox(){
  const due=await this.db.transaction(this.scope,async c=>(await c.query("SELECT o.workflow_id,o.body FROM pathway.wf_outbox o JOIN pathway.wf_instances i USING(workspace,tenant,environment,workflow_id) WHERE o.workspace=$1 AND o.tenant=$2 AND o.environment=$3 AND ((o.body->>'status' IN ('queued','failed') AND i.snapshot->>'state' IN ('OUTREACH_QUEUED','TRANSFER_QUEUED')) OR o.body->>'status' IN ('attempted','unknown')) ORDER BY o.body->>'createdAt',o.body->>'id' LIMIT 100",scoped(this.scope))).rows);
  const results=[];for(const e of due){
   if(['attempted','unknown'].includes(e.body.status))results.push(await this.engine.reconcile('agent.sc01',e.workflow_id,e.body.id,randomUUID(),this.adapter));
   else{
    const attempt=await this.engine.prepareDispatch('agent.sc01',e.workflow_id,e.body.id,randomUUID(),this.options);results.push(attempt);
    if(attempt.status==='accepted'&&attempt.snapshot.effects.find(a=>a.id===e.body.id)?.status==='attempted'&&['OUTREACH_QUEUED','TRANSFER_QUEUED'].includes(attempt.snapshot.state))results.push(await this.engine.dispatch('agent.sc01',e.workflow_id,e.body.id,randomUUID(),this.adapter,this.options));
   }
  }return results;
 }
}

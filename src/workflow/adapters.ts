import type { PoolClient } from 'pg';
import { Database,insert,scoped,validateRow } from '../db/database.ts';
import type { Scope } from '../db/database.ts';
import { hash } from '../integrity.ts';
import { Command,Receipt } from './contracts.ts';
import type { Effect } from './contracts.ts';
export interface EffectAdapter {
 dispatch(workflowId:string,effect:Effect,now:string):Promise<Receipt>;
 reconcile(workflowId:string,effect:Effect):Promise<Receipt|null>;
}
/** Independent commit represents a simulated remote system, not a real CRM/email integration. */
export class SimulatedEffectAdapter implements EffectAdapter {
 readonly db:Database;readonly scope:Scope;readonly outcome:Receipt['outcome'];
 constructor(db:Database,scope:Scope,outcome:Receipt['outcome']='delivered'){this.db=db;this.scope=scope;this.outcome=outcome;}
 async dispatch(workflowId:string,effect:Effect,now:string){return this.db.transaction(this.scope,async c=>{
  const prior=await this.latest(c,workflowId,effect);
  if(prior?.outcome==='delivered'||prior?.outcome==='rejected')return prior;
  const receipt=Receipt.parse({id:effect.id+'.receipt.'+effect.attempts,effectId:effect.id,workflowId,payloadHash:hash(effect.payload),outcome:this.outcome,timestamp:now,provider:'deterministic-simulation-v1'});
  await insert(c,this.scope,'wf_receipts',receipt.id,receipt,'receiver.sc01');return receipt;
 },false);}
 async reconcile(workflowId:string,effect:Effect){return this.db.transaction(this.scope,c=>this.latest(c,workflowId,effect),false);}
 private async latest(c:PoolClient,workflowId:string,effect:Effect){
  const r=await c.query("SELECT body,body_hash FROM pathway.wf_receipts WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND body->>'workflowId'=$4 AND body->>'effectId'=$5 ORDER BY created_at DESC,id DESC LIMIT 1",[...scoped(this.scope),workflowId,effect.id]);
  if(!r.rowCount)return null;const p=validateRow(r.rows[0],Receipt);if(p.payloadHash!==hash(effect.payload))throw new Error('ADAPTER_PAYLOAD_MISMATCH');return p;
 }
}
// Ports translate trusted integration envelopes to typed commands. Authentication stays server-side.
export interface DocumentReceiptAdapter { receive(input:unknown):Extract<Command,{type:'document'}> }
export interface ReceivingAcknowledgmentAdapter { receive(input:unknown):Extract<Command,{type:'ack'}> }
export interface HumanDecisionAdapter { resolve(input:unknown):Extract<Command,{type:'resolve'}> }
export const simulatedDocumentReceipt:DocumentReceiptAdapter={receive(input){const c=Command.parse(input);if(c.type!=='document')throw new Error('DOCUMENT_ENVELOPE');return c;}};
export const simulatedAcknowledgment:ReceivingAcknowledgmentAdapter={receive(input){const c=Command.parse(input);if(c.type!=='ack')throw new Error('ACK_ENVELOPE');return c;}};
export const simulatedHumanDecision:HumanDecisionAdapter={resolve(input){const c=Command.parse(input);if(c.type!=='resolve')throw new Error('HUMAN_ENVELOPE');return c;}};
export interface ScheduleAdapter { nextBusinessDay(now:string):string; inOfficeHours(now:string):boolean }
// Deliberately bounded fixture calendar; fails outside September 2026 rather than assuming future DST/holidays.
function local(now:string){const t=new Date(now);if(now.slice(0,7)!=='2026-09')throw new Error('OUTSIDE_FIXTURE_CALENDAR');return new Date(t.getTime()-6*3600_000);}
export const septemberCalendar:ScheduleAdapter={
 inOfficeHours(now){const d=local(now);return d.getUTCDay()>0&&d.getUTCDay()<6&&d.toISOString().slice(0,10)!=='2026-09-07'&&d.getUTCHours()>=9&&d.getUTCHours()<17;},
 nextBusinessDay(now){const d=local(now);do{d.setUTCDate(d.getUTCDate()+1);}while(d.getUTCDay()===0||d.getUTCDay()===6||d.toISOString().slice(0,10)==='2026-09-07');
  d.setUTCHours(10,0,0,0);const result=new Date(d.getTime()+6*3600_000).toISOString();local(result);return result;}
};

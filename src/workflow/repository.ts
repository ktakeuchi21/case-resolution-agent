import type { PoolClient } from 'pg';
import { Database,insert,scoped,validateRow } from '../db/database.ts';
import type { Scope } from '../db/database.ts';
import { loadRegistry } from '../db/registry.ts';
import { hash } from '../integrity.ts';
import { Grant,Revocation,Step,Snapshot } from './contracts.ts';
export async function timeline(c:PoolClient,s:Scope,id:string){
 const rows=await c.query('SELECT body,body_hash FROM pathway.wf_steps WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND workflow_id=$4 ORDER BY revision',[...scoped(s),id]);
 const steps=rows.rows.map(r=>validateRow(r,Step));
 for(let i=0;i<steps.length;i++){
  const p=steps[i]!;if(p.revision!==i+1||p.snapshot.revision!==p.revision||p.workflowId!==id||p.snapshot.id!==id||p.previousHash!==(i?hash(steps[i-1]):null))throw new Error('WORKFLOW_JOURNAL_INTEGRITY');
 }
 return steps;
}
export async function grant(c:PoolClient,s:Scope,id:string){
 const r=await c.query('SELECT body,body_hash FROM pathway.wf_grants WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(s),id]);
 if(!r.rowCount)throw new Error('WORKFLOW_GRANT_MISSING');return validateRow(r.rows[0],Grant);
}
export async function grantActive(c:PoolClient,s:Scope,g:Grant,now:string){
 const r=await c.query('SELECT body,body_hash FROM pathway.wf_revocations WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND grant_id=$4',[...scoped(s),g.id]);
 r.rows.forEach(x=>validateRow(x,Revocation));
 return !r.rowCount&&Date.parse(now)>=Date.parse(g.activeFrom)&&Date.parse(now)<Date.parse(g.expiresAt);
}
export class WorkflowRepository {
 readonly db:Database;readonly scope:Scope;
 constructor(db:Database,scope:Scope){this.db=db;this.scope=scope;}
 async provision(actor:string,input:unknown){const g=Grant.parse(input);return this.db.transaction(this.scope,async c=>{
  const r=await loadRegistry(c,this.scope),u=r.user(actor);
  if(this.scope.environment!=='governed'||actor!==g.issuedBy||!u.roles.includes('publisher')||!r.user(g.knowledgeActor).caseIds.includes(g.caseId))throw new Error('GRANT_ISSUER_DENIED');
  return insert(c,this.scope,'wf_grants',g.id,g,actor);
 });}
 async revoke(actor:string,id:string,now:string){return this.db.transaction(this.scope,async c=>{
  const r=await loadRegistry(c,this.scope);if(actor!=='publisher'||!r.user(actor).roles.includes('publisher'))throw new Error('GRANT_ISSUER_DENIED');
  await grant(c,this.scope,id);const body=Revocation.parse({id:'revoke.'+id,grantId:id,actor,timestamp:now,reason:'GRANT_REVOKED'});return insert(c,this.scope,'wf_revocations',body.id,body,actor);
 });}
 async read(actor:string,id:string){return this.db.transaction(this.scope,async c=>{
  const steps=await timeline(c,this.scope,id);if(!steps.length)throw new Error('WORKFLOW_NOT_FOUND');const g=await grant(c,this.scope,steps[0]!.snapshot.grantId);
  if(![g.office,g.manager,g.supervisor,g.worker].includes(actor as never))throw new Error('WORKFLOW_ACCESS_DENIED');return steps;
 });}
}
export function assertInvariants(s:Snapshot){
 Snapshot.parse(s);
 if(new Set(s.effects.map(e=>e.id)).size!==s.effects.length||new Set(s.inbox.map(i=>i.sourceId)).size!==s.inbox.length)throw new Error('DUPLICATE_LOGICAL_WORK');
 if(s.effects.filter(e=>e.kind==='notification').length>2)throw new Error('CADENCE_EXCEEDED');
 if(s.state==='PA_PENDING'&&(s.dependency!=='resolved'||!s.completedAt||!s.documentHash||!s.approval||!s.effects.some(e=>e.kind==='transfer'&&e.status==='acknowledged'&&e.payload.documentHash===s.documentHash)))throw new Error('FALSE_COMPLETION');
 if(s.state!=='PA_PENDING'&&(s.dependency==='resolved'||s.completedAt))throw new Error('FALSE_COMPLETION');
 for(const e of s.effects)if(['queued','attempted','delivered','acknowledged'].includes(e.status)&&!e.authorizations.length)throw new Error('UNAUTHORIZED_EFFECT');
 if(['PA_PENDING','CANCELLED','ESCALATED','FAILED'].includes(s.state)&&s.timers.some(t=>['pending','leased'].includes(t.status)))throw new Error('TERMINAL_TIMER');
}

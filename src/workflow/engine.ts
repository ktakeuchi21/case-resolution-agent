import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { Timestamp,EvidenceRecord } from '../contracts.ts';
import { Database,insert,scoped,validateRow } from '../db/database.ts';
import type { Scope } from '../db/database.ts';
import { PersistentRetrieval } from '../db/retrieval.ts';
import type { RunOptions } from '../db/retrieval.ts';
import { loadRegistry,caseSelection } from '../db/registry.ts';
import { baseRequest } from '../evaluation.ts';
import { hash } from '../integrity.ts';
import { Command,InternalCommand,Grant,Snapshot,Step,Knowledge,Authorization,Approval,Receipt,terminal } from './contracts.ts';
import type { State,Effect } from './contracts.ts';
import { timeline,grant,grantActive,assertInvariants } from './repository.ts';
import { septemberCalendar } from './adapters.ts';
import type { EffectAdapter,ScheduleAdapter } from './adapters.ts';

export interface ExecutionOptions { retrieval?:RunOptions;afterLock?:()=>Promise<void> }
interface Context { c:PoolClient;s:Snapshot;g:Grant;now:string;actor:string;commandId:string;events:Step['events'];options:ExecutionOptions }
export class WorkflowEngine {
 readonly db:Database;readonly scope:Scope;readonly clock:()=>string;readonly calendar:ScheduleAdapter;
 constructor(db:Database,scope:Scope,clock:()=>string,calendar:ScheduleAdapter=septemberCalendar){this.db=db;this.scope=scope;this.clock=clock;this.calendar=calendar;}
 async execute(actor:string,input:unknown,options:ExecutionOptions={}){
  const command=Command.parse(input);return this.commit(actor,command,options,async x=>this.handle(x,command));
 }
 private event(x:Context,type:Step['events'][number]['type'],subjectId=x.s.id,reason=''){x.events.push({type,subjectId,reason,timestamp:x.now});}
 private state(x:Context,state:State){if(x.s.state!==state){this.event(x,'state_changed',x.s.id,x.s.state+' -> '+state);x.s.state=state;}}
 private cancelTimers(x:Context,all=false){for(const t of x.s.timers)if((all||t.kind==='follow_up')&&['pending','leased'].includes(t.status)){t.status='cancelled';this.event(x,'timer_cancelled',t.id);}}
 private timer(x:Context,kind:Snapshot['timers'][number]['kind'],subjectId:string){
  const t={id:x.commandId+'.timer.'+kind+'.'+subjectId,kind,subjectId,dueAt:this.calendar.nextBusinessDay(x.now),status:'pending' as const,leaseToken:null,leaseUntil:null};x.s.timers.push(t);this.event(x,'timer_created',t.id,t.dueAt);return t;
 }
 private task(x:Context,kind:Snapshot['tasks'][number]['kind'],reason:string,resumeState=x.s.state){
  const existing=x.s.tasks.find(t=>t.kind===kind&&t.status==='open');if(existing)return existing;
  const options:Snapshot['tasks'][number]['options']=kind==='verification'?['verify_and_approve','reject']:kind==='clarification'?['release_collection','escalate']:kind==='authority'?['retry','escalate']:['escalate'];
  const t:Snapshot['tasks'][number]={id:x.commandId+'.task.'+kind,kind,reason,caseState:x.s.state,
   question:kind==='verification'?'Does this exact synthetic package match N-101, and do you approve transfer to the named receiver?':kind==='clarification'?'Has the assigned office clarified the requested document so collection may resume?':'Resolve the named blocker through its authorized process; retry cannot override governance.',
   evidenceIds:x.s.knowledge.map(k=>k.evidenceId),actionsTaken:x.s.effects.map(e=>({effectId:e.id,status:e.status})),options,
   assignedTo:kind==='verification'?x.g.office:kind==='exception'?x.g.supervisor:x.g.manager,requiredRole:kind==='verification'?'office_verifier':kind==='exception'?'supervisor':'case_manager',
   dueAt:this.calendar.nextBusinessDay(x.now),resumeState,resumeInstructions:'Recheck current knowledge and grants. Resume '+resumeState+'; preserve completed effect IDs.',status:'open',createdAt:x.now,createdBy:x.actor};
  x.s.tasks.push(t);this.event(x,'human_task_created',t.id,reason);if(kind!=='exception')this.timer(x,'human_due',t.id);return t;
 }
 private stopWork(x:Context){this.cancelTimers(x,true);for(const e of x.s.effects)if(['proposed','authorized','queued'].includes(e.status)){e.status='cancelled';this.event(x,'effect_cancelled',e.id);}}
 private pause(x:Context,reasons:string[]){
  if(x.s.state!=='PAUSED')x.s.resumeState=x.s.state;x.s.pauseReasons=[...new Set(reasons)];this.cancelTimers(x);this.state(x,'PAUSED');this.event(x,'paused',x.s.id,reasons.join(','));this.task(x,'authority',reasons.join(','),x.s.resumeState);
 }
 private escalate(x:Context,reason:string,failed=false){this.stopWork(x);for(const t of x.s.tasks)if(t.status==='open')t.status='cancelled';this.state(x,failed?'FAILED':'ESCALATED');this.event(x,'escalated',x.s.id,reason);this.task(x,'exception',reason);}
 private require(value:unknown,reason:string):asserts value {if(!value)throw new Error(reason);}
 private async knowledge(x:Context,transfer=false){
  const acknowledgment=x.options.retrieval?.acknowledgment;
  this.require(!acknowledgment||!!acknowledgment.policyId||acknowledgment.actorId===x.actor,'DEGRADED_ACK_ACTOR_MISMATCH');
  const result=await new PersistentRetrieval(this.db,this.scope,()=>x.now).runInTransaction(x.c,x.g.knowledgeActor,
   baseRequest({...caseSelection(await loadRegistry(x.c,this.scope),x.s.caseId),id:x.commandId+'.knowledge.'+x.s.knowledge.length,requestedAction:transfer?'transfer_document':'recommend_document'}),x.options.retrieval);
  this.require(!result.historical,'HISTORICAL_EVIDENCE_NOT_AUTHORITY');
  const r=result.record;const k=Knowledge.parse({evidenceId:r.id,runId:result.run.id,timestamp:r.timestamp,mode:result.run.effectiveMode,degraded:!!result.run.acknowledgment,
   releases:r.selectedReleases,passages:r.evidenceUsed,support:r.support,applicability:r.applicability,communication:r.communication,action:r.action});
  x.s.knowledge.push(k);this.event(x,'knowledge_checked',r.id,result.run.reasonCodes.join(','));
  if(r.support.status!=='supported'||r.applicability.status!=='applicable'||r.communication.status!=='allowed'||r.action.status!==(transfer?'requires_approval':'allowed')){
   this.pause(x,[...r.action.reasonCodes,...r.applicability.reasonCodes]);return null;
  }
  if(!await grantActive(x.c,this.scope,x.g,x.now)){this.pause(x,['GRANT_INACTIVE']);return null;}return k;
 }
 private async authorize(x:Context,e:Effect){
  const k=await this.knowledge(x,e.kind==='transfer');if(!k)return false;
  if(!this.calendar.inOfficeHours(x.now)){this.pause(x,['OUTSIDE_OFFICE_HOURS']);return false;}
  let approvalId:string|null=null;
  if(e.kind==='notification'){
   this.require(e.payload.template===x.g.template&&e.payload.recipient===x.g.notificationRecipient&&e.payload.documentHash===null,'TEMPLATE_SCOPE_DENIED');
   this.require(x.s.effects.filter(a=>a.kind==='notification').length<=x.g.maxReminders,'CADENCE_EXCEEDED');
  }else{
   const a=x.s.approval;
   const boundEvidence=e.authorizations[0]?.evidenceId??x.s.knowledge.at(-2)?.evidenceId;
   if(boundEvidence){
    const rows=await x.c.query('SELECT body,body_hash FROM pathway.evidence WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=ANY($4::text[])',[...scoped(this.scope),[boundEvidence,k.evidenceId]]);
    const records=rows.rows.map(row=>validateRow(row,EvidenceRecord));
    const earlier=records.find(r=>r.id===boundEvidence),current=records.find(r=>r.id===k.evidenceId);
    if(!earlier||!current||hash(earlier.caseContext)!==hash(current.caseContext)){this.pause(x,['CASE_CONTEXT_CHANGED']);return false;}
   }else{this.pause(x,['APPROVAL_BINDING_INVALID']);return false;}
   if(!a||a.id!==e.approvalId||a.documentHash!==x.s.documentHash||a.payloadHash!==hash(e.payload)||a.recipient!==x.g.transferRecipient||a.contentRevision!==x.s.contentRevision||Date.parse(a.expiresAt)<=Date.parse(x.now)){
    this.pause(x,['APPROVAL_BINDING_INVALID']);return false;
   }approvalId=a.id;
  }
  const a=Authorization.parse({id:x.commandId+'.authorization',timestamp:x.now,grantId:x.g.id,evidenceId:k.evidenceId,runId:k.runId,action:e.kind==='notification'?'notify_workspace':'transfer_verified_document',
   communication:'allowed',actionPermission:'allowed',reason:e.kind==='notification'?'EXPLICIT_TEMPLATE_GRANT':'BOUND_HUMAN_APPROVAL',payloadHash:hash(e.payload),contentRevision:x.s.contentRevision,approvalId});
  e.authorizations.push(a);this.event(x,'authorization_checked',e.id,a.reason);return true;
 }
 private async queue(x:Context,kind:Effect['kind']){
  const e:Effect={id:x.s.id+'.'+kind+'.'+(x.s.effects.filter(e=>e.kind===kind).length+1),kind,payload:{caseId:x.s.caseId,recipient:kind==='notification'?x.g.notificationRecipient:x.g.transferRecipient,
   template:kind==='notification'?'workspace-attention-v1':'verified-document-transfer-v1',documentHash:kind==='notification'?null:x.s.documentHash},status:'proposed',authorizations:[],attempts:0,createdAt:x.now,receiptId:null,approvalId:kind==='transfer'?x.s.approval?.id??null:null};
  x.s.effects.push(e);this.event(x,'effect_proposed',e.id);
  // Proposal becomes a commitment only after independent current authorization.
  if(!await this.authorize(x,e)){x.s.effects.pop();return;}
  e.status='authorized';this.event(x,'effect_authorized',e.id);e.status='queued';this.event(x,'effect_queued',e.id);
  if(!x.s.identifiedAt){x.s.identifiedAt=x.now;x.s.dependency='open';this.event(x,'dependency_identified');}
  this.state(x,kind==='notification'?'OUTREACH_QUEUED':'TRANSFER_QUEUED');
 }
 private async handle(x:Context,c:Command){
  const s=x.s,g=x.g;
  const privileged=['start','assess','acquire_timer','fire_timer'].includes(c.type);
  if(privileged)this.require(x.actor===g.worker,'WORKER_REQUIRED');
  if(c.type==='document')this.require(x.actor===g.office,'OFFICE_REQUIRED');
  if(c.type==='ack')this.require(x.actor===g.receiver,'RECEIVER_REQUIRED');
  if(c.type==='ambiguity'||c.type==='cancel')this.require([g.office,g.manager,g.supervisor].includes(x.actor as never),'HUMAN_REQUIRED');
  if(c.type==='document'||c.type==='ack'){
   const {id:_id,workflowId:_wf,...payload}=c;const fp=hash(payload),old=s.inbox.find(e=>e.sourceId===c.sourceId);
   if(old){this.require(old.fingerprint===fp,'INBOUND_ID_COLLISION');this.event(x,'duplicate_suppressed',c.sourceId,'inbound');return;}
  }
  const acceptingException=c.type==='resolve'&&['ESCALATED','FAILED'].includes(s.state)&&s.tasks.some(t=>t.id===c.taskId&&t.kind==='exception'&&t.status==='open');
  this.require(!terminal(s.state)||acceptingException,'TERMINAL_WORKFLOW');
  switch(c.type){
   case 'start':this.event(x,'case_received');break;
   case 'assess':this.require(s.state==='RECEIVED','INVALID_TRANSITION');await this.queue(x,'notification');break;
   case 'ambiguity':
    this.require(['AWAITING_RESPONSE','VERIFICATION_REQUIRED'].includes(s.state),'INVALID_TRANSITION');s.resumeState=s.state;this.cancelTimers(x);this.state(x,'PAUSED');s.pauseReasons=[c.reason];this.event(x,'paused',s.id,c.reason);this.task(x,'clarification',c.reason,s.resumeState);break;
   case 'document':{
    this.require(s.state==='AWAITING_RESPONSE','INVALID_TRANSITION');s.contentRevision++;s.documentHash=c.documentHash;s.approval=null;this.cancelTimers(x);this.state(x,'VERIFICATION_REQUIRED');this.event(x,'document_received',c.sourceId);this.task(x,'verification','DOCUMENT_NOT_VERIFIED');break;
   }
   case 'resolve':{
    const t=s.tasks.find(t=>t.id===c.taskId);this.require(t&&t.status==='open','TASK_NOT_OPEN');this.require(t.assignedTo===x.actor,'TASK_ACTOR_DENIED');this.require(t.options.includes(c.option),'TASK_OPTION_DENIED');
    this.require((t.kind==='verification'&&s.state==='VERIFICATION_REQUIRED')||s.state==='PAUSED'||(t.kind==='exception'&&['ESCALATED','FAILED'].includes(s.state)),'TASK_STATE_CHANGED');
    if(c.option==='verify_and_approve')this.require(c.documentHash===s.documentHash&&c.recipient===g.transferRecipient,'APPROVAL_BINDING_INVALID');
    t.status='resolved';for(const timer of s.timers)if(timer.subjectId===t.id&&['pending','leased'].includes(timer.status)){timer.status='cancelled';this.event(x,'timer_cancelled',timer.id);}
    s.decisions.push({id:c.id+'.decision',taskId:t.id,actor:x.actor,option:c.option,timestamp:x.now,documentHash:c.documentHash??null,recipient:c.recipient??null});this.event(x,'human_decision',t.id,c.option);
    if(t.kind==='exception')break; // Accept exception ownership; no operational resumption.
    if(['escalate','reject'].includes(c.option)){this.escalate(x,'HUMAN_'+c.option.toUpperCase());break;}
    if(c.option==='verify_and_approve'){
     s.approval=Approval.parse({id:c.id+'.approval',actor:x.actor,documentHash:c.documentHash,payloadHash:hash({caseId:s.caseId,recipient:g.transferRecipient,template:'verified-document-transfer-v1',documentHash:s.documentHash}),
      recipient:g.transferRecipient,contentRevision:s.contentRevision,approvedAt:x.now,expiresAt:this.calendar.nextBusinessDay(x.now)});
     await this.queue(x,'transfer');
    }else{
     if(t.resumeState!=='RECEIVED'&&!await this.knowledge(x))break;
     s.pauseReasons=[];this.state(x,t.resumeState);this.event(x,'resumed',t.id,t.resumeState);
     if(t.resumeState==='RECEIVED')await this.queue(x,'notification');
     else if(s.state==='VERIFICATION_REQUIRED')this.task(x,'verification','DOCUMENT_NOT_VERIFIED');
     else if((s.state as State)==='AWAITING_RESPONSE')this.timer(x,'follow_up',s.id);
    }break;
   }
   case 'ack':{
    this.require(s.state==='AWAITING_ACK','INVALID_TRANSITION');const e=s.effects.find(e=>e.id===c.effectId);
    this.require(e&&e.kind==='transfer'&&e.status==='delivered'&&e.payload.documentHash===c.documentHash&&c.documentHash===s.documentHash&&e.payload.recipient===c.recipient,'ACK_BINDING_INVALID');
    e.status=c.accepted?'acknowledged':'rejected';this.event(x,c.accepted?'receiving_acknowledged':'effect_rejected',e.id);
    if(c.accepted){s.dependency='resolved';s.completedAt=x.now;this.event(x,'dependency_resolved',s.id,'DOCUMENTATION_RESOLVED_NOT_PAYER_APPROVAL');this.state(x,'PA_PENDING');this.cancelTimers(x,true);}else this.escalate(x,'RECEIVER_REJECTED');break;
   }
   case 'cancel':this.stopWork(x);for(const t of s.tasks)if(t.status==='open')t.status='cancelled';this.state(x,'CANCELLED');this.event(x,'cancelled');break;
   case 'acquire_timer':{
    const t=s.timers.find(t=>t.id===c.timerId);this.require(t&&['pending','leased'].includes(t.status),'TIMER_NOT_PENDING');this.require(Date.parse(t.dueAt)<=Date.parse(x.now),'TIMER_NOT_DUE');
    this.require(t.status!=='leased'||!t.leaseUntil||Date.parse(t.leaseUntil)<=Date.parse(x.now),'TIMER_LEASE_ACTIVE');t.status='leased';t.leaseToken=c.id;t.leaseUntil=new Date(Date.parse(x.now)+60_000).toISOString();this.event(x,'timer_acquired',t.id,c.id);break;
   }
   case 'fire_timer':{
    const t=s.timers.find(t=>t.id===c.timerId);this.require(t&&t.status==='leased'&&t.leaseToken===c.leaseToken&&t.leaseUntil&&Date.parse(t.leaseUntil)>Date.parse(x.now),'STALE_TIMER_LEASE');
    t.status='fired';this.event(x,'timer_fired',t.id);
    if(t.kind==='follow_up'){
     this.require(s.state==='AWAITING_RESPONSE','INVALID_TRANSITION');
     if(s.effects.filter(e=>e.kind==='notification').length>=g.maxReminders)this.escalate(x,'NO_RESPONSE_AFTER_TWO_REMINDERS');else await this.queue(x,'notification');
    }else this.escalate(x,t.kind==='ack_due'?'ACK_DEADLINE_MISSED':'HUMAN_SLA_MISSED');break;
   }
  }
  if(c.type==='document'||c.type==='ack'){const {id:_id,workflowId:_wf,...payload}=c;s.inbox.push({sourceId:c.sourceId,kind:c.type,fingerprint:hash(payload),timestamp:x.now});}
 }
 private async commit(actor:string,command:Command|InternalCommand,options:ExecutionOptions,fn:(x:Context)=>Promise<void>){
  this.require(this.scope.environment==='governed','SANDBOX_WORKFLOW_DENIED');
  return this.db.transaction(this.scope,async c=>{
   await options.afterLock?.();const now=Timestamp.parse(this.clock());const steps=await timeline(c,this.scope,command.workflowId),last=steps.at(-1);
   const g=await grant(c,this.scope,last?.snapshot.grantId??(command.type==='start'?command.grantId:''));
   this.require([g.worker,g.office,g.manager,g.supervisor,g.receiver].includes(actor as never),'WORKFLOW_ACCESS_DENIED');
   const fp=hash({actor,command,retrieval:options.retrieval?{mode:options.retrieval.mode??'hybrid',acknowledgment:options.retrieval.acknowledgment??null}:null});
   const prior=steps.find(s=>s.command.id===command.id);
   if(!last)this.require(command.type==='start'&&actor===g.worker&&await grantActive(c,this.scope,g,now),'INVALID_START');
   const initial:Snapshot={id:command.workflowId,definition:'sc01-v1',caseId:g.caseId,grantId:g.id,revision:1,contentRevision:1,state:'RECEIVED',resumeState:'RECEIVED',createdAt:now,updatedAt:now,identifiedAt:null,completedAt:null,accessStatus:'PA_PENDING',dependency:'unassessed',documentHash:null,approval:null,knowledge:[],effects:[],tasks:[],timers:[],decisions:[],inbox:[],pauseReasons:[]};
   const before=last?structuredClone(last.snapshot):initial;this.require(!last||Date.parse(now)>=Date.parse(last.timestamp),'CLOCK_REWIND');
   const x:Context={c,s:structuredClone(before),g,now,actor,commandId:command.id,events:[],options};let status:Step['status']='accepted';
   await c.query('SAVEPOINT command_work');
   try{
    if(prior){this.require(prior.fingerprint===fp,'COMMAND_ID_COLLISION');status='duplicate';this.event(x,'duplicate_suppressed',command.id,'command');}
    else{this.require(!last||command.type!=='start','ALREADY_STARTED');await fn(x);if(x.events.some(e=>e.type==='duplicate_suppressed'))status='duplicate';}
    assertInvariants(x.s);
   }catch(e){
    // Infrastructure/DB failures abort the whole transaction; never label them a product transition.
    if((e as {code?:string}).code)throw e;
    const reason=e instanceof Error?e.message:'CONTRACT_FAILURE';
    if(!/^[A-Z_]+$/.test(reason))throw e;
    await c.query('ROLLBACK TO SAVEPOINT command_work');x.s=before;x.events=[];status='rejected';this.event(x,'command_rejected',command.id,reason);
   }
   x.s.revision=(last?.revision??0)+1;x.s.updatedAt=now;assertInvariants(x.s);
   const step=Step.parse({id:randomUUID(),workflowId:x.s.id,revision:x.s.revision,previousHash:last?hash(last):null,actor,timestamp:now,transactionId:(await c.query('SELECT pg_current_xact_id()::text id')).rows[0].id,
    command,fingerprint:fp,status,events:x.events,snapshot:x.s});
   await insert(c,this.scope,'wf_steps',step.id,step,actor);
   for(const k of step.snapshot.knowledge)await c.query('INSERT INTO pathway.wf_knowledge_links VALUES($1,$2,$3,$4,$5,$6)',[...scoped(this.scope),step.id,k.runId,k.evidenceId]);
   return step;
  });
 }
 async prepareDispatch(actor:string,workflowId:string,effectId:string,id:string,options:ExecutionOptions={}){
  const command=InternalCommand.parse({type:'prepare_dispatch',id,workflowId,effectId});return this.commit(actor,command,options,async x=>{
   this.require(actor===x.g.worker,'WORKER_REQUIRED');this.require(['OUTREACH_QUEUED','TRANSFER_QUEUED'].includes(x.s.state),'INVALID_TRANSITION');
   const e=x.s.effects.find(e=>e.id===effectId);this.require(e&&['queued','failed'].includes(e.status),'EFFECT_NOT_QUEUED');
   if(e.attempts>=2){this.escalate(x,'RETRY_EXHAUSTED',true);return;}
   if(!await this.authorize(x,e))return;
   if(e.attempts)this.event(x,'retry_scheduled',e.id,'KNOWN_NOT_DELIVERED_ONLY');e.attempts++;e.status='attempted';this.event(x,'effect_attempted',e.id);
  });
 }
 async dispatch(actor:string,workflowId:string,effectId:string,id:string,adapter:EffectAdapter,options:ExecutionOptions&{crashAfterDispatch?:boolean}={}){
  return this.commit(actor,InternalCommand.parse({type:'dispatch',id,workflowId,effectId}),options,async x=>{
   this.require(actor===x.g.worker,'WORKER_REQUIRED');this.require(['OUTREACH_QUEUED','TRANSFER_QUEUED'].includes(x.s.state),'INVALID_TRANSITION');
   const e=x.s.effects.find(e=>e.id===effectId);this.require(e&&e.status==='attempted','EFFECT_NOT_ATTEMPTED');
   // Attempt was committed earlier. Hold the governance lock through simulated remote acceptance.
   if(!await this.authorize(x,e))return;
   const receipt=await adapter.dispatch(workflowId,e,x.now);
   if(options.crashAfterDispatch)throw new Error('Simulated process crash after independent adapter commit');
   this.settle(x,e,receipt,false);
  });
 }
 async reconcile(actor:string,workflowId:string,effectId:string,id:string,adapter:EffectAdapter){
  return this.commit(actor,InternalCommand.parse({type:'reconcile',id,workflowId,effectId}),{},async x=>{
   this.require(actor===x.g.worker,'WORKER_REQUIRED');const e=x.s.effects.find(e=>e.id===effectId);this.require(e&&['attempted','unknown'].includes(e.status),'EFFECT_NOT_UNCERTAIN');
   e.status='unknown';this.event(x,'effect_unknown',e.id);const r=await adapter.reconcile(workflowId,e);
   if(!r){if(!terminal(x.s.state))this.escalate(x,'UNRESOLVED_DELIVERY_STATUS');return;}
   this.settle(x,e,r,true);
  });
 }
 private settle(x:Context,e:Effect,input:Receipt,reconciled:boolean){
  const r=Receipt.parse(input);this.require(r.workflowId===x.s.id&&r.effectId===e.id&&r.payloadHash===hash(e.payload),'RECEIPT_BINDING_INVALID');
  e.receiptId=r.id;e.status=r.outcome==='delivered'?'delivered':r.outcome==='rejected'?'rejected':'failed';
  this.event(x,reconciled?'effect_reconciled':r.outcome==='delivered'?'effect_delivered':r.outcome==='rejected'?'effect_rejected':'effect_failed',e.id,r.outcome);
  // Reconciliation records an earlier fact; it never authorizes another external effect.
  if(terminal(x.s.state)||x.s.state==='PAUSED')return;
  if(r.outcome==='rejected'){this.escalate(x,'ADAPTER_REJECTED');return;}
  if(r.outcome==='not_delivered'){if(e.attempts>=2)this.escalate(x,'RETRY_EXHAUSTED',true);return;}
  this.state(x,e.kind==='notification'?'AWAITING_RESPONSE':'AWAITING_ACK');this.timer(x,e.kind==='notification'?'follow_up':'ack_due',e.id);
 }
}

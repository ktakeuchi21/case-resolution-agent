import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { Database,scoped,validateRow,insert } from '../db/database.ts';
import { seed,GovernanceRepository } from '../db/governance.ts';
import { loadRegistry,caseSelection } from '../db/registry.ts';
import { PersistentRetrieval,RunRecord } from '../db/retrieval.ts';
import { EvidenceRecord,Id,Hash,Timestamp } from '../contracts.ts';
import { WorkflowEngine } from '../workflow/engine.ts';
import { WorkflowRepository } from '../workflow/repository.ts';
import { sc01Grant } from '../workflow/fixtures.ts';
import { SimulatedEffectAdapter } from '../workflow/adapters.ts';
import { nextBestAction } from '../workflow/observability.ts';
import { FileEmbeddingCache } from '../providers/embedding.ts';
import { sourceReasons,selectKnowledge } from '../policy.ts';
import { baseRequest,sandboxRequest } from '../evaluation.ts';
import { loadCorpus } from '../registry.ts';
import { hash,manifestDigest,withoutHash,textHash } from '../integrity.ts';
import { generate,GenerationResult } from '../generation/index.ts';
import { HttpError,Sessions } from './session.ts';
import type { Session } from './session.ts';
import { AgentService } from '../agent/service.ts';
import { configuredProviders, providerConfiguration } from '../agent/runtime.ts';
import { buildContext } from '../agent/context.ts';
import { StudioService } from '../studio/service.ts';
export const roles=['office','manager','supervisor','knowledge_reviewer'] as const;
const commands=['assess','dispatch','ambiguity','receive','resolve','ack','checkpoint','cancel','retire','supersede','publish','assign','reset','role'] as const;
export const Action=z.strictObject({action:z.enum(commands),idempotencyKey:Id,taskId:Id.optional(),option:z.enum(['release_collection','verify_and_approve','retry','escalate','reject']).optional(),role:z.enum(roles).optional(),documentHash:Hash.optional(),recipient:z.literal('sim-receiver-101').optional(),releaseId:Id.optional()});
const corpus=loadCorpus();
export const failureProbe='Synthetic retrieval failure probe: no cached vector exists.';
const reviewedQuestions=new Set<string>([...JSON.parse(readFileSync(new URL('../../fixtures/retrieval/gold-v1.json',import.meta.url),'utf8')).queries.map((q:{question:string})=>q.question),baseRequest().question,sandboxRequest().question,failureProbe]);
const Intent=z.strictObject({id:Id,fingerprint:Hash,action:z.string(),timestamp:Timestamp,effectId:Id.nullable(),timerId:Id.nullable(),dueAt:Timestamp.nullable()});
const ChatReceipt=z.strictObject({answer:GenerationResult,record:EvidenceRecord,run:RunRecord,queryHash:Hash,requestHash:Hash});
export const uploadFixtures=corpus.versions.filter(v=>v.id.startsWith('SB-')).map(v=>({name:v.id==='SB-INJECT.v1'?'synthetic-injection-check.txt':'synthetic-note-guide.txt',text:v.originalText,description:v.id==='SB-INJECT.v1'?'Synthetic adversarial document: instructions stay untrusted content.':'Unapproved synthetic replacement: cannot authorize case work.',documentVersionId:v.id}));
export class Application {
 readonly db:Database;readonly sessions:Sessions;readonly cache=new FileEmbeddingCache(fileURLToPath(new URL('../../fixtures/embeddings/',import.meta.url)));
 readonly agent:AgentService;
 readonly studio:StudioService;
 constructor(db:Database,sessions:Sessions,agentProviders?:AgentService['testProviders']){this.db=db;this.sessions=sessions;this.agent=new AgentService(db,sessions,this.cache,agentProviders);this.studio=new StudioService(db,sessions,this.cache);}
 scope(s:Session,environment:'governed'|'sandbox'='governed'){if(!s.workspace)throw new HttpError(409,'Launch a guided demo first.');return {workspace:s.workspace,tenant:'T-DEMO',environment};}
 async intent(scope:ReturnType<Application['scope']>,input:z.infer<typeof Intent>){
  return this.db.transaction(scope,async tx=>{
   const row=(await tx.query('SELECT body,body_hash FROM pathway.audit WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(scope),input.id])).rows[0];
   if(row){const prior=validateRow(row,Intent);if(prior.fingerprint!==input.fingerprint)throw new HttpError(409,'This request ID belongs to a different operation.');return prior;}
   await insert(tx,scope,'audit',input.id,input,'application');return input;
  });
 }
 async item(c:PoolClient,workspace:string,id:string,kind:string,body:unknown,expires=false){
  await c.query("INSERT INTO portfolio.items(workspace,id,kind,body,expires_at) VALUES($1,$2,$3,$4,CASE WHEN $5 THEN clock_timestamp()+interval '4 hours' ELSE NULL END) ON CONFLICT DO NOTHING",[workspace,id,kind,JSON.stringify(body),expires]);
 }
 async start(s:Session,scenario:string,c:PoolClient){
  if(s.reset_count>=5)throw new HttpError(429,'This session has reached its five-demo limit.');
  const workspace='demo.'+s.token_hash.slice(0,32)+'.'+(s.reset_count+1),now='2026-09-10T16:00:00.000Z';
  await this.sessions.reserveWorkspace(workspace);
  await seed(this.db,workspace);const next={...s,workspace,scenario,role:'office' as const,demo_clock:new Date(now),reset_count:s.reset_count+1};
  const repo=new WorkflowRepository(this.db,this.scope(next));await repo.provision('publisher',sc01Grant());
  await new WorkflowEngine(this.db,this.scope(next),()=>now).execute('agent.sc01',{id:'web.start',workflowId:'SC-01',type:'start',grantId:sc01Grant().id});
  await c.query('UPDATE portfolio.sessions SET workspace=$2,scenario=$3,role=$4,demo_clock=$5,reset_count=reset_count+1 WHERE token_hash=$1',[s.token_hash,workspace,scenario,'office',now]);
  return next;
 }
 async view(s:Session,itemClient?:PoolClient){
  const scope=this.scope(s);const timeline=await new WorkflowRepository(this.db,scope).read('avery','SC-01'),workflow=timeline.at(-1)!.snapshot;
  const registry=await new GovernanceRepository(this.db,scope).snapshot();const sandbox=await new GovernanceRepository(this.db,this.scope(s,'sandbox')).snapshot();
  const readRecords=(environment:'governed'|'sandbox')=>this.db.transaction(this.scope(s,environment),async c=>({evidence:(await c.query('SELECT body,body_hash FROM pathway.evidence WHERE workspace=$1 AND tenant=$2 AND environment=$3 ORDER BY sequence DESC LIMIT 60',scoped(this.scope(s,environment)))).rows.map(r=>validateRow(r,EvidenceRecord)),runs:(await c.query('SELECT body,body_hash FROM pathway.runs WHERE workspace=$1 AND tenant=$2 AND environment=$3 ORDER BY sequence DESC LIMIT 60',scoped(this.scope(s,environment)))).rows.map(r=>validateRow(r,RunRecord))}));
  const governedRecords=await readRecords('governed'),sandboxRecords=await readRecords('sandbox');
  const records={evidence:[...governedRecords.evidence,...sandboxRecords.evidence],runs:[...governedRecords.runs,...sandboxRecords.runs]};
  const now=new Date(Math.max(s.demo_clock.getTime(),Date.parse(workflow.updatedAt))).toISOString();
  const findingRequest=baseRequest(caseSelection(registry,'DEMO-101')),findingUser=registry.user('avery'),findingSelection=selectKnowledge(registry,findingUser,findingRequest,now);
  const identifiedEvidence=governedRecords.evidence.find(record=>record.disposition==='answer'&&record.support.status==='supported'&&record.evidenceUsed.some(p=>p.text.includes('does not contain the signed office note'))&&!findingSelection.reasons.length&&record.evidenceUsed.every(p=>{const version=registry.corpus.versions.find(v=>v.id===p.documentVersionId);return version&&!sourceReasons(registry,version,findingUser,findingRequest,findingSelection,now).length;}));
  const dependencyFinding=identifiedEvidence?{status:'identified_from_currently_eligible_evidence',document:'signed office note',evidenceId:identifiedEvidence.id,note:'Evidence identifies the requirement. The workflow journal separately records preparation, authorization, delivery and acknowledgment.'}:null;
  const items=(await (itemClient??this.sessions.db.pool).query('SELECT kind,body FROM portfolio.items WHERE workspace=$1 AND (expires_at IS NULL OR expires_at>clock_timestamp()) ORDER BY created_at',[s.workspace])).rows;
  return {synthetic:true,demoId:s.workspace,scenario:s.scenario,clock:new Date(Math.max(s.demo_clock.getTime(),Date.parse(workflow.updatedAt))).toISOString(),role:s.role,roles,workflow,dependencyFinding,currentAgentContext:buildContext(workflow,null,[]).context,agent:await this.agent.view(s,itemClient,registry,new Date(Math.max(s.demo_clock.getTime(),Date.parse(workflow.updatedAt))).toISOString()),knowledgeStudio:await this.studio.view(s,itemClient),
   timeline:timeline.map(t=>({id:t.id,actor:t.actor,timestamp:t.timestamp,status:t.status,events:t.events,command:{type:t.command.type}})),nextBestAction:nextBestAction(workflow),
   knowledge:{releases:registry.corpus.releases,assignments:registry.corpus.assignments,versions:[...registry.corpus.versions,...sandbox.corpus.versions],documents:[...registry.corpus.documents,...sandbox.corpus.documents],activeAssignmentId:registry.corpus.cases.find(c=>c.id==='DEMO-101')!.assignmentId,events:registry.events,collections:sandbox.corpus.collections,
    uploads:items.filter(i=>i.kind==='upload').map(i=>i.body),studio:items.filter(i=>i.kind==='studio').map(i=>i.body)},...records,answers:items.filter(i=>i.kind==='answer').map(i=>GenerationResult.parse(i.body)),
   limits:{syntheticOnly:true,maxUploadBytes:8192,sessionExpiresAt:s.expires_at.toISOString(),remainingResets:5-s.reset_count,liveModelCallsEnabled:providerConfiguration().enabled},
   questions:[baseRequest().question,'Which clinician-authenticated encounter narrative remains outstanding?','Which signed office note document is requested?',failureProbe]};
 }
 async historicalEvidence(s:Session,input:unknown){
  const id=Id.parse(input);
  for(const environment of ['governed','sandbox'] as const){const scope=this.scope(s,environment);const record=await this.db.transaction(scope,async c=>{const row=(await c.query('SELECT body,body_hash FROM pathway.evidence WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(scope),id])).rows[0];return row?validateRow(row,EvidenceRecord):null;});if(record)return record;}
  throw new HttpError(404,'This evidence record is unavailable in your session.');
 }
 async action(session:Session,input:unknown){const a=Action.parse(input);return this.sessions.exclusive(session,async(s,c)=>{
  const key='action.'+hash({session:s.token_hash,key:a.idempotencyKey}),fingerprint=hash(a);
  if(!s.workspace)throw new HttpError(409,'Launch a guided demo first.');
  const old=(await c.query('SELECT fingerprint,workspace FROM portfolio.requests WHERE session_hash=$1 AND key=$2',[s.token_hash,key])).rows[0];
  if(old){if(old.fingerprint!==fingerprint)throw new HttpError(409,'This request ID belongs to a different action.');if(old.workspace!==s.workspace&&a.action!=='reset')throw new HttpError(409,'That request belongs to a previous demo.');return this.view(s,c);}
  if(s.actions>=150)throw new HttpError(429,'Session action budget reached. Start a fresh session later.');
  const id='web.'+hash({key,action:a.action}).slice(0,32),scope=this.scope(s),repo=new WorkflowRepository(this.db,scope),options={retrieval:{cacheSource:this.cache,embeddingProvider:configuredProviders(this.sessions,s.token_hash).embeddingProvider}};
  const snapshot=(await repo.read('avery','SC-01')).at(-1)!.snapshot;
  s={...s,demo_clock:new Date(Math.max(s.demo_clock.getTime(),Date.parse(snapshot.updatedAt)))};
  const now=s.demo_clock.toISOString(),engine=new WorkflowEngine(this.db,scope,()=>now);
  const actor=s.role==='office'?'avery':s.role==='manager'?'morgan':s.role==='supervisor'?'demo-supervisor':'publisher';
  const requireRole=(...allowed:Session['role'][])=>{if(!allowed.includes(s.role))throw new HttpError(403,'Switch to the assigned synthetic reviewer role for this action.');};
  const execute=async(type:string,extra:Record<string,unknown>={},who=actor)=>{
   const r=await engine.execute(who,{id,workflowId:'SC-01',type,...extra},options);if(r.status==='rejected')throw new HttpError(409,r.events.find(e=>e.type==='command_rejected')?.reason??'This action is not available in the current state.');return r;
  };
  switch(a.action){
   case 'reset':s=await this.start(s,s.scenario,c);break;
   case 'role':if(!a.role)throw new HttpError(400,'Choose a demo role.');await c.query('UPDATE portfolio.sessions SET role=$2 WHERE token_hash=$1',[s.token_hash,a.role]);s={...s,role:a.role};break;
   case 'assess':requireRole('office');await execute('assess',{},'agent.sc01');break;
   case 'dispatch':{
    requireRole('office');const proposed=snapshot.effects.find(e=>['queued','failed','attempted','unknown'].includes(e.status));
    const plan=await this.intent(scope,{id:id+'.intent',fingerprint,action:a.action,timestamp:now,effectId:proposed?.id??null,timerId:null,dueAt:null});
    const effect=snapshot.effects.find(e=>e.id===plan.effectId);if(effect&&['delivered','acknowledged','rejected','cancelled'].includes(effect.status))break;if(!effect)throw new HttpError(409,'No permitted effect is waiting for dispatch.');
    const adapter=new SimulatedEffectAdapter(this.db,scope);
    if(['attempted','unknown'].includes(effect.status))await engine.reconcile('agent.sc01','SC-01',effect.id,id+'.reconcile',adapter);
    else{const prepared=await engine.prepareDispatch('agent.sc01','SC-01',effect.id,id+'.prepare',options);
     if(prepared.status==='accepted'&&prepared.snapshot.state!=='PAUSED')await engine.dispatch('agent.sc01','SC-01',effect.id,id+'.dispatch',adapter,options);
    }break;
   }
   case 'ambiguity':requireRole('office');await execute('ambiguity',{reason:'DOCUMENT_UNCERTAIN'});break;
   case 'receive':requireRole('office');await execute('document',{sourceId:'DOC-101',documentHash:hash('SYNTHETIC SC01 signed-note attestation fixture')});break;
   case 'resolve':{
    requireRole('office','manager','supervisor');if(!a.taskId||!a.option||!snapshot.tasks.some(t=>t.id===a.taskId))throw new HttpError(400,'Choose an existing task and structured response.');
    await execute('resolve',{taskId:a.taskId,option:a.option,...(a.option==='verify_and_approve'?{documentHash:a.documentHash,recipient:a.recipient}:{})});break;
   }
   case 'ack':requireRole('office');await execute('ack',{sourceId:'ACK-101',effectId:snapshot.effects.at(-1)?.id,documentHash:snapshot.documentHash,recipient:'sim-receiver-101',accepted:true},'receiver.sc01');break;
   case 'cancel':requireRole('office','manager','supervisor');await execute('cancel');break;
   case 'checkpoint':{
    requireRole('office');const proposed=snapshot.timers.filter(t=>['pending','leased'].includes(t.status)).sort((a,b)=>a.dueAt.localeCompare(b.dueAt))[0];
    const plan=await this.intent(scope,{id:id+'.intent',fingerprint,action:a.action,timestamp:now,effectId:null,timerId:proposed?.id??null,dueAt:proposed?.dueAt??null});
    const t=snapshot.timers.find(t=>t.id===plan.timerId);if(!t||!plan.dueAt)throw new HttpError(409,'No pending checkpoint.');
    if(['fired','cancelled'].includes(t.status))break;
    const due=new Date(Math.max(Date.parse(plan.dueAt),s.demo_clock.getTime())).toISOString(),worker=new WorkflowEngine(this.db,scope,()=>due);
    const claim=await worker.execute('agent.sc01',{id:id+'.claim',workflowId:'SC-01',type:'acquire_timer',timerId:t.id});
    if(claim.status!=='rejected')await worker.execute('agent.sc01',{id:id+'.fire',workflowId:'SC-01',type:'fire_timer',timerId:t.id,leaseToken:id+'.claim'},options);
    s={...s,demo_clock:new Date(due)};break;
   }
   case 'retire':requireRole('knowledge_reviewer');await new GovernanceRepository(this.db,scope).retire('publisher','K-PA.v2',now,'Portfolio demonstration: authority withdrawn.');break;
   case 'supersede':requireRole('knowledge_reviewer');await new GovernanceRepository(this.db,scope).supersede('publisher','K-PA.v1','K-PA.v2',now);break;
   case 'publish':{
    requireRole('knowledge_reviewer');const r=await new GovernanceRepository(this.db,scope).snapshot();
    const old=r.corpus.releases.find(r=>r.id==='KP-ALDER.2026.09.1')!;
    const request=baseRequest(caseSelection(r,'DEMO-101')),user=r.user('avery'),selection=selectKnowledge(r,user,request,now);
    const versions=old.documentVersionIds.filter(id=>r.corpus.versions.some(v=>v.id===id&&sourceReasons(r,v,user,request,selection,now).length===0));
    if(!versions.length)throw new HttpError(409,'No eligible governed sources remain for publication.');
    const body={...withoutHash(old),id:'KP-ALDER.PORTFOLIO.'+id.slice(-12),version:'portfolio-release-v1',documentVersionIds:versions,passageIds:old.passageIds.filter(id=>r.corpus.passages.some(p=>p.id===id&&versions.includes(p.documentVersionId))),publishedAt:now};
    const release={...body,manifestHash:manifestDigest(body,r.corpus)};await new GovernanceRepository(this.db,scope).publish('publisher',release);await this.item(c,s.workspace!,id,'studio',{id,type:'publication',releaseId:release.id,status:'published',timestamp:now});break;
   }
   case 'assign':{
    requireRole('knowledge_reviewer');if(!a.releaseId)throw new HttpError(400,'Select the exact published release to assign.');
    const assignment=await this.db.transaction(scope,async tx=>{
     const r=await loadRegistry(tx,scope),release=r.corpus.releases.find(r=>r.id===a.releaseId);
     if(!release||!release.id.startsWith('KP-ALDER.PORTFOLIO.'))throw new HttpError(409,'Select a release published in this demonstration.');
     const original=r.corpus.assignments.find(x=>x.id==='AS-101')!;
     const assignment={...original,id:'AS-PORTFOLIO.'+id.slice(-12),releaseIds:[release.id],mandatoryReleaseIds:[release.id]};
     const user=r.user('avery');await insert(tx,scope,'user_revisions',id+'.release-access',{...user,releaseIds:[...new Set([...user.releaseIds,release.id])]},'publisher');
     await new GovernanceRepository(this.db,scope).assignInTransaction(tx,'publisher',assignment,'DEMO-101',now);return assignment;
    });
    await this.item(c,s.workspace!,id,'studio',{id,type:'assignment',assignmentId:assignment.id,releaseIds:assignment.releaseIds,status:'assigned',timestamp:now});break;
   }
  }
  await c.query('INSERT INTO portfolio.requests(session_hash,key,workspace,fingerprint) VALUES($1,$2,$3,$4)',[s.token_hash,key,s.workspace,fingerprint]);
  const next=new Date(s.demo_clock.getTime()+60_000);await c.query('UPDATE portfolio.sessions SET demo_clock=$2,actions=actions+1 WHERE token_hash=$1',[s.token_hash,next]);
  return this.view({...s,demo_clock:next,actions:s.actions+1},c);
 });}
 async chat(session:Session,input:unknown){const data=z.strictObject({question:z.string().trim().min(1).max(500),mode:z.enum(['governed','sandbox']).default('governed'),idempotencyKey:Id}).parse(input);
  return this.sessions.exclusive(session,async(s,c)=>{
   const id='chat.'+hash({workspace:s.workspace,key:data.idempotencyKey}),prior=(await c.query('SELECT body FROM portfolio.items WHERE workspace=$1 AND id=$2',[s.workspace,id])).rows[0];
   if(prior){if(prior.body.requestHash!==hash(data))throw new HttpError(409,'Use a new request ID.');return prior.body;}
   if(s.actions>=150)throw new HttpError(429,'Session action budget reached.');
   if(!reviewedQuestions.has(data.question))throw new HttpError(422,'Choose a supplied synthetic question. Unrecognized visitor text is not stored.');
   const scope=this.scope(s,data.mode),latest=(await new WorkflowRepository(this.db,this.scope(s)).read('avery','SC-01')).at(-1)!.snapshot;
   const now=new Date(Math.max(s.demo_clock.getTime(),Date.parse(latest.updatedAt))).toISOString();
   await this.intent(this.scope(s),{id:id+'.intent',fingerprint:hash(data),action:'chat',timestamp:now,effectId:null,timerId:null,dueAt:null});
   if(data.mode==='sandbox'){
    const uploads=(await c.query("SELECT body FROM portfolio.items WHERE workspace=$1 AND kind='upload' AND expires_at>clock_timestamp()",[s.workspace])).rows;
    if(!uploads.length)throw new HttpError(409,'Upload a permitted synthetic fixture before exploring the sandbox.');
   }
   const uploaded=(await c.query("SELECT body FROM portfolio.items WHERE workspace=$1 AND kind='upload' AND expires_at>clock_timestamp() ORDER BY created_at DESC LIMIT 1",[s.workspace])).rows[0]?.body;
   const response=await this.db.transaction(scope,async tx=>{
    const prior=(await tx.query('SELECT body,body_hash FROM pathway.audit WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(scope),id+'.response'])).rows[0];
    if(prior){const saved=validateRow(prior,ChatReceipt);if(saved.requestHash!==hash(data))throw new HttpError(409,'Use a new request ID.');return saved;}

    const req=data.mode==='governed'?baseRequest({...caseSelection(await loadRegistry(tx,scope),'DEMO-101'),id,question:data.question}):sandboxRequest({id,question:data.question,selectionId:uploaded.collectionId});
    const result=await new PersistentRetrieval(this.db,scope,()=>now).runInTransaction(tx,data.mode==='governed'?'avery':'viewer',req,{cacheSource:this.cache});
    const answer=await generate(result.record,req.question,{clock:()=>now});await insert(tx,scope,'answers',answer.id,answer,data.mode==='governed'?'avery':'viewer');
    const response=ChatReceipt.parse({answer,record:result.record,run:result.run,queryHash:hash(data.question),requestHash:hash(data)});
    await insert(tx,scope,'audit',id+'.response',response,'application');return response;
   });
   await this.item(c,s.workspace!,response.answer.id,'answer',response.answer);
   await this.item(c,s.workspace!,id,'studio',response);await c.query('UPDATE portfolio.sessions SET actions=actions+1,demo_clock=GREATEST(demo_clock,$2) WHERE token_hash=$1',[s.token_hash,now]);return response;
  });
 }
 async upload(session:Session,input:unknown){const data=z.strictObject({name:z.string().min(1).max(100),text:z.string().min(1).max(8192),synthetic:z.literal(true)}).parse(input);
  const fixture=uploadFixtures.find(f=>f.name===data.name&&f.text===data.text);if(!fixture)throw new HttpError(422,'Only the downloadable synthetic TXT fixtures are accepted. Unknown, executable, patient or proprietary files are not stored.');
  return this.sessions.exclusive(session,async(s,c)=>{
   this.scope(s,'sandbox');const rows=await c.query("SELECT count(*)::int n FROM portfolio.items WHERE workspace=$1 AND kind='upload'",[s.workspace]);if(rows.rows[0].n>=3)throw new HttpError(429,'Maximum three uploads per demo.');
   // Real bounded ingestion validates bytes against a reviewed synthetic source, parses text, and binds its immutable canonical version.
   const id='upload.'+hash({name:data.name,text:data.text}),now=new Date().toISOString();
   const scope=this.scope(s,'sandbox'),registry=await new GovernanceRepository(this.db,scope).snapshot(),version=registry.corpus.versions.find(v=>v.id===fixture.documentVersionId)!,document=registry.document(version.documentId),passages=registry.corpus.passages.filter(p=>p.documentVersionId===version.id);
   const collectionId='COL-UPLOAD.'+hash(fixture.name).slice(0,16),collection={id:collectionId,revision:'uploaded-v1',tenantId:'T-DEMO',ownerId:'viewer',mode:'sandbox' as const,name:data.name+' — unapproved sandbox',documentVersionIds:[version.id],expiresAt:'2026-09-11T16:00:00.000Z'};
   await new GovernanceRepository(this.db,scope).ingest('viewer',document,[version],passages,collection);
   await this.db.transaction(scope,async tx=>{const r=await loadRegistry(tx,scope),user=r.user('viewer');if(!user.collectionIds.includes(collectionId))await insert(tx,scope,'user_revisions',id+'.access',{...user,collectionIds:[...user.collectionIds,collectionId]},'viewer');});
   await this.item(c,s.workspace!,id,'upload',{id,name:data.name,status:'parsed',reason:'SYNTHETIC_BYTES_VALIDATED_UNAPPROVED',documentVersionId:fixture.documentVersionId,collectionId,createdAt:now,expiresAt:new Date(Date.now()+4*3600_000).toISOString(),bytes:Buffer.byteLength(data.text),parser:'bounded-utf8-text-v1',textHash:textHash(data.text),stages:['received','synthetic_allowlist_verified','parsed','sandbox_index_available'],approvalStatus:'draft',operationalAuthority:false},true);
   return this.view(s,c);
  });
 }
}

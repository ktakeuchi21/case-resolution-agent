import type { PoolClient } from 'pg';
import { Corpus, KnowledgePackRelease, KnowledgeAssignment, CaseContext, Document, DocumentVersion, CanonicalPassage, Timestamp } from '../contracts.ts';
import { Registry, FIXED_TIME, loadCorpus } from '../registry.ts';
import { hash } from '../integrity.ts';
import { Database, insert, scoped } from './database.ts';
import type { Scope } from './database.ts';
import { DegradedGrant } from './retrieval.ts';
import { loadRegistry, GovernanceEvent } from './registry.ts';

async function event(c:PoolClient,s:Scope,e:GovernanceEvent) {
 const added=await insert(c,s,'events',e.id,GovernanceEvent.parse(e),e.actorId);
 if(added){const transactionId=(await c.query('SELECT pg_current_xact_id()::text AS id')).rows[0].id as string;
  await insert(c,s,'audit','governance.'+e.id,{id:'governance.'+e.id,operationId:e.id,transactionId,transactionOutcome:'committed',event:e},e.actorId);}
}
async function membership(c:PoolClient,s:Scope,r:KnowledgePackRelease) {
 for(const p of r.passageIds)await c.query('INSERT INTO pathway.membership VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[...scoped(s),r.id,p]);
}
async function assignmentLinks(c:PoolClient,s:Scope,a:KnowledgeAssignment) {
 for(const r of a.releaseIds)await c.query('INSERT INTO pathway.assignment_releases VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[...scoped(s),a.id,r]);
}
export async function seed(db:Database,workspace:string,input=loadCorpus()) {
 const full=new Registry(input).corpus,fixtureHash=hash(full);
 const tenants=[...new Set([...full.documents.map(d=>d.provenance.tenantId),...full.users.map(u=>u.tenantId)])];
 for(const tenant of tenants)for(const environment of ['governed','sandbox'] as const) {
  const s={workspace,tenant,environment};
  await db.transaction(s,async c=>{
   const existing=await c.query('SELECT fixture_hash FROM pathway.generations WHERE workspace=$1 AND tenant=$2 AND environment=$3',scoped(s));
   if(existing.rowCount) {if(existing.rows[0].fixture_hash!==fixtureHash)throw new Error('SEED_VERSION_COLLISION');return;}
   await c.query("INSERT INTO pathway.generations(workspace,tenant,environment,fixture_hash,fixture_version) VALUES($1,$2,$3,$4,'phase2c-synthetic-v1')",[...scoped(s),fixtureHash]);
   const documents=full.documents.filter(d=>d.provenance.tenantId===tenant&&d.provenance.mode===environment);
   const versions=full.versions.filter(v=>documents.some(d=>d.id===v.documentId));
   const passages=full.passages.filter(p=>versions.some(v=>v.id===p.documentVersionId));
   const packs=environment==='governed'?full.packs.filter(p=>p.tenantId===tenant):[];
   const releases=full.releases.filter(r=>packs.some(p=>p.id===r.packId));
   const assignments=environment==='governed'?full.assignments.filter(a=>a.tenantId===tenant):[];
   const cases=environment==='governed'?full.cases.filter(a=>a.tenantId===tenant):[];
   const collections=environment==='sandbox'?full.collections.filter(a=>a.tenantId===tenant):[];
   const users=full.users.filter(u=>u.tenantId===tenant);
   const groups={documents,versions,passages,packs,releases,assignments,cases,collections,users};
   for(const [table,rows] of Object.entries(groups))for(const row of rows)await insert(c,s,table,row.id,row,'fixture-seeder');
   for(const r of releases)await membership(c,s,r);
   for(const a of assignments)await assignmentLinks(c,s,a);
   for(const v of versions)if(v.approvalStatus==='approved')await event(c,s,{id:'APPROVAL.'+v.id,type:'approval',targetId:v.id,targetType:'document_version',actorId:v.approvedBy!,timestamp:v.approvedAt!,reason:'Canonical synthetic approval imported',successorId:null});
   // Instantiate after every row has been inserted: Zod plus manifest/canonical-reference checks.
   await loadRegistry(c,s);
  });
 }
 return {workspace,fixtureHash,fixtureVersion:'phase2c-synthetic-v1'};
}
export class GovernanceRepository {
 readonly db:Database; readonly scope:Scope;
 constructor(db:Database,scope:Scope){this.db=db;this.scope=scope;}
 async authorizeDegraded(actor:string,targetActor:string,requestId:string,policyId:string,activeFrom:string,expiresAt:string){
  return this.db.transaction(this.scope,async c=>{
   const r=await loadRegistry(c,this.scope);const u=r.user(actor);r.user(targetActor);
   if(!u.roles.some(x=>x==='publisher'||x==='evaluator')||Date.parse(activeFrom)>=Date.parse(expiresAt))throw new Error('POLICY_AUTHORIZATION_DENIED');
   const grant=DegradedGrant.parse({id:hash({actor:targetActor,requestId,policyId}),actorId:targetActor,policyId,requestId,authorizedBy:actor,activeFrom,expiresAt});
   await insert(c,this.scope,'degraded_grants',grant.id,grant,actor);return grant;
  });
 }
 async snapshot(){return this.db.transaction(this.scope,c=>loadRegistry(c,this.scope));}
 async retire(actor:string,targetId:string,timestamp:string,reason:string,targetType:'document_version'|'release'='document_version',afterLock?:()=>Promise<void>){
  return this.db.transaction(this.scope,async c=>{
   await afterLock?.();const r=await loadRegistry(c,this.scope);r.retire(actor,targetId,timestamp,reason,targetType);
   const e:GovernanceEvent={id:`retire.${targetType}.${targetId}`,type:'retirement',targetType,targetId,actorId:actor,timestamp,reason,successorId:null};
   const prior=r.events.find(x=>x.id===e.id);if(prior)return prior;
   await event(c,this.scope,e);return e;
  });
 }
 async conflict(actor:string,targetId:string,timestamp=FIXED_TIME){
  return this.db.transaction(this.scope,async c=>{
   const r=await loadRegistry(c,this.scope);r.reportConflict(actor,targetId,timestamp);
   const e:GovernanceEvent={id:'conflict.'+targetId,type:'conflict',targetType:'document_version',targetId,actorId:actor,timestamp,reason:'Registered authoritative conflict',successorId:null};
   await event(c,this.scope,e);return e;
  });
 }
 async supersede(actor:string,targetId:string,successorId:string,timestamp:string){
  Timestamp.parse(timestamp);
  return this.db.transaction(this.scope,async c=>{
   const r=await loadRegistry(c,this.scope),u=r.user(actor),a=r.corpus.versions.find(v=>v.id===targetId),b=r.corpus.versions.find(v=>v.id===successorId);
   if(!u.roles.includes('publisher')||!a||!b||a.id===b.id||a.documentId!==b.documentId||b.approvalStatus!=='approved')throw new Error('SUPERSESSION_UNAUTHORIZED');
   const seen=new Set([a.id]);let next:string|null=successorId;
   while(next){if(seen.has(next))throw new Error('SUPERSESSION_CYCLE');seen.add(next);next=r.events.find(e=>e.type==='supersession'&&e.targetId===next)?.successorId??r.corpus.versions.find(v=>v.id===next)?.supersededBy??null;}
   const e:GovernanceEvent={id:'supersede.'+targetId,type:'supersession',targetType:'document_version',targetId,actorId:actor,timestamp,reason:'Approved successor supersedes future retrieval at effective transition',successorId};
   await event(c,this.scope,e);return e;
  });
 }
 async publish(actor:string,input:unknown){
  const release=KnowledgePackRelease.parse(input);
  return this.db.transaction(this.scope,async c=>{
   const r=await loadRegistry(c,this.scope),user=r.user(actor);
   if(this.scope.environment!=='governed'||!user.roles.includes('publisher')||release.publishedBy!==actor||release.status!=='published')throw new Error('PUBLICATION_UNAUTHORIZED');
   const corpus=structuredClone(r.corpus);const prior=corpus.releases.find(x=>x.id===release.id);
   if(prior&&hash(prior)!==hash(release))throw new Error('IMMUTABLE_RELEASE');
   if(!prior)corpus.releases.push(release);new Registry(corpus);
   for(const id of release.documentVersionIds){const v=corpus.versions.find(v=>v.id===id)!;if(v.approvalStatus!=='approved'||r.isRetired(id)||r.supersededAt(v)&&Date.parse(r.supersededAt(v)!)<=Date.parse(release.publishedAt))throw new Error('PUBLICATION_SOURCE_INELIGIBLE');}
   await insert(c,this.scope,'releases',release.id,release,actor);await membership(c,this.scope,release);
   await event(c,this.scope,{id:'publish.'+release.id,type:'publication',targetType:'release',targetId:release.id,actorId:actor,timestamp:release.publishedAt,reason:'Validated immutable release published',successorId:null});return release;
  });
 }
 async assign(actor:string,input:unknown,caseId:string,timestamp=FIXED_TIME){
  return this.db.transaction(this.scope,c=>this.assignInTransaction(c,actor,input,caseId,timestamp));
 }
 async assignInTransaction(c:PoolClient,actor:string,input:unknown,caseId:string,timestamp=FIXED_TIME){
  const a=KnowledgeAssignment.parse(input);
  {
   const r=await loadRegistry(c,this.scope),user=r.user(actor),context=r.corpus.cases.find(x=>x.id===caseId);
   if(!user.roles.includes('publisher')||!context||a.tenantId!==this.scope.tenant||!a.caseIds.includes(caseId))throw new Error('ASSIGNMENT_UNAUTHORIZED');
   if(a.releaseIds.some(id=>r.isRetired(id)||!r.corpus.releases.some(x=>x.id===id&&x.status==='published')))throw new Error('ASSIGNMENT_RELEASE_INVALID');
   const updated=CaseContext.parse({...context,assignmentId:a.id,revision:'assignment.'+a.id});
   const corpus=structuredClone(r.corpus);corpus.assignments=corpus.assignments.filter(x=>x.id!==a.id).concat(a);corpus.cases=corpus.cases.map(x=>x.id===caseId?updated:x);new Registry(corpus);
   await insert(c,this.scope,'assignments',a.id,a,actor);await assignmentLinks(c,this.scope,a);
   await insert(c,this.scope,'case_revisions',caseId+'.'+a.id,updated,actor);
   await event(c,this.scope,{id:'assign.'+caseId+'.'+a.id,type:'assignment',targetType:'assignment',targetId:a.id,actorId:actor,timestamp,reason:'Case/agent/workflow/audience assignment versioned',successorId:null});return updated;
  }
 }
 async ingest(actor:string,document:unknown,versions:unknown[],passages:unknown[],collection?:unknown){
  const d=Document.parse(document),vs=versions.map(v=>DocumentVersion.parse(v)),ps=passages.map(p=>CanonicalPassage.parse(p));
  const col=collection===undefined?null:Corpus.shape.collections.element.parse(collection);
  return this.db.transaction(this.scope,async c=>{
   const r=await loadRegistry(c,this.scope),u=r.user(actor);
   if(d.provenance.tenantId!==this.scope.tenant||d.provenance.mode!==this.scope.environment||
    (this.scope.environment==='governed'?!u.roles.includes('publisher'):d.provenance.ownerId!==actor))throw new Error('INGESTION_UNAUTHORIZED');
   const corpus=structuredClone(r.corpus);
   for(const [key,rows] of [['documents',[d]],['versions',vs],['passages',ps],['collections',col?[col]:[]]] as const){
    for(const row of rows){const list=corpus[key] as {id:string}[];const prior=list.find(x=>x.id===row.id);if(prior&&hash(prior)!==hash(row))throw new Error('IMMUTABLE_INGESTION_COLLISION');if(!prior)list.push(row);}
   }
   new Registry(corpus);
   await insert(c,this.scope,'documents',d.id,d,actor);for(const v of vs)await insert(c,this.scope,'versions',v.id,v,actor);for(const p of ps)await insert(c,this.scope,'passages',p.id,p,actor);if(col)await insert(c,this.scope,'collections',col.id,col,actor);
   const op=hash({document:d,versions:vs,passages:ps,collection:col});
   await insert(c,this.scope,'audit','ingest.'+op,{id:'ingest.'+op,operationId:op,documentId:d.id,sourceVersions:vs.map(v=>v.id),passageIds:ps.map(p=>p.id),reasonCodes:['SYNTHETIC_CANONICAL_IMPORT'],actorId:actor,transactionOutcome:'committed'},actor);
   for(const v of vs)if(v.approvalStatus==='approved')await event(c,this.scope,{id:'APPROVAL.'+v.id,type:'approval',targetId:v.id,targetType:'document_version',actorId:v.approvedBy!,timestamp:v.approvedAt!,reason:'Canonical synthetic approval imported',successorId:null});
   return {operationId:op,documentId:d.id};
  });
 }
}

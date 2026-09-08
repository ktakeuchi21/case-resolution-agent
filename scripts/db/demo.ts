import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Database,scoped } from '../../src/db/database.ts';
import { seed,GovernanceRepository } from '../../src/db/governance.ts';
import { PersistentRetrieval } from '../../src/db/retrieval.ts';
import { loadCorpus,FIXED_TIME } from '../../src/registry.ts';
import { baseRequest,sandboxRequest } from '../../src/evaluation.ts';
import { FileEmbeddingCache } from '../../src/providers/embedding.ts';
import { cachedOnlyProvider } from '../../src/db/vector.ts';
import { artifact } from './parity.ts';

function barrier(){let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return {promise,release};}
async function blocked(db:Database){
 for(let i=0;i<200;i++){
  const r=await db.pool.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())");
  if(r.rows[0].n>0)return true;await new Promise(r=>setTimeout(r,10));
 }
 throw new Error('No blocked transaction observed');
}
export async function restartDemo(){
 const workspace='restart.'+randomUUID(),scope={workspace,tenant:'T-DEMO',environment:'governed' as const};
 let db=new Database();const cacheSource=new FileEmbeddingCache('.local/embeddings'),options={cacheSource,embeddingProvider:cachedOnlyProvider()};
 const steps:unknown[]=[];
 try{
  const seeded=await seed(db,workspace);steps.push({step:1,seeded});
  const corpus=loadCorpus();let governance=new GovernanceRepository(db,scope);
  const release=await governance.publish('publisher',corpus.releases[0]!);
  const assigned=await governance.assign('publisher',corpus.assignments[0]!,'DEMO-101');steps.push({step:2,releaseId:release.id,assignmentId:assigned.assignmentId});
  let service=new PersistentRetrieval(db,scope,()=>FIXED_TIME);
  const initial=await service.run('avery',baseRequest({id:'before'}),options);assert.equal(initial.record.action.status,'allowed');steps.push({step:3,result:initial});
  await db.close();db=new Database();service=new PersistentRetrieval(db,scope,()=>FIXED_TIME);governance=new GovernanceRepository(db,scope);
  const historical=await service.history('avery',initial.record.id);assert.deepEqual(historical,initial.record);steps.push({step:4,repositoriesReconstructed:true,step5:{historicalId:historical.id,recordHash:historical.recordHash,unchanged:true}});
  const retirement=await governance.retire('publisher','K-PA.v2',FIXED_TIME,'Restart demonstration retirement');steps.push({step:6,retirement});
  const after=await service.run('avery',baseRequest({id:'after'}),options);assert.equal(after.record.action.status,'paused');steps.push({step:7,result:after});
  const sandboxScope={...scope,environment:'sandbox' as const};const sb=await new GovernanceRepository(db,sandboxScope).snapshot();
  const doc=sb.corpus.documents.find(d=>d.id==='SB-REPLACEMENT')!,version=sb.corpus.versions.find(v=>v.documentId===doc.id)!;
  await new GovernanceRepository(db,sandboxScope).ingest('viewer',doc,[version],sb.corpus.passages.filter(p=>p.documentVersionId===version.id),sb.corpus.collections[0]);
  const sandbox=await new PersistentRetrieval(db,sandboxScope,()=>FIXED_TIME).run('viewer',sandboxRequest(),options);assert.equal(sandbox.record.action.status,'denied');
  const retry=await service.run('avery',baseRequest({id:'retry'}),options);assert.equal(retry.record.action.status,'paused');steps.push({step:8,sandbox,retry,note:'Idempotently imports the existing canonical synthetic replacement; no fixture mutation or provider calls.'});
  const races=[];
  for(const order of ['retirement-first','evidence-first'] as const){
   const raceWorkspace=workspace+'.'+order;await seed(db,raceWorkspace);const raceScope={...scope,workspace:raceWorkspace};
   const g=new GovernanceRepository(db,raceScope),s=new PersistentRetrieval(db,raceScope,()=>FIXED_TIME);
   const entered=barrier(),commit=barrier();let r;let retired;
   const hook=async()=>{entered.release();await commit.promise;};
   if(order==='retirement-first'){
    const first=g.retire('publisher','K-PA.v2',FIXED_TIME,order,'document_version',hook);await entered.promise;
    const second=s.run('avery',baseRequest(),options);const wasBlocked=await blocked(db).finally(()=>commit.release());retired=await first;r=await second;
    assert(wasBlocked);assert.equal(r.record.action.status,'paused');
   }else{
    const first=s.run('avery',baseRequest(),{...options,afterLock:hook});await entered.promise;
    const second=g.retire('publisher','K-PA.v2',FIXED_TIME,order);const wasBlocked=await blocked(db).finally(()=>commit.release());r=await first;retired=await second;
    assert(wasBlocked);assert.equal(r.record.action.status,'allowed');assert.deepEqual(await s.history('avery',r.record.id),r.record);
   }
   const subsequent=await s.run('avery',baseRequest({id:'subsequent'}),options);assert.equal(subsequent.record.action.status,'paused');
   const lifecycle=await db.transaction(raceScope,async c=>(await c.query("SELECT body FROM pathway.audit WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4",[...scoped(raceScope),'governance.'+retired.id])).rows[0].body);
   races.push({order,blockedWaiterObserved:true,firstCommitted:order==='retirement-first'?'retirement':'evidence',retirement:lifecycle,result:r,subsequent});
  }
  steps.push({step:9,step10:{races,semantics:'Same scope transaction lock; post-lock READ COMMITTED snapshot; evidence inserted atomically and returned only after commit.'}});
  await db.close();db=new Database();service=new PersistentRetrieval(db,scope,()=>FIXED_TIME);
  assert.deepEqual(await service.history('avery',initial.record.id),initial.record);assert((await new GovernanceRepository(db,scope).snapshot()).isRetired('K-PA.v2'));
  assert.deepEqual(await service.history('avery',after.record.id),after.record);steps.push({step:11,repositoriesReconstructedAgain:true,historyIntact:true,activeRetirementPersisted:true});
  return {schemaVersion:'phase2c-restart-concurrency-v1',recordedAt:new Date().toISOString(),workspace,steps,pass:true,additionalProviderCalls:0,limitations:'Repository/pool reconstruction tested; not host crash, power loss, hosted auth or backup restore. All sources and actors synthetic; no actions executed.'};
 }finally{await db.close();}
}
try{const r=await restartDemo();console.log(JSON.stringify({artifact:artifact('restart-concurrency',r),pass:r.pass},null,2));}
catch(e){console.error(e instanceof assert.AssertionError?{code:'DEMO_ASSERTION',message:e.message}:{code:'DEMO_FAILURE',driverCode:(e as {code?:string}).code??'contract_or_cache_failure'});process.exitCode=1;}

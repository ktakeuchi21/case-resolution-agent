import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Database } from '../../src/db/database.ts';
import { GovernanceRepository,seed } from '../../src/db/governance.ts';
import { PersistentRetrieval } from '../../src/db/retrieval.ts';
import { cachedOnlyProvider } from '../../src/db/vector.ts';
import { baseRequest,sandboxRequest,harness,referenceCases,runEvaluations } from '../../src/evaluation.ts';
import { loadCorpus,FIXED_TIME } from '../../src/registry.ts';
import { loadExperiment,prepareQuery } from '../../src/retrieval-benchmark.ts';
import { CachedEmbeddings,FileEmbeddingCache } from '../../src/providers/embedding.ts';
import { LocalSemanticProvider } from '../../src/providers/semantic.ts';
import { LocalLexicalProvider } from '../../src/providers/local-lexical.ts';
import { LocalHybridProvider } from '../../src/providers/hybrid.ts';
import { RetrievalConfiguration } from '../../src/providers/configuration.ts';
import { KnowledgePipeline } from '../../src/pipeline.ts';
import { EvidenceStore } from '../../src/evidence-store.ts';
import { textHash } from '../../src/integrity.ts';
import type { EvidenceRecord } from '../../src/contracts.ts';
import type { RunRecord, DegradedAcknowledgment } from '../../src/db/retrieval.ts';

function ack(id:string,actor:string,now:string):DegradedAcknowledgment{return {actorId:actor,policyId:null,timestamp:now,expiresAt:'2027-01-01T00:00:00Z',reason:'OFFLINE_EXPLICIT',originalRunId:null,scope:'single_request',requestId:id};}
function parity(a:EvidenceRecord,b:EvidenceRecord){
 for(const key of ['eligibleVersionIds','excluded','disposition','authorityFindings','support','applicability','communication','action','evidenceUsed','actionProposal'] as const)assert.deepEqual(a[key],b[key],key);
 assert.deepEqual(a.answer.claims,b.answer.claims);
}
function audit(record:EvidenceRecord){
 const {id,recordHash,...body}=record;const checked=new EvidenceStore().put(body);assert.equal(id,checked.id);assert.equal(recordHash,checked.recordHash);
 assert(record.evidenceUsed.every(p=>textHash(p.text)===p.textHash));
 assert(record.answer.claims.every(c=>c.passageIds.every(id=>record.evidenceUsed.some(p=>p.passageId===id&&p.text.includes(c.text)))));
}
export async function runParity(){
 const db=new Database(),prefix='parity.'+randomUUID(),source=new FileEmbeddingCache('.local/embeddings');
 const original=await runEvaluations();assert(original.summary.allPassed);
 const referenceResults=[];const retrievalResults:{queryId:string;mode:string;pass:boolean;correctOutcome:boolean;rankParity:boolean;liveRankParity:boolean;maxCosineDelta:number;record:EvidenceRecord;run:RunRecord}[]=[];let maxCosineDelta=0;
 try{
  for(const t of referenceCases){
   const h=harness(t.corpus?t.corpus(loadCorpus()):loadCorpus());t.setup?.(h);
   const request=(t.sandbox?sandboxRequest:baseRequest)({id:t.id,...t.request});const actor=t.actor??(t.sandbox?'viewer':'avery');
   const memory=await h.pipeline.run(actor,request),workspace=prefix+'.'+t.id;
   await seed(db,workspace,h.registry.corpus);
   const scope={workspace,tenant:h.registry.user(actor).tenantId,environment:request.mode};
   const g=new GovernanceRepository(db,scope);
   for(const e of h.registry.retirements())await g.retire(e.actorId,e.targetId,e.timestamp,e.reason,e.targetType);
   for(const id of h.registry.conflictVersionIds())await g.conflict('publisher',id,FIXED_TIME);
   const sql=await new PersistentRetrieval(db,scope,()=>memory.timestamp).run(actor,request,{mode:'lexical',acknowledgment:ack(request.id,actor,memory.timestamp)});
   parity(memory,sql.record);audit(sql.record);
   referenceResults.push({id:t.id,pass:true,evidenceId:sql.record.id,runId:sql.run.id,eligible:sql.record.eligibleVersionIds,excluded:sql.record.excluded,disposition:sql.record.disposition});
  }
  const {experiment,queries}=loadExperiment();const live=JSON.parse(readFileSync('artifacts/phase2b-benchmark.json','utf8'));
  for(const q of queries){
   const prepared=prepareQuery(q),workspace=prefix+'.'+q.id;
   await seed(db,workspace,prepared.registry.corpus);
   const scope={workspace,tenant:prepared.registry.user(q.actor).tenantId,environment:prepared.request.mode};
   const g=new GovernanceRepository(db,scope);
   for(const r of prepared.registry.retirements())await g.retire(r.actorId,r.targetId,r.timestamp,r.reason,r.targetType);
   for(const id of prepared.registry.conflictVersionIds())await g.conflict('publisher',id,FIXED_TIME);
   for(const mode of ['lexical','semantic','hybrid'] as const){
    const config=RetrievalConfiguration.parse({mode,embedding:experiment.embedding}),embeddingProvider=cachedOnlyProvider(config.embedding);
    const memoryEmbeddings=new CachedEmbeddings(embeddingProvider,source);
    const sem=new LocalSemanticProvider(memoryEmbeddings,config);
    const provider=mode==='lexical'?new LocalLexicalProvider():mode==='semantic'?sem:new LocalHybridProvider(new LocalLexicalProvider(),sem,config);
    const request={...prepared.request,id:q.id+'.'+mode};
    const memory=await new KnowledgePipeline(prepared.registry,provider,new EvidenceStore(),()=>prepared.now).run(q.actor,request);
    const sql=await new PersistentRetrieval(db,scope,()=>prepared.now).run(q.actor,request,{mode,embeddingProvider,cacheSource:source,...(mode==='lexical'?{acknowledgment:ack(request.id,q.actor,prepared.now)}:{})});
    parity(memory,sql.record);audit(sql.record);
    const orderMemory=memory.retrieved.map(x=>x.passageId),orderSql=sql.record.retrieved.map(x=>x.passageId);
    assert.deepEqual(orderSql,orderMemory,'storage changed ranking');
    const prior=live.arms.find((a:{id:string})=>a.id===mode).runs[0].results.find((r:{id:string})=>r.id===q.id);
    assert.deepEqual(orderSql,prior.record.retrieved.map((r:{passageId:string})=>r.passageId),'storage changed preserved live ranking');
    assert.equal(sql.record.disposition,prior.record.disposition);assert.equal(sql.record.action.status,prior.record.action.status);
    let delta=0,float32ReplayDelta=0;for(let i=0;i<memory.retrieved.length;i++){
     const a=memory.retrieved[i]!,b=sql.record.retrieved[i]!;
     if(a.ranking?.semantic&&b.ranking?.semantic){
      delta=Math.max(delta,Math.abs(a.ranking.semantic.score-b.ranking.semantic.score));
      const qv=(await source.get(b.embedding!.queryVectorKey))!.vector,dv=(await source.get(b.embedding!.documentVectorKey))!.vector;
      let dot=0,nq=0,nd=0;
      for(let j=0;j<qv.length;j++){const x=Math.fround(qv[j]!),y=Math.fround(dv[j]!);dot=Math.fround(dot+Math.fround(x*y));nq=Math.fround(nq+Math.fround(x*x));nd=Math.fround(nd+Math.fround(y*y));}
      const expected=Math.max(-1,Math.min(1,dot/Math.sqrt(nq*nd)));
      float32ReplayDelta=Math.max(float32ReplayDelta,Math.abs(expected-b.ranking.semantic.score));
     }
    }
    // Storage arithmetic tolerance, never a retrieval threshold. Initial 1e-6 failed and is preserved.
    assert(delta<1e-5,`pgvector numerical delta ${delta} on ${q.id}/${mode} exceeds 1e-5`);
    assert(float32ReplayDelta<1e-7,'PostgreSQL difference not explained by verified float32 accumulation');maxCosineDelta=Math.max(maxCosineDelta,delta);
    retrievalResults.push({queryId:q.id,mode,pass:true,correctOutcome:sql.record.disposition===q.expectedDisposition&&sql.record.action.status===q.expectedAction,
     rankParity:true,liveRankParity:true,maxCosineDelta:delta,record:sql.record,run:sql.run});
   }
  }
  return {schemaVersion:'phase2c-parity-v1',recordedAt:new Date().toISOString(),scope:'Replays preserved live vectors; no provider calls. PostgreSQL float4 cosine compared with Phase 2B JS doubles; no ranking differences permitted.',
   numericalAnalysis:{initialTolerance:1e-6,initialFailure:'Q01/semantic, delta 0.0000015454036114137537',acceptedStorageTolerance:1e-5,float32ReplayTolerance:1e-7,explanation:'pgvector v0.8.6 accumulates dot products and norms in float32; independently replayed each SQL score with Math.fround. No query, ranking, fusion, filter, expectation or similarity threshold changed.'},
   frozenGoldHash:experiment.goldSha256,sourceLiveSha256:textHash(readFileSync('artifacts/phase2b-benchmark.json','utf8')),originalReferenceSummary:original.summary,
   referenceResults,retrievalResults,summary:{referencePass:referenceResults.length,retrievalPass:retrievalResults.length,rankingDifferences:0,maxCosineDelta,
    outcomes:Object.fromEntries(['lexical','semantic','hybrid'].map(mode=>[mode,retrievalResults.filter(r=>r.mode===mode&&r.correctOutcome).length])),additionalProviderCalls:0,pass:true}};
 }catch(e){artifact('parity-incomplete',{schemaVersion:'phase2c-parity-incomplete-v1',referenceResults,retrievalResults,maximumCompletedCosineDelta:maxCosineDelta,error:e instanceof assert.AssertionError?e.message:'infrastructure_or_contract_failure'});throw e;}finally{await db.close();}
}
export function artifact(label:string,body:unknown){
 const bytes=JSON.stringify(body,null,2)+'\n',path=`artifacts/phase2c/${label}-${textHash(bytes)}.json`;
 mkdirSync('artifacts/phase2c',{recursive:true});writeFileSync(path,bytes,{flag:'wx',mode:0o444});return path;
}
if(process.argv[1]?.endsWith('/parity.ts')){
 try{const r=await runParity();console.log(JSON.stringify({artifact:artifact('parity',r),summary:r.summary},null,2));}
 catch(e){console.error(e instanceof assert.AssertionError?{code:'PARITY_ASSERTION',operator:e.operator,message:e.message}:{code:'PARITY_INFRASTRUCTURE_FAILURE',driverCode:(e as {code?:string}).code??'contract_or_cache_failure'});process.exitCode=1;}
}

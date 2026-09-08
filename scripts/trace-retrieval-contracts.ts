/** Developer-only trace. Handcrafted unit vectors exercise controls, NEVER semantic quality. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadCorpus, Registry, FIXED_TIME } from '../src/registry.ts';
import { baseRequest, sandboxRequest } from '../src/evaluation.ts';
import { KnowledgePipeline } from '../src/pipeline.ts';
import { EvidenceStore } from '../src/evidence-store.ts';
import { createRetrievalProvider } from '../src/providers/factory.ts';
import { MemoryEmbeddingCache } from '../src/providers/embedding.ts';
import type { EmbeddingProvider } from '../src/providers/embedding.ts';
import { loadExperiment, prepareQuery } from '../src/retrieval-benchmark.ts';
import { canonical } from '../src/integrity.ts';

const corpus=loadCorpus();
const unit: EmbeddingProvider={
  identity:{provider:'unit-fixture',model:'handcrafted-not-semantic',dimensions:2,revision:'v1',normalization:'none-v1'},
  embed:async texts=>({inputTokens:0,vectors:texts.map(text=>{
    const passage=corpus.passages.find(p=>p.text===text);
    return !passage||['K-CEDAR.v1.s1','K-UT.v1.s1'].includes(passage.id)?[1,0]:[0.8,0.6];
  })}),
};
const modes=[];
for(const mode of ['lexical','semantic','hybrid'] as const){
  const {provider}=createRetrievalProvider({mode,embedding:unit.identity},{embeddingProvider:unit,cache:new MemoryEmbeddingCache()});
  const registry=new Registry(corpus),store=new EvidenceStore();const pipeline=new KnowledgePipeline(registry,provider,store,()=>FIXED_TIME);
  const before=await pipeline.run('avery',baseRequest());assert.equal(before.action.status,'allowed');
  const bytes=canonical(before);registry.retire('publisher','K-PA.v2',FIXED_TIME,'contract trace retirement');
  const retired=await pipeline.run('avery',baseRequest({id:'AFTER'}));assert.equal(retired.action.status,'paused');
  const sandbox=await pipeline.run('viewer',sandboxRequest());assert.equal(sandbox.action.status,'denied');
  const retry=await pipeline.run('avery',baseRequest({id:'RETRY'}));assert.equal(retry.action.status,'paused');
  assert.equal(canonical(store.get(before.id,registry.user('avery'))),bytes);
  const scenarios=[];
  for(const q of loadExperiment().queries.filter(q=>['Q16','Q17','Q20','Q22','Q23','Q24','Q25','Q27','Q31','Q32','Q34'].includes(q.id))){
    const h=prepareQuery(q);const record=await new KnowledgePipeline(h.registry,provider,new EvidenceStore(),()=>h.now).run(q.actor,h.request);
    assert.equal(record.disposition,q.expectedDisposition);assert.equal(record.action.status,q.expectedAction);
    scenarios.push({queryId:q.id,scenario:q.category,record});
  }
  const fresh=new Registry(corpus);await provider.index(corpus.passages,fresh.corpusHash);
  const nearCandidates=await provider.search({query:'contract-query',limit:8,universe:{corpusHash:fresh.corpusHash,snapshotHash:fresh.snapshotHash(),passageIds:['K-CEDAR.v1.s1','K-UT.v1.s1','K-PA.v2.s1']}});
  const nearGoverned=await new KnowledgePipeline(fresh,provider,new EvidenceStore(),()=>FIXED_TIME).run('avery',baseRequest({question:'contract-query'}));
  assert(!nearGoverned.retrieved.some(r=>['K-CEDAR.v1','K-UT.v1'].includes(r.documentVersionId)));
  modes.push({mode,provider:provider.descriptor,before,retired,sandbox,retry,history:{unchanged:true,evidenceId:before.id,recordHash:before.recordHash},scenarios,
    constructedCounterexample:{meaning:'Handcrafted vectors deliberately make wrong-payer/state sources closest. This proves filter mechanics, not a learned model result.',nearCandidates,nearGoverned}});
}
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/phase2b-governance-contract-trace.json',JSON.stringify({schemaVersion:'phase2b-unit-contract-trace-v1',
  semanticQualityMeasured:false,liveModelCalls:0,vectorOrigin:'HANDCRAFTED UNIT VECTORS; never used in the retrieval quality benchmark',pass:true,modes},null,2)+'\n');
console.log('PASS: three-mode contract trace; handcrafted vectors, no live semantic quality claim.');

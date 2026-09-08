import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CachedEmbeddings, FileEmbeddingCache, MemoryEmbeddingCache } from '../src/providers/embedding.ts';
import type { EmbeddingIdentity, EmbeddingProvider } from '../src/providers/embedding.ts';
import { OpenAIEmbeddingProvider } from '../src/providers/openai-embedding.ts';
import { LocalSemanticProvider, cosine } from '../src/providers/semantic.ts';
import { LocalHybridProvider, reciprocalRankFusion } from '../src/providers/hybrid.ts';
import { LocalLexicalProvider } from '../src/providers/local-lexical.ts';
import { RetrievalConfiguration } from '../src/providers/configuration.ts';
import { createRetrievalProvider } from '../src/providers/factory.ts';
import type { RetrievalProvider } from '../src/providers/provider.ts';
import { loadCorpus, Registry, FIXED_TIME } from '../src/registry.ts';
import { KnowledgePipeline } from '../src/pipeline.ts';
import { EvidenceStore } from '../src/evidence-store.ts';
import { baseRequest, sandboxRequest, BASE_EVIDENCE } from '../src/evaluation.ts';
import { canonical, textHash } from '../src/integrity.ts';
import { loadExperiment, rankingMetrics, latencySummary, prepareQuery } from '../src/retrieval-benchmark.ts';

// HAND-AUTHORED UNIT VECTORS: mechanics/adversarial contract tests only. Never benchmark semantic quality with these.
const identity: EmbeddingIdentity = { provider: 'unit-fixture', model: 'unit-vectors', dimensions: 2, revision: 'v1', normalization: 'none-v1' };
class UnitEmbeddings implements EmbeddingProvider {
  readonly identity: EmbeddingIdentity = identity;
  texts: string[] = [];
  vector: (text: string) => number[] = () => [1,0];
  async embed(texts: readonly string[]) { this.texts.push(...texts); return { vectors: texts.map(this.vector), inputTokens: texts.length }; }
}
function semantic(unit = new UnitEmbeddings(), patch: Partial<RetrievalConfiguration> = {}) {
  const config = RetrievalConfiguration.parse({ mode: 'semantic', embedding: unit.identity, ...patch });
  const cache = new CachedEmbeddings(unit,new MemoryEmbeddingCache(),() => FIXED_TIME);
  return { provider: new LocalSemanticProvider(cache, config), unit, config, cache };
}
function providers() {
  const s = semantic(); const h = semantic();
  return [new LocalLexicalProvider(), s.provider,
    new LocalHybridProvider(new LocalLexicalProvider(),h.provider,{ ...h.config, mode: 'hybrid' })];
}
const openaiIdentity: EmbeddingIdentity = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 2, revision: 'test', normalization: 'none-v1' };

test('OpenAI adapter sends explicit configuration and validates reordered response, without network', async () => {
  let called = false;
  const transport: typeof fetch = async (url,init) => {
    called = true; assert.equal(url,'https://api.openai.com/v1/embeddings'); assert.equal(init?.redirect,'error');
    assert.deepEqual(JSON.parse(init!.body as string),{ input: ['one','two'], model: openaiIdentity.model, dimensions: 2, encoding_format: 'float' });
    assert.equal((init!.headers as Record<string,string>).Authorization,'Bearer unit-test-key');
    return Response.json({ model: openaiIdentity.model, data: [{ index: 1, embedding: [0,1] },{ index: 0, embedding: [1,0] }], usage: { prompt_tokens: 3,total_tokens: 3 } });
  };
  const provider = new OpenAIEmbeddingProvider(openaiIdentity,'unit-test-key',transport);
  assert.deepEqual(await provider.embed(['one','two']),{ vectors: [[1,0],[0,1]], inputTokens: 3 }); assert(called);
  assert(!JSON.stringify(provider).includes('unit-test-key'));
});
test('OpenAI malformed, wrong-model, missing, duplicated, nonfinite, dimension and zero responses fail closed', async () => {
  const valid = { model: openaiIdentity.model, data: [{ index: 0, embedding: [1,0] }], usage: { prompt_tokens: 1,total_tokens: 1 } };
  for (const bad of [{}, { ...valid, model: 'other' },{ ...valid,data: [] },{ ...valid,data: [...valid.data,...valid.data] },
    { ...valid,data: [{ index: 3,embedding: [1,0] }] },{ ...valid,data: [{ index: 0,embedding: [1] }] },
    { ...valid,data: [{ index: 0,embedding: [0,0] }] },{ ...valid,data: [{ index: 0,embedding: [null,0] }] }]) {
    const p = new OpenAIEmbeddingProvider(openaiIdentity,'test',async () => Response.json(bad));
    await assert.rejects(p.embed(['one']));
  }
});
test('transport and HTTP errors redact provider payloads; no automatic retry', async () => {
  let calls=0;
  const p = new OpenAIEmbeddingProvider(openaiIdentity,'secret-unit',async () => { calls++; return new Response('secret-unit diagnostic',{ status: 429 }); });
  await assert.rejects(p.embed(['one']),e => e instanceof Error && e.message.includes('429') && !e.message.includes('secret-unit'));
  assert.equal(calls,1);
  const failing = new OpenAIEmbeddingProvider(openaiIdentity,'secret-unit',async () => { throw new Error('secret-unit'); });
  await assert.rejects(failing.embed(['one']),/Embedding transport unavailable/);
});
test('missing credentials, invalid mode, out-of-range config and empty embedding inputs fail explicitly', async () => {
  assert.throws(() => createRetrievalProvider({ mode: 'semantic' }),/OPENAI_API_KEY/);
  assert.throws(() => createRetrievalProvider({ mode: 'hybrid' }),/OPENAI_API_KEY/);
  assert.equal(createRetrievalProvider({ mode: 'lexical' }).provider.descriptor.kind,'lexical');
  for (const bad of [{ mode: 'bogus' },{ rrfK: 0 },{ semanticMinCosine: 2 },{ candidateDepth: 0 }]) assert.throws(() => RetrievalConfiguration.parse(bad));
  const p = new OpenAIEmbeddingProvider(openaiIdentity,'test',async () => { throw new Error('must not call'); });
  await assert.rejects(p.embed(['']),/input/); await assert.rejects(p.embed(['x'.repeat(8001)]),/bounds/);
});
test('file cache survives reopening, avoids repeat calls and detects tampering and path traversal', async () => {
  const dir=mkdtempSync(join(tmpdir(),'pathway-vectors-'));
  try {
    const unit=new UnitEmbeddings(); const store=new FileEmbeddingCache(dir);
    const a=new CachedEmbeddings(unit,store,() => FIXED_TIME);
    const first=await a.get('one',{ chunker: 'v1' });
    const b=new CachedEmbeddings(unit,new FileEmbeddingCache(dir),() => FIXED_TIME);
    assert.deepEqual(await b.get('one',{ chunker: 'v1' }),first); assert.equal(unit.texts.length,1);
    const path=join(dir,first.key+'.json'); const raw=JSON.parse(readFileSync(path,'utf8')); raw.vector=[0,1]; writeFileSync(path,JSON.stringify(raw));
    await assert.rejects(b.get('one',{ chunker: 'v1' }),/integrity/);
    await assert.rejects(store.get('../../secret'));
  } finally { rmSync(dir,{ recursive:true,force:true }); }
});
test('content, chunking, model revision, dimensions and corpus invalidate embedding cache identity', async () => {
  const cache=new MemoryEmbeddingCache(), unit=new UnitEmbeddings(); const a=new CachedEmbeddings(unit,cache,() => FIXED_TIME);
  const keys = new Set<string>();
  for (const [text,context] of [['one',{ chunker:'v1',corpus:'a' }],['two',{ chunker:'v1',corpus:'a' }],['one',{ chunker:'v2',corpus:'a' }],['one',{ chunker:'v1',corpus:'b' }]] as const) keys.add((await a.get(text,context)).key);
  const changed: EmbeddingProvider={ identity:{ ...identity,dimensions:3,revision:'v2' },embed:async () => ({ vectors:[[1,0,0]],inputTokens:1 }) };
  keys.add((await new CachedEmbeddings(changed,cache,() => FIXED_TIME).get('one',{ chunker:'v1',corpus:'a' })).key);
  assert.equal(keys.size,5);
});
test('concurrent identical cache requests are coalesced; configuration mutation is rejected', async () => {
  const unit=new UnitEmbeddings(); const a=new CachedEmbeddings(unit,new MemoryEmbeddingCache());
  const results=await Promise.all([a.get('one',{}),a.get('one',{})]);
  assert.equal(unit.texts.length,1); assert.equal(results[0]!.key,results[1]!.key);
  const mutable: EmbeddingProvider={ identity:{...identity},embed:unit.embed.bind(unit) };
  const b=new CachedEmbeddings(mutable,new MemoryEmbeddingCache()); mutable.identity.revision='changed';
  await assert.rejects(b.get('one',{}),/configuration changed/);
});
test('semantic indexing sends nothing; only eligible passages and query are embedded', async () => {
  const s=semantic(),c=loadCorpus(); await s.provider.index(c.passages,'corpus'); assert.equal(s.unit.texts.length,0);
  const hits=await s.provider.search({ query:'question',limit:8,universe:{ corpusHash:'corpus',snapshotHash:'s',passageIds:['K-PA.v2.s1'] } });
  assert.deepEqual(hits.map(h => h.passageId),['K-PA.v2.s1']); assert.equal(s.unit.texts.length,2);
  assert(!s.unit.texts.some(t => t.includes('Ignore all previous')));
  assert.equal(hits[0]!.embedding!.model,'unit-vectors'); assert.equal(hits[0]!.ranking!.semantic!.score,1);
  await assert.rejects(s.provider.search({ query:'x',limit:8,universe:{ corpusHash:'other',snapshotHash:'s',passageIds:[] } }),/snapshot/);
});
test('cosine handles opposite vectors and threshold abstains without changing metadata authority', async () => {
  assert.equal(cosine([1,0],[0,1]),0); assert.equal(cosine([1,0],[-1,0]),-1);
  assert.throws(() => cosine([0,0],[0,0]));
  const unit=new UnitEmbeddings(); unit.vector=t => t==='question' ? [1,0] : [-1,0];
  const s=semantic(unit,{ semanticMinCosine:0.35 }); await s.provider.index(loadCorpus().passages,'c');
  assert.deepEqual(await s.provider.search({ query:'question',limit:8,universe:{ corpusHash:'c',snapshotHash:'s',passageIds:['K-PA.v2.s1'] } }),[]);
});
test('RRF is rank-based, explainable, deterministic and retains both branch scores', async () => {
  assert.equal(reciprocalRankFusion(1,2,60),1/61+1/62); assert.equal(reciprocalRankFusion(null,1,60),1/61);
  assert.throws(() => reciprocalRankFusion(0,1,60));
  const h=providers()[2]!;const c=loadCorpus();await h.index(c.passages,'c');
  const input={ query:baseRequest().question,limit:8,universe:{ corpusHash:'c',snapshotHash:'s',passageIds:BASE_EVIDENCE } };
  const hits=await h.search(input); assert.deepEqual(await h.search(input),hits);
  for (const r of hits) {
    assert(r.ranking?.lexical);assert(r.ranking.semantic);assert.equal(r.ranking.inclusionReason,'both');
    assert.equal(r.score,reciprocalRankFusion(r.ranking.lexical.rank,r.ranking.semantic.rank,60));
    assert.equal(r.ranking.combined!.rank,r.rank);assert(r.embedding);
  }
});
test('hybrid rejects a poisoned branch even when other branch is valid; no lexical fallback', async () => {
  const s=semantic(); const l=new LocalLexicalProvider(); const c=loadCorpus();
  const bad: RetrievalProvider={ descriptor:l.descriptor,capabilities:()=>l.capabilities(),index:async()=>{},search:async()=>[{ passageId:'HIDDEN.v1.s1',documentVersionId:'HIDDEN.v1',textHash:c.passages.find(p=>p.id==='HIDDEN.v1.s1')!.textHash,rank:1,score:999,scoreKind:'lexical_bm25' }] };
  const hybrid=new LocalHybridProvider(bad,s.provider,{ ...s.config,mode:'hybrid' });await hybrid.index(c.passages,'c');
  await assert.rejects(hybrid.search({ query:'x',limit:8,universe:{ corpusHash:'c',snapshotHash:'s',passageIds:BASE_EVIDENCE } }),/canonical universe/);
  const fail: RetrievalProvider={ ...bad,descriptor:s.provider.descriptor,search:async()=>{throw new Error('unavailable');} };
  const failed=new LocalHybridProvider(l,fail,{...s.config,mode:'hybrid'});
  const registry=new Registry(c);const record=await new KnowledgePipeline(registry,failed,new EvidenceStore(),()=>FIXED_TIME).run('avery',baseRequest());
  assert.equal(record.disposition,'pause');assert.equal(record.retrieved.length,0);assert.equal(record.action.status,'paused');
});
for (const provider of providers()) {
  test(`${provider.descriptor.kind}: retirement/history/sandbox boundaries survive retrieval substitution (unit vectors, not quality)`,async()=>{
    const registry=new Registry(loadCorpus()),store=new EvidenceStore();const pipe=new KnowledgePipeline(registry,provider,store,()=>FIXED_TIME);
    const first=await pipe.run('avery',baseRequest());assert.equal(first.action.status,'allowed');
    const original=canonical(first);registry.retire('publisher','K-PA.v2',FIXED_TIME,'contract retirement');
    const retired=await pipe.run('avery',baseRequest({ id:'retired' }));assert.equal(retired.disposition,'pause');
    assert(!retired.retrieved.some(r=>r.documentVersionId==='K-PA.v2'));
    const sandbox=await pipe.run('viewer',sandboxRequest());assert.equal(sandbox.action.status,'denied');assert.equal(sandbox.actionProposal?.execution,'not_executed');
    assert(!sandbox.answer.claims.some(c=>c.text.includes('Ignore all previous')));
    const retry=await pipe.run('avery',baseRequest({ id:'retry' }));assert.equal(retry.action.status,'paused');
    assert.equal(canonical(store.get(first.id,registry.user('avery'))),original);
    if(provider.descriptor.kind!=='lexical') {assert(first.retrievalDiagnostics);assert(first.retrieved.every(r=>r.ranking));}
  });
}
test('all provider modes preserve independent permissions, wrong scope, conflicts and insufficient-evidence decisions',async()=>{
  const selected=loadExperiment().queries.filter(q=>['Q16','Q17','Q20','Q22','Q23','Q24','Q25','Q26','Q27','Q28','Q31','Q32','Q33','Q34','Q35','Q36'].includes(q.id));
  for(const query of selected) {
    const decisions=[];
    for(const provider of providers()) {
      const h=prepareQuery(query);const e=await new KnowledgePipeline(h.registry,provider,new EvidenceStore(),()=>h.now).run(query.actor,h.request);
      assert.equal(e.disposition,query.expectedDisposition,query.id+' '+provider.descriptor.kind);
      assert.equal(e.action.status,query.expectedAction,query.id+' '+provider.descriptor.kind);
      decisions.push({disposition:e.disposition,support:e.support.status,applicability:e.applicability.status,communication:e.communication.status,action:e.action.status});
    }
    assert.deepEqual(decisions[1],decisions[0],query.id);assert.deepEqual(decisions[2],decisions[0],query.id);
  }
});
test('a maximally similar wrong-payer passage is excluded by policy, independently of its vector score',async()=>{
  const unit=new UnitEmbeddings();unit.vector=t=>t.includes('administrative request form')||t==='near match'?[1,0]:[0.8,0.6];
  const s=semantic(unit),registry=new Registry(loadCorpus());await s.provider.index(registry.corpus.passages,registry.corpusHash);
  const broad=await s.provider.search({query:'near match',limit:8,universe:{corpusHash:registry.corpusHash,snapshotHash:registry.snapshotHash(),passageIds:['K-CEDAR.v1.s1',...BASE_EVIDENCE]}});
  assert.equal(broad[0]!.passageId,'K-CEDAR.v1.s1');assert.equal(broad[0]!.ranking!.semantic!.score,1);
  const e=await new KnowledgePipeline(registry,s.provider,new EvidenceStore(),()=>FIXED_TIME).run('avery',baseRequest({question:'near match'}));
  assert(e.excluded.some(x=>x.documentVersionId==='K-CEDAR.v1'&&x.reasonCodes.includes('WRONG_PAYER')));
  assert(!e.retrieved.some(x=>x.documentVersionId==='K-CEDAR.v1'));
});
test('semantic invalidation in flight still clears all evidence',async()=>{
  const s=semantic(),registry=new Registry(loadCorpus());const search=s.provider.search.bind(s.provider);
  s.provider.search=async input=>{const rows=await search(input);registry.retire('publisher','K-PA.v2',FIXED_TIME,'race');return rows;};
  const e=await new KnowledgePipeline(registry,s.provider,new EvidenceStore(),()=>FIXED_TIME).run('avery',baseRequest());
  assert(e.support.reasonCodes.includes('STALE_SNAPSHOT'));assert.equal(e.retrieved.length,0);assert.equal(e.action.status,'paused');
});
test('metric denominators distinguish missing results, absent gold and inapplicability',()=>{
  assert.deepEqual(rankingMetrics([{passageId:'bad'},{passageId:'a'}],['a','b'],new Set(['a','b'])),{
    returned:2,relevant:1,gold:2,recallAtK:0.5,precisionAtK:0.5,reciprocalRank:0.5,firstRelevantRank:2,requiredPassageRetrieval:false,inapplicable:1,inapplicableRate:0.5});
  assert.equal(rankingMetrics([],['a'],new Set()).precisionAtK,0);
  assert.equal(rankingMetrics([],[],new Set()).recallAtK,null);
  assert.equal(latencySummary([1,2,3,4,5]).p95Ms,5);
  const frozen=loadExperiment();assert.equal(frozen.queries.length,36);
});
test('legacy evidence artifacts remain readable and satisfy hash integrity after schema extension',()=>{
  const old=JSON.parse(readFileSync(new URL('../artifacts/phase2a-retirement-trace.json',import.meta.url),'utf8')).initial;
  assert.equal(textHash(old.evidenceUsed[0].text),old.evidenceUsed[0].textHash);
  // The artifact body round-trips through the current evidence store without changing its content address.
  const {id,recordHash,...body}=old;
  const restored=new EvidenceStore().put(body);assert.equal(restored.id,id);assert.equal(restored.recordHash,recordHash);
});

test('semantic cache tracks actual parser/chunker revisions and rejects corrupted indexed text',async()=>{
  const s=semantic();const passages=loadCorpus().passages.filter(p=>p.id==='K-PA.v2.s1');
  const input={query:'question',limit:8,universe:{corpusHash:'same-corpus-token',snapshotHash:'s',passageIds:['K-PA.v2.s1']}};
  await s.provider.index(passages,'same-corpus-token');const first=await s.provider.search(input);
  const changed=structuredClone(passages);changed[0]!.chunkerVersion='chunker-v2';changed[0]!.parserVersion='parser-v2';
  await s.provider.index(changed,'same-corpus-token');const second=await s.provider.search(input);
  assert.notEqual(first[0]!.embedding!.documentVectorKey,second[0]!.embedding!.documentVectorKey);
  changed[0]!.text='changed without updating hash';await assert.rejects(s.provider.index(changed,'same-corpus-token'),/canonical index/);
});
test('hybrid threshold filtering can remove the semantic branch without erasing lexical lineage',async()=>{
  const unit=new UnitEmbeddings();unit.vector=t=>t===baseRequest().question?[1,0]:[-1,0];
  const s=semantic(unit,{semanticMinCosine:0.35});const hybrid=new LocalHybridProvider(new LocalLexicalProvider(),s.provider,{...s.config,mode:'hybrid'});
  await hybrid.index(loadCorpus().passages,'c');
  const rows=await hybrid.search({query:baseRequest().question,limit:8,universe:{corpusHash:'c',snapshotHash:'s',passageIds:BASE_EVIDENCE}});
  assert(rows.length);for(const row of rows){assert.equal(row.ranking!.semantic,null);assert.equal(row.ranking!.inclusionReason,'lexical_only');assert.equal(row.embedding,undefined);}
});
test('unit semantic retrieval retains four distinct decisions and exact embedding provenance through file evidence restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pathway-semantic-evidence-'));
  try{
    const registry=new Registry(loadCorpus()),s=semantic();
    const result=await new KnowledgePipeline(registry,s.provider,new EvidenceStore(dir),()=>FIXED_TIME).run('avery',baseRequest({requestedAction:'transfer_document'}));
    assert.equal(result.support.status,'supported');assert.equal(result.applicability.status,'applicable');assert.equal(result.communication.status,'allowed');assert.equal(result.action.status,'requires_approval');
    assert.equal(result.schemaVersion,'phase2b-v1');assert(result.retrieved.every(r=>r.embedding?.dimensions===2));
    registry.retire('publisher','K-PA.v2',FIXED_TIME,'retirement');
    assert.deepEqual(new EvidenceStore(dir).get(result.id,registry.user('avery')),result);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('a semantic provider cannot omit its retrieval lineage or relabel lexical hits',async()=>{
  const registry=new Registry(loadCorpus()),s=semantic();const c=loadCorpus().passages[0]!;
  for(const scoreKind of ['vector_similarity','lexical_bm25'] as const){
    const p:RetrievalProvider={descriptor:s.provider.descriptor,capabilities:()=>({prefilter:true,exactCanonicalIds:true}),index:async()=>{},
      search:async()=>[{passageId:c.id,documentVersionId:c.documentVersionId,textHash:c.textHash,rank:1,score:1,scoreKind}]};
    const e=await new KnowledgePipeline(registry,p,new EvidenceStore(),()=>FIXED_TIME).run('avery',baseRequest());
    assert(e.support.reasonCodes.includes('PROVIDER_CONTRACT_VIOLATION'));assert.equal(e.action.status,'paused');
  }
});

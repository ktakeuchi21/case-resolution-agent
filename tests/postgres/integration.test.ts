import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { Database,scoped,insert } from '../../src/db/database.ts';
import { GovernanceRepository,seed } from '../../src/db/governance.ts';
import { PersistentRetrieval } from '../../src/db/retrieval.ts';
import { PostgresEmbeddingCache,PostgresSemanticProvider } from '../../src/db/vector.ts';
import { loadRegistry } from '../../src/db/registry.ts';
import { CachedEmbeddings } from '../../src/providers/embedding.ts';
import { RetrievalConfiguration } from '../../src/providers/configuration.ts';
import { baseRequest,sandboxRequest } from '../../src/evaluation.ts';
import { FIXED_TIME,loadCorpus } from '../../src/registry.ts';
import { manifestDigest,withoutHash,textHash } from '../../src/integrity.ts';
import { db,fixture,unit,ack,barrier } from './helpers.ts';
after(()=>db.close());

test('default hybrid persists evidence, four decisions and diagnostics across repository reconstruction',async()=>{
 const f=await fixture();const initial=await f.service.run('avery',baseRequest(),{embeddingProvider:unit});
 assert.equal(initial.record.provider.kind,'hybrid');assert.equal(initial.record.action.status,'allowed');
 const reopened=new Database();try{
  const service=new PersistentRetrieval(reopened,f.scope,()=>FIXED_TIME);
  assert.deepEqual(await service.history('avery',initial.record.id),initial.record);
  const duplicate=await service.run('avery',baseRequest(),{embeddingProvider:unit});assert.equal(duplicate.replayed,true);assert.equal(duplicate.historical,true);assert.equal(duplicate.run.id,initial.run.id);
  await reopened.transaction(f.scope,async c=>assert.equal((await c.query('SELECT count(*)::int AS n FROM pathway.decisions')).rows[0].n,4));
 }finally{await reopened.close();}
});
test('retirement is durable; history and duplicate replies are historical; new requests pause',async()=>{
 const f=await fixture(),a=await f.service.run('avery',baseRequest(),{embeddingProvider:unit});
 await f.governance.retire('publisher','K-PA.v2',FIXED_TIME,'withdrawn');
 const fresh=new PersistentRetrieval(db,f.scope,()=>FIXED_TIME);
 assert.deepEqual(await fresh.history('avery',a.record.id),a.record);
 assert.equal((await fresh.run('avery',baseRequest(),{embeddingProvider:unit})).historical,true);
 const next=await fresh.run('avery',baseRequest({id:'after'}),{embeddingProvider:unit});assert.equal(next.record.disposition,'pause');assert(next.record.excluded.some(e=>e.reasonCodes.includes('SOURCE_RETIRED')));
 const r=await new GovernanceRepository(db,f.scope).snapshot();assert(r.isRetired('K-PA.v2'));
});
test('supersession is an immutable durable event and does not mutate old manifests',async()=>{
 const f=await fixture();const before=await f.governance.snapshot();await f.governance.supersede('publisher','K-PA.v2','K-PA.v3',FIXED_TIME);
 const after=await new GovernanceRepository(db,f.scope).snapshot();assert.equal(after.supersededAt(after.corpus.versions.find(v=>v.id==='K-PA.v2')!),FIXED_TIME);
 assert.deepEqual(after.corpus.releases,before.corpus.releases);
 const r=await f.service.run('avery',baseRequest(),{embeddingProvider:unit});assert(r.record.excluded.some(e=>e.documentVersionId==='K-PA.v2'&&e.reasonCodes.includes('SUPERSEDED')));assert.notEqual(r.record.action.status,'allowed');
 await assert.rejects(f.governance.supersede('publisher','K-PA.v3','K-PA.v2',FIXED_TIME),/CYCLE/);
});
test('database forbids updating/deleting published releases and EvidenceRecords',async()=>{
 const f=await fixture();await f.service.run('avery',baseRequest(),{embeddingProvider:unit});
 for(const table of ['releases','evidence'])for(const sql of [`UPDATE pathway.${table} SET body=body`,`DELETE FROM pathway.${table}`])await assert.rejects(db.transaction(f.scope,c=>c.query(sql)));
 await db.transaction(f.scope,async c=>assert.equal((await c.query('SELECT count(*)::int AS n FROM pathway.evidence')).rows[0].n,1));
});
test('duplicate ingestion is idempotent; changed immutable passage content is rejected',async()=>{
 const f=await fixture(),c=loadCorpus(),d=c.documents.find(d=>d.id==='K-PA')!,v=c.versions.filter(v=>v.documentId===d.id),ps=c.passages.filter(p=>v.some(v=>v.id===p.documentVersionId));
 const a=await f.governance.ingest('publisher',d,v,ps),b=await f.governance.ingest('publisher',d,v,ps);assert.deepEqual(a,b);
 const changed=structuredClone(ps);changed[0]!.text+=' changed';changed[0]!.textHash=textHash(changed[0]!.text);
 await assert.rejects(f.governance.ingest('publisher',d,v,changed),/COLLISION/);
 await seed(db,f.workspace);await seed(db,f.workspace);
});
test('duplicate retrieval IDs coalesce concurrent calls and reject changed payloads',async()=>{
 const f=await fixture();const [a,b]=await Promise.all([f.service.run('avery',baseRequest(),{embeddingProvider:unit}),f.service.run('avery',baseRequest(),{embeddingProvider:unit})]);assert.equal(a.run.id,b.run.id);assert.equal(Number(a.replayed)+Number(b.replayed),1);
 await assert.rejects(f.service.run('avery',baseRequest({question:'different'}),{embeddingProvider:unit}),/IDEMPOTENCY/);
});
test('retirement-first controlled interleaving commits before the decision snapshot',async()=>{
 const f=await fixture(),entered=barrier(),allowCommit=barrier();
 const retirement=f.governance.retire('publisher','K-PA.v2',FIXED_TIME,'race', 'document_version',async()=>{entered.release();await allowCommit.promise;});
 await entered.promise;const retrieval=f.service.run('avery',baseRequest(),{embeddingProvider:unit});allowCommit.release();await retirement;const r=await retrieval;
 assert.equal(r.record.disposition,'pause');assert.equal(r.record.action.status,'paused');
});
test('evidence-first controlled interleaving preserves valid committed history then retires',async()=>{
 const f=await fixture(),entered=barrier(),allowCommit=barrier();
 const retrieval=f.service.run('avery',baseRequest(),{embeddingProvider:unit,afterLock:async()=>{entered.release();await allowCommit.promise;}});
 await entered.promise;const retirement=f.governance.retire('publisher','K-PA.v2',FIXED_TIME,'race');allowCommit.release();const first=await retrieval;await retirement;
 assert.equal(first.record.action.status,'allowed');assert.deepEqual(await f.service.history('avery',first.record.id),first.record);
 assert.equal((await f.service.run('avery',baseRequest({id:'next'}),{embeddingProvider:unit})).record.action.status,'paused');
});
test('concurrent publication is idempotent; conflicting content cannot reuse a release ID',async()=>{
 const f=await fixture();const corpus=loadCorpus(),release=structuredClone(corpus.releases[0]!);release.id='KP-ALDER.new';release.version='new';release.manifestHash=manifestDigest(withoutHash(release),corpus);
 const [a,b]=await Promise.all([f.governance.publish('publisher',release),f.governance.publish('publisher',release)]);assert.deepEqual(a,b);
 const changed={...release,indexVersion:'changed'};changed.manifestHash=manifestDigest(withoutHash(changed),corpus);await assert.rejects(f.governance.publish('publisher',changed),/IMMUTABLE_RELEASE/);
});
test('wrong tenant and sandbox/governed isolation hold at repository, RLS and FK boundaries',async()=>{
 const f=await fixture();await f.service.run('avery',baseRequest(),{embeddingProvider:unit});
 const foreign={...f.scope,tenant:'T-OTHER'};
 await db.transaction(foreign,async c=>{assert.equal((await c.query('SELECT count(*)::int AS n FROM pathway.evidence')).rows[0].n,0);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM pathway.documents WHERE tenant='T-DEMO'")).rows[0].n,0);});
 await assert.rejects(db.transaction(foreign,c=>insert(c,f.scope,'audit','bad',{id:'bad'},'outsider')),/row-level security/);
 const sb={...f.scope,environment:'sandbox' as const};
 await db.transaction(sb,async c=>{assert.equal((await c.query('SELECT count(*)::int AS n FROM pathway.releases')).rows[0].n,0);});
 await assert.rejects(db.transaction(sb,c=>c.query('INSERT INTO pathway.membership VALUES($1,$2,$3,$4,$5)',[...scoped(sb),'KP-ALDER.2026.09.1','SB-REPLACEMENT.v1.s1'])));
 await assert.rejects(new PersistentRetrieval(db,sb,()=>FIXED_TIME).run('viewer',baseRequest(),{embeddingProvider:unit}),/WRONG_MODE/);
 const sandbox=await new PersistentRetrieval(db,sb,()=>FIXED_TIME).run('viewer',sandboxRequest(),{embeddingProvider:unit});assert.equal(sandbox.record.action.status,'denied');
});
test('wrong pack assignment denied; newly versioned expired assignment stays denied after restart',async()=>{
 const f=await fixture();assert.equal((await f.service.run('avery',baseRequest({id:'wrong',releaseIds:['KP-CEDAR.2026.09.1']}),{embeddingProvider:unit})).record.disposition,'deny');
 const a={...loadCorpus().assignments[0]!,id:'AS-expired',expiresAt:FIXED_TIME};await f.governance.assign('publisher',a,'DEMO-101');
 const r=await new PersistentRetrieval(db,f.scope,()=>FIXED_TIME).run('avery',baseRequest({selectionId:a.id}),{embeddingProvider:unit});assert.equal(r.record.disposition,'pause');assert(r.record.support.reasonCodes.includes('EXPIRED'));
});
test('mixed models and dimensions rejected; changed content misses cache; SQL vector binding validated',async()=>{
 const f=await fixture();await db.transaction(f.scope,async c=>{
  const cache=new PostgresEmbeddingCache(c,f.scope),emb=new CachedEmbeddings(unit,cache,()=>FIXED_TIME),v=await emb.get('original',{kind:'test'});
  const changed=await emb.get('changed',{kind:'test'});assert.notEqual(v.key,changed.key);
  const altered=new CachedEmbeddings({...unit,identity:{...unit.identity,model:'other'}},cache,()=>FIXED_TIME);assert.notEqual((await altered.get('original',{kind:'test'})).key,v.key);
  assert.throws(()=>new PostgresSemanticProvider(c,f.scope,emb,RetrievalConfiguration.parse({mode:'semantic',embedding:{...unit.identity,dimensions:2}})),/MISMATCH/);
 });
 await assert.rejects(db.transaction(f.scope,async c=>{const cache=new PostgresEmbeddingCache(c,f.scope);const e=new CachedEmbeddings(unit,cache,()=>FIXED_TIME);const v=await e.get('not passage',{kind:'wrong'});
  await c.query('INSERT INTO pathway.passage_vectors VALUES($1,$2,$3,$4,$5,$6,$7)',[...scoped(f.scope),'K-PA.v2.s1',v.key,v.configurationHash,v.inputHash]);}),/INVALID_VECTOR_BINDING/);
});
test('transaction failure rolls back all writes and leaves previous history intact',async()=>{
 const f=await fixture();const before=await f.governance.snapshot();
 await assert.rejects(db.transaction(f.scope,async c=>{await insert(c,f.scope,'audit','rolled-back',{id:'rolled-back'},'publisher');throw new Error('controlled rollback');}),/controlled rollback/);
 await db.transaction(f.scope,async c=>assert.equal((await c.query("SELECT count(*)::int AS n FROM pathway.audit WHERE id='rolled-back'")).rows[0].n,0));assert.equal((await f.governance.snapshot()).generation,before.generation);
});
test('provider failure persists a hybrid pause without fallback; lexical retry requires acknowledgment',async()=>{
 const f=await fixture();const failed=await f.service.run('avery',baseRequest(),{embeddingProvider:{identity:unit.identity,embed:async()=>{throw new Error('offline failure');}}});
 assert.equal(failed.record.disposition,'pause');assert.equal(failed.run.effectiveMode,'hybrid');assert(failed.run.reasonCodes.includes('PROVIDER_UNAVAILABLE'));
 await assert.rejects(f.service.run('avery',baseRequest({id:'retry'}),{mode:'lexical'}),/ACKNOWLEDGMENT_REQUIRED/);
 const acknowledgment={...ack('retry'),reason:'PROVIDER_UNAVAILABLE' as const,originalRunId:failed.run.id};
 const retry=await f.service.run('avery',baseRequest({id:'retry'}),{mode:'lexical',acknowledgment});assert.equal(retry.record.action.status,'allowed');assert.equal(retry.run.requestedMode,'hybrid');assert.equal(retry.run.effectiveMode,'lexical');
 await f.governance.retire('publisher','K-PA.v2',FIXED_TIME,'withdrawn');
 const post=await f.service.run('avery',baseRequest({id:'after'}),{mode:'lexical',acknowledgment:ack('after')});assert.equal(post.record.action.status,'paused');
 await assert.rejects(f.service.run('avery',baseRequest({id:'forged'}),{mode:'lexical',acknowledgment:{...ack('forged'),actorId:'viewer'}}),/INVALID_DEGRADED/);
});
test('database row hashes and contracts are checked on reads',async()=>{
 const f=await fixture();await assert.rejects(db.transaction(f.scope,async c=>{
  await insert(c,f.scope,'case_revisions','invalid',{id:'DEMO-101'},'publisher');await loadRegistry(c,f.scope);
 }));
});
test('embedding cache reuse after reconstruction performs no new embedding calls',async()=>{
 const f=await fixture();await f.service.run('avery',baseRequest(),{embeddingProvider:unit});let calls=0;
 const r=await new PersistentRetrieval(db,f.scope,()=>FIXED_TIME).run('avery',baseRequest({id:'again'}),{embeddingProvider:{identity:unit.identity,embed:async()=>{calls++;throw new Error('no calls');}}});
 assert.equal(r.record.action.status,'allowed');assert.equal(calls,0);
});

test('a named system policy must be durably preauthorized for this actor and request',async()=>{
 const f=await fixture(),acknowledgment={...ack('policy-retry'),actorId:'publisher',policyId:'offline-eval-policy'};
 await assert.rejects(f.service.run('avery',baseRequest({id:'policy-retry'}),{mode:'lexical',acknowledgment}),/NOT_PREAUTHORIZED/);
 await f.governance.authorizeDegraded('publisher','avery','policy-retry','offline-eval-policy',FIXED_TIME,'2027-01-01T00:00:00Z');
 const r=await new PersistentRetrieval(db,f.scope,()=>FIXED_TIME).run('avery',baseRequest({id:'policy-retry'}),{mode:'lexical',acknowledgment});assert.equal(r.record.action.status,'allowed');
 await assert.rejects(f.service.run('avery',baseRequest({id:'wrong-request'}),{mode:'lexical',acknowledgment:{...acknowledgment,requestId:'wrong-request'}}),/NOT_PREAUTHORIZED/);
});
test('new pack publication cannot migrate pinned case assignment or grant access implicitly',async()=>{
 const f=await fixture(),corpus=loadCorpus(),release={...corpus.releases[0]!,id:'KP-ALDER.next',version:'next'};release.manifestHash=manifestDigest(withoutHash(release),corpus);
 await f.governance.publish('publisher',release);
 const original=await f.service.run('avery',baseRequest(),{embeddingProvider:unit});assert.equal(original.record.selectedReleases[0]!.id,'KP-ALDER.2026.09.1');
 const denied=await f.service.run('avery',baseRequest({id:'unassigned',releaseIds:[release.id]}),{embeddingProvider:unit});assert.equal(denied.record.disposition,'deny');
 const assignment={...corpus.assignments[0]!,id:'AS-next',releaseIds:[release.id],mandatoryReleaseIds:[release.id]};await f.governance.assign('publisher',assignment,'DEMO-101');
 const after=await f.service.run('avery',baseRequest({id:'assigned',selectionId:assignment.id,releaseIds:[release.id]}),{embeddingProvider:unit});assert.equal(after.record.disposition,'deny');assert(after.record.support.reasonCodes.includes('RELEASE_NOT_ASSIGNED'));
 assert.deepEqual(await f.service.history('avery',original.record.id),original.record);
});
test('retirement with an earlier request clock still blocks future operational reliance',async()=>{
 const f=await fixture();await f.governance.retire('publisher','K-PA.v2','2026-09-10T16:05:00Z','withdrawn');
 const r=await f.service.run('avery',baseRequest(),{embeddingProvider:unit});assert.equal(r.record.action.status,'paused');
});

test('degraded retry cannot cite an unrelated failed request as its authorization trace',async()=>{
 const f=await fixture();const failed=await f.service.run('avery',baseRequest(),{embeddingProvider:{identity:unit.identity,embed:async()=>{throw new Error('controlled outage');}}});
 await assert.rejects(f.service.run('avery',baseRequest({id:'unrelated',question:'a different question'}),{mode:'lexical',acknowledgment:{...ack('unrelated'),reason:'PROVIDER_UNAVAILABLE',originalRunId:failed.run.id}}),/REQUEST_MISMATCH/);
});

test('corrections create a fresh governed decision linked to immutable earlier evidence',async()=>{
 const f=await fixture();const original=await f.service.run('avery',baseRequest(),{embeddingProvider:unit});
 await f.governance.retire('publisher','K-PA.v2',FIXED_TIME,'new information');
 const correction=await f.service.run('avery',baseRequest({id:'corrected'}),{embeddingProvider:unit,correctionOf:original.record.id});
 assert.equal(correction.run.correctionOf,original.record.id);assert.notEqual(correction.record.id,original.record.id);assert.equal(correction.record.action.status,'paused');
 assert.deepEqual(await f.service.history('avery',original.record.id),original.record);
 await db.transaction(f.scope,async c=>assert.equal((await c.query('SELECT correction_of FROM pathway.runs WHERE id=$1',[correction.run.id])).rows[0].correction_of,original.record.id));
});

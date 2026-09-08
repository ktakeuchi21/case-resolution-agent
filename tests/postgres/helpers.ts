import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Database } from '../../src/db/database.ts';
import type { Scope } from '../../src/db/database.ts';
import { seed, GovernanceRepository } from '../../src/db/governance.ts';
import { PersistentRetrieval } from '../../src/db/retrieval.ts';
import type { DegradedAcknowledgment } from '../../src/db/retrieval.ts';
import { loadCorpus, FIXED_TIME } from '../../src/registry.ts';
import { CachedEmbeddings, MemoryEmbeddingCache } from '../../src/providers/embedding.ts';
import type { EmbeddingProvider } from '../../src/providers/embedding.ts';
import { hash } from '../../src/integrity.ts';
import type { EvidenceRecord } from '../../src/contracts.ts';
export const db=new Database();
export const unit:EmbeddingProvider={identity:{provider:'unit-fixture',model:'unit-vectors',dimensions:3,revision:'phase2c-v1',normalization:'none-v1'},
 embed:async texts=>({vectors:texts.map(t=>{const h=hash(t);return [1+parseInt(h.slice(0,2),16),1+parseInt(h.slice(2,4),16),1+parseInt(h.slice(4,6),16)];}),inputTokens:0})};
export const unitEmbeddings=()=>new CachedEmbeddings(unit,new MemoryEmbeddingCache(),()=>FIXED_TIME);
export function ack(id:string,actor='avery'):DegradedAcknowledgment{return {actorId:actor,policyId:null,timestamp:FIXED_TIME,expiresAt:'2027-01-01T00:00:00Z',reason:'OFFLINE_EXPLICIT',originalRunId:null,scope:'single_request',requestId:id};}
export async function fixture(corpus=loadCorpus()){
 const workspace='test.'+randomUUID();await seed(db,workspace,corpus);
 const scope:Scope={workspace,tenant:'T-DEMO',environment:'governed'};
 return {workspace,scope,governance:new GovernanceRepository(db,scope),service:new PersistentRetrieval(db,scope,()=>FIXED_TIME)};
}
export function sameGovernance(a:EvidenceRecord,b:EvidenceRecord){
 for(const key of ['eligibleVersionIds','excluded','disposition','authorityFindings','support','applicability','communication','action','evidenceUsed','actionProposal'] as const)assert.deepEqual(a[key],b[key],key);
 assert.deepEqual(a.answer.claims,b.answer.claims);
}
export function barrier(){let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return {promise,release};}

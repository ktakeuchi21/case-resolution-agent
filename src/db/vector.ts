import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { CanonicalPassage, RetrievalCandidate } from '../contracts.ts';
import { RetrievalCandidate as Candidate } from '../contracts.ts';
import type { AuthorizedUniverse, SemanticRetrievalProvider } from '../providers/provider.ts';
import { CachedEmbeddings, MemoryEmbeddingCache, VectorRecord } from '../providers/embedding.ts';
import type { EmbeddingCache, EmbeddingProvider } from '../providers/embedding.ts';
import { RetrievalConfiguration } from '../providers/configuration.ts';
import { hash, textHash } from '../integrity.ts';
import { scoped, validateRow } from './database.ts';
import type { Scope } from './database.ts';

export class PostgresEmbeddingCache implements EmbeddingCache {
 readonly client:PoolClient;readonly scope:Scope;readonly source:EmbeddingCache|undefined;
 constructor(client:PoolClient,scope:Scope,source?:EmbeddingCache){this.client=client;this.scope=scope;this.source=source;}
 async get(key:string){
  const r=await this.client.query('SELECT body,body_hash FROM pathway.embeddings WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(this.scope),key]);
  if(r.rowCount){const row=validateRow(r.rows[0],VectorRecord);const validator=new MemoryEmbeddingCache();await validator.put(row);return validator.get(key);}
  const imported=await this.source?.get(key);if(imported){await this.put(imported);return imported;}return null;
 }
 async put(input:VectorRecord){
  const validator=new MemoryEmbeddingCache();await validator.put(input);const v=(await validator.get(input.key))!;
  await this.client.query('INSERT INTO pathway.embeddings(workspace,tenant,environment,id,body,body_hash,embedding) VALUES($1,$2,$3,$4,$5,$6,$7::vector) ON CONFLICT DO NOTHING',[...scoped(this.scope),v.key,JSON.stringify(v),hash(v),JSON.stringify(v.vector)]);
  const r=await this.client.query('SELECT body,body_hash FROM pathway.embeddings WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(this.scope),v.key]);
  const prior=validateRow(r.rows[0],VectorRecord);if(prior.vectorHash!==v.vectorHash)throw new Error('EMBEDDING_COLLISION');
 }
}
export class PostgresSemanticProvider implements SemanticRetrievalProvider {
 readonly descriptor;readonly embeddings:CachedEmbeddings;readonly configuration:RetrievalConfiguration;
 readonly client:PoolClient;readonly scope:Scope;
 #passages=new Map<string,CanonicalPassage>();#corpusHash='';
 constructor(c:PoolClient,s:Scope,embeddings:CachedEmbeddings,config:RetrievalConfiguration){
  this.client=c;this.scope=s;this.embeddings=embeddings;this.configuration=RetrievalConfiguration.parse(config);
  if(hash(config.embedding)!==embeddings.configurationHash)throw new Error('EMBEDDING_CONFIGURATION_MISMATCH');
  this.descriptor={id:'postgres-pgvector',version:'exact-cosine-v1',kind:'semantic' as const,config:JSON.stringify({...config,storage:'pgvector-float4',scoring:'1 - cosine distance; authorized universe only; no ANN'})};
 }
 capabilities(){return {prefilter:true,exactCanonicalIds:true};}
 async index(passages:readonly CanonicalPassage[],corpusHash:string){
  this.#passages=new Map(passages.map(p=>{if(textHash(p.text)!==p.textHash)throw new Error('CANONICAL_HASH_MISMATCH');return [p.id,p];}));this.#corpusHash=corpusHash;
 }
 async search({query,universe,limit}:{query:string;universe:AuthorizedUniverse;limit:number}):Promise<RetrievalCandidate[]>{
  if(universe.corpusHash!==this.#corpusHash||limit<1||limit>50||!Number.isInteger(limit)||new Set(universe.passageIds).size!==universe.passageIds.length)throw new Error('INVALID_VECTOR_SEARCH');
  if(!universe.passageIds.length)return [];
  const q=await this.embeddings.get(query,{kind:'query',corpusHash:this.#corpusHash});
  const keys:string[]=[],records=new Map<string,VectorRecord>();
  for(const id of universe.passageIds){
   const p=this.#passages.get(id);if(!p)throw new Error('UNKNOWN_CANONICAL_ID');
   const v=await this.embeddings.get(p.text,{kind:'passage',corpusHash:this.#corpusHash,passageId:p.id,documentVersionId:p.documentVersionId,artifactVersion:p.artifactVersion,parserVersion:p.parserVersion,chunkerVersion:p.chunkerVersion});
   if(v.configurationHash!==q.configurationHash||v.identity.dimensions!==q.identity.dimensions)throw new Error('MIXED_EMBEDDING_IDENTITY');
   await this.client.query('INSERT INTO pathway.passage_vectors VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[...scoped(this.scope),p.id,v.key,v.configurationHash,p.textHash]);
   keys.push(v.key);records.set(id,v);
  }
  // Both RLS and an exact canonical-ID/key allowlist constrain the SQL relation BEFORE distance/limit.
  const result=await this.client.query(`SELECT p.id,p.body,p.body_hash,1-(e.embedding <=> $4::vector) AS cosine
   FROM pathway.passages p JOIN pathway.passage_vectors pv ON (pv.workspace,pv.tenant,pv.environment,pv.passage_id)=(p.workspace,p.tenant,p.environment,p.id)
   JOIN pathway.embeddings e ON (e.workspace,e.tenant,e.environment,e.id)=(pv.workspace,pv.tenant,pv.environment,pv.vector_id)
   WHERE p.workspace=$1 AND p.tenant=$2 AND p.environment=$3 AND p.id=ANY($5::text[]) AND e.id=ANY($6::text[])
   AND e.configuration_hash=$7 AND e.dimensions=$8 AND p.content_hash=pv.content_hash
   ORDER BY cosine DESC,p.id COLLATE "C"`,[...scoped(this.scope),JSON.stringify(q.vector),[...universe.passageIds],keys,q.configurationHash,q.identity.dimensions]);
  if(result.rows.length!==universe.passageIds.length)throw new Error('INCOMPLETE_VECTOR_INDEX');
  return result.rows.map((row,i)=>{
   const score=z.number().finite().parse(row.cosine),p=this.#passages.get(row.id)!;
   if(hash(p)!==row.body_hash||hash(row.body)!==row.body_hash)throw new Error('POST_RETRIEVAL_CANONICAL_MISMATCH');
   return {p,score:Math.max(-1,Math.min(1,score)),semanticRank:i+1};
  }).filter(x=>this.configuration.semanticMinCosine===null||x.score>=this.configuration.semanticMinCosine).slice(0,limit).map(({p,score,semanticRank},i)=>{
   const v=records.get(p.id)!;
   return Candidate.parse({passageId:p.id,documentVersionId:p.documentVersionId,textHash:p.textHash,rank:i+1,score:(score+1)/2,scoreKind:'vector_similarity',
    ranking:{lexical:null,semantic:{rank:semanticRank,score},combined:null,method:'cosine',rrfK:null,candidateDepth:limit,semanticMinCosine:this.configuration.semanticMinCosine,inclusionReason:'semantic'},
    embedding:{provider:v.identity.provider,model:v.identity.model,dimensions:v.identity.dimensions,configurationHash:v.configurationHash,documentVectorKey:v.key,queryVectorKey:q.key,documentEmbeddedAt:v.embeddedAt,queryEmbeddedAt:q.embeddedAt}});
  });
 }
}
export function cachedOnlyProvider(identity=RetrievalConfiguration.parse({}).embedding):EmbeddingProvider {
 return {identity,embed:async()=>{throw new Error('CACHE_MISS_LIVE_EMBEDDING_DISABLED');}};
}

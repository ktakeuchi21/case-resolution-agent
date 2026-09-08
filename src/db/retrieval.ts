import { z } from 'zod';
import type { PoolClient } from 'pg';
import { Id, Timestamp, EvidenceRecord, RetrievalRequest, ReasonCode } from '../contracts.ts';
import { hash } from '../integrity.ts';
import { KnowledgePipeline } from '../pipeline.ts';
import { EvidenceStore } from '../evidence-store.ts';
import { LocalLexicalProvider } from '../providers/local-lexical.ts';
import { LocalHybridProvider } from '../providers/hybrid.ts';
import type { RetrievalProvider } from '../providers/provider.ts';
import { CachedEmbeddings } from '../providers/embedding.ts';
import type { EmbeddingCache, EmbeddingProvider } from '../providers/embedding.ts';
import { RetrievalConfiguration } from '../providers/configuration.ts';
import { Database, insert, scoped, validateRow } from './database.ts';
import type { Scope } from './database.ts';
import { loadRegistry } from './registry.ts';
import { randomUUID } from 'node:crypto';
import { Registry } from '../registry.ts';
import { LocalSemanticProvider } from '../providers/semantic.ts';
import { MemoryEmbeddingCache } from '../providers/embedding.ts';
import { PostgresEmbeddingCache, PostgresSemanticProvider, cachedOnlyProvider } from './vector.ts';

export const DegradedAcknowledgment=z.strictObject({actorId:Id,policyId:Id.nullable(),timestamp:Timestamp,expiresAt:Timestamp,
 reason:z.enum(['PROVIDER_UNAVAILABLE','OFFLINE_EXPLICIT']),originalRunId:Id.nullable(),scope:z.literal('single_request'),requestId:Id});
export type DegradedAcknowledgment=z.infer<typeof DegradedAcknowledgment>;
export const RunRecord=z.strictObject({id:Id,operationId:Id,transactionId:z.string(),transactionOutcome:z.literal('committed'),
 evidenceId:Id,requestId:Id,actorId:Id,requestedMode:z.enum(['lexical','semantic','hybrid']),effectiveMode:z.enum(['lexical','semantic','hybrid']),
 generation:z.string(),decisionTimestamp:Timestamp,configuration:RetrievalConfiguration,correctionOf:Id.optional(),
 acknowledgment:DegradedAcknowledgment.nullable(),reasonCodes:z.array(z.union([ReasonCode,z.literal('DEGRADED_LEXICAL_ACKNOWLEDGED')])),
 diagnostics:z.strictObject({retrieved:EvidenceRecord.shape.retrieved,excluded:EvidenceRecord.shape.excluded,eligibleVersionIds:EvidenceRecord.shape.eligibleVersionIds,selectedReleases:EvidenceRecord.shape.selectedReleases,assignmentId:Id.nullable()}),
 embeddingUsage:z.strictObject({cacheHits:z.number().int().nonnegative(),cacheMisses:z.number().int().nonnegative(),requests:z.number().int().nonnegative(),inputTokens:z.number().int().nonnegative()})});
export type RunRecord=z.infer<typeof RunRecord>;
export const DegradedGrant=z.strictObject({id:Id,actorId:Id,policyId:Id,requestId:Id,authorizedBy:Id,activeFrom:Timestamp,expiresAt:Timestamp});
const Idempotency=z.strictObject({id:Id,fingerprint:z.string(),evidenceId:Id,runId:Id,actorId:Id});
export interface RunOptions {
 mode?:'lexical'|'semantic'|'hybrid'; acknowledgment?:DegradedAcknowledgment;correctionOf?:string;
 embeddingProvider?:EmbeddingProvider;cacheSource?:EmbeddingCache;
 // Trusted test/evaluation seam, never accepted from a serialized client request.
 providerFactory?:(client:PoolClient,defaultProvider:RetrievalProvider)=>RetrievalProvider;
 afterLock?:()=>Promise<void>;
}
export class PersistentRetrieval {
 readonly db:Database;readonly scope:Scope;readonly clock:()=>string;
 constructor(db:Database,scope:Scope,clock:()=>string=()=>new Date().toISOString()){this.db=db;this.scope=scope;this.clock=clock;}
 async run(actor:string,input:unknown,options:RunOptions={}){
  return this.db.transaction(this.scope,c=>this.runInTransaction(c,actor,input,options));
 }
 /** Temporary exploration uses the same deterministic pipeline through this
  * entry point, with an explicitly scoped ephemeral registry and cache. It
  * returns evidence for TTL storage; no upload enters immutable tables here. */
 async exploreTemporary(actor:string,input:unknown,registry:Registry,options:{mode:'hybrid'|'semantic'|'lexical';acknowledgeLexical?:boolean;embeddingProvider?:EmbeddingProvider;cacheSource?:EmbeddingCache}){
  const request=RetrievalRequest.parse(input);
  if(this.scope.environment!=='sandbox'||request.mode!=='sandbox'||registry.user(actor).tenantId!==this.scope.tenant||registry.corpus.documents.some(d=>d.provenance.mode!=='sandbox'||d.provenance.tenantId!==this.scope.tenant))throw new Error('TEMPORARY_SCOPE_MISMATCH');
  if(options.mode==='lexical'&&!options.acknowledgeLexical)throw new Error('DEGRADED_ACKNOWLEDGMENT_REQUIRED');
  const config=RetrievalConfiguration.parse({mode:options.mode,embedding:options.embeddingProvider?.identity});
  const embeddings=new CachedEmbeddings(options.embeddingProvider??cachedOnlyProvider(config.embedding),options.cacheSource??new MemoryEmbeddingCache());
  const semantic=new LocalSemanticProvider(embeddings,config);
  const provider=options.mode==='lexical'?new LocalLexicalProvider():options.mode==='semantic'?semantic:new LocalHybridProvider(new LocalLexicalProvider(),semantic,config);
  const record=await new KnowledgePipeline(registry,provider,new EvidenceStore(),this.clock).run(actor,request);
  return {record,diagnostics:{effectiveMode:options.mode,requestedMode:options.mode,acknowledgedLexical:options.mode==='lexical',silentFallback:false,temporary:true,embeddingUsage:embeddings.usage}};
 }
 /** Trusted composition only: caller must hold Database.transaction(scope) through commit. */
 async runInTransaction(c:PoolClient,actor:string,input:unknown,options:RunOptions={}){
  const request=RetrievalRequest.parse(input),now=Timestamp.parse(this.clock());
  if(request.mode!==this.scope.environment)throw new Error('WRONG_MODE');
  const mode=options.mode??'hybrid';
  const config=RetrievalConfiguration.parse({mode,embedding:options.embeddingProvider?.identity});
  const ack=options.acknowledgment?DegradedAcknowledgment.parse(options.acknowledgment):null;
  if(mode==='lexical'&&!ack)throw new Error('DEGRADED_ACKNOWLEDGMENT_REQUIRED');
  if(mode!=='lexical'&&ack)throw new Error('UNEXPECTED_DEGRADED_ACKNOWLEDGMENT');
   await options.afterLock?.();const registry=await loadRegistry(c,this.scope),user=registry.user(actor);
   if(user.tenantId!==this.scope.tenant)throw new Error('WRONG_TENANT');
   if(ack){
    // A policy identifier is audit attribution, not a grant. A trusted publisher/evaluator must authorize it.
    const approver=registry.user(ack.actorId);
    if(ack.policyId){
     const rows=await c.query('SELECT body,body_hash FROM pathway.degraded_grants WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(this.scope),hash({actor,requestId:request.id,policyId:ack.policyId})]);
     if(!rows.rowCount)throw new Error('SYSTEM_POLICY_NOT_PREAUTHORIZED');
     const grant=validateRow(rows.rows[0],DegradedGrant);
     if(grant.actorId!==actor||grant.authorizedBy!==ack.actorId||Date.parse(grant.activeFrom)>Date.parse(now)||Date.parse(grant.expiresAt)<=Date.parse(now))throw new Error('SYSTEM_POLICY_SCOPE_EXPIRED');
    }
    if(ack.requestId!==request.id||Date.parse(ack.timestamp)>Date.parse(now)||Date.parse(ack.expiresAt)<=Date.parse(now)||
     (ack.policyId?!approver.roles.some(r=>r==='publisher'||r==='evaluator'):ack.actorId!==actor))throw new Error('INVALID_DEGRADED_ACKNOWLEDGMENT');
    if(ack.reason==='PROVIDER_UNAVAILABLE'){
     if(!ack.originalRunId)throw new Error('MISSING_FAILED_RUN');
     const prior=await c.query('SELECT body,body_hash FROM pathway.runs WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(this.scope),ack.originalRunId]);
     if(!prior.rowCount)throw new Error('MISSING_FAILED_RUN');const run=validateRow(prior.rows[0],RunRecord);
     if(run.actorId!==actor||run.effectiveMode==='lexical'||!run.reasonCodes.includes('PROVIDER_UNAVAILABLE'))throw new Error('INVALID_FAILED_RUN');
     const earlier=await readEvidence(c,this.scope,run.evidenceId,user);
     const {id:_earlierId,...earlierRequest}=earlier.request;
     const {id:_newId,...currentRequest}=request;
     if(hash(earlierRequest)!==hash(currentRequest))throw new Error('FAILED_RUN_REQUEST_MISMATCH');
    }
   }
   const key=hash({actor,requestId:request.id});
   const correction=options.correctionOf===undefined?{}:{correctionOf:Id.parse(options.correctionOf)};
   if(correction.correctionOf)await readEvidence(c,this.scope,correction.correctionOf,user);
   const fingerprint=hash({actor,request,configuration:config,acknowledgment:ack,...correction});
   const duplicate=await c.query('SELECT body,body_hash FROM pathway.idempotency WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(this.scope),key]);
   if(duplicate.rowCount){
    const saved=validateRow(duplicate.rows[0],Idempotency);if(saved.fingerprint!==fingerprint)throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
    const record=await readEvidence(c,this.scope,saved.evidenceId,user);
    const run=await c.query('SELECT body,body_hash FROM pathway.runs WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(this.scope),saved.runId]);
    return {record,run:validateRow(run.rows[0],RunRecord),replayed:true,historical:true};
   }
   const embeddingProvider=options.embeddingProvider??cachedOnlyProvider(config.embedding);
   const embeddings=new CachedEmbeddings(embeddingProvider,new PostgresEmbeddingCache(c,this.scope,options.cacheSource));
   let provider:RetrievalProvider=mode==='lexical'?new LocalLexicalProvider():new PostgresSemanticProvider(c,this.scope,embeddings,config);
   if(mode==='hybrid')provider=new LocalHybridProvider(new LocalLexicalProvider(),provider,config);
   if(options.providerFactory)provider=options.providerFactory(c,provider);
   const record=await new KnowledgePipeline(registry,provider,new EvidenceStore(),()=>now).run(actor,request);
   // Nothing escapes before COMMIT. A DB/serialization/commit error returns no evidence record.
   await insert(c,this.scope,'evidence',record.id,record,actor);
   for(const citation of record.evidenceUsed)await c.query('INSERT INTO pathway.evidence_passages VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[...scoped(this.scope),record.id,citation.passageId]);
   for(const release of record.selectedReleases)await c.query('INSERT INTO pathway.evidence_releases VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[...scoped(this.scope),record.id,release.id]);
   const id=randomUUID(),transactionId=(await c.query('SELECT pg_current_xact_id()::text AS id')).rows[0].id as string;
   const run=RunRecord.parse({id,operationId:id,transactionId,transactionOutcome:'committed',evidenceId:record.id,requestId:request.id,actorId:actor,
    requestedMode:ack?'hybrid':mode,effectiveMode:mode,generation:registry.generation,decisionTimestamp:now,configuration:config,acknowledgment:ack,...correction,
    reasonCodes:[...new Set([...record.support.reasonCodes,...record.action.reasonCodes,...(ack?['DEGRADED_LEXICAL_ACKNOWLEDGED']:[])])],
    diagnostics:{retrieved:record.retrieved,excluded:record.excluded,eligibleVersionIds:record.eligibleVersionIds,selectedReleases:record.selectedReleases,assignmentId:record.caseContext?.assignmentId??null},embeddingUsage:embeddings.usage});
   await insert(c,this.scope,'runs',id,run,actor);
   for(const kind of ['support','applicability','communication','action'] as const)await insert(c,this.scope,'decisions',id+'.'+kind,{id:id+'.'+kind,evidenceId:record.id,kind,decision:record[kind]},actor);
   if(record.escalation)await insert(c,this.scope,'escalations',id+'.escalation',{id:id+'.escalation',evidenceId:record.id,escalation:record.escalation},actor);
   for(const a of record.audit)await insert(c,this.scope,'audit',id+'.'+a.type,{id:id+'.'+a.type,evidenceId:record.id,event:a},actor);
   await insert(c,this.scope,'idempotency',key,{id:key,fingerprint,evidenceId:record.id,runId:id,actorId:actor},actor);
   return {record,run,replayed:false,historical:false};
 }
 async history(actor:string,id:string){return this.db.transaction(this.scope,async c=>readEvidence(c,this.scope,id,(await loadRegistry(c,this.scope)).user(actor)));}
}
async function readEvidence(c:PoolClient,s:Scope,id:string,user:EvidenceRecord['userContext']){
 const r=await c.query('SELECT body,body_hash FROM pathway.evidence WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scoped(s),id]);
 if(!r.rowCount)throw new Error('HISTORICAL_ACCESS_DENIED');const record=validateRow(r.rows[0],EvidenceRecord);
 const {id:actualId,recordHash,...body}=record;const store=new EvidenceStore();const checked=store.put(body);
 if(actualId!==checked.id||recordHash!==checked.recordHash)throw new Error('EVIDENCE_INTEGRITY');return store.get(id,user);
}

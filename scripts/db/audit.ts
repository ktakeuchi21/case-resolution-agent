import assert from 'node:assert/strict';
import pg from 'pg';
import { z } from 'zod';
import { readdirSync,readFileSync } from 'node:fs';
import { connection,validateRow } from '../../src/db/database.ts';
import { Corpus,EvidenceRecord,SourceSupportDecision,ApplicabilityDecision,CommunicationPermissionDecision,ActionPermissionDecision,EscalationRecord,AuditEvent } from '../../src/contracts.ts';
import { EvidenceStore } from '../../src/evidence-store.ts';
import { MemoryEmbeddingCache,VectorRecord } from '../../src/providers/embedding.ts';
import { RunRecord,DegradedGrant } from '../../src/db/retrieval.ts';
import { GenerationResult } from '../../src/generation/index.ts';
import { GovernanceEvent } from '../../src/db/registry.ts';
import { hash,textHash } from '../../src/integrity.ts';
import { artifact } from './parity.ts';
const admin=new pg.Pool(connection(true));
try{
 const checks:Record<string,number>={};
 for(const table of Object.keys(Corpus.shape)){
  const rows=(await admin.query(`SELECT body,body_hash FROM pathway.${table}`)).rows;
  for(const row of rows)validateRow(row,Corpus.shape[table as keyof typeof Corpus.shape].element as z.ZodType<unknown>);
  checks[table]=rows.length;
 }
 for(const [table,schema] of [['events',GovernanceEvent],['runs',RunRecord],['degraded_grants',DegradedGrant],['case_revisions',Corpus.shape.cases.element],['user_revisions',Corpus.shape.users.element],['answers',GenerationResult]] as const){
  const rows=(await admin.query(`SELECT body,body_hash FROM pathway.${table}`)).rows;
  for(const row of rows)validateRow(row,schema as z.ZodType<unknown>);checks[table]=rows.length;
 }
 const evidence=(await admin.query('SELECT workspace,tenant,environment,body,body_hash FROM pathway.evidence')).rows;
 for(const row of evidence){
  const r=validateRow(row,EvidenceRecord),{id,recordHash,...body}=r;const computed=new EvidenceStore().put(body);assert.equal(computed.id,id);assert.equal(computed.recordHash,recordHash);
  for(const cite of r.evidenceUsed){
   const p=(await admin.query('SELECT body,body_hash FROM pathway.passages WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[row.workspace,row.tenant,row.environment,cite.passageId])).rows[0];
   const passage=validateRow(p,Corpus.shape.passages.element);assert.equal(passage.textHash,cite.textHash);assert.equal(passage.text,cite.text);
   const v=(await admin.query('SELECT body,body_hash FROM pathway.versions WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[row.workspace,row.tenant,row.environment,cite.documentVersionId])).rows[0];
   const version=validateRow(v,Corpus.shape.versions.element);assert.equal(version.originalText.slice(cite.locator.start,cite.locator.end),cite.text);assert.equal(textHash(cite.text),cite.textHash);
  }
  assert(r.answer.claims.every(c=>c.passageIds.every(id=>r.evidenceUsed.some(p=>p.passageId===id&&p.text.includes(c.text)))));
 }
 const answers=(await admin.query('SELECT workspace,tenant,environment,body,body_hash FROM pathway.answers')).rows;
 for(const row of answers){const answer=validateRow(row,GenerationResult);const linked=evidence.find(e=>e.workspace===row.workspace&&e.tenant===row.tenant&&e.environment===row.environment&&e.body.id===answer.evidenceId);assert(linked);assert.equal(answer.evidenceHash,linked.body.recordHash);
  for(const citation of answer.citations)assert(linked.body.evidenceUsed.some((c:unknown)=>hash(c)===hash(citation)));}
 checks.evidence=evidence.length;
 const validators={support:SourceSupportDecision,applicability:ApplicabilityDecision,communication:CommunicationPermissionDecision,action:ActionPermissionDecision};
 const decisions=(await admin.query('SELECT body,body_hash FROM pathway.decisions')).rows;
 for(const row of decisions){assert.equal(hash(row.body),row.body_hash);validators[row.body.kind as keyof typeof validators].parse(row.body.decision);}checks.decisions=decisions.length;
 const escalations=(await admin.query('SELECT body,body_hash FROM pathway.escalations')).rows;for(const row of escalations){assert.equal(hash(row.body),row.body_hash);EscalationRecord.parse(row.body.escalation);}checks.escalations=escalations.length;
 const audit=(await admin.query('SELECT body,body_hash FROM pathway.audit')).rows;
 for(const row of audit){assert.equal(hash(row.body),row.body_hash);if(row.body.event?.policyVersion)AuditEvent.parse(row.body.event);else if(row.body.event)GovernanceEvent.parse(row.body.event);}checks.audit=audit.length;
 const vectors=(await admin.query('SELECT body,body_hash FROM pathway.embeddings')).rows;
 for(const row of vectors)await new MemoryEmbeddingCache().put(validateRow(row,VectorRecord));checks.embeddings=vectors.length;
 const roles=(await admin.query("SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='pathway_app'")).rows;assert(roles.every(r=>!r.rolsuper&&!r.rolbypassrls&&!r.rolcreatedb&&!r.rolcreaterole));
 const rls=(await admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pathway' AND relkind='r' ORDER BY relname")).rows;assert(rls.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 const migrations=(await admin.query('SELECT name,sha256 FROM public.pathway_migrations ORDER BY name')).rows;for(const m of migrations)assert.equal(textHash(readFileSync('migrations/'+m.name,'utf8')),m.sha256);
 const extensions=(await admin.query("SELECT extname,extversion FROM pg_extension WHERE extname='vector'")).rows;assert.equal(extensions[0].extversion,'0.8.6');
 const files=readdirSync('artifacts/phase2c').filter(p=>p.endsWith('.json'));for(const name of files)assert.equal(textHash(readFileSync('artifacts/phase2c/'+name,'utf8')),name.slice(name.lastIndexOf('-')+1,-5));
 console.log(JSON.stringify({artifact:artifact('database-audit',{schemaVersion:'phase2c-database-audit-v1',recordedAt:new Date().toISOString(),checks,roles,rls,migrations,extensions,artifactHashesVerified:files.length,pass:true}),checks,pass:true},null,2));
}catch(e){console.error(e instanceof assert.AssertionError?{code:'AUDIT_ASSERTION',message:e.message}:{code:'AUDIT_FAILURE',driverCode:(e as {code?:string}).code??'contract_failure'});process.exitCode=1;}
finally{await admin.end();}

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
import { databaseProfile as selectedDatabaseProfile, inspectDatabaseProfile } from '../../src/db/profile.ts';
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
 // Supabase's extra_float_digits=0 rounds textual real[] coordinates. Read
 // round-trippable float4 values in one read-only session; do not change storage.
 const vectorClient=await admin.connect();
 let vectors;
 try {
  await vectorClient.query('BEGIN READ ONLY');
  await vectorClient.query('SET LOCAL extra_float_digits=3');
  vectors=(await vectorClient.query('SELECT body,body_hash,embedding::real[] AS coordinates FROM pathway.embeddings')).rows;
 } finally {await vectorClient.query('ROLLBACK');vectorClient.release();}
 for(const row of vectors){const vector=validateRow(row,VectorRecord);await new MemoryEmbeddingCache().put(vector);
  assert.equal(row.coordinates.length,vector.vector.length);assert(row.coordinates.every((x:number,i:number)=>Math.fround(x)===Math.fround(vector.vector[i]!)));}
 checks.embeddings=vectors.length;
 const roles=(await admin.query("SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolcanlogin FROM pg_roles WHERE rolname='pathway_app'")).rows;
 assert.equal(roles.length,1,'Exactly one runtime role is required');
 assert(roles.every(r=>!r.rolsuper&&!r.rolbypassrls&&!r.rolcreatedb&&!r.rolcreaterole&&!r.rolinherit&&r.rolcanlogin),'Runtime role capabilities exceed the restricted profile');
 const runtimeMemberships=(await admin.query(`SELECT parent.rolname AS granted_role FROM pg_auth_members m
  JOIN pg_roles member ON member.oid=m.member JOIN pg_roles parent ON parent.oid=m.roleid
  WHERE member.rolname='pathway_app' ORDER BY parent.rolname`)).rows;
 assert.equal(runtimeMemberships.length,0,'Runtime role must not be a member of another role');
 const runtimeOwnership=(await admin.query(`SELECT 'schema' AS object_kind,n.nspname AS schema_name,n.nspname AS object_name
  FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
  WHERE r.rolname='pathway_app' AND n.nspname IN ('pathway','portfolio')
  UNION ALL SELECT 'relation',n.nspname,c.relname FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
  WHERE r.rolname='pathway_app' AND n.nspname IN ('pathway','portfolio')
  ORDER BY object_kind,schema_name,object_name`)).rows;
 assert.equal(runtimeOwnership.length,0,'Runtime role must not own application schemas or relations');
 const rls=(await admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pathway' AND relkind='r' ORDER BY relname")).rows;assert(rls.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 const migrations=(await admin.query('SELECT name,sha256 FROM public.pathway_migrations ORDER BY name')).rows;for(const m of migrations)assert.equal(textHash(readFileSync('migrations/'+m.name,'utf8')),m.sha256);
 const extensions=(await admin.query("SELECT extname,extversion FROM pg_extension WHERE extname='vector'")).rows;
 const databaseProfile=await inspectDatabaseProfile(admin);
 let hostedHardening:Record<string,unknown>|null=null;
 if(selectedDatabaseProfile().hosted){
  const apiRoles=(await admin.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname")).rows;
  assert.deepEqual(apiRoles.map(r=>r.rolname),['anon','authenticated'],'Both Supabase API roles must be checked');
  const apiTablePrivileges=(await admin.query(`SELECT r.rolname,n.nspname AS schema_name,c.relname AS table_name,
   has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS has_table_privilege,
   has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS has_column_privilege
   FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE r.rolname IN ('anon','authenticated') AND c.relkind IN ('r','p','v','m','f')
   AND (n.nspname IN ('pathway','portfolio') OR (n.nspname='public' AND c.relname='pathway_migrations'))
   ORDER BY r.rolname,n.nspname,c.relname`)).rows;
  assert(apiTablePrivileges.length>0,'Hosted application table privileges must be inspected');
  assert(apiTablePrivileges.every(r=>!r.has_table_privilege&&!r.has_column_privilege),'Supabase API roles must have no application table or column privileges');
  const schemaCreatePrivileges=(await admin.query(`SELECT r.rolname,n.nspname AS schema_name,
   has_schema_privilege(r.oid,n.oid,'CREATE') AS can_create FROM pg_roles r CROSS JOIN pg_namespace n
   WHERE r.rolname IN ('pathway_app','anon','authenticated') AND n.nspname IN ('public','extensions')
   ORDER BY r.rolname,n.nspname`)).rows;
  assert.equal(schemaCreatePrivileges.length,6,'All runtime/API role and search-path schema pairs must be inspected');
  assert(schemaCreatePrivileges.every(r=>!r.can_create),'Runtime and API roles must not create objects in search-path schemas');
  const runtimeSchemaUsage=(await admin.query(`SELECT n.nspname AS schema_name,
   has_schema_privilege('pathway_app',n.oid,'USAGE') AS can_use FROM pg_namespace n
   WHERE n.nspname IN ('pathway','portfolio','extensions') ORDER BY n.nspname`)).rows;
  assert.equal(runtimeSchemaUsage.length,3,'All required runtime schemas must be inspected');
  assert(runtimeSchemaUsage.every(r=>r.can_use),'Runtime must have USAGE on application and vector extension schemas');
  const migrationLedgerRls=(await admin.query(`SELECT c.relrowsecurity,c.relforcerowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='pathway_migrations' AND c.relkind='r'`)).rows;
  assert.equal(migrationLedgerRls.length,1,'Migration ledger must exist');
  assert(migrationLedgerRls[0].relrowsecurity&&migrationLedgerRls[0].relforcerowsecurity,'Hosted migration ledger must enforce and force RLS');
  hostedHardening={apiRoles,apiTablePrivileges,schemaCreatePrivileges,runtimeSchemaUsage,migrationLedgerRls};
 }
 const databaseSizeBytes=(await admin.query('SELECT pg_database_size(current_database())::text AS bytes')).rows[0]?.bytes;
 assert(typeof databaseSizeBytes==='string'&&/^\d+$/.test(databaseSizeBytes)&&BigInt(databaseSizeBytes)>0n,'Database size must be recorded');
 const files=readdirSync('artifacts/phase2c').filter(p=>p.endsWith('.json'));for(const name of files)assert.equal(textHash(readFileSync('artifacts/phase2c/'+name,'utf8')),name.slice(name.lastIndexOf('-')+1,-5));
 console.log(JSON.stringify({artifact:artifact('database-audit',{schemaVersion:'phase2c-database-audit-v1',recordedAt:new Date().toISOString(),checks,roles,runtimeMemberships,runtimeOwnership,rls,migrations,extensions,databaseProfile,hostedHardening,databaseSizeBytes,artifactHashesVerified:files.length,pass:true}),checks,pass:true},null,2));
}catch(e){console.error(e instanceof assert.AssertionError?{code:'AUDIT_ASSERTION',message:e.message}:{code:'AUDIT_FAILURE',driverCode:(e as {code?:string}).code??'contract_failure'});process.exitCode=1;}
finally{await admin.end();}

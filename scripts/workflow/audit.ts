import assert from 'node:assert/strict';
import pg from 'pg';
import { connection,validateRow } from '../../src/db/database.ts';
import { Grant,Revocation,Step,Receipt } from '../../src/workflow/contracts.ts';
import { EvidenceRecord } from '../../src/contracts.ts';
import { RunRecord } from '../../src/db/retrieval.ts';
import { assertInvariants } from '../../src/workflow/repository.ts';
import { hash } from '../../src/integrity.ts';
import { artifact } from './run.ts';
const admin=new pg.Pool(connection(true));
try{
 const grants=(await admin.query('SELECT workspace,tenant,environment,body,body_hash FROM pathway.wf_grants')).rows;
 grants.forEach(r=>validateRow(r,Grant));
 const revocations=(await admin.query('SELECT body,body_hash FROM pathway.wf_revocations')).rows;revocations.forEach(r=>validateRow(r,Revocation));
 const receipts=(await admin.query('SELECT body,body_hash FROM pathway.wf_receipts')).rows;receipts.forEach(r=>validateRow(r,Receipt));
 const rows=(await admin.query('SELECT workspace,tenant,environment,body,body_hash FROM pathway.wf_steps ORDER BY workspace,tenant,environment,workflow_id,revision')).rows;
 const previous=new Map<string,Step>();let authorizations=0,links=0;
 for(const row of rows){
  const step=validateRow(row,Step),scope=[row.workspace,row.tenant,row.environment],key=JSON.stringify([...scope,step.workflowId]),last=previous.get(key);
  assert.equal(step.revision,(last?.revision??0)+1);assert.equal(step.previousHash,last?hash(last):null);assertInvariants(step.snapshot);previous.set(key,step);
  const g=Grant.parse(grants.find(r=>r.workspace===row.workspace&&r.tenant===row.tenant&&r.environment===row.environment&&r.body.id===step.snapshot.grantId)?.body);
  const linkRows=(await admin.query('SELECT run_id,evidence_id FROM pathway.wf_knowledge_links WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND step_id=$4',[...scope,step.id])).rows;assert.equal(linkRows.length,step.snapshot.knowledge.length);links+=linkRows.length;
  for(const k of step.snapshot.knowledge){
   const er=(await admin.query('SELECT body,body_hash FROM pathway.evidence WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scope,k.evidenceId])).rows[0];
   const rr=(await admin.query('SELECT body,body_hash FROM pathway.runs WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4',[...scope,k.runId])).rows[0];
   const e=validateRow(er,EvidenceRecord),r=validateRow(rr,RunRecord);assert.equal(r.evidenceId,e.id);assert.equal(k.timestamp,e.timestamp);
   for(const field of ['support','applicability','communication','action'] as const)assert.deepEqual(k[field],e[field]);assert.deepEqual(k.passages,e.evidenceUsed);assert.deepEqual(k.releases,e.selectedReleases);
   assert(linkRows.some(l=>l.run_id===r.id&&l.evidence_id===e.id));
  }
  for(const effect of step.snapshot.effects)for(const a of effect.authorizations){
   authorizations++;const k=step.snapshot.knowledge.find(k=>k.evidenceId===a.evidenceId&&k.runId===a.runId);assert(k);assert.equal(k.support.status,'supported');assert.equal(k.applicability.status,'applicable');assert.equal(k.communication.status,'allowed');
   assert.equal(k.action.status,effect.kind==='transfer'?'requires_approval':'allowed');assert.equal(a.payloadHash,hash(effect.payload));assert.equal(a.grantId,g.id);
   if(effect.kind==='transfer'){assert(a.approvalId);assert(step.snapshot.decisions.some(d=>d.id.replace(/\.decision$/,'.approval')===a.approvalId&&d.actor===g.office&&d.option==='verify_and_approve'));}
   else{assert.equal(effect.payload.documentHash,null);assert.equal(effect.payload.recipient,g.notificationRecipient);}
  }
 }
 const views=(await admin.query("SELECT relname,reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pathway' AND relkind='v' AND relname LIKE 'wf_%'")).rows;
 assert.equal(views.length,5);assert(views.every(v=>v.reloptions.includes('security_invoker=true')));
 console.log(JSON.stringify({artifact:artifact('workflow-audit',{schemaVersion:'phase2d-workflow-audit-v1',recordedAt:new Date().toISOString(),grants:grants.length,revocations:revocations.length,simulatedReceipts:receipts.length,journalSteps:rows.length,workflows:previous.size,validatedSnapshotAuthorizations:authorizations,knowledgeLinks:links,views,pass:true,note:'Counts include retained development and regression workspaces; repeated snapshot references are not independent quality trials.'}),pass:true}));
}finally{await admin.end();}

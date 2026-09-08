import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { createApplicationServer } from '../../src/app/server.ts';
import { digest } from '../../src/app/session.ts';

test('persistent API golden, publication assignment, sandbox and retirement journey',async()=>{
 const service=createApplicationServer();await new Promise<void>(r=>service.server.listen(0,'127.0.0.1',r));
 const address=service.server.address();assert(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}`;
 const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
 await service.sessionDb.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '4 hours')",[digest(token),csrf]);
 const request=async(path:string,body?:unknown)=>{const res=await fetch(url+'/api/'+path,{method:body?'POST':'GET',headers:{cookie:'pathway_session='+token,'x-csrf-token':csrf,'content-type':'application/json',origin:url},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();assert(res.ok,JSON.stringify({status:res.status,data}));return data;};
 const act=(action:string,extra:Record<string,unknown>={})=>request('action',{action,idempotencyKey:'test.'+randomUUID(),...extra});
 try{
  let v=await request('demo',{scenario:'golden'});assert.equal(v.workflow.state,'RECEIVED');
  v=await act('role',{role:'knowledge_reviewer'});v=await act('publish');
  const release=v.knowledge.releases.find((r:{id:string})=>r.id.startsWith('KP-ALDER.PORTFOLIO.'));assert(release);
  v=await act('assign',{releaseId:release.id});assert(v.knowledge.activeAssignmentId.startsWith('AS-PORTFOLIO.'));
  v=await act('publish');assert.equal(v.knowledge.releases.filter((r:{id:string})=>r.id.startsWith('KP-ALDER.PORTFOLIO.')).length,2);
  await act('role',{role:'office'});v=await act('assess');assert.equal(v.workflow.state,'OUTREACH_QUEUED');assert(v.workflow.knowledge.at(-1).releases.some((r:{id:string})=>r.id===release.id));
  v=await act('dispatch');assert.equal(v.workflow.state,'AWAITING_RESPONSE');
  v=await request('state');assert.equal(v.workflow.state,'AWAITING_RESPONSE');
  v=await act('ambiguity');assert.equal(v.workflow.state,'PAUSED');let task=v.workflow.tasks.find((t:{status:string})=>t.status==='open');
  await act('role',{role:'manager'});v=await act('resolve',{taskId:task.id,option:'release_collection'});assert.equal(v.workflow.state,'AWAITING_RESPONSE');assert.equal(v.workflow.effects.length,1);
  await act('role',{role:'office'});v=await act('receive');assert.equal(v.workflow.state,'VERIFICATION_REQUIRED');task=v.workflow.tasks.find((t:{status:string})=>t.status==='open');
  v=await act('resolve',{taskId:task.id,option:'verify_and_approve',documentHash:v.workflow.documentHash,recipient:'sim-receiver-101'});assert.equal(v.workflow.state,'TRANSFER_QUEUED');
  v=await act('dispatch');assert.equal(v.workflow.state,'AWAITING_ACK');v=await act('ack');assert.equal(v.workflow.state,'PA_PENDING');
  const chat=await request('chat',{question:'Which clinician-authenticated encounter narrative remains outstanding?',mode:'governed',idempotencyKey:'test.synonym'});assert.equal(chat.record.support.status,'supported');assert.equal(chat.answer.audit.execution,'none');
  const fixtures=await request('fixtures');for(const file of [...fixtures.files,fixtures.files[0]])await request('upload',{name:file.name,text:file.text,synthetic:true});
  const sb=await request('studio-test',{mode:'sandbox'});assert.notEqual(sb.record.action.status,'allowed');
  await act('reset');await act('assess');v=await request('state');const historical=v.evidence.map((e:{id:string;recordHash:string})=>({id:e.id,hash:e.recordHash}));
  await act('role',{role:'knowledge_reviewer'});await act('retire');await act('role',{role:'office'});v=await act('dispatch');assert.equal(v.workflow.state,'PAUSED');
  for(const e of historical)assert.equal(v.evidence.find((x:{id:string})=>x.id===e.id).recordHash,e.hash);
 }finally{await service.close();}
});

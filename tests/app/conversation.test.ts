import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApplicationServer } from '../../src/app/server.ts';
import { digest } from '../../src/app/session.ts';
import { hash } from '../../src/integrity.ts';

test('conversation fast path: notice, inferred products, knowledge changes, memory and temporary deletion',async()=>{
 const service=createApplicationServer();await new Promise<void>(r=>service.server.listen(0,'127.0.0.1',r));
 const address=service.server.address();assert(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
 const visitors=[0,1].map(()=>({token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex')}));
 const req=async(path:string,input?:unknown,expected=200,visitor=0)=>{const v=visitors[visitor]!;const r=await fetch(origin+'/api/'+path,{method:input?'POST':'GET',headers:{cookie:'pathway_session='+v.token,'x-csrf-token':v.csrf,origin,'content-type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});const body=await r.json();assert.equal(r.status,expected,JSON.stringify(body));return body;};
 const talk=(text:string)=>req('conversation',{idempotencyKey:randomUUID(),text});
 try{
  for(const v of visitors)await service.sessionDb.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '4 hours')",[digest(v.token),v.csrf]);
  const initial=await req('demo',{},201);await req('demo',{},201,1);const baseline=hash(initial.workflow),assignment=initial.knowledge.activeAssignmentId;
  assert.equal(initial.agent.notice.acknowledgedAt,null);assert.equal(initial.agent.knowledge.kind,'sample');
  await req('agent-preferences',{action:'select',selection:{kind:'sample'}});
  const answer=await talk('What should happen next?');assert.equal(answer.disposition,'answer');assert.equal(answer.knowledge.authority,'assigned_case_knowledge');assert.equal(answer.citations.length,3);
  const why=await talk('Why?');assert.equal(why.disposition,'answer');assert.equal(why.interpretation.follows,answer.id);assert(why.message.includes('current evidence'));assert.equal(why.context.state,'RECEIVED');
  const summary=await talk('Summarize this case for a supervisor.');assert.equal(summary.workProduct.audience,'supervisor');assert.equal(summary.operation,'summary');
  const draft=await talk('Draft a short email to the office requesting the missing document.');assert.equal(draft.workProduct.channel,'email');assert.equal(draft.workProduct.audience,'office');
  const warm=await talk('Make that warmer and shorter.');assert.equal(warm.workProduct.tone,'warm');assert.equal(warm.workProduct.basedOn,draft.id);
  const sms=await talk('Turn it into an SMS.');assert.equal(sms.workProduct.channel,'sms');assert(sms.workProduct.body.length<250);assert(!sms.workProduct.body.includes('signed office note'));
  const ambiguous=await talk('Is it ready?');assert.equal(ambiguous.disposition,'clarify');const resolved=await talk('The workflow status.');assert.equal(resolved.clarification.status,'resolved');assert.equal(resolved.inReplyTo,ambiguous.id);
  await req('agent-preferences',{action:'acknowledge_notice'});const acknowledged=(await req('state')).agent.notice.acknowledgedAt;await req('agent-preferences',{action:'acknowledge_notice'});assert.equal((await req('state')).agent.notice.acknowledgedAt,acknowledged);
  await req('conversation',{idempotencyKey:randomUUID(),text:'MRN: 123456'},422);
  const packs=(await req('state')).agent.packs;const allowed=packs.find((p:{available:boolean})=>p.available);assert(allowed);
  await req('agent-preferences',{action:'select',selection:{kind:'pack',releaseId:allowed.id}});assert.equal((await req('state')).knowledge.activeAssignmentId,assignment);
  await req('agent-preferences',{action:'select',selection:{kind:'pack',releaseId:'unknown-release'}},409);
  const upload=await req('studio-upload',{name:'synthetic-conversation.md',base64:Buffer.from('# Synthetic administrative note\n\nA sample document describes an administrative review.').toString('base64'),synthetic:true});
  await req('agent-preferences',{action:'select',selection:{kind:'upload',uploadId:upload.id}},404,1);
  await req('agent-preferences',{action:'select',selection:{kind:'upload',uploadId:upload.id}});
  // No provider is configured in this regression run: semantic exploration must
  // produce an explicit pause, not a lexical answer or new governed authority.
  const sandbox=await talk('What does this document say?');assert.equal(sandbox.disposition,'pause');assert.equal(sandbox.knowledge.authority,'sandbox_only');assert.equal(sandbox.temporaryEvidence.request.mode,'sandbox');assert.equal(sandbox.context.permission.action,'denied');assert(sandbox.reasonCodes.includes('PROVIDER_UNAVAILABLE'));assert(!sandbox.facts.some((f:{authoritative:boolean})=>f.authoritative));
  assert.equal((await service.sessionDb.pool.query('SELECT count(*)::int n FROM portfolio.agent_entries WHERE id=$1',[sandbox.id])).rows[0].n,0);
  assert.equal((await req('state')).knowledge.activeAssignmentId,assignment);
  await req('agent-feedback',{entryId:sandbox.id,rating:'helpful'});
  await req('studio-action',{action:'delete',uploadId:upload.id,revision:upload.revision,confirmed:true,idempotencyKey:randomUUID()});
  const deleted=await req('state');assert.equal(deleted.agent.knowledge,null);assert(!deleted.agent.feedback.some((f:{entry_id:string})=>f.entry_id===sandbox.id));assert(!deleted.agent.entries.some((e:{id:string})=>e.id===sandbox.id));assert(deleted.agent.entries.some((e:{id:string})=>e.id===answer.id));assert.equal(hash(deleted.workflow),baseline);
  await req('agent-preferences',{action:'select',selection:{kind:'sample'}});assert.equal((await req('state')).agent.notice.acknowledgedAt,acknowledged);
 }finally{await service.close();}
});

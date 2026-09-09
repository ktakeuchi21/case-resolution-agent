import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { createApplicationServer } from '../../src/app/server.ts';
import { digest } from '../../src/app/session.ts';
import { baseRequest } from '../../src/evaluation.ts';
import { turnSlots } from '../../src/agent/turn-contract.ts';
import type { SynthesisProvider } from '../../src/agent/provider.ts';
import { hash } from '../../src/integrity.ts';

test('contextual API commits validated full turns, streams only stages, scopes feedback and bounds fresh regeneration',async()=>{
 let calls=0;const compositionInputs:unknown[]=[];
 const usage={requests:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0,costBasis:'Deterministic integration fixture. No live quality evidence.'};
 const provider:SynthesisProvider={identity:{provider:'fixture',model:'contract-only'},complete:async()=>{throw new Error('Unexpected legacy composer');},verify:async()=>{throw new Error('Unexpected legacy verifier');},
  interpret:async input=>{calls++;return {output:{intent:'question',follows:input.history.at(-1)?.id??null,artifactId:null,audience:'case_manager',channel:'chat',tone:'concise',length:'unchanged',retrievalQuestion:baseRequest().question,clarification:null,requestedAction:null,note:'Fixture'},usage};},
  composeTurn:async input=>{calls++;compositionInputs.push(input);const s=input.sources[0]!;return {output:{answer:s.text,rationale:null,workProduct:null,claims:[{id:'claim.1',kind:'fact',text:s.text,locations:['answer'],supports:[{reference:s.reference,quote:s.text}]}],uncertainties:[],requestedAction:null},usage};},
  reviewTurn:async(_input,turn)=>{calls++;return {output:{claims:turn.claims.map(c=>({id:c.id,supported:true,reason:'Fixture'})),slots:turnSlots(turn).map(([slot])=>({slot,allMaterialStatementsCovered:true,supported:true,reason:'Fixture'})),channelSafe:true,transformationFaithful:true,answersActualRequest:true},usage};},
 };
 const service=createApplicationServer({agentProviders:{provider}});await new Promise<void>(r=>service.server.listen(0,'127.0.0.1',r));const address=service.server.address();assert(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
 const visitors=[0,1].map(()=>({token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex')}));
 const req=async(path:string,input?:unknown,expected=200,visitor=0,staged=false)=>{const v=visitors[visitor]!;const r=await fetch(origin+'/api/'+path,{method:input?'POST':'GET',headers:{cookie:'pathway_session='+v.token,'x-csrf-token':v.csrf,origin,'content-type':'application/json',...(staged?{accept:'application/x-ndjson'}:{})},...(input?{body:JSON.stringify(input)}:{})});const text=await r.text();assert.equal(r.status,expected,text);return staged?text.trim().split('\n').map(line=>JSON.parse(line)):JSON.parse(text);};
 try{
  for(const v of visitors)await service.sessionDb.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '4 hours')",[digest(v.token),v.csrf]);
  const initial=await req('demo',{},201);await req('demo',{},201,1);const baseline=hash(initial.workflow);
  const input={idempotencyKey:randomUUID(),text:'What document is missing?'};
  const records=await req('conversation',input,200,0,true),r=records.at(-1).result;
  assert.deepEqual(records.slice(0,-1),['understanding','retrieving','composing','validating'].map(stage=>({type:'stage',stage})));
  assert.equal(r.audit.method,'model-synthesis');assert.equal(r.audit.requests,3);assert(r.turn);assert.equal(calls,3);
  assert.equal(hash(await req('conversation',input)),hash(r));assert.equal(calls,3);
  const vote=await req('agent-feedback',{entryId:r.id,rating:'helpful'});assert.equal(vote.rating,'helpful');await req('agent-feedback',{entryId:r.id,rating:'not_helpful'});assert.equal((await req('state')).agent.feedback[0].rating,'helpful');
  await req('agent-feedback',{entryId:r.id,rating:'helpful'},404,1);
  const regen=await req('conversation',{idempotencyKey:randomUUID(),text:r.query,regenerateId:r.id});assert.equal(regen.turn.regeneratedFrom,r.id);assert.notEqual(regen.evidenceId,r.evidenceId);assert.equal(regen.audit.requests,3);assert.equal((compositionInputs[1] as {memory:unknown[]}).memory.length,0);
  await req('conversation',{idempotencyKey:randomUUID(),text:r.query,regenerateId:regen.id});const before=calls;
  await req('conversation',{idempotencyKey:randomUUID(),text:r.query,regenerateId:r.id},429);assert.equal(calls,before);
  await req('conversation',{idempotencyKey:randomUUID(),text:r.query,regenerateId:r.id},409,1);
  const state=await req('state');assert.equal(hash(state.agent.entries.find((e:{id:string})=>e.id===r.id)),hash(r));assert.equal(hash(state.workflow),baseline);
 }finally{await service.close();}
});

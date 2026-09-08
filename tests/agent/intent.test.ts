import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSettings } from '../../src/agent/preferences.ts';
import { interpretMessage, ConversationRequest } from '../../src/agent/intent.ts';
import type { AgentResponse } from '../../src/agent/contracts.ts';
const defaults=AgentSettings.parse({});
const interpret=(text:string,history:AgentResponse[]=[])=>interpretMessage({idempotencyKey:'intent.test',text},history,defaults,'model');
const product={id:'draft.previous',query:'Draft an office email.',operation:'draft',message:'An unsent draft.',workProduct:{type:'draft',audience:'office',channel:'email',tone:'formal'}} as AgentResponse;
for(const [text,intent,operation] of [
 ['What should happen next?','next_action','ask'],['Summarize this case for a supervisor.','summary','summary'],
 ['Create a CRM note from everything that has happened.','summary','summary'],['Draft a short email to the office requesting the missing document.','draft','draft'],
 ['Explain the evidence and citations.','evidence','ask'],['Record this as a Teams call note: Still waiting. Please provide an update today.','interaction','interaction'],
 ['Send the office email.','human_action','ask'],['Approve the transfer.','human_action','ask'],
] as const)test(`intent: ${text}`,()=>{const r=interpret(text);assert.equal(r.interpretation.intent,intent);assert.equal(r.request.operation,operation);assert.equal(r.request.generation,'model');});
test('plain conversational text requires no attestation or configuration',()=>{assert(ConversationRequest.parse({idempotencyKey:'plain',text:'What next?'}));assert.throws(()=>ConversationRequest.parse({idempotencyKey:'plain',text:'What next?',generation:'evidence'}));});
test('Why uses the previous turn and preserves original query',()=>{const r=interpret('Why?',[product]);assert.equal(r.interpretation.follows,product.id);assert.equal(r.interpretation.retrievalQuestion,product.query);assert.equal(r.request.text,'Why?');});
test('draft refinement carries audience/channel and changes tone without granting execution',()=>{const r=interpret('Make that warmer and shorter.',[product]);assert.equal(r.request.operation,'draft');assert.equal(r.request.audience,'office');assert.equal(r.request.channel,'email');assert.equal(r.request.tone,'warm');assert.equal(r.request.targetId,product.id);assert.equal(r.interpretation.intent,'refinement');});
test('channel conversion uses the prior draft and an explicit SMS choice',()=>{const r=interpret('Turn it into an SMS.',[product]);assert.equal(r.request.operation,'draft');assert.equal(r.request.channel,'sms');assert.equal(r.request.audience,'office');});
test('missing refinement target asks for clarification instead of fabricating a previous draft',()=>{assert.equal(interpret('Make that warmer.').interpretation.intent,'clarification');});
test('natural clarification resolves only an open conversational question',()=>{const prior={id:'clarify.previous',operation:'ask',clarification:{status:'open',options:[{value:'workflow_status',label:'Current workflow status'},{value:'document_requirement',label:'Documentation requirement'}]}} as AgentResponse;const r=interpret('The workflow status.',[prior]);assert.equal(r.request.operation,'clarify');assert.equal(r.request.choice,'workflow_status');assert.equal(r.request.targetId,prior.id);});
test('settings reject unsupported channels, models and unavailable defaults',()=>{assert.throws(()=>AgentSettings.parse({channels:['sms']}));assert.throws(()=>AgentSettings.parse({model:'arbitrary-model'}));assert.throws(()=>AgentSettings.parse({channels:['fax']}));});
test('a call-note request without transcript asks for text and carries its channel into the reply',()=>{
 const first=interpret('Record this as a Teams call note.');assert.equal(first.interpretation.intent,'clarification');
 const pending={id:'missing.transcript',query:first.request.text,operation:'ask',reasonCodes:['INTERACTION_TEXT_REQUIRED']} as AgentResponse;
 const reply=interpret('Still waiting. Please provide an update today.',[pending]);assert.equal(reply.request.operation,'interaction');assert.equal(reply.request.channel,'teams');assert.equal(reply.interpretation.follows,pending.id);
 assert.equal(interpret('Summarize the case for a supervisor.',[pending]).request.operation,'summary');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { AgentProviderFailure, OpenAISynthesisProvider, schemaRejectionCode } from '../../src/agent/provider.ts';
import { textHash } from '../../src/integrity.ts';

test('schema location diagnostics contain only a node index and request-schema fingerprint',()=>{
 const schema={type:'object',properties:{private_marker:{anyOf:[{type:'string',enum:['private document content']},{type:'null'}]}},required:['private_marker'],additionalProperties:false};
 const prefix='PROVIDER_SCHEMA_REJECTED_ANYOF_NOT_ALLOWED_FORMAT_CONTEXT_PROPERTIES',message="Invalid schema for response_format: In context=('properties', 'private_marker'), anyOf is not allowed. private document content";
 const code=schemaRejectionCode(message,schema);
 assert.equal(code,prefix+'_AT_NODE_2_SCHEMA_'+textHash(JSON.stringify(schema)).slice(0,12));
 assert(!code.includes('private'));assert(!code.includes('document'));assert(!code.includes('content'));
 assert.equal(schemaRejectionCode('In context=(), anyOf is not allowed',schema),'PROVIDER_SCHEMA_REJECTED_ANYOF_NOT_ALLOWED_CONTEXT_AT_NODE_0_SCHEMA_'+textHash(JSON.stringify(schema)).slice(0,12));
});

test('unknown, scalar, inherited, oversized and malformed contexts cannot become diagnostic paths',()=>{
 const schema={type:'object',properties:{answer:{type:'string'}}};
 for(const context of ["'properties', 'absent_node'","'properties', 'answer', 'type'","'__proto__'","'properties'; code()","'properties', x",Array(34).fill("'properties'").join(','),"'"+'x'.repeat(2100)+"'"]){
  const code=schemaRejectionCode(`In context=(${context}), anyOf is not allowed.`,schema);
  assert(!code.includes('_AT_NODE_'));assert(code.includes('_SCHEMA_'+textHash(JSON.stringify(schema)).slice(0,12)));
  assert(!/absent_node|__proto__|code\(\)|x{20}/i.test(code));assert(code.length<1200);
 }
});

test('array positions identify separate schema nodes without retaining their field names',()=>{
 const schema={anyOf:[{type:'string'},{type:'null'}]};
 const code=schemaRejectionCode("In context=('anyOf', 1), anyOf is not allowed",schema);
 assert.equal(code,'PROVIDER_SCHEMA_REJECTED_ANYOF_NOT_ALLOWED_CONTEXT_AT_NODE_3_SCHEMA_'+textHash(JSON.stringify(schema)).slice(0,12));
});

test('JSON-array context locations and separator whitespace retain only verified structural indices',()=>{
 const schema={type:'object',properties:{answer:{type:'string'}}};
 const tuple=schemaRejectionCode("In context=('properties', 'answer'), anyOf is not allowed",schema);
 for(const context of ['Context: ["properties", "answer"]',"Context=('properties' , 'answer' )"]){assert.equal(schemaRejectionCode(context+', anyOf is not allowed',schema),tuple);}
});

test('expanded error locations resolve local shared definitions without exposing their paths',()=>{
 const schema={type:'object',properties:{answer:{$ref:'#/$defs/private~1prose'}},$defs:{'private/prose':{type:'array',items:{$ref:'#/$defs/segment'}},segment:{anyOf:[{type:'string'},{type:'null'}]}}};
 const expanded=schemaRejectionCode("In context=('properties', 'answer', 'items', 'anyOf', 1), anyOf is not allowed",schema);
 assert.equal(expanded.split('_AT_NODE_')[1],schemaRejectionCode("In context=('$defs', 'segment', 'anyOf', 1), anyOf is not allowed",schema).split('_AT_NODE_')[1]);
 assert.match(expanded,/_AT_NODE_\d+_SCHEMA_[a-f0-9]{12}$/);assert(!expanded.includes('private'));
 for(const ref of ['https://example.invalid/schema','#/$defs/absent','#/$defs/loop']){
  const unsafe={properties:{answer:{$ref:ref}},$defs:{loop:{$ref:'#/$defs/loop'}}};
  const code=schemaRejectionCode("In context=('properties', 'answer', 'items'), anyOf is not allowed",unsafe);
  assert(code.startsWith('PROVIDER_SCHEMA_REJECTED_ANYOF_ITEMS_NOT_ALLOWED_CONTEXT_PROPERTIES_ANSWER_SCHEMA_'));assert(!code.includes('_AT_NODE_'));
 }
});

test('the actual provider transport associates a bounded rejection with its own submitted schema',async()=>{
 let reserved=0,fingerprint='';
 const provider=new OpenAISynthesisProvider('fixture-only',async()=>{reserved++;},async(_url,options)=>{
  const request=JSON.parse(String(options!.body));fingerprint=textHash(JSON.stringify(request.text.format.schema)).slice(0,12);
  assert.equal(request.model,'gpt-4.1-mini-2025-04-14');assert.equal(request.text.format.strict,true);
  return new Response(JSON.stringify({error:{code:'invalid_json_schema',message:"In context=('properties', 'requestedAction'), anyOf is not allowed. Never retain private-provider-marker."}}),{status:400});
 });
 const input={query:'Synthetic question',canonicalCaseQuery:'Synthetic question',selectedKnowledge:{key:'sample',authority:'assigned_case_knowledge'},workflow:{},defaults:{audience:'office',channel:'chat',tone:'concise'},targetId:null,history:[]};
 await assert.rejects(provider.interpret(input),error=>error instanceof AgentProviderFailure&&/^PROVIDER_SCHEMA_REJECTED_ANYOF_NOT_ALLOWED_CONTEXT_PROPERTIES_REQUESTEDACTION_AT_NODE_\d+_SCHEMA_[a-f0-9]{12}$/.test(error.code)&&error.code.endsWith(fingerprint)&&!error.message.includes('private-provider-marker'));
 assert.equal(reserved,1);
 const schema=z.toJSONSchema(z.strictObject({answer:z.string()}));
 assert.equal(schemaRejectionCode('An unknown private-provider-marker',schema),'PROVIDER_SCHEMA_REJECTED_SCHEMA_'+textHash(JSON.stringify(schema)).slice(0,12)+'_SHAPE_X_X_X');
});

test('unrecognized provider context syntax retains a bounded structural sketch without private values',()=>{
 const schema={type:'object',properties:{answer:{type:'string'}}};
 const code=schemaRejectionCode('Invalid format. In context /properties/private-plaintext-1234: anyOf is not allowed. Bearer private-token-9876',schema);
 assert(code.endsWith('_SHAPE_CONTEXT_PROPERTIES_X_:_ANYOF_X_NOT_ALLOWED_._X_X'));
 assert(!/private|plaintext|Bearer|1234|9876/i.test(code));
});

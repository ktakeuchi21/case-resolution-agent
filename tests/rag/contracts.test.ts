import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Passage, SendInput } from '../../src/rag/contracts.ts';
import type { RetrievalTrace, Turn } from '../../src/rag/contracts.ts';
import { packs, passages, documents } from '../../src/rag/corpus.ts';
import { contextualQuery, eligible, lexicalControl } from '../../src/rag/retrieval.ts';
import { validateAnswer, numberCitations, OpenAIConversation } from '../../src/rag/provider.ts';
import { providerDailyCeiling } from '../../src/rag/service.ts';
import { evaluationCases } from '../../src/rag/evaluation-cases.ts';
const trace:RetrievalTrace={question:'missing?',query:'signed note',packId:'alder',packName:'Alder',caseId:'ALD-1042',method:'hybrid',passages:lexicalControl('signed office note',passages,'alder'),citations:[]};
const valid={answer:'The signed office note is requested. [1]',citations:['alder.N-101.1'],suggestedFollowups:['Why?'],workProduct:null,retrievalContext:'Signed office note N-101'};
test('three synthetic packs have eight source documents and deliberate current, superseded, wrong-case boundaries',()=>{
 for(const p of passages)Passage.parse(p);
 assert.equal(new Set(passages.map(p=>p.id)).size,passages.length);
 for(const p of packs){assert.equal(documents.filter(d=>d.packId===p.id).length,8);assert(p.user.email.endsWith('.example'));assert(evaluationCases.filter(c=>c.packId===p.id).length>=10);assert(passages.some(q=>q.packId===p.id&&!eligible(q,p.id)));}
});
test('wrong-pack, wrong-case and superseded sources never enter lexical retrieval even with exact matching wording',()=>{
 for(const p of packs){const results=lexicalControl('deadline five-business-day two-day shipped insurance card',passages,p.id,99);assert(results.length>0);assert(results.every(r=>eligible(r,p.id)));}
});
test('contextual follow-ups carry referents; a pack boundary drops previous case context',()=>{
 const turn={packId:'alder',status:'complete',question:'What document is missing?',response:valid} as Turn;
 assert.match(contextualQuery('Why?','alder',[turn]),/Signed office note N-101/);
 const switched=contextualQuery('Why?','fulfillment',[turn]);assert(!switched.includes('N-101'));assert(!switched.includes('ALD-1042'));assert(switched.includes('FUL-3091'));
});
test('citation membership, uniqueness and any supplied inline numbering are validated against retrieved passages',()=>{
 assert.deepEqual(validateAnswer(valid,trace),valid);
 assert.equal(validateAnswer({...valid,answer:'The signed office note is requested.'},trace).citations[0],'alder.N-101.1');
 for(const bad of [{...valid,citations:['fulfillment.STATUS-3091.1']},{...valid,citations:['not-retrieved']},{...valid,answer:'A fact. [2]'},{...valid,citations:[valid.citations[0],valid.citations[0]]}])assert.throws(()=>validateAnswer(bad,trace));
});
test('external work-product copy contains no citation machinery and cannot claim sent status',()=>{
 const workProduct={type:'email',subject:'Signed note',body:'Please send the note. [1]',status:'generated_not_sent'};
 assert.throws(()=>validateAnswer({...valid,workProduct},trace));
 assert.throws(()=>validateAnswer({...valid,workProduct:{...workProduct,body:'Please send the note.',status:'sent'}},trace));
});
test('strict public input cannot select model, actor, database or evidence',()=>{
 const input={conversationId:crypto.randomUUID(),requestId:crypto.randomUUID(),text:'Hello'};
 SendInput.parse(input);for(const extra of [{model:'gpt-5.4-pro'},{actor:'owner'},{passages:[]},{session:'other'}])assert.throws(()=>SendInput.parse({...input,...extra}));
 for(const model of ['gpt-5.4','gpt-5.4-pro','gpt-5.5','gpt-5.6-sol','gpt-6-astra','toString'])assert.throws(()=>new OpenAIConversation('fixture',async()=>{},model));
});
test('one bounded malformed-citation repair reuses evidence and accounts for both provider calls',async()=>{
 let reservations=0;const bodies:any[]=[];
 const transport=(async(_url:unknown,init:RequestInit)=>{const body=JSON.parse(init.body as string);bodies.push(body);return new Response(JSON.stringify({status:'completed',usage:{input_tokens:100,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(bodies.length===1?{...valid,citations:['invalid']}:valid)}]}]}));}) as typeof fetch;
 const model=new OpenAIConversation('fixture',async()=>{reservations++;},'gpt-5.4-mini',transport);
 const answer=await model.generate('missing?',packs[0]!,trace,[]);assert.equal(reservations,2);assert.equal(answer.usage.requests,2);assert(bodies[1].input.startsWith(bodies[0].input));assert.deepEqual(bodies[0].text.format,bodies[1].text.format);assert.equal(bodies[0].store,false);
});
test('provider errors do not fabricate an answer or trigger a format repair',async()=>{
 let n=0;const model=new OpenAIConversation('fixture',async()=>{n++;},'gpt-5.4-mini',(async()=>new Response('{}',{status:503})) as typeof fetch);
 await assert.rejects(model.generate('missing?',packs[0]!,trace,[]));assert.equal(n,1);
});

test('failed bounded repairs retain measured usage; missing provider usage remains unknown',async()=>{
 const payload={status:'completed',usage:{input_tokens:100,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...valid,citations:['invalid']})}]}]};
 const model=new OpenAIConversation('fixture',async()=>{},'gpt-5.4-mini',(async()=>new Response(JSON.stringify(payload))) as typeof fetch);
 await assert.rejects(model.generate('missing?',packs[0]!,trace,[]));
 assert.equal(model.usageSnapshot().requests,2);assert.equal(model.usageSnapshot().inputTokens,200);assert.equal(model.usageSnapshot().outputTokens,40);assert.equal(model.usageSnapshot().unmeasuredRequests,0);assert(model.usageSnapshot().estimatedCostUsd!>0);
 const unavailable=new OpenAIConversation('fixture',async()=>{},'gpt-5.4-mini',(async()=>new Response('{}',{status:503})) as typeof fetch);
 await assert.rejects(unavailable.generate('missing?',packs[0]!,trace,[]));assert.equal(unavailable.usageSnapshot().requests,1);assert.equal(unavailable.usageSnapshot().unmeasuredRequests,1);assert.equal(unavailable.usageSnapshot().estimatedCostUsd,null);
});

test('provider passage-ID markers become stable user citations without changing claim text',()=>{
 const source={...valid,answer:'The signed office note is requested. [alder.N-101.1]'};
 assert.deepEqual(numberCitations(source,trace),valid);
 assert.throws(()=>numberCitations({...source,answer:'A fact. [access.BV-2086.1]'},trace));
 assert.throws(()=>numberCitations({...source,workProduct:{type:'email',subject:'Note',body:'Please send it. [alder.N-101.1]',status:'generated_not_sent'}},trace));
});

test('citation normalization keeps only actual prose references and never repairs claim text or accepts unknown IDs',()=>{
 const extra=trace.passages.find(p=>p.id!==valid.citations[0])!.id;
 assert.deepEqual(numberCitations({...valid,answer:'The signed office note is requested. [alder.N-101.1]',citations:[extra,'alder.N-101.1']},trace),valid);
 assert.deepEqual(numberCitations({...valid,answer:'The signed office note is requested. [2]',citations:[extra,'alder.N-101.1']},trace),valid);
 assert.deepEqual(numberCitations({...valid,answer:'The signed office note is requested.'},trace),{...valid,answer:'The signed office note is requested.'});
 assert.throws(()=>numberCitations({...valid,citations:['alder.N-101.1','not-retrieved']},trace));
 assert.throws(()=>numberCitations({...valid,citations:['alder.N-101.1','alder.N-101.1']},trace));
});

test('the inactive acceptance allowance requires an exact configured UTC date and expires automatically',()=>{
 const before=process.env.PATHWAY_RAG_ACCEPTANCE_DAY;
 const beforeRequests=process.env.PATHWAY_RAG_ACCEPTANCE_REQUESTS;
 try{
  delete process.env.PATHWAY_RAG_ACCEPTANCE_REQUESTS;
  delete process.env.PATHWAY_RAG_ACCEPTANCE_DAY;assert.equal(providerDailyCeiling('2026-09-12'),100);
  process.env.PATHWAY_RAG_ACCEPTANCE_DAY='2026-09-12';assert.equal(providerDailyCeiling('2026-09-12'),250);assert.equal(providerDailyCeiling('2026-09-13'),100);assert.equal(providerDailyCeiling('2026-09-13',20),20);
  process.env.PATHWAY_RAG_ACCEPTANCE_REQUESTS='400';assert.equal(providerDailyCeiling('2026-09-12'),400);assert.equal(providerDailyCeiling('2026-09-13'),100);assert.equal(providerDailyCeiling('2026-09-13',20),20);
  process.env.PATHWAY_RAG_ACCEPTANCE_REQUESTS='9999';assert.equal(providerDailyCeiling('2026-09-12'),250);
 }finally{if(before===undefined)delete process.env.PATHWAY_RAG_ACCEPTANCE_DAY;else process.env.PATHWAY_RAG_ACCEPTANCE_DAY=before;if(beforeRequests===undefined)delete process.env.PATHWAY_RAG_ACCEPTANCE_REQUESTS;else process.env.PATHWAY_RAG_ACCEPTANCE_REQUESTS=beforeRequests;}
});

test('a work-product source list is valid without repeating all references in its brief introduction',()=>{
 const workProduct={type:'email',subject:'Signed note',body:'Please send the signed office note through the secure channel.',status:'generated_not_sent'};
 const value={...valid,answer:'Here is the draft for review.',workProduct};
 assert.deepEqual(validateAnswer(value,trace),value);
 assert.throws(()=>validateAnswer({...value,answer:'Here is the draft. [9]'},trace));
 assert.throws(()=>validateAnswer({...value,citations:['not-retrieved']},trace));
});

test('GPT-4.1 mini omits unsupported reasoning and measures its own cached, input and output prices',async()=>{
 const bodies:any[]=[];
 const transport=(async(_url:unknown,init:RequestInit)=>{bodies.push(JSON.parse(init.body as string));return new Response(JSON.stringify({status:'completed',usage:{input_tokens:1000,input_tokens_details:{cached_tokens:200},output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(valid)}]}]}));}) as typeof fetch;
 const model=new OpenAIConversation('fixture',async()=>{},'gpt-4.1-mini',transport);
 const result=await model.generate('missing?',packs[0]!,trace,[]);
 assert.equal(bodies[0].model,'gpt-4.1-mini');assert.equal(Object.hasOwn(bodies[0],'reasoning'),false);
 assert.equal(bodies[0].text.format.strict,true);assert.equal(result.usage.estimatedCostUsd,.0005);
 assert.equal(result.usage.cachedInputTokens,200);assert.equal(result.usage.requests,1);
});

test('GPT-5 mini uses low reasoning and its lower token prices',async()=>{
 const bodies:any[]=[];
 const transport=(async(_url:unknown,init:RequestInit)=>{bodies.push(JSON.parse(init.body as string));return new Response(JSON.stringify({status:'completed',usage:{input_tokens:1000,input_tokens_details:{cached_tokens:200},output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(valid)}]}]}));}) as typeof fetch;
 const model=new OpenAIConversation('fixture',async()=>{},'gpt-5-mini',transport);
 const result=await model.generate('missing?',packs[0]!,trace,[]);
 assert.equal(bodies[0].reasoning.effort,'low');assert.equal(result.usage.estimatedCostUsd,.000405);
});

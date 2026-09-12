import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Passage, SendInput } from '../../src/rag/contracts.ts';
import type { RetrievalTrace, Turn } from '../../src/rag/contracts.ts';
import { packs, passages, documents } from '../../src/rag/corpus.ts';
import { contextualQuery, eligible, lexicalControl } from '../../src/rag/retrieval.ts';
import { validateAnswer, OpenAIConversation } from '../../src/rag/provider.ts';
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
test('citation membership, uniqueness and inline numbering are validated against retrieved passages',()=>{
 assert.deepEqual(validateAnswer(valid,trace),valid);
 for(const bad of [{...valid,citations:['fulfillment.STATUS-3091.1']},{...valid,citations:['not-retrieved']},{...valid,answer:'A fact. [2]'},{...valid,answer:'An uncited fact.'},{...valid,citations:[valid.citations[0],valid.citations[0]]}])assert.throws(()=>validateAnswer(bad,trace));
});
test('external work-product copy contains no citation machinery and cannot claim sent status',()=>{
 const workProduct={type:'email',subject:'Signed note',body:'Please send the note. [1]',status:'generated_not_sent'};
 assert.throws(()=>validateAnswer({...valid,workProduct},trace));
 assert.throws(()=>validateAnswer({...valid,workProduct:{...workProduct,body:'Please send the note.',status:'sent'}},trace));
});
test('strict public input cannot select model, actor, database or evidence',()=>{
 const input={conversationId:crypto.randomUUID(),requestId:crypto.randomUUID(),text:'Hello'};
 SendInput.parse(input);for(const extra of [{model:'gpt-5.4-pro'},{actor:'owner'},{passages:[]},{session:'other'}])assert.throws(()=>SendInput.parse({...input,...extra}));
 assert.throws(()=>new OpenAIConversation('fixture',async()=>{},'gpt-5.4-pro'));
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

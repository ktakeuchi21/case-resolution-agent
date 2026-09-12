import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Database } from '../../src/db/database.ts';
import { Sessions } from '../../src/app/session.ts';
import type { Session } from '../../src/app/session.ts';
import { RagService } from '../../src/rag/service.ts';
import { PersistentRetrieval, lexicalControl } from '../../src/rag/retrieval.ts';
import { OpenAIConversation } from '../../src/rag/provider.ts';
import { getPack, passages } from '../../src/rag/corpus.ts';
import type { ActivityEvent, RetrievalTrace } from '../../src/rag/contracts.ts';
const db=new Database(),sessions=new Sessions(db),service=new RagService(db,sessions);let visitor:Session;
before(async()=>{visitor=(await db.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour') RETURNING *",[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')])).rows[0];});
after(async()=>{if(visitor)await db.pool.query('DELETE FROM portfolio.sessions WHERE token_hash=$1',[visitor.token_hash]);await db.close();});
test('real activity stages persist before publication, survive reload and do not enter generation context',async()=>{
 const originalSearch=PersistentRetrieval.prototype.search,originalProvider=service.provider;
 const conversation=await service.start(visitor,{scenarioId:'access'}),request={conversationId:conversation.id,requestId:randomUUID(),text:'What is blocking this case?'};
 const pack=getPack('access'),trace:RetrievalTrace={question:request.text,query:request.text,packId:'access',packName:pack.name,caseId:pack.caseId,method:'hybrid',passages:lexicalControl(request.text,passages,'access'),citations:[]};
 const events:ActivityEvent[]=[],saved:any[]=[],bodies:any[]=[];let reserves=0;
 try{
  PersistentRetrieval.prototype.search=async()=>trace;
  service.provider=()=>new OpenAIConversation('synthetic-fixture',async()=>{reserves++;},'gpt-5-mini',(async(_url:unknown,init:RequestInit)=>{
   bodies.push(JSON.parse(init.body as string));
   const value={answer:'The member identifier is unreadable.',citations:[bodies.length===1?'invalid':trace.passages[0]!.id],workProduct:null,suggestedFollowups:[],retrievalContext:'member identifier'};
   return new Response(JSON.stringify({status:'completed',usage:{input_tokens:100,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
  }) as typeof fetch);
  const result=await service.send(visitor,request,event=>{events.push(event);saved.push(service.read(visitor,conversation.id).then(c=>c.turns[0]));});
  assert.equal(result.status,'complete');assert.equal(reserves,2);
  assert.deepEqual(events.map(e=>e.stage),['searching','retrieved','generating','checking','repairing','generating','checking','complete']);
  assert.deepEqual(events.map(e=>e.sequence),[1,2,3,4,5,6,7,8]);
  assert(events.every((e,i)=>e.turnId===request.requestId&&e.attempt===1&&e.elapsedMs>=(events[i-1]?.elapsedMs??0)));
  assert.equal(events[1]!.message,`Found ${trace.passages.length} passages across ${new Set(trace.passages.map(p=>p.sourceId)).size} documents.`);
  const persisted=await Promise.all(saved);persisted.forEach((turn,i)=>assert(turn.activity.events.some((e:ActivityEvent)=>e.sequence===events[i]!.sequence)));
  assert.deepEqual((await service.read(visitor,conversation.id)).turns[0],result);
  assert.deepEqual(await service.send(visitor,request),result);assert.equal(reserves,2);
  assert(bodies.every(b=>b.model==='gpt-5-mini'&&!b.stream&&!b.reasoning.summary&&!b.input.includes('elapsedMs')&&!b.input.includes('activity')));
  await service.configure(visitor,{conversationId:conversation.id,packId:'alder'});
  assert.deepEqual((await service.read(visitor,conversation.id)).turns[0],result);
 }finally{PersistentRetrieval.prototype.search=originalSearch;service.provider=originalProvider;}
});
test('provider failure records a terminal activity and a retry starts a fresh attempt',async()=>{
 const original=service.provider,conversation=await service.start(visitor,{scenarioId:'fulfillment'});
 const request={conversationId:conversation.id,requestId:randomUUID(),text:'Where is this case stuck?'};
 try{
  service.provider=()=>{throw Error('fixture private provider detail');};
  const first=await service.send(visitor,request);assert.equal(first.status,'failed');assert(first.activity?.finishedAt);
  assert.deepEqual(first.activity?.events.map(e=>e.stage),['failed']);assert(!JSON.stringify(first).includes('private provider'));
  const retry=await service.send(visitor,{...request,retry:true});assert.equal(retry.attempt,2);assert.equal(retry.activity?.events.length,1);
  assert.equal(retry.activity?.events[0]?.attempt,2);assert.equal(retry.activity?.events[0]?.sequence,1);
 }finally{service.provider=original;}
});

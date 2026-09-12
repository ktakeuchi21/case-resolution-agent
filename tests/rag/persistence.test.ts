import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Database } from '../../src/db/database.ts';
import { Sessions } from '../../src/app/session.ts';
import type { Session } from '../../src/app/session.ts';
import { RagService } from '../../src/rag/service.ts';
const db=new Database(),sessions=new Sessions(db),service=new RagService(db,sessions);const visitors:Session[]=[];
before(async()=>{for(let i=0;i<2;i++)visitors.push((await db.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour') RETURNING *",[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')])).rows[0]);});
after(async()=>{for(const v of visitors)await db.pool.query('DELETE FROM portfolio.sessions WHERE token_hash=$1',[v.token_hash]);await db.close();});
test('real PostgreSQL session isolation, RLS and pack switching preserve original conversations',async()=>{
 const a=visitors[0]!,b=visitors[1]!,conversation=await service.start(a,{scenarioId:'alder'});
 await assert.rejects(service.read(b,conversation.id));assert.equal((await db.pool.query('SELECT * FROM rag.conversations WHERE id=$1',[conversation.id])).rowCount,0);
 const changed=await service.configure(a,{conversationId:conversation.id,packId:'fulfillment'});assert.equal(changed.packId,'fulfillment');assert.equal(changed.scenarioId,'alder');
 await assert.rejects(service.configure(b,{conversationId:conversation.id,packId:'access'}));
});
test('provider failure retains question, retry is bounded and history survives a new service instance',async()=>{
 const a=visitors[0]!,conversation=await service.start(a,{scenarioId:'access'}),request={conversationId:conversation.id,requestId:randomUUID(),text:'What is blocking this case?'};
 const first=await service.send(a,request);assert.equal(first.status,'failed');assert.equal(first.question,request.text);assert.equal(first.response,null);assert.equal(first.trace,null);assert(!first.error!.includes('PROVIDER'));
 assert.deepEqual(await service.send(a,request),first);
 await service.send(a,{...request,retry:true});await service.send(a,{...request,retry:true});await assert.rejects(service.send(a,{...request,retry:true}));
 const reloaded=await new RagService(db,sessions).read(a,conversation.id);assert.equal(reloaded.turns.length,1);assert.equal(reloaded.turns[0]!.attempt,3);
 await assert.rejects(service.send(a,{...request,text:'Different payload'}));
});
test('session expiration cleanup removes conversation derivatives and does not touch seeded knowledge',async()=>{
 const visitor=(await db.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour') RETURNING *",[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')])).rows[0] as Session;
 const conversation=await service.start(visitor,{scenarioId:'fulfillment'});const before=(await db.pool.query('SELECT count(*)::int n FROM rag.passages')).rows[0].n;
 await db.pool.query('DELETE FROM portfolio.sessions WHERE token_hash=$1',[visitor.token_hash]);await assert.rejects(service.read(visitor,conversation.id));assert.equal((await db.pool.query('SELECT count(*)::int n FROM rag.passages')).rows[0].n,before);
});

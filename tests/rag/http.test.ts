import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApplicationServer } from '../../src/app/server.ts';
import { digest } from '../../src/app/session.ts';
const server=createApplicationServer(),visitors=[0,1].map(()=>({token:randomBytes(32).toString('hex'),csrf:randomBytes(32).toString('hex')}));let origin='';
before(async()=>{for(const v of visitors)await server.sessionDb.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')",[digest(v.token),v.csrf]);await new Promise<void>(resolve=>server.server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+(server.server.address() as AddressInfo).port;});
after(async()=>{for(const v of visitors)await server.sessionDb.pool.query('DELETE FROM portfolio.sessions WHERE token_hash=$1',[digest(v.token)]);await server.close();});
async function request(path:string,input?:unknown,visitor=0,headers:Record<string,string>={}){const v=visitors[visitor]!;const response=await fetch(origin+'/api/rag/'+path,{method:input?'POST':'GET',headers:{Cookie:'pathway_session='+v.token,'X-CSRF-Token':v.csrf,'Content-Type':'application/json',Origin:origin,...headers},body:input?JSON.stringify(input):undefined});return {status:response.status,headers:response.headers,body:await response.json() as any};}
test('catalog contains synthetic source passages and no infrastructure/private key fields',async()=>{const r=await request('catalog');assert.equal(r.status,200);assert.equal(r.body.packs.length,3);assert.equal(r.body.documents.length,24);assert.equal(r.body.passages.length,38);assert(r.body.passages.every((p:any)=>p.synthetic));assert(!JSON.stringify(r.body).includes('OPENAI_API_KEY'));});
test('RAG API authenticates sessions, rejects cross-origin and forged configuration, and retains errors without fabrication',async()=>{
 for(const headers of [{'X-CSRF-Token':''},{Origin:'https://untrusted.example'},{'Sec-Fetch-Site':'cross-site'}] as Record<string,string>[])assert.equal((await request('start',{scenarioId:'alder'},0,headers)).status,403);
 assert.equal((await request('start',{scenarioId:'alder',model:'gpt-5.4-pro'})).status,400);
 const created=await request('start',{scenarioId:'alder'});assert.equal(created.status,201);
 assert.equal((await request('conversation?id='+created.body.id,undefined,1)).status,404);
 const result=await request('send',{conversationId:created.body.id,requestId:randomUUID(),text:'What document is missing?'});assert.equal(result.body.status,'failed');assert.equal(result.body.trace,null);assert.equal(result.body.response,null);
 assert.equal((await request('conversation?id='+created.body.id)).body.turns[0].question,'What document is missing?');
 const session=await request('session');assert(!JSON.stringify(session.body).includes(visitors[0]!.token));assert.equal(session.headers.get('cache-control'),'no-store');
});

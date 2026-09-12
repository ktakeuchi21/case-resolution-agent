import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { Database } from '../db/database.ts';
import type { Session, Sessions } from '../app/session.ts';
import { HttpError } from '../app/session.ts';
import { providerConfiguration, reserveProviderRequest } from '../agent/runtime.ts';
import { PackId, SendInput, RagError, recoveryMessage } from './contracts.ts';
import type { Conversation, Turn } from './contracts.ts';
import { getPack } from './corpus.ts';
import { PersistentRetrieval } from './retrieval.ts';
import { OpenAIConversation } from './provider.ts';

// Inactive unless the operator explicitly authorizes and configures an acceptance day.
// The exception expires automatically at the next UTC day; counters are never reset.
export function providerDailyCeiling(today=new Date().toISOString().slice(0,10),configuredLimit=100) {
 // The 400 ceiling is a prepared, inactive option requiring separate operator approval.
 // Existing acceptance deployments remain at 250 unless this exact setting is added.
 return process.env.PATHWAY_RAG_ACCEPTANCE_DAY===today?(process.env.PATHWAY_RAG_ACCEPTANCE_REQUESTS==='400'?400:250):Math.min(configuredLimit,100);
}
export class RagService {
 readonly db:Database;readonly sessions:Sessions;
 constructor(db:Database,sessions:Sessions){this.db=db;this.sessions=sessions;}
 async scoped<T>(session:Session,fn:(c:PoolClient)=>Promise<T>){
  const c=await this.db.pool.connect();
  try{await c.query('BEGIN');await c.query("SELECT set_config('rag.session',$1,true)",[session.token_hash]);const value=await fn(c);await c.query('COMMIT');return value;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async read(session:Session,id:string):Promise<Conversation>{
  return this.scoped(session,async c=>{
   const row=(await c.query('SELECT * FROM rag.conversations WHERE id=$1 AND session_hash=$2',[z.uuid().parse(id),session.token_hash])).rows[0];
   if(!row)throw new HttpError(404,'This conversation is unavailable in your session.');
   const turns=(await c.query('SELECT body FROM rag.turns WHERE conversation_id=$1 AND session_hash=$2 ORDER BY created_at,id',[id,session.token_hash])).rows.map(r=>r.body as Turn);
   return {id:row.id,scenarioId:row.scenario_id,packId:row.pack_id,channel:row.channel,turns};
  });
 }
 async start(session:Session,input:unknown){
  const data=z.strictObject({scenarioId:PackId,channel:z.enum(['chat','email']).optional()}).parse(input),id=randomUUID();
  await this.sessions.limit('rag-conversations.'+session.token_hash,12,14400);
  await this.scoped(session,c=>c.query('INSERT INTO rag.conversations(id,session_hash,scenario_id,pack_id,channel) VALUES($1,$2,$3,$3,$4)',[id,session.token_hash,data.scenarioId,data.channel??getPack(data.scenarioId).defaultChannel]));
  return this.read(session,id);
 }
 async configure(session:Session,input:unknown){
  const data=z.strictObject({conversationId:z.uuid(),packId:PackId.optional(),channel:z.enum(['chat','email']).optional()}).parse(input);
  return this.lock(session,data.conversationId,async()=>{
   await this.read(session,data.conversationId);
   await this.scoped(session,c=>c.query('UPDATE rag.conversations SET pack_id=coalesce($3,pack_id),channel=coalesce($4,channel) WHERE id=$1 AND session_hash=$2',[data.conversationId,session.token_hash,data.packId??null,data.channel??null]));
   return this.read(session,data.conversationId);
  });
 }
 provider(session:Session){
  const config=providerConfiguration();if(!config.enabled)throw new RagError('PROVIDER_NOT_CONFIGURED');
  // Existing shared durable limits include this rebuild and the previous application.
  const bounded={daily:providerDailyCeiling(new Date().toISOString().slice(0,10),config.daily),perSession:Math.min(config.perSession,40)};
  return new OpenAIConversation(process.env.OPENAI_API_KEY!,()=>reserveProviderRequest(this.sessions,session.token_hash,bounded));
 }
 async retrieve(session:Session,input:unknown){
  const data=z.strictObject({packId:PackId,text:z.string().trim().min(1).max(2500)}).parse(input);
  const provider=this.provider(session);
  return new PersistentRetrieval(this.db,texts=>provider.embed(texts)).search(data.text,data.packId);
 }
 async lock<T>(session:Session,conversationId:string,fn:()=>Promise<T>){
  const c=await this.db.pool.connect(),key='rag.'+session.token_hash+'.'+conversationId;
  try{
   if(!(await c.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[key])).rows[0].acquired)throw new HttpError(409,'An answer is still being prepared. Please wait a moment.');
   try{return await fn();}finally{await c.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[key]);}
  }finally{c.release();}
 }
 async send(session:Session,input:unknown,stage:(text:string)=>void=()=>{}) {
  const data=SendInput.parse(input);
  return this.lock(session,data.conversationId,async()=>{
   const conversation=await this.read(session,data.conversationId),existing=conversation.turns.find(t=>t.id===data.requestId);
   if(existing&&(existing.question!==data.text||existing.packId!==conversation.packId))throw new HttpError(409,'Start a new message after changing knowledge.');
   if(existing?.status==='complete')return existing;
   if(existing&&!data.retry)return existing;
   if(existing&&existing.attempt>=3)throw new HttpError(429,'This message has reached its retry limit. Try a new question later.');
   if(!existing&&conversation.turns.length>=40)throw new HttpError(429,'Start a new conversation to keep the context focused.');
   const turn:Turn={id:data.requestId,question:data.text,packId:conversation.packId,createdAt:existing?.createdAt??new Date().toISOString(),status:'pending',response:null,trace:null,usage:null,error:null,feedback:null,attempt:(existing?.attempt??0)+1};
   const save=async()=>{const saved=await this.scoped(session,c=>c.query(`INSERT INTO rag.turns(id,conversation_id,session_hash,body) VALUES($1,$2,$3,$4)
    ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body WHERE rag.turns.session_hash=EXCLUDED.session_hash AND rag.turns.conversation_id=EXCLUDED.conversation_id`,[turn.id,conversation.id,session.token_hash,JSON.stringify(turn)]));if(!saved.rowCount)throw new HttpError(409,'Choose a new request identifier.');};
   await save();stage('Looking through the selected knowledge…');
   let provider:OpenAIConversation|undefined;
   try {
    provider=this.provider(session);const currentProvider=provider,retrieval=new PersistentRetrieval(this.db,texts=>currentProvider.embed(texts));
    const history=conversation.turns.filter(t=>t.id!==turn.id);
    const trace=await retrieval.search(data.text,conversation.packId,history);
    stage('Preparing an answer with its sources…');
    const {response,usage}=await provider.generate(data.text,getPack(conversation.packId),trace,history);
    trace.citations=response.citations.map((passageId,i)=>({number:i+1,passageId}));
    turn.status='complete';turn.response=response;turn.trace=trace;turn.usage=usage;
   } catch(e) {
    turn.status='failed';turn.error=recoveryMessage;turn.usage=provider?.usageSnapshot()??null;
    console.error(JSON.stringify({event:'rag_turn_failed',turnId:turn.id,code:e instanceof RagError?e.code:'SERVICE_FAILURE'}));
   }
   await save();return turn;
  });
 }
 async feedback(session:Session,input:unknown){
  const data=z.strictObject({conversationId:z.uuid(),turnId:z.uuid(),value:z.enum(['helpful','not_helpful'])}).parse(input);
  await this.read(session,data.conversationId);
  await this.scoped(session,c=>c.query("UPDATE rag.turns SET body=jsonb_set(body,'{feedback}',to_jsonb($4::text)) WHERE id=$1 AND conversation_id=$2 AND session_hash=$3",[data.turnId,data.conversationId,session.token_hash,data.value]));
  return {saved:true};
 }
}

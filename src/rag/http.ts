import { evaluationCases } from './evaluation-cases.ts';
import { PersistentRetrieval } from './retrieval.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RagService } from './service.ts';
import { packs, documents, passages } from './corpus.ts';
import { HttpError } from '../app/session.ts';
import { providerConfiguration } from '../agent/runtime.ts';
import { defaultConversationModel } from './provider.ts';

export async function ragHttp(req:IncomingMessage,res:ServerResponse,url:URL,service:RagService,body:(req:IncomingMessage,limit?:number)=>Promise<unknown>,json:(res:ServerResponse,status:number,value:unknown)=>void){
 const path=url.pathname.slice('/api/rag'.length);
 if(path==='/catalog'&&req.method==='GET'){json(res,200,{version:'rag-v1',synthetic:true,packs,documents,passages});return;}
 if(path==='/session'&&req.method==='GET'){
  const s=await service.sessions.get(req,res,true);await service.sessions.limit('read.'+s.token_hash,240,60);
  json(res,200,{csrf:s.csrf,expiresAt:s.expires_at,live:providerConfiguration().enabled,model:process.env.PATHWAY_RAG_MODEL??defaultConversationModel});return;
 }
 const s=await service.sessions.get(req,res);await service.sessions.limit('read.'+s.token_hash,240,60);
 if(path==='/conversation'&&req.method==='GET'){json(res,200,await service.read(s,url.searchParams.get('id')??''));return;}
 if(req.method!=='POST')throw new HttpError(404,'This page is unavailable.');
 service.sessions.verifyCsrf(req,s);await service.sessions.limit('write.'+s.token_hash,30,60);await service.sessions.limit('attempts.'+s.token_hash,150,14400);
 const input=await body(req,12000);
 if(path==='/start'){json(res,201,await service.start(s,input));return;}
 if(path==='/configure'){json(res,200,await service.configure(s,input));return;}
 if(path==='/prepare-evaluation'){const provider=service.provider(s),retrieval=new PersistentRetrieval(service.db,texts=>provider.embed(texts));await retrieval.ensureEmbeddings();const preparation=await retrieval.warmQueries(evaluationCases.map(t=>({packId:t.packId,text:t.retrievalQuestion})));json(res,200,{...preparation,usage:provider.usageSnapshot()});return;}
 if(path==='/retrieve'){json(res,200,await service.retrieve(s,input));return;}
 if(path==='/feedback'){json(res,200,await service.feedback(s,input));return;}
 if(path==='/send'){
  if(req.headers.accept==='application/x-ndjson'){
   const stage=(message:string)=>{if(!res.headersSent)res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'});if(!res.destroyed)res.write(JSON.stringify({type:'stage',message})+'\n');};
   const turn=await service.send(s,input,stage);
   if(!res.headersSent)res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store'});
   res.end(JSON.stringify({type:'result',turn})+'\n');
  }else json(res,200,await service.send(s,input));
  return;
 }
 throw new HttpError(404,'This page is unavailable.');
}

import { createServer } from 'node:http';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { readFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve,extname } from 'node:path';
import { z } from 'zod';
import { Database,connection } from '../db/database.ts';
import { Application,uploadFixtures } from './service.ts';
import { Sessions,HttpError } from './session.ts';
import { configuredPublicOrigin } from './origin.ts';
import { databaseProfile,inspectDatabaseProfile } from '../db/profile.ts';
const bodyLimit=12_000;
async function body(req:IncomingMessage,limit=bodyLimit){
 if(!String(req.headers['content-type']??'').startsWith('application/json'))throw new HttpError(415,'Send JSON with the supported content type.');
 let length=0;const parts:Buffer[]=[];for await(const part of req){length+=part.length;if(length>limit)throw new HttpError(413,limit===bodyLimit?'Upload/request too large. Maximum legacy fixture size is 8 KB.':'Upload/request too large. Maximum Studio file size is 1 MB.');parts.push(part);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;}catch{throw new HttpError(400,'Invalid JSON request.');}
}
function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
export function createApplicationServer(options:{db?:Database;sessionDb?:Database;webRoot?:string}={}){
 const publicOrigin=configuredPublicOrigin();
 const db=options.db??new Database(),sessionDb=options.sessionDb??new Database({...connection(),max:4});
 const sessions=new Sessions(sessionDb),app=new Application(db,sessions);let active=0;
 const cleanup=setInterval(()=>{void app.studio.prune().catch(()=>{});},5*60_000);cleanup.unref();
 void app.studio.prune().catch(()=>{});
 const webRoot=resolve(options.webRoot??fileURLToPath(new URL('../../web/',import.meta.url)));
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options','DENY');if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000');
  let counted=false;
  try{
   const host=req.headers.host??'localhost',url=new URL(req.url??'/',`http://${host}`);
   if(url.pathname==='/healthz'){if(databaseProfile().hosted)await inspectDatabaseProfile(db.pool);await db.pool.query('SELECT 1 FROM portfolio.sessions WHERE false UNION ALL SELECT 1 FROM pathway.answers WHERE false UNION ALL SELECT 1 FROM portfolio.agent_entries WHERE false UNION ALL SELECT 1 FROM portfolio.studio_uploads WHERE false UNION ALL SELECT 1 FROM portfolio.agent_preferences WHERE false UNION ALL SELECT 1 FROM portfolio.temporary_agent_entries WHERE false');json(res,200,{status:'ok',synthetic:true,service:'pathway-agent',version:'digital-worker-v1'});return;}
   if(url.pathname.startsWith('/api/')){
    if(req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Cross-site requests are not allowed.');
    const origin=req.headers.origin,expected=publicOrigin;
    if(origin&&origin!==(expected??`http://${host}`))throw new HttpError(403,'Request origin is not allowed.');
    if(active>=2)throw new HttpError(503,'The demo is busy. Please retry in a moment.');active++;counted=true;
    if(url.pathname==='/api/session'&&req.method==='GET'){
     const s=await sessions.get(req,res,true);await sessions.limit('read.'+s.token_hash,240,60);json(res,200,{csrf:s.csrf,session:{id:s.token_hash.slice(0,12),role:s.role,expiresAt:s.expires_at.toISOString()},data:s.workspace?await app.view(s):null});return;
    }
    const s=await sessions.get(req,res);await sessions.limit('read.'+s.token_hash,240,60);
    if(req.method==='GET'){
     if(url.pathname==='/api/evidence'){json(res,200,await app.historicalEvidence(s,url.searchParams.get('id')));return;}
     if(url.pathname==='/api/state'){json(res,200,await app.view(s));return;}
     if(url.pathname==='/api/fixtures'){json(res,200,{files:uploadFixtures});return;}
     if(url.pathname==='/api/studio-original'){
      const original=await app.studio.original(s,url.searchParams.get('id')??'');
      res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${original.name.replace(/[^A-Za-z0-9_.()-]/g,'_')}"`,'Cache-Control':'no-store'});res.end(original.bytes);return;
     }
     throw new HttpError(404,'This API route does not exist.');
    }
    if(req.method!=='POST')throw new HttpError(405,'Method not allowed.');
    sessions.verifyCsrf(req,s);await sessions.limit('write.'+s.token_hash,30,60);await sessions.limit('attempts.'+s.token_hash,150,14400);const input=await body(req,url.pathname==='/api/studio-upload'?1_410_000:url.pathname==='/api/studio-action'?120_000:url.pathname==='/api/agent'?40_000:bodyLimit);
    if(url.pathname==='/api/demo'){
     const data=z.strictObject({scenario:z.enum(['golden','exception','retirement']).default('golden')}).parse(input);
     const view=await sessions.exclusive(s,async(current,c)=>app.view(current.workspace?current:await app.start(current,data.scenario,c),c));json(res,201,view);return;
    }
    if(url.pathname==='/api/action'){json(res,200,await app.action(s,input));return;}
    if(url.pathname==='/api/chat'){json(res,200,await app.chat(s,input));return;}
    if(url.pathname==='/api/conversation'){json(res,200,await app.agent.respond(s,input,true));return;}
    if(url.pathname==='/api/agent-preferences'){json(res,200,await app.agent.configure(s,input));return;}
    if(url.pathname==='/api/agent'){json(res,200,await app.agent.respond(s,input));return;}
    if(url.pathname==='/api/studio-upload'){json(res,200,await app.studio.upload(s,input));return;}
    if(url.pathname==='/api/studio-action'){json(res,200,await app.studio.action(s,input));return;}
    if(url.pathname==='/api/studio-query'){json(res,200,await app.studio.test(s,input));return;}
    if(url.pathname==='/api/upload'){json(res,200,await app.upload(s,input));return;}
    if(url.pathname==='/api/studio-test'){
     const data=z.strictObject({mode:z.enum(['governed','sandbox'])}).parse(input);
     json(res,200,await app.chat(s,{question:data.mode==='governed'?'Which signed office note document is missing for this request?':'Which signed office note document is requested?',mode:data.mode,idempotencyKey:'studio.'+crypto.randomUUID()}));return;
    }
    throw new HttpError(404,'This API route does not exist.');
   }
   if(req.method!=='GET'&&req.method!=='HEAD')throw new HttpError(405,'Method not allowed.');
   const decoded=decodeURIComponent(url.pathname);if(decoded.includes('..')||decoded.includes('\\')||decoded.includes('\0'))throw new HttpError(404,'Not found.');
   const relative=decoded==='/'?'index.html':decoded.slice(1),file=resolve(webRoot,relative);
   if(!file.startsWith(webRoot+'/')||!existsSync(file))throw new HttpError(404,'Not found.');
   const mime:Record<string,string>={'.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
   if(!mime[extname(file)])throw new HttpError(404,'Not found.');const bytes=readFileSync(file);
   res.writeHead(200,{'Content-Type':mime[extname(file)]!,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){
   const status=error instanceof HttpError?error.status:error instanceof z.ZodError?400:503;
   // Never return driver messages, connection strings, request payloads or provider responses.
   json(res,status,{error:error instanceof HttpError?error.message:status===400?'Invalid request. Check the selected action and input.':'The service could not complete this request. Your durable case is preserved; retry or refresh.',code:status===503?'SERVICE_UNAVAILABLE':'REQUEST_REJECTED'});
  }finally{if(counted)active--;}
 });
 server.requestTimeout=15_000;server.headersTimeout=10_000;server.keepAliveTimeout=5_000;
 return {server,db,sessionDb,app,sessions,close:async()=>{clearInterval(cleanup);await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));await db.close();await sessionDb.close();}};
}
if(process.argv[1]?.endsWith('/server.ts')||process.argv[1]?.endsWith('/server.js')){
 const service=createApplicationServer();const port=Number(process.env.PORT??3000);
 service.server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`Pathway Agent synthetic demo listening on port ${port}`));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void service.close().then(()=>process.exit(0));});
}

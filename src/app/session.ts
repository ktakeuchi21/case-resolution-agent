import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';
import type { IncomingMessage,ServerResponse } from 'node:http';
import type { PoolClient } from 'pg';
import { Database } from '../db/database.ts';
export class HttpError extends Error {readonly status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export interface Session {token_hash:string;csrf:string;workspace:string|null;role:'office'|'manager'|'supervisor'|'knowledge_reviewer';scenario:string;demo_clock:Date;expires_at:Date;reset_count:number;actions:number}
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export class Sessions {
 readonly db:Database;constructor(db:Database){this.db=db;}
 async limit(key:string,max:number,seconds:number){
  const r=await this.db.pool.query("INSERT INTO portfolio.limits(key,hits,expires_at) VALUES($1,1,clock_timestamp()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN portfolio.limits.expires_at<clock_timestamp() THEN 1 ELSE portfolio.limits.hits+1 END,expires_at=CASE WHEN portfolio.limits.expires_at<clock_timestamp() THEN clock_timestamp()+$2*interval '1 second' ELSE portfolio.limits.expires_at END RETURNING hits",[key,seconds]);
  if(r.rows[0].hits>max)throw new HttpError(429,'Demo rate limit reached. Please wait before trying again.');
 }
 async get(req:IncomingMessage,res:ServerResponse,create=false):Promise<Session>{
  const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('pathway_session='))?.slice(16);
  if(token&&/^[a-f0-9]{64}$/.test(token)){
   const r=await this.db.pool.query('SELECT * FROM portfolio.sessions WHERE token_hash=$1 AND expires_at>clock_timestamp()',[digest(token)]);if(r.rowCount)return r.rows[0] as Session;
  }
  if(!create)throw new HttpError(401,'Your demo session expired. Start a new session.');
  await this.db.pool.query('DELETE FROM portfolio.sessions WHERE expires_at<clock_timestamp()');
  await this.db.pool.query('DELETE FROM portfolio.items WHERE expires_at<clock_timestamp()');
  await this.db.pool.query('DELETE FROM portfolio.limits WHERE expires_at<clock_timestamp()');
  await this.limit('session-global',100,3600);await this.limit('session-ip.'+digest(req.socket.remoteAddress??'unknown'),10,3600);
  const value=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
  const r=await this.db.pool.query("INSERT INTO portfolio.sessions(token_hash,csrf,expires_at) VALUES($1,$2,clock_timestamp()+interval '4 hours') RETURNING *",[digest(value),csrf]);
  const secure=process.env.NODE_ENV==='production';res.setHeader('Set-Cookie',`pathway_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=14400${secure?'; Secure':''}`);return r.rows[0] as Session;
 }
 verifyCsrf(req:IncomingMessage,s:Session){const given=req.headers['x-csrf-token'];if(typeof given!=='string'||!/^[a-f0-9]{64}$/.test(given)||!timingSafeEqual(Buffer.from(given),Buffer.from(s.csrf)))throw new HttpError(403,'Request verification failed. Refresh the page and try again.');}
 async reserveWorkspace(workspace:string){
  const c=await this.db.pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(402061)');
   if(!(await c.query('SELECT 1 FROM portfolio.reservations WHERE workspace=$1',[workspace])).rowCount){
    if((await c.query('SELECT count(*)::int n FROM portfolio.reservations')).rows[0].n>=64)throw new HttpError(429,'The public demo is at capacity. Please contact the portfolio owner.');
    await c.query('INSERT INTO portfolio.reservations(workspace) VALUES($1)',[workspace]);
   }await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async exclusive<T>(session:Session,fn:(current:Session,c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.pool.connect();try{
   await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='10s'");
   const r=await c.query('SELECT * FROM portfolio.sessions WHERE token_hash=$1 AND expires_at>clock_timestamp() FOR UPDATE',[session.token_hash]);if(!r.rowCount)throw new HttpError(401,'Session expired.');
   const result=await fn(r.rows[0] as Session,c);await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}

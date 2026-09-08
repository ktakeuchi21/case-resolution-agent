import pg from 'pg';
import type { PoolClient, PoolConfig } from 'pg';
import { z } from 'zod';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Id, Mode } from '../contracts.ts';
import { hash, textHash } from '../integrity.ts';
import { databaseProfile, hostedConnection, inspectDatabaseProfile } from './profile.ts';

export const Scope = z.strictObject({ workspace: Id, tenant: Id, environment: Mode });
export type Scope = z.infer<typeof Scope>;
export const scoped = (s: Scope) => [s.workspace,s.tenant,s.environment];
export function connection(admin = false): PoolConfig {
  const url = admin ? process.env.PATHWAY_ADMIN_DATABASE_URL : process.env.PATHWAY_DATABASE_URL;
  if (databaseProfile().hosted) {
    if (!url) throw new Error('HOSTED_DATABASE_URL_REQUIRED');
    const config=hostedConnection(url);
    if (!new RegExp(`^${admin?'postgres':'pathway_app'}\\.[a-z]{20}$`).test(config.user ?? '')) throw new Error('DATABASE_ROLE_CONFIGURATION_MISMATCH');
    return config;
  }
  if (url) {
    let target:URL;
    try { target=new URL(url); } catch { throw new Error('INVALID_LOCAL_DATABASE_URL'); }
    const hosts=target.searchParams.getAll('host');
    if (hosts.length>1 || hosts[0]==='') throw new Error('HOSTED_PROFILE_REQUIRED');
    const localNames=['','localhost','127.0.0.1','[::1]'];
    const host=hosts[0]??target.hostname;
    if (!['postgres:','postgresql:'].includes(target.protocol) ||
      !localNames.includes(target.hostname) || (!localNames.includes(host) && !host.startsWith('/'))) throw new Error('HOSTED_PROFILE_REQUIRED');
    return {connectionString:url,max:6};
  }
  return { host:resolve('.local/postgres/socket'), port:55432,
    database:'pathway',user:admin?'pathway_owner':'pathway_app',max:6 };
}
export class Database {
  readonly pool: pg.Pool;
  constructor(config: PoolConfig = connection()) { this.pool=new pg.Pool(config); this.pool.on('error',()=>{ /* Never emit raw driver errors/credentials. Next operation fails explicitly. */ }); }
  async close() { await this.pool.end(); }
  // Bind an already-open application transaction to the same RLS and serialization
  // boundary used by transaction(). Caller owns commit/rollback.
  async bindScope(c: PoolClient, scope: Scope) {
    Scope.parse(scope);
    if (databaseProfile().hosted) { await inspectDatabaseProfile(c); await c.query('SET LOCAL search_path = pg_catalog, public, extensions'); }
    const role=await c.query("SELECT rolsuper,rolbypassrls,EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='pathway' AND n.nspowner=r.oid) AS owns_schema FROM pg_roles r WHERE rolname=current_user");
    if(role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls || role.rows[0]?.owns_schema) throw new Error('Runtime role must not bypass RLS');
    await c.query("SELECT set_config('pathway.workspace',$1,true),set_config('pathway.tenant',$2,true),set_config('pathway.environment',$3,true)",scoped(scope));
    await c.query("SET LOCAL statement_timeout='30s'");
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scoped(scope).join('/')]);
  }
  async transaction<T>(scope: Scope, fn: (client: PoolClient) => Promise<T>, lock = true): Promise<T> {
    Scope.parse(scope); const c=await this.pool.connect();
    try {
      if (databaseProfile().hosted) await inspectDatabaseProfile(c);
      const role=await c.query("SELECT rolsuper,rolbypassrls,EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='pathway' AND n.nspowner=r.oid) AS owns_schema FROM pg_roles r WHERE rolname=current_user");
      if (role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls || role.rows[0]?.owns_schema) throw new Error('Runtime role must not bypass RLS');
      await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      if (databaseProfile().hosted) await c.query('SET LOCAL search_path = pg_catalog, public, extensions');
      await c.query("SELECT set_config('pathway.workspace',$1,true),set_config('pathway.tenant',$2,true),set_config('pathway.environment',$3,true)",scoped(scope));
      await c.query("SET LOCAL lock_timeout='10s'"); await c.query("SET LOCAL statement_timeout='30s'");
      if(lock) await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scoped(scope).join('/')]);
      // Every governance read follows the lock. READ COMMITTED obtains a fresh snapshot after any waiter.
      const result=await fn(c); await c.query('COMMIT'); return result;
    } catch(e) { await c.query('ROLLBACK').catch(()=>{}); throw e; }
    finally { c.release(); }
  }
}
export async function migrate(config=connection(true)) {
  const pool=new pg.Pool(config),c=await pool.connect();
  try {
    if (databaseProfile().hosted) {
      await inspectDatabaseProfile(c);
      await c.query('SET search_path = pg_catalog, public, extensions');
    }
    await c.query('SELECT pg_advisory_lock(204260907)');
    if (databaseProfile().hosted) await c.query('BEGIN');
    try {
      await c.query('CREATE TABLE IF NOT EXISTS public.pathway_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
      if (databaseProfile().hosted) {
        // Supabase default privileges expose new public tables to API roles.
        // The migration ledger is administrator-only, even though it is in public.
        await c.query('REVOKE ALL ON TABLE public.pathway_migrations FROM PUBLIC, anon, authenticated, service_role');
        await c.query('ALTER TABLE public.pathway_migrations ENABLE ROW LEVEL SECURITY');
        await c.query('ALTER TABLE public.pathway_migrations FORCE ROW LEVEL SECURITY');
        await c.query('COMMIT');
      }
    } catch (e) { if (databaseProfile().hosted) await c.query('ROLLBACK'); throw e; }
    for(const file of readdirSync('migrations').filter(f=>/^\d+.*\.sql$/.test(f)).sort()) {
      const sql=readFileSync(resolve('migrations',file),'utf8'),digest=textHash(sql);
      const prior=await c.query('SELECT sha256 FROM public.pathway_migrations WHERE name=$1',[file]);
      if(prior.rowCount) { if(prior.rows[0].sha256!==digest)throw new Error('Applied migration checksum changed'); continue; }
      await c.query('BEGIN');
      try { await c.query(sql);await c.query('INSERT INTO public.pathway_migrations(name,sha256) VALUES($1,$2)',[file,digest]);await c.query('COMMIT'); }
      catch(e) {await c.query('ROLLBACK');throw e;}
    }
    if (databaseProfile().hosted) {
      await c.query('REVOKE ALL ON TABLE public.pathway_migrations FROM pathway_app');
      await c.query('GRANT USAGE ON SCHEMA extensions TO pathway_app');
    }
    return (await c.query('SELECT name,sha256,applied_at FROM public.pathway_migrations ORDER BY name')).rows;
  } finally { await c.query('SELECT pg_advisory_unlock(204260907)').catch(()=>{});c.release();await pool.end(); }
}
export function validateRow<T>(row: {body:unknown;body_hash:string},schema:z.ZodType<T>):T {
  const body=schema.parse(row.body);if(hash(body)!==row.body_hash)throw new Error('DATABASE_ROW_INTEGRITY');return body;
}
const tables=new Set(['documents','versions','passages','collections','packs','releases','assignments','cases','users','case_revisions','events','evidence','runs','decisions','escalations','audit','idempotency','degraded_grants','wf_grants','wf_revocations','wf_steps','wf_receipts','answers','user_revisions']);
export async function insert(c:PoolClient,s:Scope,table:string,id:string,body:unknown,actor:string) {
  if(!tables.has(table))throw new Error('Unknown repository table');
  Id.parse(id);Id.parse(actor);
  const prior=await c.query(`SELECT body_hash FROM pathway.${table} WHERE workspace=$1 AND tenant=$2 AND environment=$3 AND id=$4`,[...scoped(s),id]);
  const h=hash(body);
  if(prior.rowCount) {if(prior.rows[0].body_hash!==h)throw new Error('IMMUTABLE_ID_COLLISION');return false;}
  await c.query(`INSERT INTO pathway.${table}(workspace,tenant,environment,id,body,body_hash,created_by,authorized_by) VALUES($1,$2,$3,$4,$5,$6,$7,$7)`,[...scoped(s),id,JSON.stringify(body),h,actor]);return true;
}

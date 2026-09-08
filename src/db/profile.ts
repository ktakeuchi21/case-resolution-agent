import type { PoolClient, PoolConfig } from 'pg';
import { readFileSync } from 'node:fs';

export function databaseProfile(env: NodeJS.ProcessEnv = process.env) {
  const id = env.PATHWAY_DATABASE_PROFILE ?? 'local-pg18-vector086';
  if (id === 'local-pg18-vector086') return { id, postgres: '18.6', vector: '0.8.6', hosted: false };
  if (id === 'supabase-pg17-vector082') return { id, postgres: '17.6', vector: '0.8.2', hosted: true };
  throw new Error('UNKNOWN_DATABASE_PROFILE');
}

export function hostedConnection(url: string, env: NodeJS.ProcessEnv = process.env): PoolConfig {
  if (!databaseProfile(env).hosted) throw new Error('HOSTED_PROFILE_REQUIRED');
  let parsed: URL;
  let database: string, user: string, password: string;
  try {
    parsed = new URL(url);
    database = decodeURIComponent(parsed.pathname.slice(1));
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch { throw new Error('INVALID_HOSTED_DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname.endsWith('.pooler.supabase.com') || parsed.port !== '5432') throw new Error('HOSTED_SESSION_POOLER_REQUIRED');
  if (parsed.searchParams.size !== 0) throw new Error('HOSTED_URL_QUERY_OPTIONS_FORBIDDEN');
  if (!env.PATHWAY_DATABASE_CA_FILE) throw new Error('DATABASE_CA_FILE_REQUIRED');
  // Explicit fields prevent URL SSL flags from replacing certificate verification.
  return { host: parsed.hostname, port: 5432, database, user, password,
    ssl: { ca: readFileSync(env.PATHWAY_DATABASE_CA_FILE, 'utf8'), rejectUnauthorized: true },
    max: 6, connectionTimeoutMillis: 15000 };
}

export async function inspectDatabaseProfile(client: Pick<PoolClient, 'query'>) {
  const row = (await client.query(`SELECT current_setting('server_version') AS postgres, version() AS build,
    e.extversion AS vector, n.nspname AS extension_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector'`)).rows[0];
  const expected = databaseProfile();
  // Homebrew reports its packaging suffix in server_version; retain the raw
  // value in evidence while accepting only this observed local build suffix.
  const postgres = !expected.hosted && row?.postgres === `${expected.postgres} (Homebrew)`
    ? expected.postgres : row?.postgres;
  if (!row || postgres !== expected.postgres || row.vector !== expected.vector ||
    (expected.hosted && row.extension_schema !== 'extensions')) throw new Error('DATABASE_PROFILE_MISMATCH');
  return { profile: expected.id, ...row };
}

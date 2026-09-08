import pg from 'pg';
import assert from 'node:assert/strict';
import { connection, migrate } from '../../src/db/database.ts';
import { databaseProfile, inspectDatabaseProfile } from '../../src/db/profile.ts';
import { artifact } from './parity.ts';

// Explicit provisioning for an identified, empty synthetic Supabase project only.
const project = process.argv[2];
assert(project && /^[a-z]{20}$/.test(project), 'Supply the approved Supabase project reference');
assert(databaseProfile().hosted, 'Select the hosted database profile explicitly');
const config = connection(true);
assert.equal(config.user, `postgres.${project}`);
assert.equal(config.database, 'postgres');
const pool = new pg.Pool(config);
let emptySchemaVerified = false;
try {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(204260907)');
    const preflight = (await c.query(`SELECT current_setting('server_version') AS postgres,
      EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('pathway','portfolio')) AS existing_application_schema,
      EXISTS(SELECT 1 FROM pg_available_extension_versions WHERE name='vector' AND version='0.8.2') AS version_available`)).rows[0];
    assert.equal(preflight.postgres, '17.6');
    assert.equal(preflight.existing_application_schema, false, 'Bootstrap requires empty application schemas; use normal migrate for existing deployment');
    assert.equal(preflight.version_available, true);
    emptySchemaVerified = true;
    await c.query('BEGIN');
    try {
      await c.query("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions VERSION '0.8.2'");
      await inspectDatabaseProfile(c);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; }
  } finally { await c.query('SELECT pg_advisory_unlock(204260907)').catch(()=>{}); c.release(); }
  const first = await migrate(config), second = await migrate(config);
  assert.deepEqual(first, second);
  assert.equal(first.length, 8);
  const profile = await inspectDatabaseProfile(pool);
  console.log(JSON.stringify({artifact:artifact('hosted-bootstrap', {schemaVersion:'hosted-bootstrap-v1',
    recordedAt:new Date().toISOString(),project,profile,emptySchemaVerified,migrations:first,
    repeatMigrationsIdentical:true,migrationFilesModified:false,pass:true}),pass:true}));
} catch (e) {
  const errorCode = typeof (e as {code?:unknown})?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test((e as {code:string}).code) ? (e as {code:string}).code : 'BOOTSTRAP_FAILURE';
  console.error(JSON.stringify({artifact:artifact('hosted-bootstrap-incomplete', {schemaVersion:'hosted-bootstrap-incomplete-v1',
    recordedAt:new Date().toISOString(),project,emptySchemaVerified,errorCode,pass:false}),errorCode}));
  process.exitCode = 1;
} finally { await pool.end(); }

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import type { PoolClient } from 'pg';
import { databaseProfile, hostedConnection, inspectDatabaseProfile } from '../src/db/profile.ts';
import { connection } from '../src/db/database.ts';

const hostedProfile = 'supabase-pg17-vector082';
const hostedEnv = { PATHWAY_DATABASE_PROFILE: hostedProfile };
function syntheticUrl() {
  const url = new URL('postgresql://aws-0-us-west-2.pooler.supabase.com:5432/postgres');
  url.username = 'pathway_app.synthetic-project';
  url.password = 'synthetic credential:/@';
  return url;
}
async function withProfile(profile: string | undefined, action: () => Promise<void>) {
  const prior = process.env.PATHWAY_DATABASE_PROFILE;
  try {
    if (profile === undefined) delete process.env.PATHWAY_DATABASE_PROFILE;
    else process.env.PATHWAY_DATABASE_PROFILE = profile;
    await action();
  } finally {
    if (prior === undefined) delete process.env.PATHWAY_DATABASE_PROFILE;
    else process.env.PATHWAY_DATABASE_PROFILE = prior;
  }
}
function clientWith(rows: unknown[]): Pick<PoolClient, 'query'> {
  return { query: async (sql: string) => {
    assert.match(sql, /^SELECT current_setting\('server_version'\)/);
    assert.match(sql, /WHERE e\.extname='vector'/);
    return { rows };
  } } as unknown as Pick<PoolClient, 'query'>;
}
const connectionEnvironmentNames = ['PATHWAY_DATABASE_PROFILE', 'PATHWAY_DATABASE_URL',
  'PATHWAY_ADMIN_DATABASE_URL', 'PATHWAY_DATABASE_CA_FILE'] as const;
async function withConnectionEnvironment(
  values: Partial<Record<typeof connectionEnvironmentNames[number], string>>,
  action: () => void | Promise<void>,
) {
  const prior = new Map(connectionEnvironmentNames.map(name => [name, process.env[name]]));
  try {
    for (const name of connectionEnvironmentNames) {
      if (values[name] === undefined) delete process.env[name];
      else process.env[name] = values[name];
    }
    await action();
  } finally {
    for (const name of connectionEnvironmentNames) {
      if (prior.get(name) === undefined) delete process.env[name];
      else process.env[name] = prior.get(name);
    }
  }
}

test('database profiles retain exact local defaults and require a recognized hosted opt-in', () => {
  assert.deepEqual(databaseProfile({}), { id: 'local-pg18-vector086', postgres: '18.6', vector: '0.8.6', hosted: false });
  assert.deepEqual(databaseProfile(hostedEnv), { id: hostedProfile, postgres: '17.6', vector: '0.8.2', hosted: true });
  for (const id of ['', 'supabase', 'supabase-pg17-vector083', 'local-pg18-vector086 ']) {
    assert.throws(() => databaseProfile({ PATHWAY_DATABASE_PROFILE: id }), /UNKNOWN_DATABASE_PROFILE/);
  }
  assert.throws(() => hostedConnection(syntheticUrl().href, {}), /HOSTED_PROFILE_REQUIRED/);
});

test('hosted connections reject transaction pooling, alternate endpoints and URL SSL overrides', () => {
  for (const [field, value] of [['port', '6543'], ['port', ''], ['hostname', 'localhost'],
    ['hostname', 'pooler.supabase.com.attacker.invalid']] as const) {
    const url = syntheticUrl(); url[field] = value;
    assert.throws(() => hostedConnection(url.href, hostedEnv), /HOSTED_SESSION_POOLER_REQUIRED/);
  }
  assert.throws(() => hostedConnection(syntheticUrl().href.replace(/^postgresql:/, 'https:'), hostedEnv), /HOSTED_SESSION_POOLER_REQUIRED/);
  for (const query of ['sslmode=disable', 'sslmode=no-verify', 'sslmode=require', 'sslrootcert=/tmp/untrusted',
    'options=-c%20search_path%3Duntrusted', 'application_name=unexpected']) {
    const url = syntheticUrl(); url.search = query;
    assert.throws(() => hostedConnection(url.href, hostedEnv), /HOSTED_URL_QUERY_OPTIONS_FORBIDDEN/);
  }
});

test('hosted connections require a CA and preserve TLS verification using explicit connection fields', () => {
  assert.throws(() => hostedConnection(syntheticUrl().href, hostedEnv), /DATABASE_CA_FILE_REQUIRED/);
  const directory = mkdtempSync(join(tmpdir(), 'pathway-profile-test-'));
  try {
    const path = join(directory, 'synthetic-ca.txt');
    const ca = 'SYNTHETIC TEST TEXT: NOT A CERTIFICATE OR SECRET\n';
    writeFileSync(path, ca, { mode: 0o600 });
    const config = hostedConnection(syntheticUrl().href, { ...hostedEnv, PATHWAY_DATABASE_CA_FILE: path });
    assert.equal(config.host, 'aws-0-us-west-2.pooler.supabase.com');
    assert.equal(config.port, 5432);
    assert.equal(config.database, 'postgres');
    assert.equal(config.user, 'pathway_app.synthetic-project');
    assert.equal(config.password, 'synthetic credential:/@');
    assert.deepEqual(config.ssl, { ca, rejectUnauthorized: true });
    assert.equal(config.connectionString, undefined);
    assert.equal(config.connectionTimeoutMillis, 15000);
    assert.throws(() => hostedConnection(syntheticUrl().href, {
      ...hostedEnv, PATHWAY_DATABASE_CA_FILE: join(directory, 'missing-ca.txt'),
    }), { code: 'ENOENT' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('malformed hosted URLs cannot expose credentials through an uncaught parser error', () => {
  const badEncoding = syntheticUrl(); badEncoding.password = '%invalid';
  for (const malformed of [syntheticUrl().href.replace(':5432/', ':invalid-port/'), badEncoding.href]) {
    assert.throws(() => hostedConnection(malformed, hostedEnv), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'INVALID_HOSTED_DATABASE_URL');
      assert.equal(Object.hasOwn(error, 'input'), false);
      assert.equal(Object.hasOwn(error, 'cause'), false);
      assert.ok(!inspect(error).includes('synthetic%20credential'));
      assert.ok(!inspect(error).includes(malformed));
      return true;
    });
  }
});

test('profile inspection accepts only the exact hosted PostgreSQL, vector and extension schema', async () => {
  await withProfile(hostedProfile, async () => {
    const row = { postgres: '17.6', vector: '0.8.2', extension_schema: 'extensions' };
    assert.deepEqual(await inspectDatabaseProfile(clientWith([row])), { profile: hostedProfile, ...row });
    for (const invalid of [[], [{ ...row, postgres: '17.7' }], [{ ...row, postgres: '18.6' }],
      [{ ...row, vector: '0.8.6' }], [{ ...row, vector: null }], [{ ...row, extension_schema: 'public' }],
      [{ ...row, extension_schema: 'untrusted' }]]) {
      await assert.rejects(inspectDatabaseProfile(clientWith(invalid)), /DATABASE_PROFILE_MISMATCH/);
    }
  });
});

test('profile inspection retains local version checks and restores environment on rejection', async () => {
  const prior = process.env.PATHWAY_DATABASE_PROFILE;
  await withProfile(undefined, async () => {
    const row = { postgres: '18.6', vector: '0.8.6', extension_schema: 'public' };
    assert.deepEqual(await inspectDatabaseProfile(clientWith([row])), { profile: 'local-pg18-vector086', ...row });
    const packaged = { ...row, postgres: '18.6 (Homebrew)' };
    assert.deepEqual(await inspectDatabaseProfile(clientWith([packaged])), { profile: 'local-pg18-vector086', ...packaged });
    for (const postgres of ['18.7 (Homebrew)', '18.6 (unknown)', '18.60', '18.6beta1']) {
      await assert.rejects(inspectDatabaseProfile(clientWith([{ ...row, postgres }])), /DATABASE_PROFILE_MISMATCH/);
    }
    await assert.rejects(inspectDatabaseProfile(clientWith([{ ...row, vector: '0.8.2' }])), /DATABASE_PROFILE_MISMATCH/);
  });
  await assert.rejects(withProfile('unknown', async () => {
    await inspectDatabaseProfile(clientWith([]));
  }), /UNKNOWN_DATABASE_PROFILE/);
  assert.equal(process.env.PATHWAY_DATABASE_PROFILE, prior);
});

test('connection rejects hosted URLs without an explicit hosted profile for either role', async () => {
  const prior = connectionEnvironmentNames.map(name => process.env[name]);
  await withConnectionEnvironment({ PATHWAY_DATABASE_URL: syntheticUrl().href,
    PATHWAY_ADMIN_DATABASE_URL: syntheticUrl().href }, () => {
    assert.throws(() => connection(), /HOSTED_PROFILE_REQUIRED/);
    assert.throws(() => connection(true), /HOSTED_PROFILE_REQUIRED/);
  });
  // Compare without printing any inherited environment values if restoration fails.
  assert.ok(connectionEnvironmentNames.every((name, index) => process.env[name] === prior[index]));
});

test('local-profile validation rejects ambiguous host overrides before the pg parser can select a remote host', async () => {
  const urls: URL[] = [];
  for (const hostname of ['localhost', 'remote.invalid']) {
    for (const query of ['host=', 'host=localhost&host=remote.invalid', 'host=localhost&host=localhost']) {
      const url = new URL('postgresql://localhost:55432/pathway');
      url.hostname = hostname; url.search = query; urls.push(url);
    }
  }
  const maskedRemote = syntheticUrl(); maskedRemote.searchParams.set('host', 'localhost'); urls.push(maskedRemote);
  await withConnectionEnvironment({}, () => {
    for (const url of urls) {
      process.env.PATHWAY_DATABASE_URL = url.href;
      process.env.PATHWAY_ADMIN_DATABASE_URL = url.href;
      assert.throws(() => connection(), /HOSTED_PROFILE_REQUIRED/);
      assert.throws(() => connection(true), /HOSTED_PROFILE_REQUIRED/);
    }
  });
});

test('hosted connection distinguishes project-scoped runtime and administrator login names', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pathway-connection-test-'));
  try {
    const path = join(directory, 'synthetic-ca.txt');
    writeFileSync(path, 'SYNTHETIC CA TEST TEXT ONLY\n', { mode: 0o600 });
    const runtime = syntheticUrl(), admin = syntheticUrl();
    runtime.username = 'pathway_app.abcdefghijklmnopqrst';
    admin.username = 'postgres.abcdefghijklmnopqrst';
    await withConnectionEnvironment({ ...hostedEnv, PATHWAY_DATABASE_CA_FILE: path,
      PATHWAY_DATABASE_URL: runtime.href, PATHWAY_ADMIN_DATABASE_URL: admin.href }, () => {
      assert.equal(connection().user, runtime.username);
      assert.equal(connection(true).user, admin.username);
      for (const administrator of [false, true]) {
        const variable = administrator ? 'PATHWAY_ADMIN_DATABASE_URL' : 'PATHWAY_DATABASE_URL';
        for (const role of ['service_role.abcdefghijklmnopqrst', 'pathway_app.short',
          'postgres.short', 'pathway_app.ABCDEFGHIJKLMNOPQRST',
          administrator ? runtime.username : admin.username]) {
          const wrong = syntheticUrl(); wrong.username = role;
          process.env[variable] = wrong.href;
          assert.throws(() => connection(administrator), /DATABASE_ROLE_CONFIGURATION_MISMATCH/);
        }
        delete process.env[variable];
        assert.throws(() => connection(administrator), /HOSTED_DATABASE_URL_REQUIRED/);
      }
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('local Unix socket URLs remain supported and malformed local URLs are sanitized', async () => {
  const local = new URL('postgresql://localhost:55432/pathway');
  local.username = 'pathway_app';
  local.password = 'synthetic-only';
  local.searchParams.set('host', '/tmp/pathway-synthetic-socket');
  await withConnectionEnvironment({ PATHWAY_DATABASE_URL: local.href, PATHWAY_ADMIN_DATABASE_URL: local.href }, () => {
    assert.equal(connection().connectionString, local.href);
    assert.equal(connection(true).connectionString, local.href);
    for (const variable of ['PATHWAY_DATABASE_URL', 'PATHWAY_ADMIN_DATABASE_URL'] as const) {
      const malformed = local.href.replace(':55432/', ':invalid-port/');
      process.env[variable] = malformed;
      assert.throws(() => connection(variable === 'PATHWAY_ADMIN_DATABASE_URL'), error => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'INVALID_LOCAL_DATABASE_URL');
        assert.equal(Object.hasOwn(error, 'input'), false);
        assert.equal(Object.hasOwn(error, 'cause'), false);
        assert.ok(!inspect(error).includes('synthetic-only'));
        assert.ok(!inspect(error).includes(malformed));
        return true;
      });
    }
  });
});

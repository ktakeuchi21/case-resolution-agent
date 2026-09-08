import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Reuse the latest retained local database created by test:postgres. No cloud
// credential discovery, database deletion or modification of prior artifacts.
const reports = readdirSync('artifacts/phase2c').filter(f => /^empty-database-.*\.json$/.test(f))
 .map(f => ({ path: 'artifacts/phase2c/' + f, mtime: statSync('artifacts/phase2c/' + f).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
if (!reports.length) throw new Error('Run npm run test:postgres to create a retained verification database.');
const requested=process.argv[3];
const report = requested ? reports.map(r=>JSON.parse(readFileSync(r.path,'utf8'))).find(r=>r.database===requested) : JSON.parse(readFileSync(reports[0]!.path, 'utf8'));
if(!report)throw new Error('Choose an existing retained verification database.');
if (!/^pathway_verify_[a-f0-9]+$/.test(report.database) || !report.pass) throw new Error('Verified local database required.');
const url = (role: string) => { const u = new URL('postgresql:///'); u.pathname = '/' + report.database; u.searchParams.set('host', resolve('.local/postgres/socket')); u.searchParams.set('port', '55432'); u.searchParams.set('user', role); return u.href; };
const env = { ...process.env, PATHWAY_DATABASE_PROFILE: 'local-pg18-vector086', PATHWAY_DATABASE_URL: url('pathway_app'), PATHWAY_ADMIN_DATABASE_URL: url('pathway_owner') };
const command = process.argv[2] ?? 'app';
const args = ['serve','serve-built'].includes(command) ? [command==='serve-built'?'dist/src/app/server.js':'src/app/server.ts'] : command === 'migrate' ? ['scripts/db/cli.ts', 'migrate'] : ['--test', '--test-concurrency=1', ...readdirSync(`tests/${command}`).filter(f => f.endsWith('.test.ts')).map(f => `tests/${command}/${f}`)];
if (!['app', 'workflow', 'postgres', 'serve', 'serve-built', 'migrate'].includes(command)) throw new Error('Choose app, workflow, postgres, serve, serve-built or migrate.');
const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
child.once('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => child.kill(signal));

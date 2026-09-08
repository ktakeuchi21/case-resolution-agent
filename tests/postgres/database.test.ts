import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { Database,connection,migrate } from '../../src/db/database.ts';
import { seed,GovernanceRepository } from '../../src/db/governance.ts';
import { PersistentRetrieval } from '../../src/db/retrieval.ts';
import { baseRequest } from '../../src/evaluation.ts';
import { FIXED_TIME } from '../../src/registry.ts';
import { artifact } from '../../scripts/db/parity.ts';
import { db,fixture,unit } from './helpers.ts';
import { databaseProfile } from '../../src/db/profile.ts';
import { readdirSync } from 'node:fs';
const owner=new pg.Pool(connection(true));after(async()=>{await db.close();await owner.end();});

test('ordered migrations succeed on a new empty database and seed is deterministic',{skip:databaseProfile().hosted?'Hosted empty-schema migration is verified by the explicit bootstrap; do not create extra cloud databases.':false},async()=>{
 const database='pathway_verify_'+randomUUID().replaceAll('-','');assert(/^[a-z0-9_]+$/.test(database));
 await owner.query(`CREATE DATABASE ${database}`);
 const adminConfig={...connection(true),database},appConfig={...connection(),database};
 const first=await migrate(adminConfig),second=await migrate(adminConfig);assert.deepEqual(first,second);assert.deepEqual(first.map(r=>r.name),readdirSync('migrations').filter(f=>/^\d+.*\.sql$/.test(f)).sort());
 const fresh=new Database(appConfig);
 try{
  const a=await seed(fresh,'empty-test'),b=await seed(fresh,'empty-test');assert.deepEqual(a,b);
  const scope={workspace:'empty-test',tenant:'T-DEMO',environment:'governed' as const};
  assert((await new GovernanceRepository(fresh,scope).snapshot()).corpus.versions.length>0);
  const r=await new PersistentRetrieval(fresh,scope,()=>FIXED_TIME).run('avery',baseRequest(),{embeddingProvider:unit});assert.equal(r.record.action.status,'allowed');
  artifact('empty-database',{schemaVersion:'phase2c-empty-database-v1',database,migrations:first,seed:a,repeatSeedIdentical:true,hybridRun:r.run.id,pass:true,note:'Disposable verification database retained; no automatic database or volume deletion.'});
 }finally{await fresh.close();}
});
test('immutable triggers reject owner writes too; runtime role cannot truncate',async()=>{
 const f=await fixture();const e=await f.service.run('avery',baseRequest(),{embeddingProvider:unit});
 await assert.rejects(owner.query('UPDATE pathway.evidence SET body=body WHERE workspace=$1 AND id=$2',[f.workspace,e.record.id]),/IMMUTABLE_RECORD/);
 await assert.rejects(owner.query('DELETE FROM pathway.releases WHERE workspace=$1',[f.workspace]),/IMMUTABLE_RECORD/);
 await assert.rejects(db.transaction(f.scope,c=>c.query('TRUNCATE pathway.evidence CASCADE')),/permission denied/);
 const unsafe=new Database(connection(true));try{await assert.rejects(unsafe.transaction(f.scope,async()=>null),/must not bypass RLS/);}finally{await unsafe.close();}
});
test('SQL independently rejects vector dimension mismatches',async()=>{
 const f=await fixture();await f.service.run('avery',baseRequest(),{embeddingProvider:unit});
 await assert.rejects(db.transaction(f.scope,async c=>{
  const r=(await c.query('SELECT body,body_hash FROM pathway.embeddings LIMIT 1')).rows[0];
  await c.query('INSERT INTO pathway.embeddings(workspace,tenant,environment,id,body,body_hash,embedding) VALUES($1,$2,$3,$4,$5,$6,$7::vector)',[f.workspace,f.scope.tenant,f.scope.environment,'bad-dimensions',JSON.stringify(r.body),r.body_hash,'[1,0]']);
 }),/check constraint/);
});

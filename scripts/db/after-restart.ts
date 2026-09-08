import assert from 'node:assert/strict';
import { readdirSync,readFileSync } from 'node:fs';
import { Database } from '../../src/db/database.ts';
import { GovernanceRepository } from '../../src/db/governance.ts';
import { PersistentRetrieval } from '../../src/db/retrieval.ts';
import { artifact } from './parity.ts';
import { textHash } from '../../src/integrity.ts';
const db=new Database();
try{
 const name=readdirSync('artifacts/phase2c').filter(n=>n.startsWith('restart-concurrency-')).map(name=>({name,data:JSON.parse(readFileSync('artifacts/phase2c/'+name,'utf8'))})).sort((a,b)=>Date.parse(b.data.recordedAt)-Date.parse(a.data.recordedAt))[0];
 if(!name)throw new Error('Run the restart demonstration first');
 const trace=name.data,bytes=readFileSync('artifacts/phase2c/'+name.name,'utf8');assert(name.name.includes(textHash(bytes)));
 const scope={workspace:trace.workspace as string,tenant:'T-DEMO',environment:'governed' as const};
 const start=(await db.pool.query('SELECT pg_postmaster_start_time() AS started')).rows[0].started as Date;
 assert(start.getTime()>Date.parse(trace.recordedAt),'Stop/start PostgreSQL after the demonstration before this check');
 const original=trace.steps.find((s:{step:number})=>s.step===3).result.record;
 const previous=await new PersistentRetrieval(db,scope).history('avery',original.id);assert.deepEqual(previous,original);
 const registry=await new GovernanceRepository(db,scope).snapshot();assert(registry.isRetired('K-PA.v2'));
 const result={schemaVersion:'phase2c-server-restart-v1',sourceDemo:name.name,serverStartedAt:start.toISOString(),demoRecordedAt:trace.recordedAt,evidenceId:previous.id,recordHash:previous.recordHash,historicalEvidenceUnchanged:true,activeRetirementSurvived:true,pass:true};
 console.log(JSON.stringify({artifact:artifact('server-restart',result),pass:true},null,2));
}catch(e){console.error(e instanceof assert.AssertionError?{code:'RESTART_ASSERTION',message:e.message}:{code:'RESTART_VERIFICATION_FAILURE'});process.exitCode=1;}
finally{await db.close();}

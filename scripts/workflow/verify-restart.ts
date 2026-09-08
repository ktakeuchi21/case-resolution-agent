import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { Database } from '../../src/db/database.ts';
import { WorkflowRepository } from '../../src/workflow/repository.ts';
import { artifact } from './run.ts';
const db=new Database();try{
 const files=readdirSync('artifacts/phase2d').filter(p=>p.startsWith('scenario-verification-')).map(p=>JSON.parse(readFileSync('artifacts/phase2d/'+p,'utf8'))).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));
 const v=files.at(-1);assert(v);const started=(await db.pool.query('SELECT pg_postmaster_start_time() started')).rows[0].started.toISOString();assert(Date.parse(started)>Date.parse(v.recordedAt),'Restart PostgreSQL after the workflow demonstration first');
 const restored=[];for(const scenario of v.scenarios){const steps=await new WorkflowRepository(db,scenario.scope).read('avery','SC-01');assert.equal(steps.at(-1)!.snapshot.state,scenario.finalState);restored.push({name:scenario.name,workspace:scenario.scope.workspace,state:steps.at(-1)!.snapshot.state,steps:steps.length});}
 console.log(JSON.stringify({artifact:artifact('server-restart',{schemaVersion:'phase2d-server-restart-v1',recordedAt:new Date().toISOString(),serverStartedAt:started,demonstrationRecordedAt:v.recordedAt,restored,pass:true}),pass:true}));
}finally{await db.close();}

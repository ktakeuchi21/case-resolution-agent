import test from 'node:test';
import assert from 'node:assert/strict';
import {Sessions} from '../../src/app/session.ts';

function fixture(count:number,existing=false){
 const statements:string[]=[];let released=false;
 const client={async query(sql:string){statements.push(sql);if(sql.startsWith('SELECT 1 FROM portfolio.reservations'))return {rowCount:existing?1:0};if(sql.startsWith('SELECT count(*)'))return {rows:[{n:count}]};return {rowCount:1};},release(){released=true;}};
 const sessions=new Sessions({pool:{connect:async()=>client}} as any);
 return {sessions,statements,released:()=>released};
}
test('workspace capacity admits reservation 128 under the existing serialized transaction',async()=>{
 const f=fixture(127);await f.sessions.reserveWorkspace('isolated-test');
 assert.equal(f.statements[0],'BEGIN');assert(f.statements.includes('SELECT pg_advisory_xact_lock(402061)'));
 assert.equal(f.statements.filter(s=>s.startsWith('INSERT INTO portfolio.reservations')).length,1);
 assert.equal(f.statements.at(-1),'COMMIT');assert(f.released());
});
test('workspace capacity rejects workspace 129 without insertion or deletion',async()=>{
 const f=fixture(128);await assert.rejects(f.sessions.reserveWorkspace('isolated-test'),/at capacity/);
 assert.equal(f.statements.at(-1),'ROLLBACK');assert(!f.statements.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));assert(f.released());
});
test('workspace capacity preserves idempotent reservations at capacity',async()=>{
 const f=fixture(128,true);await f.sessions.reserveWorkspace('isolated-test');
 assert(!f.statements.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));assert.equal(f.statements.at(-1),'COMMIT');
});

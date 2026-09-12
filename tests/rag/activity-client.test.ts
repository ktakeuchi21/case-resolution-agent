import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native browser ES module, exercised directly without bundling.
import { ActivityRun, readRagStream } from '../../web/rag-activity.js';
const event=(sequence:number,stage='searching',attempt=1)=>({turnId:'turn',attempt,sequence,stage,message:stage+'…',elapsedMs:sequence*100});
const pending=()=>({id:'turn',attempt:1,status:'pending',activity:{startedAt:new Date(10000).toISOString(),elapsedMs:0,events:[] as any[]}});
const stream=(chunks:Uint8Array[])=>new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(chunk);c.close();}});
test('NDJSON handles fragmented Unicode, buffered events, final lines and transport errors',async()=>{
 const turn={...pending(),status:'complete'},events:any[]=[];
 const bytes=new TextEncoder().encode(JSON.stringify({type:'stage',...event(1)})+'\n'+JSON.stringify({type:'result',turn}));
 const chunks=Array.from(bytes,b=>new Uint8Array([b]));
 assert.deepEqual(await readRagStream(stream(chunks),(e:any)=>events.push(e)),turn);assert.equal(events[0].message,'searching…');
 assert.deepEqual(await readRagStream(stream([bytes]),()=>{}),turn);
 for(const body of ['',JSON.stringify({type:'stage',...event(1)})+'\n','{broken}',JSON.stringify({type:'error',error:'Failed'})])
  await assert.rejects(readRagStream(stream([new TextEncoder().encode(body)]),()=>{}));
});
test('activity rejects wrong turns/attempts and stale stages; polls fill missed stages without regression',()=>{
 const turn=pending(),announced:any[]=[];const run=new ActivityRun(turn,{read:async()=>{},update:(e:any)=>{if(e)announced.push(e);},finish:()=>{},now:()=>10000});
 run.stage(event(3,'generating'));run.stage(event(2,'retrieved'));run.stage(event(3,'generating'));run.stage(event(4,'checking',2));run.stage({...event(4),turnId:'other'});
 assert.deepEqual(turn.activity.events.map(e=>e.sequence),[3]);
 run.snapshot({...pending(),activity:{...turn.activity,events:[event(1),event(2,'retrieved')]}});
 assert.deepEqual(turn.activity.events.map(e=>e.sequence),[1,2,3]);assert.equal(announced.length,1);
 run.stage(event(4,'checking'));assert.equal(announced.length,2);
 run.stop();run.stage(event(5,'complete'));assert.equal(turn.activity.events.length,4);
});
test('silent streams poll after three seconds, streaming pauses polling and final snapshots stop it',async()=>{
 let clock=10000,reads=0,finished=0;const turn=pending();let result:any=pending();
 const run=new ActivityRun(turn,{read:async()=>{reads++;return result;},update:()=>{},finish:()=>finished++,now:()=>clock});
 await run.tick();clock=12999;await run.tick();assert.equal(reads,0);
 clock=13000;await run.tick();assert.equal(reads,1);
 run.stage(event(1));clock=15999;await run.tick();assert.equal(reads,1);
 clock=16000;await run.tick();assert.equal(reads,2);
 result={...pending(),status:'complete',response:{answer:'Fixture'},activity:{...turn.activity,elapsedMs:7000,finishedAt:new Date(17000).toISOString(),events:[event(1),event(2,'complete')]}};
 clock=19000;await run.tick();assert.equal(reads,3);assert.equal(finished,1);assert(run.stopped);assert(run.controller.signal.aborted);
 clock=22000;await run.tick();assert.equal(reads,3);assert.equal(run.elapsed(),7000);
});
test('reloaded pending requests use their original deadline; timeout and navigation stop all updates',async()=>{
 let clock=99000,finished=0;const turn=pending();
 const run=new ActivityRun(turn,{read:async()=>{throw Error('Temporary read failure');},update:()=>{},finish:()=>finished++,now:()=>clock});
 await run.tick();assert.equal(turn.status,'pending');clock=100000;await run.tick();
 assert.equal(turn.status,'failed');assert.equal(finished,1);assert.equal(run.elapsed(),90000);
 const next:{id:string;attempt:number;status:string;activity?:ReturnType<typeof pending>['activity']}={id:'turn',attempt:2,status:'pending'};
 const retry=new ActivityRun(next,{read:async()=>{},update:()=>{},finish:()=>{},now:()=>clock});
 retry.stage(event(1,'searching',1));assert.equal(next.activity!.events.length,0);
 retry.stage(event(1,'searching',2));assert.equal(next.activity!.events.length,1);
 retry.stop();assert(retry.controller.signal.aborted);
});

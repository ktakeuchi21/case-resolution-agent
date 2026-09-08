import { mkdirSync,writeFileSync } from 'node:fs';
import { textHash } from '../../src/integrity.ts';
import { metrics,workflowDefinition } from '../../src/workflow/observability.ts';
import { runScenario,scenarios } from './scenarios.ts';
export function artifact(label:string,value:unknown){const bytes=JSON.stringify(value,null,2)+'\n',path='artifacts/phase2d/'+label+'-'+textHash(bytes)+'.json';mkdirSync('artifacts/phase2d',{recursive:true});writeFileSync(path,bytes,{flag:'wx',mode:0o444});return path;}
if(process.argv[1]?.endsWith('/run.ts')){
 const completed:Awaited<ReturnType<typeof runScenario>>[]=[];
 try{
  for(const name of Object.keys(scenarios)){const trace=await runScenario(name);completed.push(trace);console.log(JSON.stringify({scenario:name,artifact:artifact(name,trace),state:trace.steps.at(-1)!.snapshot.state,pass:true}));}
  console.log(JSON.stringify({metrics:artifact('operational-metrics',metrics(completed.map(r=>r.steps),completed.map(r=>({scenario:r.name,workspace:r.scope.workspace})))),verification:artifact('scenario-verification',{schemaVersion:'phase2d-workflow-verification-v1',recordedAt:new Date().toISOString(),definition:workflowDefinition,scenarios:completed.map(c=>({name:c.name,scope:c.scope,pass:c.pass,finalState:c.steps.at(-1)!.snapshot.state,notes:c.notes})),pass:true}),pass:true}));
 }catch(e){console.error(JSON.stringify({code:'WORKFLOW_RUN_FAILED',completed:completed.map(c=>c.name),diagnostic:e instanceof Error?e.message:'unknown'}));process.exitCode=1;}
}

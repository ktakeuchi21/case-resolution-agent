import { Database } from '../../src/db/database.ts';
import { WorkflowRepository } from '../../src/workflow/repository.ts';
import { hash } from '../../src/integrity.ts';
const db=new Database();try{
 const steps=await new WorkflowRepository(db,{workspace:process.argv[2]!,tenant:'T-DEMO',environment:'governed'}).read('avery',process.argv[3]!);
 console.log(JSON.stringify({processId:process.pid,steps:steps.length,state:steps.at(-1)!.snapshot.state,snapshotHash:hash(steps.at(-1)!.snapshot)}));
}finally{await db.close();}

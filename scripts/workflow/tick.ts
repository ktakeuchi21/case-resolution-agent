import { Database } from '../../src/db/database.ts';
import { Timestamp,Id } from '../../src/contracts.ts';
import { WorkflowEngine } from '../../src/workflow/engine.ts';
import { WorkflowWorker } from '../../src/workflow/worker.ts';
import { SimulatedEffectAdapter } from '../../src/workflow/adapters.ts';
import { FileEmbeddingCache } from '../../src/providers/embedding.ts';
const db=new Database();try{
 const workspace=Id.parse(process.argv[2]),now=Timestamp.parse(process.argv[3]),scope={workspace,tenant:'T-DEMO',environment:'governed' as const};
 const worker=new WorkflowWorker(db,scope,new WorkflowEngine(db,scope,()=>now),new SimulatedEffectAdapter(db,scope));worker.options={retrieval:{cacheSource:new FileEmbeddingCache('.local/embeddings')}};
 const steps=[...await worker.runDue(now),...await worker.runOutbox()];console.log(JSON.stringify(steps.map(s=>({workflowId:s.workflowId,command:s.command.type,status:s.status,state:s.snapshot.state,events:s.events})),null,2));
}finally{await db.close();}

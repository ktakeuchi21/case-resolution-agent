// Explicit live evaluation only. Uses the existing bounded application API;
// session secrets are never written to the report and provider limits stay in force.
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { hash } from '../../src/integrity.ts';
import { packs, passages } from '../../src/rag/corpus.ts';
import { eligible } from '../../src/rag/retrieval.ts';
import { evaluationCases } from '../../src/rag/evaluation-cases.ts';
import { knowledgeCases, knowledgeEvaluationVersion } from '../../src/rag/knowledge-evaluation-cases.ts';
import type { RetrievalTrace, Turn } from '../../src/rag/contracts.ts';

const [origin,mode,selectedPack,savedVisitor]=process.argv.slice(2);
if(!origin||!['retrieval','conversation'].includes(mode??''))throw new Error('Supply an explicit application origin and retrieval or conversation.');
if(selectedPack&&!packs.some(p=>p.id===selectedPack))throw new Error('INVALID_PACK');
const rows:any[]=[];
const report:any={suite:knowledgeEvaluationVersion,mode,origin,selectedPack:selectedPack??null,startedAt:new Date().toISOString(),corpusHash:hash(passages),results:rows,
 limitations:'Source coverage and exact citation membership are mechanical checks, not semantic quality ratings. Read retained responses against the review criteria. Retrieval endpoint usage is not reported; generation usage excludes any separately prepared corpus/query embeddings.'};
async function session(){
 // An explicit saved evaluation visitor lets an interrupted run continue within
 // its original session allowance instead of creating more anonymous visitors.
 let prior:any;
 if(savedVisitor){
  const path='.local/rag-evaluation/'+createHash('sha256').update(origin!).digest('hex')+'.json';
  prior=JSON.parse(readFileSync(path,'utf8'))[savedVisitor];
  if(!prior||Date.parse(prior.expiresAt)<=Date.now()||!/^pathway_session=[a-f0-9]{64}$/.test(prior.cookie))throw new Error('SAVED_VISITOR_UNAVAILABLE');
 }
 const res=await fetch(origin+'/api/rag/session',{headers:prior?{Cookie:prior.cookie}:{},signal:AbortSignal.timeout(90000)});
 if(!res.ok)throw new Error('SESSION_'+res.status);
 const body=await res.json() as any,cookie=res.headers.get('set-cookie')?.split(';')[0]??prior?.cookie;
 if(!cookie||!body.csrf||body.model!=='gpt-5-mini')throw new Error('SESSION_OR_MODEL_MISMATCH');
 return {cookie,csrf:body.csrf};
}
type Visitor=Awaited<ReturnType<typeof session>>;
async function post(s:Visitor,path:string,body:unknown){
 const res=await fetch(origin+'/api/rag/'+path,{method:'POST',headers:{Cookie:s.cookie,'X-CSRF-Token':s.csrf,Origin:origin!,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 if(!res.ok)throw new Error(path+'_HTTP_'+res.status);
 return res.json() as Promise<any>;
}
function inspect(trace:RetrievalTrace,packId:typeof packs[number]['id']){
 return {isolated:trace.passages.every(p=>eligible(p,packId)),exact:trace.passages.every(p=>passages.some(q=>q.id===p.id&&hash(q)===hash(Object.fromEntries(Object.keys(q).map(k=>[k,p[k as keyof typeof p]])))))};
}
try{
 if(mode==='retrieval')report.preparation=await post(await session(),'prepare-evaluation',{});
 for(const pack of packs.filter(p=>!selectedPack||p.id===selectedPack)){
  const s=await session();
  if(mode==='retrieval'){
   for(const item of evaluationCases.filter(c=>c.packId===pack.id)){
    const trace=await post(s,'retrieve',{packId:pack.id,text:item.retrievalQuestion}) as RetrievalTrace;
    const recall=item.expected.filter(id=>trace.passages.some(p=>p.id===id)).length/item.expected.length;
    const row={id:item.id,kind:'original-exact-source-regression',question:item.retrievalQuestion,expected:item.expected,recall,...inspect(trace,pack.id),trace};
    rows.push(row);console.log(JSON.stringify({id:row.id,recall,isolated:row.isolated}));
    if(!row.isolated||!row.exact)throw new Error('EVIDENCE_BOUNDARY');
   }
   for(const item of knowledgeCases.filter(c=>c.packId===pack.id)){
    const trace=await post(s,'retrieve',{packId:pack.id,text:item.question}) as RetrievalTrace;
    const row={...item,kind:'expanded-topic',found:trace.passages.some(p=>p.sourceId===item.sourceId),...inspect(trace,pack.id),trace};
    rows.push(row);console.log(JSON.stringify({id:row.id,found:row.found,isolated:row.isolated}));
    if(!row.isolated||!row.exact)throw new Error('EVIDENCE_BOUNDARY');
   }
  }else{
   const conversation=await post(s,'start',{scenarioId:pack.id});
   const live=knowledgeCases.filter(c=>c.packId===pack.id&&c.live).map(c=>({...c,expectedSource:c.sourceId}));
   const control=evaluationCases.find(c=>c.packId===pack.id&&c.category==='deadline')!;
   const questions=[...live,{id:control.id,question:control.question,review:control.review,expectedSource:''}];
   for(const item of questions){
    const turn=await post(s,'send',{conversationId:conversation.id,requestId:randomUUID(),text:item.question}) as Turn;
    const row={id:item.id,question:item.question,review:item.review,expectedSource:item.expectedSource,turn,
     ...(turn.trace?inspect(turn.trace,pack.id):{isolated:false,exact:false}),
     citationMembership:!!turn.response&&turn.response.citations.every(id=>turn.trace?.passages.some(p=>p.id===id)),semanticReview:null};
    rows.push(row);console.log(JSON.stringify({id:row.id,status:turn.status,answer:turn.response?.answer}));
    if(turn.status!=='complete'||!row.isolated||!row.exact||!row.citationMembership)throw new Error('LIVE_ANSWER_FAILED');
   }
   // Source snapshots must survive switching knowledge after expanded answers.
   const before=rows.filter(r=>r.turn).at(-1).turn as Turn;
   await post(s,'configure',{conversationId:conversation.id,packId:packs.find(p=>p.id!==pack.id)!.id});
   const res=await fetch(origin+'/api/rag/conversation?id='+conversation.id,{headers:{Cookie:s.cookie},signal:AbortSignal.timeout(30000)});
   if(!res.ok)throw new Error('HISTORY_'+res.status);
   const history=await res.json() as any;
   const unchanged=hash(history.turns.find((t:Turn)=>t.id===before.id))===hash(before);
   rows.push({kind:'history',packId:pack.id,unchanged});if(!unchanged)throw new Error('HISTORICAL_SNAPSHOT_CHANGED');
  }
 }
 report.completed=true;
}catch(e){report.error=e instanceof Error?e.message:'UNKNOWN';process.exitCode=1;}
finally{
 const originals=rows.filter(r=>r.kind==='original-exact-source-regression'),topics=rows.filter(r=>r.kind==='expanded-topic'),turns=rows.filter(r=>r.turn);
 report.metrics={originalCases:originals.length,originalMeanExactPassageRecall:originals.length?originals.reduce((n,r)=>n+r.recall,0)/originals.length:null,
  expandedTopics:topics.length,expandedTopicsFound:topics.filter(r=>r.found).length,answers:turns.length,completedAnswers:turns.filter(r=>r.turn.status==='complete').length,
  generationRequests:turns.reduce((n,r)=>n+(r.turn.usage?.requests??0),0),generationEstimatedCostUsd:turns.some(r=>r.turn.usage?.estimatedCostUsd==null)?null:turns.reduce((n,r)=>n+r.turn.usage.estimatedCostUsd,0)};
 const bytes=JSON.stringify(report,null,2)+'\n';
 const {createHash}=await import('node:crypto');
 const path='artifacts/rebuild/knowledge-'+mode+'-'+createHash('sha256').update(bytes).digest('hex')+'.json';
 mkdirSync('artifacts/rebuild',{recursive:true});writeFileSync(path,bytes,{flag:'wx',mode:0o444});console.log(JSON.stringify({artifact:path,metrics:report.metrics,error:report.error}));
}

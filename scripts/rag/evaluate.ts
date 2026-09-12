import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { evaluationCases, evaluationVersion } from '../../src/rag/evaluation-cases.ts';
import { boundaryCases, boundaryEvaluationVersion } from '../../src/rag/boundary-cases.ts';
import { packs, passages } from '../../src/rag/corpus.ts';
import { hash } from '../../src/integrity.ts';
import { eligible } from '../../src/rag/retrieval.ts';
import type { RetrievalTrace, Turn } from '../../src/rag/contracts.ts';
const origin=process.argv[2]??'',mode=process.argv[3];
if(!origin||!['retrieval','conversation','boundary'].includes(mode??''))throw new Error('Pass the explicit application origin and retrieval, conversation or boundary.');
const findings:unknown[]=[];const stamp=new Date().toISOString();
const report:any={suite:mode==='boundary'?boundaryEvaluationVersion:evaluationVersion,mode,startedAt:stamp,origin,live:true,results:findings,limitations:'Expected-source recall and mechanical citation checks are automated. Supported-answer, abstention, hallucination, usefulness and semantic consistency require review of the actual retained output; no fixture is live quality evidence.'};
async function session(){const res=await fetch(origin+'/api/rag/session',{signal:AbortSignal.timeout(90000)});if(!res.ok)throw new Error('SESSION_'+res.status);return {cookie:res.headers.get('set-cookie')?.split(';')[0]??'',csrf:(await res.json() as any).csrf};}
async function post(s:{cookie:string;csrf:string},path:string,body:unknown){const res=await fetch(origin+'/api/rag/'+path,{method:'POST',headers:{Cookie:s.cookie,'X-CSRF-Token':s.csrf,'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});if(!res.ok)throw new Error('HTTP_'+res.status+'_'+path);return res.json() as Promise<any>;}
try{
 if(mode==='retrieval'){
  const s=await session();report.preparation=await post(s,'prepare-evaluation',{});
  // Each fixed scenario is evaluated as a separate visitor; all share the same daily provider cap.
  for(const pack of packs){const visitor=await session();for(const item of evaluationCases.filter(c=>c.packId===pack.id)){
   const start=performance.now(),trace=await post(visitor,'retrieve',{packId:pack.id,text:item.retrievalQuestion}) as RetrievalTrace;
   const hits=item.expected.filter(id=>trace.passages.some(p=>p.id===id));
   const row={id:item.id,question:item.retrievalQuestion,expected:item.expected,hits,recall:hits.length/item.expected.length,isolated:trace.passages.every(p=>eligible(p,pack.id)),exact:trace.passages.every(p=>passages.some(q=>q.id===p.id&&q.text===p.text)),latencyMs:Math.round(performance.now()-start),trace};findings.push(row);console.log(JSON.stringify({id:item.id,recall:row.recall,isolated:row.isolated}));
  }}
 }else if(mode==='boundary'){
  const s=await session(),conversation=await post(s,'start',{scenarioId:'alder'});let previousPack='alder',firstSnapshot:string|undefined;
  for(const item of boundaryCases){
   if(item.packId!==previousPack){await post(s,'configure',{conversationId:conversation.id,packId:item.packId});previousPack=item.packId;}
   const start=performance.now(),turn=await post(s,'send',{conversationId:conversation.id,requestId:randomUUID(),text:item.question}) as Turn,trace=turn.trace;
   if(!firstSnapshot)firstSnapshot=JSON.stringify(turn);
   const historyResponse=await fetch(origin+'/api/rag/conversation?id='+conversation.id,{headers:{Cookie:s.cookie},signal:AbortSignal.timeout(30000)});
   if(!historyResponse.ok)throw new Error('HISTORY_'+historyResponse.status);
   const historical=(await historyResponse.json() as any).turns[0];
   const row={id:item.id,category:'knowledge-switch',reviewCriterion:item.review,expected:item.expected,
    recall:trace?item.expected.filter(id=>trace.passages.some(p=>p.id===id)).length/item.expected.length:0,
    isolated:!!trace&&trace.passages.every(p=>eligible(p,item.packId)),historicalPreserved:hash(historical)===hash(JSON.parse(firstSnapshot)),
    citationMembership:!!turn.response&&turn.response.citations.every(id=>trace?.passages.some(p=>p.id===id)),
    citationExact:!!trace&&trace.passages.every(p=>passages.some(q=>q.id===p.id&&q.text===p.text)),latencyMs:Math.round(performance.now()-start),humanReview:null,turn};
   findings.push(row);console.log(JSON.stringify({id:item.id,status:turn.status,isolated:row.isolated,historicalPreserved:row.historicalPreserved,answer:turn.response?.answer}));
   if(turn.status!=='complete'||!row.isolated||!row.historicalPreserved)throw new Error('BOUNDARY_ACCEPTANCE_FAILED');
  }
 }else{
  for(const pack of packs){const s=await session(),conversation=await post(s,'start',{scenarioId:pack.id});
   for(const item of evaluationCases.filter(c=>c.packId===pack.id)){
    const start=performance.now(),turn=await post(s,'send',{conversationId:conversation.id,requestId:randomUUID(),text:item.question}) as Turn;
    const trace=turn.trace,cited=turn.response?.citations??[];
    const row={id:item.id,category:item.category,reviewCriterion:item.review,expected:item.expected,recall:trace?item.expected.filter(id=>trace.passages.some(p=>p.id===id)).length/item.expected.length:0,
     isolated:!!trace&&trace.passages.every(p=>eligible(p,pack.id)),citationMembership:cited.every(id=>trace?.passages.some(p=>p.id===id)),citationExact:!!trace&&trace.passages.every(p=>passages.some(q=>q.id===p.id&&q.text===p.text)),
     latencyMs:Math.round(performance.now()-start),humanReview:null,turn};findings.push(row);console.log(JSON.stringify({id:item.id,status:turn.status,latencyMs:row.latencyMs,answer:turn.response?.answer,workProduct:turn.response?.workProduct}));
    if(turn.status!=='complete'){report.stopped='A live turn failed; retained for diagnosis before further paid calls.';throw new Error('LIVE_TURN_FAILED');}
   }
  }
 }
 report.completed=true;
}catch(e){report.error=e instanceof Error?e.message:'UNKNOWN';process.exitCode=1;}
finally{
 const rows=findings as any[],times=rows.map(r=>r.latencyMs).sort((a,b)=>a-b);
 const usageRecords=[...(report.preparation?.usage?[report.preparation.usage]:[]),...rows.flatMap(r=>r.turn?.usage?[r.turn.usage]:[])];
 const sum=(field:string)=>usageRecords.reduce((n:number,u:any)=>n+(u[field]??0),0);
 report.metrics={cases:rows.length,meanExpectedPassageRecall:rows.length?rows.reduce((n,r)=>n+r.recall,0)/rows.length:null,packIsolation:rows.filter(r=>r.isolated).length,medianLatencyMs:times[Math.floor(times.length/2)]??null,maxLatencyMs:times.at(-1)??null,
 inputTokens:sum('inputTokens'),cachedInputTokens:sum('cachedInputTokens'),outputTokens:sum('outputTokens'),embeddingInputTokens:sum('embeddingInputTokens'),generationRequests:sum('requests'),embeddingRequests:sum('embeddingRequests'),
 unmeasuredRequests:sum('unmeasuredRequests'),estimatedCostUsd:usageRecords.some((u:any)=>u.estimatedCostUsd===null)?null:sum('estimatedCostUsd'),
 costScope:'Includes reported corpus/query preparation and turn generation/embedding usage in this run. Cached query vectors were charged when first prepared. Missing provider usage is unknown, not zero.'};

 const bytes=JSON.stringify(report,null,2)+'\n',digest=createHash('sha256').update(bytes).digest('hex'),path=`artifacts/rebuild/${mode}-${digest}.json`;
 mkdirSync('artifacts/rebuild',{recursive:true});writeFileSync(path,bytes,{flag:'wx',mode:0o444});console.log(JSON.stringify({artifact:path,metrics:report.metrics,error:report.error}));
}

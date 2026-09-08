import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runBenchmark } from './retrieval-benchmark.ts';
import { retirementDemo, runEvaluations } from './evaluation.ts';
import { EvidenceStore } from './evidence-store.ts';
import { hash } from './integrity.ts';

const args = process.argv.slice(2);
if (args.some(a => !['--live','--require-all-modes'].includes(a))) throw new Error('Usage: npm run benchmark -- [--live] [--require-all-modes]');
const live = args.includes('--live');
const report = await runBenchmark({ live, apiKey: live ? process.env.OPENAI_API_KEY : undefined });
function write(name: string, value: unknown) {
  const path = join('artifacts',name); mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,JSON.stringify(value,null,2)+'\n');
}
const reference = await runEvaluations();
const retirement = await retirementDemo(new EvidenceStore('.local/evidence'));
write('phase2b-reference-regressions.json',{ ...reference, retirement, note:'Phase 2A reference cases rerun unchanged under BM25. Semantic/hybrid governance mechanics are covered separately by unit-vector contract tests; not live quality.' });
write('phase2b-benchmark.json',report);
const views = report.arms.map(arm => ({ mode:arm.id,status:arm.status,reason:arm.reason,
  literal:arm.runs[0]?.results.find(r=>r.id==='Q01')??null,
  synonym:arm.runs[0]?.results.find(r=>r.id==='Q02')??null }));
const semanticArm=views.find(v=>v.mode==='semantic');
const hybridArm=views.find(v=>v.mode==='hybrid');
write('phase2b-synonym-trace.json',{
  claim:'Live synonym success must be observed, never inferred from unit vectors.',
  status:semanticArm?.status==='measured'||hybridArm?.status==='measured'?'measured_inspect_results':'not_measured_no_live_embeddings',
  semanticSuccess:semanticArm?.synonym?.final.outcomeCorrect??null,hybridSuccess:hybridArm?.synonym?.final.outcomeCorrect??null,
  modes:views,
});
write('phase2b-inapplicable-match-trace.json',{
  claim:'Broad candidate similarity is a developer diagnostic, not operational eligibility. No excluded candidate is passed to the production pipeline.',
  semanticStatus:semanticArm?.status??'not_run',
  unitContractTest:'tests/retrieval.test.ts: maximally similar wrong-payer passage is excluded independently of vector score; handcrafted vectors are NOT measured semantic quality.',
  modes:report.arms.map(arm=>({mode:arm.id,status:arm.status,reason:arm.reason,
    wrongPayer:arm.runs[0]?.results.find(r=>r.id==='Q12')??null,wrongState:arm.runs[0]?.results.find(r=>r.id==='Q13')??null})),
});
const store=new EvidenceStore('.local/evidence');
for(const arm of report.arms) for(const run of arm.runs) for(const result of run.results) {
  const { id:_id,recordHash:_hash,...body }=result.record; store.put(body);
}
// Content-addressed snapshot preserves each measured report when the convenience path is refreshed.
const snapshotId=hash(report);
mkdirSync('.local/benchmarks',{recursive:true});
writeFileSync(`.local/benchmarks/${snapshotId}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
const armSummary=report.arms.map(a=>({id:a.id,status:a.status,summary:a.summary,...('reproducibility' in a?{reproducibility:a.reproducibility}:{}),...('latency' in a?{latency:a.latency}:{}),cost:a.cost}));
console.log(JSON.stringify({report:'artifacts/phase2b-benchmark.json',snapshotId,reference:reference.summary,arms:armSummary},null,2));
const completed=report.arms.filter(a=>a.status==='measured');
const failure=!reference.summary.allPassed||report.arms.some(a=>a.status==='failed')||completed.some(a=>!('reproducibility' in a)||!a.reproducibility?.stable||a.summary!.final.unsafeOutcomes>0||a.summary!.final.providerFailures>0||a.summary!.eligible.inapplicablePassages>0||a.summary!.final.conflicts.correct!==a.summary!.final.conflicts.total||a.summary!.final.abstentions.correct!==a.summary!.final.abstentions.total||a.summary!.final.unsupportedClaims>0||a.summary!.final.citations.exact!==a.summary!.final.citations.total);
if(failure||(args.includes('--require-all-modes')&&report.arms.some(a=>a.status!=='measured'))) process.exitCode=1;

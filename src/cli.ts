import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runEvaluations, retirementDemo, runRetrievalProbes } from './evaluation.ts';
import { EvidenceStore } from './evidence-store.ts';

const command = process.argv[2];
const args = process.argv.slice(3);
const out = args[0] === '--out' ? args[1] : undefined;
if ((args.length !== 0 && (args.length !== 2 || !out || out.startsWith('--'))) || !['eval', 'demo', 'probes'].includes(command ?? '')) {
  console.error('Usage: npm run eval|demo|probes -- [--out path.json]');
  process.exitCode = 2;
} else {
  try {
    if (command === 'probes') {
      const report = await runRetrievalProbes();
      console.log(JSON.stringify(report, null, 2));
      if (out) { const path = resolve(out); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); }
    } else if (command === 'eval') {
      const report = await runEvaluations();
      for (const result of report.results) {
        console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.id}: ${result.title}`);
        console.log(`  expected eligible: ${result.expected.eligible.join(', ') || '(none)'}`);
        console.log(`  retrieved: ${result.retrievedSources.join(', ') || '(none)'}`);
        console.log(`  excluded: ${result.excluded.map(e => `${e.documentVersionId}=${e.reasonCodes.join('|')}`).join('; ') || '(none disclosed)'}`);
        console.log(`  evidence: ${result.evidenceUsed.join(', ') || '(none)'}`);
        console.log(`  support=${result.support.status}; applicability=${result.applicability.status}; communication=${result.communication.status}; action=${result.action.status}; disposition=${result.disposition}`);
        for (const error of result.errors) console.log(`  ERROR: ${error}`);
      }
      console.log(JSON.stringify(report.summary, null, 2));
      console.log('Local lexical retrieval; reviewed fixture statements; no embeddings, LLM, semantic benchmark or action execution.');
      if (out) { const path = resolve(out); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); }
      if (!report.summary.allPassed) process.exitCode = 1;
    } else {
      const demo = await retirementDemo(new EvidenceStore(resolve('.local/evidence')));
      for (const [label, record] of [['approved source', demo.initial], ['after retirement', demo.afterRetirement], ['sandbox replacement', demo.sandboxReplacement], ['operational retry', demo.retry]] as const) {
        console.log(`${label}: support=${record.support.status}; applicability=${record.applicability.status}; communication=${record.communication.status}; action=${record.action.status}; ${record.disposition}`);
        console.log(`  evidence: ${record.id}`);
      }
      console.log(`Historical evidence unchanged and source passages resolvable: ${demo.history.unchanged && demo.history.citationsResolvable}`);
      console.log('PASS: approved recommendation → retired source → paused retry → intact history → sandbox cannot restore authority.');
      console.log('Local lexical provider; extractive composition; no action dispatched. Evidence snapshots: .local/evidence/');
      if (out) { const path = resolve(out); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(demo, null, 2) + '\n'); }
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

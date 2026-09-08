import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { EvidenceRecord, RetrievalRequest } from './contracts.ts';
import { RetrievalRequest as RequestSchema } from './contracts.ts';
import { baseRequest, sandboxRequest } from './evaluation.ts';
import { Registry, loadCorpus, FIXED_TIME } from './registry.ts';
import { KnowledgePipeline } from './pipeline.ts';
import { EvidenceStore } from './evidence-store.ts';
import { selectKnowledge, sourceReasons } from './policy.ts';
import { hash } from './integrity.ts';
import { RetrievalConfiguration } from './providers/configuration.ts';
import { createRetrievalProvider } from './providers/factory.ts';
import { FileEmbeddingCache } from './providers/embedding.ts';
import type { RetrievalProvider } from './providers/provider.ts';

const GoldQuery = z.strictObject({ id: z.string(), category: z.string(), split: z.enum(['development', 'challenge']), question: z.string(),
  scenario: z.enum(['base','conflict','sandbox','injection','retired','wrong-benefit','wrong-audience','expired-release','wrong-state','wrong-payer','missing-inventory','no-action-grant','unknown-benefit','sandbox-expired']),
  actor: z.string(), requestPatch: z.record(z.string(), z.unknown()), goldPassageIds: z.array(z.string()),
  expectedDisposition: z.enum(['answer','abstain','deny','escalate','pause']), expectedAction: z.enum(['allowed','denied','paused','requires_approval','not_requested']) });
export type GoldQuery = z.infer<typeof GoldQuery>;
export function loadExperiment() {
  const goldPath = new URL('../fixtures/retrieval/gold-v1.json', import.meta.url);
  const corpusPath = new URL('../fixtures/knowledge/corpus.json', import.meta.url);
  const experiment = z.object({ schemaVersion: z.literal('phase2b-experiment-v1'), goldSha256: z.string(), corpusSha256: z.string(),
    k: z.number().int().positive(), repeats: z.number().int().min(2), candidateDepth: z.number().int().positive(), rrfK: z.number().int().positive(),
    embedding: RetrievalConfiguration.shape.embedding, price: z.object({ usdPerMillionInputTokens: z.number(), checkedAt: z.string(), url: z.string() }),
    arms: z.array(z.object({ id: z.string(), mode: z.enum(['lexical','semantic','hybrid']), semanticMinCosine: z.number().nullable() }))
  }).parse(JSON.parse(readFileSync(new URL('../fixtures/retrieval/experiment-v1.json', import.meta.url),'utf8')));
  const digest = (url: URL) => createHash('sha256').update(readFileSync(url)).digest('hex');
  if (digest(goldPath) !== experiment.goldSha256 || digest(corpusPath) !== experiment.corpusSha256) throw new Error('Frozen gold/corpus changed; create a new experiment version');
  const gold = z.object({ synthetic: z.literal(true), queries: z.array(GoldQuery).min(1) }).parse(JSON.parse(readFileSync(goldPath,'utf8')));
  if (new Set(gold.queries.map(q => q.id)).size !== gold.queries.length) throw new Error('Duplicate gold query');
  const ids = new Set(loadCorpus().passages.map(p => p.id));
  if (gold.queries.some(q => new Set(q.goldPassageIds).size !== q.goldPassageIds.length || q.goldPassageIds.some(id => !ids.has(id)))) throw new Error('Invalid gold passage identity');
  return { experiment, queries: gold.queries };
}
export function prepareQuery(query: GoldQuery) {
  const corpus = loadCorpus();
  const scenario = query.scenario;
  if (scenario === 'injection') corpus.collections[0]!.documentVersionIds = ['SB-INJECT.v1'];
  if (scenario === 'wrong-benefit') corpus.cases[0]!.attributes.benefit = 'medical';
  if (scenario === 'wrong-state') corpus.cases[0]!.attributes.state = 'UT';
  if (scenario === 'wrong-payer') corpus.cases[0]!.attributes.payer = 'Cedar';
  if (scenario === 'unknown-benefit') corpus.cases[0]!.attributes.benefit = null;
  if (scenario === 'wrong-audience') corpus.users.find(u => u.id === query.actor)!.audience = 'visitor';
  if (scenario === 'no-action-grant') corpus.users.find(u => u.id === query.actor)!.actionGrants = [];
  if (scenario === 'missing-inventory') corpus.cases[0]!.evidenceVersionIds = ['N-101.v1'];
  const registry = new Registry(corpus);
  if (scenario === 'conflict') registry.reportConflict('publisher','K-PA-X.v1',FIXED_TIME);
  if (scenario === 'retired') registry.retire('publisher','K-PA.v2',FIXED_TIME,'Phase 2B synthetic retirement');
  const now = scenario === 'expired-release' ? '2026-12-01T07:00:00Z' : scenario === 'sandbox-expired' ? '2026-09-11T16:00:00Z' : FIXED_TIME;
  const sandbox = ['sandbox','injection','sandbox-expired'].includes(scenario);
  const request = RequestSchema.parse((sandbox ? sandboxRequest : baseRequest)({ ...query.requestPatch as Partial<RetrievalRequest>, id: query.id, question: query.question }));
  const user = registry.user(query.actor);
  const selection = selectKnowledge(registry,user,request,now);
  const visible = registry.visibleVersions(user);
  const reasons = new Map(visible.map(v => [v.id, selection.reasons.length ? selection.reasons : sourceReasons(registry,v,user,request,selection,now)]));
  const allowed = registry.corpus.passages.filter(p => reasons.get(p.documentVersionId)?.length === 0 &&
    (sandbox || selection.caseContext?.evidenceVersionIds.includes(p.documentVersionId) || selection.releases.some(r => r.passageIds.includes(p.id))));
  return { registry, now, request, selection, visible, reasons, allowed };
}
export function rankingMetrics(hits: readonly { passageId: string }[], gold: readonly string[], allowed: ReadonlySet<string>, anyRequired = false) {
  const unique = [...new Set(hits.map(h => h.passageId))];
  const matches = unique.filter(id => gold.includes(id)).length;
  const first = unique.findIndex(id => gold.includes(id));
  return { returned: unique.length, relevant: matches, gold: gold.length,
    recallAtK: gold.length ? matches/gold.length : null,
    precisionAtK: gold.length ? (unique.length ? matches/unique.length : 0) : null,
    reciprocalRank: gold.length ? (first < 0 ? 0 : 1/(first+1)) : null,
    firstRelevantRank: first < 0 ? null : first+1,
    requiredPassageRetrieval: gold.length ? (anyRequired ? matches > 0 : matches === gold.length) : null,
    inapplicable: unique.filter(id => !allowed.has(id)).length,
    inapplicableRate: unique.length ? unique.filter(id => !allowed.has(id)).length/unique.length : null };
}
const mean = (numbers: number[]) => numbers.length ? numbers.reduce((a,b) => a+b,0)/numbers.length : null;
export const latencySummary = (numbers: number[]) => ({ samples: numbers.length, meanMs: mean(numbers),
  p95Ms: numbers.length ? [...numbers].sort((a,b) => a-b)[Math.ceil(numbers.length*0.95)-1]! : null });
function fidelity(record: EvidenceRecord, registry: Registry) {
  const passages = record.evidenceUsed;
  const correct = passages.filter(p => {
    const version = registry.corpus.versions.find(v => v.id === p.documentVersionId)!;
    return version.originalText.slice(p.locator.start,p.locator.end) === p.text && registry.corpus.passages.some(c => c.id === p.passageId && c.textHash === p.textHash);
  }).length;
  const claims = record.answer.claims;
  const supported = claims.filter(c => c.passageIds.every(id => passages.some(p => p.passageId === id && p.text.includes(c.text)))).length;
  return { citations: passages.length, exactCitations: correct, claims: claims.length, supportedClaims: supported,
    pass: correct === passages.length && supported === claims.length };
}
export async function runQuery(query: GoldQuery, provider: RetrievalProvider) {
  const h = prepareQuery(query), { registry, request } = h;
  const allowed = new Set(h.allowed.map(p => p.id));
  // Developer-only synthetic diagnostic: access-visible candidates, BEFORE applicability.
  // Never feed this broader ranking to KnowledgePipeline or expose it as an app endpoint.
  const broad = registry.corpus.passages.filter(p => h.visible.some(v => v.id === p.documentVersionId));
  const start = performance.now();
  await provider.index(registry.corpus.passages,registry.corpusHash);
  const candidates = await provider.search({ query: request.question, limit: request.maxResults,
    universe: { snapshotHash: registry.snapshotHash(), corpusHash: registry.corpusHash, passageIds: broad.map(p => p.id) } });
  const candidateMs = performance.now()-start;
  const pipelineStart = performance.now();
  const record = await new KnowledgePipeline(registry,provider,new EvidenceStore(),() => h.now).run(query.actor,request);
  const pipelineMs = performance.now()-pipelineStart;
  const candidateDiagnostics = candidates.map(c => ({ ...c,
    releaseIds: registry.corpus.releases.filter(r => r.passageIds.includes(c.passageId)).map(r => r.id),
    metadataFilter: allowed.has(c.passageId) ? 'eligible' : 'excluded',
    filterReasons: h.reasons.get(c.documentVersionId) ?? ['NOT_VISIBLE'],
    inclusionReason: c.ranking?.inclusionReason ?? 'lexical_match',
  }));
  const anyRequired = query.scenario === 'sandbox';
  const final = { disposition: record.disposition, support: record.support, applicability: record.applicability,
    communication: record.communication, action: record.action,
    outcomeCorrect: record.disposition === query.expectedDisposition && record.action.status === query.expectedAction,
    providerFailure: record.support.reasonCodes.some(r => ['PROVIDER_UNAVAILABLE','PROVIDER_CONTRACT_VIOLATION','STALE_SNAPSHOT'].includes(r)),
    unsafeOutcome: (record.disposition === 'answer' && query.expectedDisposition !== 'answer') || (record.action.status === 'allowed' && query.expectedAction !== 'allowed'),
    abstentionCorrect: query.expectedDisposition === 'abstain' ? record.disposition === 'abstain' : null,
    falseAbstention: query.expectedDisposition === 'answer' && record.disposition !== 'answer',
    conflictPreserved: query.scenario === 'conflict' ? record.support.status === 'conflicting' && record.disposition === 'escalate' && record.action.status === 'paused' : null,
    fidelity: fidelity(record,registry), evidenceIds: record.evidenceUsed.map(p => p.passageId) };
  return { id: query.id, category: query.category, split: query.split, question: query.question, scenario: query.scenario, k: request.maxResults,
    expected: { goldPassageIds: query.goldPassageIds, disposition: query.expectedDisposition, action: query.expectedAction },
    corpusHash: registry.corpusHash, registryHash: registry.snapshotHash(),
    candidates: { metrics: rankingMetrics(candidates, query.goldPassageIds, allowed, anyRequired), results: candidateDiagnostics },
    eligible: { metrics: rankingMetrics(record.retrieved, query.goldPassageIds, allowed, anyRequired), results: record.retrieved,
      eligiblePassageIds: [...allowed], excluded: record.excluded }, final,
    latency: { candidateMs, pipelineMs }, record,
    reproducibilityHash: hash({ candidates, eligible: record.retrieved, excluded: record.excluded, final,
      provider: record.provider, releases: record.selectedReleases }) };
}
type QueryResult = Awaited<ReturnType<typeof runQuery>>;
function summarize(results: QueryResult[]) {
  const stage = (key: 'candidates' | 'eligible') => {
    const metrics = results.map(r => r[key].metrics);
    const applicable = metrics.filter(m => m.gold > 0);
    const allReturned = metrics.reduce((n,m) => n+m.returned,0);
    return { positiveQueryCount: applicable.length,
      recallAtK: mean(applicable.map(m => m.recallAtK!)), precisionAtK: mean(applicable.map(m => m.precisionAtK!)),
      meanReciprocalRank: mean(applicable.map(m => m.reciprocalRank!)),
      firstRelevantRankMeanWhenFound: mean(applicable.flatMap(m => m.firstRelevantRank === null ? [] : [m.firstRelevantRank])),
      requiredPassageRetrievalRate: mean(applicable.map(m => Number(m.requiredPassageRetrieval))),
      inapplicablePassages: metrics.reduce((n,m) => n+m.inapplicable,0), returnedPassages: allReturned,
      inapplicablePassageRate: allReturned ? metrics.reduce((n,m) => n+m.inapplicable,0)/allReturned : null };
  };
  const abstentions = results.filter(r => r.final.abstentionCorrect !== null), conflicts = results.filter(r => r.final.conflictPreserved !== null);
  const citations = results.reduce((n,r) => n+r.final.fidelity.citations,0), exact = results.reduce((n,r) => n+r.final.fidelity.exactCitations,0);
  return { queries: results.length, candidates: stage('candidates'), eligible: stage('eligible'),
    final: { outcomesCorrect: results.filter(r => r.final.outcomeCorrect).length, providerFailures: results.filter(r => r.final.providerFailure).length, unsafeOutcomes: results.filter(r => r.final.unsafeOutcome).length,
      abstentions: { correct: abstentions.filter(r => r.final.abstentionCorrect).length, total: abstentions.length },
      falseAbstentions: results.filter(r => r.final.falseAbstention).length,
      conflicts: { correct: conflicts.filter(r => r.final.conflictPreserved).length, total: conflicts.length },
      citations: { exact, total: citations, fidelity: citations ? exact/citations : null },
      unsupportedClaims: results.reduce((n,r) => n+r.final.fidelity.claims-r.final.fidelity.supportedClaims,0) } };
}
export async function runBenchmark(options: { live?: boolean; apiKey?: string; cacheDirectory?: string } = {}) {
  const { experiment, queries } = loadExperiment();
  const arms = [];
  for (const arm of experiment.arms) {
    const configuration = RetrievalConfiguration.parse({ mode: arm.mode, semanticMinCosine: arm.semanticMinCosine, candidateDepth: experiment.candidateDepth,
      rrfK: experiment.rrfK, embedding: experiment.embedding });
    if (arm.mode !== 'lexical' && (!options.live || !options.apiKey)) {
      arms.push({ id: arm.id, status: 'not_run' as const, reason: !options.apiKey ? 'OPENAI_API_KEY unavailable; no fake embeddings or silent fallback' : 'Explicit --live required; semantic quality not measured',
        configuration, summary: null, cost: null, runs: [] });
      continue;
    }
    const built = createRetrievalProvider(configuration, { apiKey: options.apiKey, cache: new FileEmbeddingCache(options.cacheDirectory ?? '.local/embeddings') });
    const startedAt = new Date().toISOString();
    const runs = [];
    let failure: string | null = null;
    for (let repeat = 0; repeat < experiment.repeats && !failure; repeat++) {
      const results: QueryResult[] = [];
      for (const query of queries) {
        try { results.push(await runQuery(query,built.provider)); }
        catch { failure = 'Provider/benchmark failed; partial results are not a successful quality comparison'; break; }
      }
      runs.push({ repeat, results });
    }
    const first = runs[0]?.results ?? [];
    const comparable = runs.length === experiment.repeats && runs.every(r => r.results.length === queries.length);
    const stable = comparable && runs.every(r => r.results.every((q,i) => q.reproducibilityHash === first[i]!.reproducibilityHash));
    const all = runs.flatMap(r => r.results);
    arms.push({ id: arm.id, status: failure ? 'failed' as const : 'measured' as const, reason: failure,
      configuration, provider: built.provider.descriptor, startedAt, completedAt: new Date().toISOString(),
      summary: failure ? null : summarize(first), bySplit: failure ? null : Object.fromEntries(['development','challenge'].map(split => [split,summarize(first.filter(r => r.split === split))])),
      byCategory: failure ? null : Object.fromEntries([...new Set(first.map(r => r.category))].map(category => [category,summarize(first.filter(r => r.category === category))])),
      reproducibility: { repeats: runs.length, allQueriesCompleted: comparable, stable, scope: 'cached vectors + ranking + decisions; excludes timing; not fresh provider reruns' },
      latency: { candidate: latencySummary(all.map(r => r.latency.candidateMs)), pipeline: latencySummary(all.map(r => r.latency.pipelineMs)),
        firstPass: latencySummary(first.map(r => r.latency.candidateMs+r.latency.pipelineMs)),
        laterPasses: latencySummary(runs.slice(1).flatMap(r => r.results.map(q => q.latency.candidateMs+q.latency.pipelineMs))) },
      cost: { usage: built.embeddings?.usage ?? { cacheHits: 0, cacheMisses: 0, requests: 0, inputTokens: 0 },
        estimatedUsdFromReportedTokens: (built.embeddings?.usage.inputTokens ?? 0)*experiment.price.usdPerMillionInputTokens/1e6,
        rate: experiment.price, scope: 'Embedding API usage for this arm including diagnostic and governed paths; excludes hosting and local compute; failed HTTP usage may be unknown' }, runs });
  }
  return { schemaVersion: 'phase2b-benchmark-v1', recordedAt: new Date().toISOString(), simulatedAt: FIXED_TIME,
    goldSha256: experiment.goldSha256, corpusSha256: experiment.corpusSha256, configurationHash: hash(experiment),
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    implementationHash: hash(['contracts.ts','pipeline.ts','policy.ts','support.ts','retrieval-benchmark.ts',
      'providers/provider.ts','providers/configuration.ts','providers/embedding.ts','providers/openai-embedding.ts',
      'providers/local-lexical.ts','providers/semantic.ts','providers/hybrid.ts','providers/factory.ts']
      .map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex') }))),
    inputStatus: 'All source documents and questions are synthetic; developer-only fixture benchmark',
    methodology: 'Frozen 36 queries; 5 repeats; @8 except conflict @1; eligible stage ranks the prefiltered universe independently, not raw top-k posthoc. Gold-empty rows excluded from relevance metrics. Threshold probe is uncalibrated. No query rewriting or reranker.',
    arms, decision: 'D', recommendedDefault: 'lexical', fallback: 'Explicit lexical mode available; selected semantic/hybrid failures pause, never silently downgrade.',
    decisionReason: 'No automatic adoption decision. Review measured quality, governance, latency and cost; missing live arms make results inconclusive.' };
}

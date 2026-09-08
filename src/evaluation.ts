import assert from 'node:assert/strict';
import type { Corpus, EvidenceRecord, RetrievalRequest, ReasonCode } from './contracts.ts';
import { KnowledgePipeline } from './pipeline.ts';
import { Registry, FIXED_TIME, loadCorpus } from './registry.ts';
import { LocalLexicalProvider } from './providers/local-lexical.ts';
import { EvidenceStore } from './evidence-store.ts';
import { canonical, manifestDigest, withoutHash } from './integrity.ts';

export const BASE_ELIGIBLE = ['CE-101-01.v1', 'K-APL.v1', 'K-EDU.v1', 'K-PA.v2', 'N-101.v1'];
export const BASE_EVIDENCE = ['K-PA.v2.s1', 'N-101.v1.s1', 'CE-101-01.v1.s1'];
export const baseRequest = (patch: Partial<RetrievalRequest> = {}): RetrievalRequest => ({
  id: 'REQ-BASE', mode: 'governed', question: 'Which signed office note document is missing for this request?',
  channel: 'chat', task: 'missing_document', selectionId: 'AS-101', releaseIds: ['KP-ALDER.2026.09.1'],
  caseId: 'DEMO-101', purpose: 'recommend', requestedAction: 'recommend_document', maxResults: 8, ...patch,
});
export const sandboxRequest = (patch: Partial<RetrievalRequest> = {}): RetrievalRequest => ({
  id: 'REQ-SANDBOX', mode: 'sandbox', question: 'Which signed office note document is requested?', channel: 'chat',
  task: 'source_summary', selectionId: 'COLLECTION-1', releaseIds: [], caseId: null, purpose: 'explore',
  requestedAction: 'transfer_document', maxResults: 8, ...patch,
});

/** Test-only resealing models separately reviewed input revisions, never a runtime approval tool. */
export function reseal(corpus: Corpus): Corpus {
  for (const release of corpus.releases) release.manifestHash = manifestDigest(withoutHash(release), corpus);
  return corpus;
}
export function harness(input: Corpus = loadCorpus(), store = new EvidenceStore()) {
  const registry = new Registry(input);
  const provider = new LocalLexicalProvider();
  let now = FIXED_TIME;
  const pipeline = new KnowledgePipeline(registry, provider, store, () => now);
  return { registry, provider, pipeline, store, setTime: (time: string) => { now = time; } };
}

export async function retirementDemo(store = new EvidenceStore()) {
  const h = harness(loadCorpus(), store);
  const initial = await h.pipeline.run('avery', baseRequest({ id: 'DEMO-BEFORE' }));
  assert.equal(initial.disposition, 'answer');
  assert.equal(initial.action.status, 'allowed');
  assert.deepEqual(initial.evidenceUsed.map(e => e.passageId), BASE_EVIDENCE);
  const originalBytes = canonical(initial);
  const retirement = h.registry.retire('publisher', 'K-PA.v2', '2026-09-10T16:05:00Z', 'Synthetic source withdrawn for review');
  h.setTime('2026-09-10T16:06:00Z');
  const afterRetirement = await h.pipeline.run('avery', baseRequest({ id: 'DEMO-AFTER' }));
  assert.equal(afterRetirement.disposition, 'pause');
  assert.equal(afterRetirement.action.status, 'paused');
  const historical = store.get(initial.id, h.registry.user('avery'));
  assert.equal(canonical(historical), originalBytes);
  for (const citation of historical.evidenceUsed) {
    const version = h.registry.corpus.versions.find(v => v.id === citation.documentVersionId)!;
    assert.equal(version.originalText.slice(citation.locator.start, citation.locator.end), citation.text);
  }
  const sandboxReplacement = await h.pipeline.run('viewer', sandboxRequest({ id: 'DEMO-SANDBOX-REPLACEMENT' }));
  assert.equal(sandboxReplacement.disposition, 'answer');
  assert.equal(sandboxReplacement.action.status, 'denied');
  const retry = await h.pipeline.run('avery', baseRequest({ id: 'DEMO-RETRY' }));
  assert.equal(retry.disposition, 'pause');
  assert.equal(retry.action.status, 'paused');
  assert(!retry.evidenceUsed.some(e => e.documentVersionId.startsWith('SB-')));
  assert.equal(canonical(store.get(initial.id, h.registry.user('avery'))), originalBytes);
  return { demonstration: 'approved-source-retirement-history-sandbox-boundary', simulated: ['fixture identity and approvals', 'reviewed statement annotations', 'no action executor', 'no LLM'],
    provider: h.provider.descriptor, pass: true, initial, retirement, afterRetirement,
    history: { evidenceId: historical.id, recordHash: historical.recordHash, unchanged: true, citationsResolvable: true },
    sandboxReplacement, retry };
}

type Expected = {
  eligible: string[]; disposition: EvidenceRecord['disposition']; support?: EvidenceRecord['support']['status'];
  applicability?: EvidenceRecord['applicability']['status']; communication?: EvidenceRecord['communication']['status'];
  action: EvidenceRecord['action']['status']; evidence?: string[];
  exclusions?: [string, ReasonCode][]; finding?: ReasonCode;
};
interface EvaluationCase {
  id: string; title: string; reference: string; actor?: string; request?: Partial<RetrievalRequest>;
  sandbox?: boolean; setup?: (h: ReturnType<typeof harness>) => void;
  corpus?: (c: Corpus) => Corpus; expected: Expected;
}
const cases: EvaluationCase[] = [
  { id: 'T01', title: 'Current source supports SC-01 and a recommendation', reference: 'E-02', expected: {
    eligible: BASE_ELIGIBLE, disposition: 'answer', support: 'supported', applicability: 'applicable', communication: 'allowed', action: 'allowed', evidence: BASE_EVIDENCE,
  } },
  { id: 'T02', title: 'Expired, superseded and future versions are excluded', reference: 'E-03', expected: {
    eligible: BASE_ELIGIBLE, disposition: 'answer', action: 'allowed', evidence: BASE_EVIDENCE,
    exclusions: [['K-PA.expired', 'EXPIRED'], ['K-PA.superseded', 'SUPERSEDED'], ['K-PA.v3', 'NOT_YET_EFFECTIVE']],
  } },
  { id: 'T03', title: 'Topically similar wrong payer and plan are excluded', reference: 'E-07', expected: {
    eligible: BASE_ELIGIBLE, disposition: 'answer', action: 'allowed', exclusions: [['K-CEDAR.v1', 'WRONG_PAYER'], ['K-CEDAR.v1', 'WRONG_PLAN']],
  } },
  { id: 'T04', title: 'Wrong state is excluded before retrieval', reference: 'E-07 extension', expected: {
    eligible: BASE_ELIGIBLE, disposition: 'answer', action: 'allowed', exclusions: [['K-UT.v1', 'WRONG_STATE']],
  } },
  { id: 'T05', title: 'Lower-authority conflict cannot override payer evidence', reference: 'E-04 extension', expected: {
    eligible: BASE_ELIGIBLE, disposition: 'answer', action: 'allowed', evidence: BASE_EVIDENCE, finding: 'LOWER_AUTHORITY_CONFLICT',
  } },
  { id: 'T06', title: 'Authoritative conflict outside top-k blocks reliance', reference: 'E-04',
    setup: h => { h.registry.reportConflict('publisher', 'K-PA-X.v1', FIXED_TIME); }, request: { maxResults: 1 }, expected: {
      eligible: BASE_ELIGIBLE, disposition: 'escalate', support: 'conflicting', applicability: 'unknown', action: 'paused', finding: 'AUTHORITATIVE_CONFLICT',
    } },
  { id: 'T07', title: 'Missing payer deadline produces abstention', reference: 'E-05',
    request: { task: 'deadline', question: 'What is the deadline for the signed note request?', requestedAction: null }, expected: {
      eligible: BASE_ELIGIBLE, disposition: 'abstain', support: 'missing', action: 'not_requested', evidence: [],
    } },
  { id: 'T08', title: 'Injection document supports only its reviewed quotation', reference: 'E-08', sandbox: true,
    corpus: c => { c.collections[0]!.documentVersionIds = ['SB-INJECT.v1']; return c; }, expected: {
      eligible: ['SB-INJECT.v1'], disposition: 'answer', applicability: 'sandbox_only', action: 'denied', evidence: ['SB-INJECT.v1.s1'],
    } },
  { id: 'T09', title: 'Sandbox Q&A never enables a case action', reference: 'E-09', sandbox: true, expected: {
    eligible: ['SB-INJECT.v1', 'SB-REPLACEMENT.v1'], disposition: 'answer', support: 'supported', action: 'denied',
  } },
  { id: 'T10', title: 'Retired source pauses next recommendation', reference: 'E-11',
    setup: h => { h.registry.retire('publisher', 'K-PA.v2', FIXED_TIME, 'Fixture retirement'); }, expected: {
      eligible: BASE_ELIGIBLE.filter(id => id !== 'K-PA.v2'), disposition: 'pause', action: 'paused', exclusions: [['K-PA.v2', 'SOURCE_RETIRED']],
    } },
  { id: 'T11', title: 'Supported communication does not authorize transfer', reference: 'E-19',
    request: { task: 'source_summary', purpose: 'explain', question: 'Explain authenticated chat and separate package approval.', requestedAction: 'transfer_document' }, expected: {
      eligible: [...BASE_ELIGIBLE, 'K-COMM.v1'].sort(), disposition: 'answer', support: 'supported', communication: 'allowed', action: 'requires_approval', evidence: ['K-COMM.v1.s1'],
    } },
  { id: 'T12', title: 'Incomplete metadata never becomes operational evidence', reference: 'E-10', expected: {
    eligible: BASE_ELIGIBLE, disposition: 'answer', action: 'allowed', exclusions: [['K-UNDATED.v1', 'METADATA_UNKNOWN'], ['K-UNDATED.v1', 'UNAPPROVED']],
  } },
  { id: 'T13', title: 'Wrong-tenant actor cannot discover case sources', reference: 'E-20', actor: 'outsider', expected: {
    eligible: [], disposition: 'deny', communication: 'denied', action: 'paused', evidence: [],
  } },
  { id: 'T14', title: 'User cannot swap an Alder case to Cedar', reference: 'E-07',
    request: { releaseIds: ['KP-CEDAR.2026.09.1'] }, expected: { eligible: [], disposition: 'deny', action: 'paused', evidence: [] } },
  { id: 'T15', title: 'Mandatory pack cannot be deselected', reference: 'E-04 extension',
    request: { releaseIds: [] }, expected: { eligible: [], disposition: 'deny', action: 'paused', evidence: [] } },
  { id: 'T16', title: 'SC-02 notice supplies the exact appeal deadline', reference: 'E-13 subset',
    request: { task: 'deadline', caseId: 'DEMO-102', selectionId: 'AS-102', question: 'What appeal deadline does the denial notice give?', requestedAction: null }, expected: {
      eligible: ['K-APL.v1', 'K-EDU.v1', 'K-PA.v2', 'N-102.v1'], disposition: 'answer', action: 'not_requested', evidence: ['N-102.v1.s1'],
    } },
  { id: 'T17', title: 'SC-03 unknown coverage permits generic intake only', reference: 'E-16',
    request: { task: 'support_intake', caseId: 'DEMO-103', selectionId: 'AS-103', releaseIds: ['KP-SUPPORT.2026.09.1'], question: 'Current coverage is uncertain; can support determine eligibility?', requestedAction: null }, expected: {
      eligible: ['K-FIN.v1'], disposition: 'answer', action: 'not_requested', evidence: ['K-FIN.v1.s1'],
    } },
  { id: 'T18', title: 'A clinical/coverage decision is prohibited despite supported evidence', reference: 'E-15 subset',
    request: { requestedAction: 'decide_coverage' }, expected: { eligible: BASE_ELIGIBLE, disposition: 'answer', action: 'denied', evidence: BASE_EVIDENCE } },
  { id: 'T19', title: 'Forbidden communication channel cannot leak passages', reference: 'E-18',
    request: { channel: 'sms' }, expected: { eligible: [], disposition: 'deny', communication: 'denied', action: 'paused', evidence: [] } },
  { id: 'T20', title: 'Expired pinned release pauses without automatic migration', reference: 'E-25 subset',
    setup: h => h.setTime('2026-12-01T07:00:00Z'), expected: { eligible: [], disposition: 'pause', action: 'paused', evidence: [] } },
  { id: 'T21', title: 'Unknown benefit does not match a plan-specific rule', reference: 'E-06',
    corpus: c => { c.cases[0]!.attributes.benefit = null; return c; }, expected: { eligible: [], disposition: 'deny', applicability: 'unknown', action: 'paused', evidence: [] } },
  { id: 'T22', title: 'Same question, different valid pack and context', reference: 'E-01 subset',
    request: { task: 'document_requirement', caseId: 'DEMO-CEDAR', selectionId: 'AS-CEDAR', releaseIds: ['KP-CEDAR.2026.09.1'], requestedAction: null }, expected: {
      eligible: ['K-CEDAR.v1'], disposition: 'answer', action: 'not_requested', evidence: ['K-CEDAR.v1.s1'],
    } },
  { id: 'T23', title: 'An expired sandbox collection cannot answer', reference: 'Collection expiry extension; E-26 deletion not implemented', sandbox: true,
    setup: h => h.setTime('2026-09-11T16:00:00Z'), expected: { eligible: [], disposition: 'pause', action: 'denied', evidence: [] } },
];

export interface EvaluationResult {
  id: string; title: string; reference: string; pass: boolean; errors: string[]; expected: Expected;
  retrievedSources: string[]; excluded: EvidenceRecord['excluded']; evidenceUsed: string[];
  applicability: EvidenceRecord['applicability']; communication: EvidenceRecord['communication'];
  action: EvidenceRecord['action']; support: EvidenceRecord['support']; disposition: EvidenceRecord['disposition']; evidenceId: string;
}
export async function runEvaluations() {
  const results: EvaluationResult[] = [];
  for (const test of cases) {
    const corpus = test.corpus ? test.corpus(loadCorpus()) : loadCorpus();
    const h = harness(corpus);
    test.setup?.(h);
    const request = (test.sandbox ? sandboxRequest : baseRequest)({ id: test.id, ...test.request });
    const record = await h.pipeline.run(test.actor ?? (test.sandbox ? 'viewer' : 'avery'), request);
    const errors: string[] = [];
    const check = (fn: () => void) => { try { fn(); } catch (e) { errors.push((e as Error).message); } };
    check(() => assert.deepEqual(record.eligibleVersionIds, [...test.expected.eligible].sort(), 'eligible source set'));
    check(() => assert.equal(record.disposition, test.expected.disposition, 'final disposition'));
    check(() => assert.equal(record.action.status, test.expected.action, 'action permission'));
    if (test.expected.support) check(() => assert.equal(record.support.status, test.expected.support));
    if (test.expected.applicability) check(() => assert.equal(record.applicability.status, test.expected.applicability));
    if (test.expected.communication) check(() => assert.equal(record.communication.status, test.expected.communication));
    if (test.expected.evidence) check(() => assert.deepEqual(record.evidenceUsed.map(e => e.passageId), test.expected.evidence));
    for (const [id, reason] of test.expected.exclusions ?? []) check(() => assert(record.excluded.some(e => e.documentVersionId === id && e.reasonCodes.includes(reason)), `${id}: ${reason}`));
    if (test.expected.finding) check(() => assert(record.authorityFindings.some(f => f.reasonCode === test.expected.finding)));
    check(() => assert(record.retrieved.every(r => test.expected.eligible.includes(r.documentVersionId)), 'retrieval escaped expected eligible universe'));
    check(() => assert(record.answer.claims.every(c => c.passageIds.every(id => record.evidenceUsed.some(e => e.passageId === id && e.text.includes(c.text)))), 'claim/citation fidelity'));
    check(() => assert(!JSON.stringify(record).includes('HIDDEN.v1'), 'private source identity leak'));
    if (test.sandbox) {
      check(() => assert.equal(record.action.status, 'denied'));
      check(() => assert(record.answer.claims.every(c => !c.text.includes('Ignore all previous'))));
    }
    results.push({ id: test.id, title: test.title, reference: test.reference, pass: !errors.length, errors, expected: test.expected,
      retrievedSources: record.retrieved.map(r => r.documentVersionId), excluded: record.excluded,
      evidenceUsed: record.evidenceUsed.map(e => e.passageId), applicability: record.applicability,
      communication: record.communication, action: record.action, support: record.support, disposition: record.disposition, evidenceId: record.id });
  }
  const h = harness();
  const a = await h.pipeline.run('avery', baseRequest());
  const b = await h.pipeline.run('avery', baseRequest());
  const reproducible = canonical(a) === canonical(b);
  const demo = await retirementDemo();
  return { schemaVersion: 'phase2a-eval-v1', provider: h.provider.descriptor,
    claims: { semanticRetrieval: 'not_implemented', llmInjectionResistance: 'not_tested',
      governance: 'deterministic assertions on synthetic reference fixtures', lexicalQuality: 'no held-out retrieval benchmark; not inferred from governance pass rate',
      modelCost: 'no model calls; $0 API usage, not a hosted cost estimate', latency: 'not_benchmarked' },
    summary: { cases: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length,
      reproducibleEvidence: reproducible, retirementSequence: demo.pass, allPassed: results.every(r => r.pass) && reproducible && demo.pass }, results };
}

/** Two diagnostic queries, not a representative or held-out semantic benchmark. */
export async function runRetrievalProbes() {
  const questions = [baseRequest().question, 'Which clinician-authenticated encounter narrative remains outstanding?'];
  const results = [];
  for (const [i, question] of questions.entries()) {
    const h = harness();
    const e = await h.pipeline.run('avery', baseRequest({ id: `PROBE-${i + 1}`, question }));
    results.push({ id: `P${i + 1}`, question, expectedEligibleSources: BASE_ELIGIBLE,
      goldPassageIds: BASE_EVIDENCE, retrieved: e.retrieved,
      goldPassagesRetrieved: BASE_EVIDENCE.filter(id => e.retrieved.some(r => r.passageId === id)).length,
      goldPassageCount: BASE_EVIDENCE.length, evidenceUsed: e.evidenceUsed.map(p => p.passageId),
      disposition: e.disposition, action: e.action.status, evidenceId: e.id });
  }
  return { schemaVersion: 'phase2a-retrieval-probes-v1', provider: new LocalLexicalProvider().descriptor,
    interpretation: 'Two hand-authored diagnostic queries for one case, not a benchmark. Exact vocabulary retrieves the three required passages; the synonymous wording exposes the lexical provider limit. Governance correctly abstains when required evidence is not retrieved.',
    recommendation: 'A: expand real retrieval behind the same policy boundary; measure paraphrase recall separately from governance correctness.', results };
}

// Reuse the unchanged reference definitions for durable-adapter parity; no copied expectations.
export { cases as referenceCases };

import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalPassage, DocumentVersion, EvidenceRecord, RetrievalRequest, Scope, KnowledgePackRelease } from '../src/contracts.ts';
import { Registry, loadCorpus, FIXED_TIME } from '../src/registry.ts';
import { baseRequest, harness, reseal } from '../src/evaluation.ts';
import { dateReasons, scopeReasons } from '../src/policy.ts';

test('all fixture references, immutable manifests and exact source locations validate', () => {
  const r = new Registry(loadCorpus());
  assert.equal(r.corpus.versions.length, 19);
  assert.equal(r.corpus.passages.length, 19);
});
test('runtime request refuses caller-supplied user, approval and as-of overrides', () => {
  for (const extra of [{ actionApproved: true }, { userContext: { roles: ['publisher'] } }, { timestamp: FIXED_TIME }, { asOf: FIXED_TIME }]) {
    assert.equal(RetrievalRequest.safeParse({ ...baseRequest(), ...extra }).success, false);
  }
});
test('sandbox request cannot attach a case or operational release', () => {
  assert.equal(RetrievalRequest.safeParse({ ...baseRequest(), mode: 'sandbox' }).success, false);
});
test('scope requires explicit unknown/all/not-applicable values', () => {
  const scope = loadCorpus().versions[0]!.scope;
  assert.equal(Scope.safeParse({ ...scope, plan: null }).success, false);
  assert.equal(Scope.safeParse({ ...scope, plan: { kind: 'known', values: [] } }).success, false);
  assert.equal(Scope.safeParse({ ...scope, plan: { kind: 'all_explicit' } }).success, false);
});
test('unknown context is not a wildcard even for an explicit all scope', () => {
  const c = loadCorpus();
  const scope = { ...c.versions[0]!.scope, plan: { kind: 'all_explicit' as const, reason: 'Every known plan' } };
  assert(scopeReasons(scope, { ...c.cases[0]!.attributes, plan: null }).includes('METADATA_UNKNOWN'));
});
test('approval cannot be a boolean or unaccountable label', () => {
  const v = loadCorpus().versions[0]!;
  assert.equal(DocumentVersion.safeParse({ ...v, approvalStatus: true }).success, false);
  assert.equal(DocumentVersion.safeParse({ ...v, approvedBy: null }).success, false);
});
test('dates require a valid interval, and supersession requires both fields', () => {
  const v = loadCorpus().versions[0]!;
  assert.equal(DocumentVersion.safeParse({ ...v, expiresAt: v.effectiveFrom }).success, false);
  assert.equal(DocumentVersion.safeParse({ ...v, supersededBy: 'K-PA.v3' }).success, false);
});
test('release contributor cannot self-approve', () => {
  const r = loadCorpus().releases[0]!;
  assert.equal(KnowledgePackRelease.safeParse({ ...r, reviewedBy: r.contributedBy }).success, false);
});
test('changed source metadata invalidates an existing release manifest', () => {
  const c = loadCorpus();
  c.versions[0]!.permittedUses.push('internal_route');
  assert.throws(() => new Registry(c), /manifest/);
});
test('quote must exist in exact canonical text', () => {
  const p = loadCorpus().passages[0]!;
  assert.equal(CanonicalPassage.safeParse({ ...p, statements: [{ ...p.statements[0]!, quote: 'invented claim' }] }).success, false);
});
test('incorrect source string offsets are rejected, not silently relocated', () => {
  const c = loadCorpus();
  c.passages[0]!.locator.start += 1;
  assert.throws(() => new Registry(c), /canonical passage/);
});
test('structured table preserves header, row and limiting footnote', () => {
  const p = loadCorpus().passages.find(p => p.documentVersionId === 'K-TABLE.v1')!;
  assert(p.locator.table);
  assert(p.text.includes(p.locator.table.footnote));
  const c = loadCorpus();
  c.passages.find(p => p.documentVersionId === 'K-TABLE.v1')!.locator.table!.footnote = 'missing footnote';
  assert.throws(() => new Registry(c), /table context/);
});
test('duplicate version identities cannot overwrite existing sources', () => {
  const c = loadCorpus(); c.versions.push(c.versions[0]!);
  assert.throws(() => new Registry(c), /Duplicate/);
});
test('a reusable pack cannot contain case-specific evidence', () => {
  const c = loadCorpus();
  c.releases[0]!.documentVersionIds.push('N-101.v1');
  c.releases[0]!.passageIds.push('N-101.v1.s1');
  assert.throws(() => new Registry(reseal(c)), /pack provenance/);
});
test('a reusable governed pack cannot contain sandbox evidence even when rehashed', () => {
  const c = loadCorpus();
  c.releases[0]!.documentVersionIds.push('SB-REPLACEMENT.v1');
  c.releases[0]!.passageIds.push('SB-REPLACEMENT.v1.s1');
  assert.throws(() => new Registry(reseal(c)), /pack provenance/);
});
test('case notice cannot be cross-bound to another case', () => {
  const c = loadCorpus(); c.cases[0]!.evidenceVersionIds.push('N-102.v1');
  assert.throws(() => new Registry(c), /case evidence/);
});
test('date boundaries are start-inclusive and end-exclusive across offsets', () => {
  assert.deepEqual(dateReasons('2026-09-01T00:00:00-06:00', '2026-12-01T00:00:00-07:00', '2026-09-01T06:00:00Z'), []);
  assert.deepEqual(dateReasons('2026-09-01T06:00:00Z', '2026-12-01T07:00:00Z', '2026-12-01T06:59:59Z'), []);
  assert.deepEqual(dateReasons('2026-09-01T06:00:00Z', '2026-12-01T07:00:00Z', '2026-12-01T07:00:00Z'), ['EXPIRED']);
});
test('evidence requires four structured decisions and a tamper-evident record', async () => {
  const h = harness(); const e = await h.pipeline.run('avery', baseRequest());
  assert(EvidenceRecord.safeParse(e).success);
  assert(!EvidenceRecord.safeParse({ ...e, applicability: true }).success);
  assert(!EvidenceRecord.safeParse({ ...e, action: { allowed: true } }).success);
  assert.equal(e.audit.length, 10);
});

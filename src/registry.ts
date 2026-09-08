import { readFileSync } from 'node:fs';
import { Corpus, Retirement, ConflictFinding, Timestamp, Hash } from './contracts.ts';
import type { DocumentVersion, UserContext } from './contracts.ts';
import { freeze, hash, textHash, manifestDigest, withoutHash } from './integrity.ts';

export const POLICY_VERSION = 'knowledge-policy-v1';
export const FIXED_TIME = '2026-09-10T16:00:00Z';

export function loadCorpus(): Corpus {
  return Corpus.parse(JSON.parse(readFileSync(new URL('../fixtures/knowledge/corpus.json', import.meta.url), 'utf8')));
}

export class Registry {
  readonly corpus: Corpus;
  readonly corpusHash: string;
  #retirements: Retirement[] = [];
  #conflicts: ConflictFinding[] = [];

  constructor(input: unknown, cacheNamespaceHash?: string) {
    const corpus = Corpus.parse(input);
    for (const values of Object.values(corpus)) {
      if (new Set(values.map(v => v.id)).size !== values.length) throw new Error('Duplicate stable or immutable identity');
    }
    for (const v of corpus.versions) {
      const doc = corpus.documents.find(d => d.id === v.documentId);
      if (!doc || textHash(v.originalText) !== v.contentHash) throw new Error(`Invalid source ${v.id}`);
      if (v.approvalStatus === 'approved' && v.approvedBy === doc.provenance.uploadedBy) throw new Error('Document self-approval');
      if (v.supersededBy) {
        const next = corpus.versions.find(n => n.id === v.supersededBy);
        if (!next || next.documentId !== v.documentId) throw new Error('Invalid supersession reference');
        const seen = new Set([v.id]);
        let cursor: DocumentVersion | undefined = next;
        while (cursor) {
          if (seen.has(cursor.id)) throw new Error('Supersession cycle');
          seen.add(cursor.id);
          cursor = corpus.versions.find(n => n.id === cursor?.supersededBy);
        }
      }
    }
    for (const p of corpus.passages) {
      const v = corpus.versions.find(v => v.id === p.documentVersionId);
      if (!v || p.artifactVersion !== v.artifactVersion || textHash(p.text) !== p.textHash ||
          v.originalText.slice(p.locator.start, p.locator.end) !== p.text) throw new Error(`Invalid canonical passage ${p.id}`);
      const start = v.originalText.slice(0, p.locator.start).split('\n').length;
      if (p.locator.lineStart !== start || p.locator.lineEnd !== start + p.text.split('\n').length - 1) throw new Error('Invalid line locator');
      if (p.locator.table && (!p.text.includes(p.locator.table.row) || !p.text.includes(p.locator.table.footnote) || p.locator.table.headers.some(h => !p.text.includes(h)))) throw new Error('Invalid table context');
    }
    for (const r of corpus.releases) {
      const pack = corpus.packs.find(p => p.id === r.packId);
      if (!pack || r.manifestHash !== manifestDigest(withoutHash(r), corpus)) throw new Error(`Invalid release manifest ${r.id}`);
      if (new Set(r.documentVersionIds).size !== r.documentVersionIds.length || new Set(r.passageIds).size !== r.passageIds.length) throw new Error('Duplicate manifest member');
      for (const id of r.documentVersionIds) {
        const v = corpus.versions.find(v => v.id === id);
        const d = corpus.documents.find(d => d.id === v?.documentId);
        if (!d || d.caseId || d.provenance.mode !== 'governed' || d.provenance.tenantId !== pack.tenantId) throw new Error('Invalid pack provenance');
      }
      for (const id of r.passageIds) {
        const p = corpus.passages.find(p => p.id === id);
        if (!p || !r.documentVersionIds.includes(p.documentVersionId)) throw new Error('Invalid pack passage reference');
      }
    }
    for (const c of corpus.collections) {
      for (const id of c.documentVersionIds) {
        const v = corpus.versions.find(v => v.id === id);
        const d = corpus.documents.find(d => d.id === v?.documentId);
        if (!d || d.provenance.mode !== 'sandbox' || d.provenance.tenantId !== c.tenantId || d.provenance.ownerId !== c.ownerId) throw new Error('Invalid collection ownership');
      }
    }
    for (const c of corpus.cases) {
      const a = corpus.assignments.find(a => a.id === c.assignmentId);
      if (!a || a.tenantId !== c.tenantId || !a.caseIds.includes(c.id)) throw new Error('Invalid case assignment');
      for (const id of c.evidenceVersionIds) {
        const v = corpus.versions.find(v => v.id === id);
        const d = corpus.documents.find(d => d.id === v?.documentId);
        if (!d || d.caseId !== c.id || d.provenance.tenantId !== c.tenantId || d.provenance.mode !== 'governed') throw new Error('Invalid case evidence reference');
      }
    }
    for (const a of corpus.assignments) {
      if (a.mandatoryReleaseIds.some(id => !a.releaseIds.includes(id))) throw new Error('Mandatory pack not assigned');
      for (const id of a.releaseIds) {
        const r = corpus.releases.find(r => r.id === id);
        if (!r || corpus.packs.find(p => p.id === r.packId)?.tenantId !== a.tenantId) throw new Error('Invalid release assignment');
      }
    }
    this.corpus = freeze(corpus);
    this.corpusHash = cacheNamespaceHash === undefined ? hash(corpus) : Hash.parse(cacheNamespaceHash);
  }

  user(id: string): UserContext {
    const user = this.corpus.users.find(u => u.id === id);
    if (!user) throw new Error('Unauthenticated actor');
    return user;
  }

  visibleVersions(user: UserContext): DocumentVersion[] {
    return this.corpus.versions.filter(v => {
      const d = this.document(v.documentId);
      return d.provenance.tenantId === user.tenantId && (!d.caseId || user.caseIds.includes(d.caseId)) &&
        (d.provenance.mode === 'sandbox' ? d.provenance.ownerId === user.id : !user.roles.includes('sandbox'));
    });
  }

  document(id: string) {
    const document = this.corpus.documents.find(d => d.id === id);
    if (!document) throw new Error('Unknown document');
    return document;
  }

  snapshotHash(): string {
    return hash({ corpusHash: this.corpusHash, retirements: this.#retirements, conflicts: this.#conflicts });
  }

  retire(userId: string, targetId: string, timestamp: string, reason: string, targetType: Retirement['targetType'] = 'document_version'): Retirement {
    const user = this.user(userId);
    Timestamp.parse(timestamp);
    const tenant = targetType === 'document_version'
      ? this.corpus.documents.find(d => d.id === this.corpus.versions.find(v => v.id === targetId)?.documentId)?.provenance.tenantId
      : this.corpus.packs.find(p => p.id === this.corpus.releases.find(r => r.id === targetId)?.packId)?.tenantId;
    if (!user.roles.includes('publisher') || tenant !== user.tenantId) throw new Error('Retirement unauthorized');
    const prior = this.#retirements.find(r => r.targetId === targetId && r.targetType === targetType);
    if (prior) return prior;
    const record = Retirement.parse({ id: `RV-${this.#retirements.length + 1}`, targetType, targetId, actorId: userId, timestamp, reason, policyVersion: POLICY_VERSION });
    this.#retirements.push(freeze(record));
    return record;
  }

  supersededAt(version: DocumentVersion): string | null { return version.supersededAt; }

  isRetired(id: string): boolean {
    // Active revocations always win, even against a request using an earlier as-of clock.
    return this.#retirements.some(r => r.targetId === id);
  }

  reportConflict(userId: string, versionId: string, timestamp: string): ConflictFinding {
    const user = this.user(userId);
    const v = this.corpus.versions.find(v => v.id === versionId);
    if (!v || !user.roles.includes('publisher') || this.document(v.documentId).provenance.tenantId !== user.tenantId || v.approvalStatus !== 'approved') throw new Error('Conflict registration unauthorized');
    const record = ConflictFinding.parse({ id: `CF-${this.#conflicts.length + 1}`, documentVersionId: versionId, actorId: userId, timestamp });
    this.#conflicts.push(freeze(record));
    return record;
  }

  conflictVersionIds(): string[] { return this.#conflicts.map(c => c.documentVersionId); }
  retirements(): Retirement[] { return structuredClone(this.#retirements); }
}

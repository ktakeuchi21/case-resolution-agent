import { createHash } from 'node:crypto';
import type { Corpus, KnowledgePackRelease } from './contracts.ts';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Unserializable value');
  return encoded;
}

export function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function textHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}

export function withoutHash<T extends { manifestHash: string }>(value: T): Omit<T, 'manifestHash'> {
  const { manifestHash: _manifestHash, ...rest } = value;
  return rest;
}

export function manifestDigest(release: Omit<KnowledgePackRelease, 'manifestHash'>, corpus: Pick<Corpus, 'documents' | 'versions' | 'passages'>): string {
  const versions = corpus.versions.filter(v => release.documentVersionIds.includes(v.id)).sort((a, b) => a.id.localeCompare(b.id));
  return hash({ release, versions,
    documents: corpus.documents.filter(d => versions.some(v => v.documentId === d.id)).sort((a, b) => a.id.localeCompare(b.id)),
    passages: corpus.passages.filter(p => release.passageIds.includes(p.id)).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

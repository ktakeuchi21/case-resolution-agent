import type { CanonicalPassage, RetrievalCandidate } from '../contracts.ts';
import { hash, textHash } from '../integrity.ts';
import { CachedEmbeddings } from './embedding.ts';
import { RetrievalConfiguration } from './configuration.ts';
import type { AuthorizedUniverse, SemanticRetrievalProvider } from './provider.ts';

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) throw new Error('Vector dimensions mismatch');
  const denominator = Math.hypot(...a) * Math.hypot(...b);
  const value = a.reduce((sum, v, i) => sum + v * b[i]!, 0) / denominator;
  if (!Number.isFinite(value)) throw new Error('Invalid cosine');
  return Math.max(-1, Math.min(1, value));
}
export class LocalSemanticProvider implements SemanticRetrievalProvider {
  readonly descriptor;
  readonly embeddings: CachedEmbeddings;
  readonly configuration: RetrievalConfiguration;
  #passages = new Map<string, CanonicalPassage>();
  #corpusHash = '';
  constructor(embeddings: CachedEmbeddings, configuration: RetrievalConfiguration) {
    this.embeddings = embeddings;
    this.configuration = Object.freeze(RetrievalConfiguration.parse(configuration));
    if (hash(this.configuration.embedding) !== embeddings.configurationHash) throw new Error('Embedding configuration mismatch');
    this.descriptor = Object.freeze({ id: 'local-cosine', version: 'v1', kind: 'semantic' as const,
      config: JSON.stringify({ ...this.configuration, scoring: '(cosine+1)/2; raw cosine retained; ID ties; exact eligible scan' }) });
  }
  capabilities() { return { prefilter: true, exactCanonicalIds: true }; }
  async index(passages: readonly CanonicalPassage[], corpusHash: string): Promise<void> {
    const rows = new Map<string, CanonicalPassage>();
    for (const p of passages) {
      if (rows.has(p.id) || textHash(p.text) !== p.textHash) throw new Error('Invalid canonical index');
      rows.set(p.id, structuredClone(p));
    }
    this.#passages = rows; this.#corpusHash = corpusHash;
  }
  async search({ query, universe, limit }: { query: string; universe: AuthorizedUniverse; limit: number }): Promise<RetrievalCandidate[]> {
    if (universe.corpusHash !== this.#corpusHash) throw new Error('Wrong index snapshot');
    if (!Number.isInteger(limit) || limit < 1 || limit > 50 || new Set(universe.passageIds).size !== universe.passageIds.length) throw new Error('Invalid search bounds');
    const rows = universe.passageIds.map(id => {
      const p = this.#passages.get(id); if (!p) throw new Error('Unknown canonical passage'); return p;
    });
    if (!rows.length) return [];
    // Embed only the policy-authorized universe; index() itself sends nothing externally.
    const queryVector = await this.embeddings.get(query, { kind: 'query', corpusHash: this.#corpusHash });
    const ranked = [];
    for (const p of rows) {
      const vector = await this.embeddings.get(p.text, { kind: 'passage', corpusHash: this.#corpusHash,
        passageId: p.id, documentVersionId: p.documentVersionId, artifactVersion: p.artifactVersion,
        parserVersion: p.parserVersion, chunkerVersion: p.chunkerVersion });
      const score = cosine(queryVector.vector, vector.vector);
      ranked.push({ p, vector, score });
    }
    ranked.sort((a,b) => b.score-a.score || a.p.id.localeCompare(b.p.id));
    return ranked.map((row,i) => ({ ...row, semanticRank: i+1 }))
      .filter(row => this.configuration.semanticMinCosine === null || row.score >= this.configuration.semanticMinCosine)
      .slice(0, limit).map(({ p, vector, score, semanticRank }, i) => ({
        passageId: p.id, documentVersionId: p.documentVersionId, textHash: p.textHash,
        rank: i+1, score: (score+1)/2, scoreKind: 'vector_similarity',
        ranking: { lexical: null, semantic: { rank: semanticRank, score }, combined: null, method: 'cosine', rrfK: null,
          candidateDepth: limit, semanticMinCosine: this.configuration.semanticMinCosine, inclusionReason: 'semantic' },
        embedding: { provider: vector.identity.provider, model: vector.identity.model, dimensions: vector.identity.dimensions,
          configurationHash: vector.configurationHash, documentVectorKey: vector.key, queryVectorKey: queryVector.key,
          documentEmbeddedAt: vector.embeddedAt, queryEmbeddedAt: queryVector.embeddedAt },
      }));
  }
}

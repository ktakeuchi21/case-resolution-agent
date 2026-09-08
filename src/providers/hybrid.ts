import { RetrievalCandidate } from '../contracts.ts';
import type { CanonicalPassage } from '../contracts.ts';
import { RetrievalConfiguration } from './configuration.ts';
import type { AuthorizedUniverse, HybridRetrievalProvider, RetrievalProvider } from './provider.ts';

export function reciprocalRankFusion(lexicalRank: number | null, semanticRank: number | null, k: number): number {
  if (!Number.isInteger(k) || k < 1 || [lexicalRank, semanticRank].some(r => r !== null && (!Number.isInteger(r) || r < 1))) throw new Error('Invalid RRF ranks');
  return (lexicalRank === null ? 0 : 1/(k+lexicalRank)) + (semanticRank === null ? 0 : 1/(k+semanticRank));
}
export class LocalHybridProvider implements HybridRetrievalProvider {
  readonly descriptor;
  readonly configuration: RetrievalConfiguration;
  #lexical: RetrievalProvider;
  #semantic: RetrievalProvider;
  #passages = new Map<string, CanonicalPassage>();
  #corpusHash = '';
  constructor(lexical: RetrievalProvider, semantic: RetrievalProvider, configuration: RetrievalConfiguration) {
    this.configuration = Object.freeze(RetrievalConfiguration.parse(configuration));
    if (lexical.descriptor.kind !== 'lexical' || semantic.descriptor.kind !== 'semantic') throw new Error('Hybrid requires lexical and semantic branches');
    this.#lexical = lexical; this.#semantic = semantic;
    this.descriptor = Object.freeze({ id: 'local-rrf', version: 'v1', kind: 'hybrid' as const,
      config: JSON.stringify({ ...this.configuration, fusion: 'sum(1/(rrfK+branch rank)); equal contributions; absent branch=0; ID ties', lexical: lexical.descriptor, semantic: semantic.descriptor }) });
  }
  capabilities() {
    const both = [this.#lexical.capabilities(), this.#semantic.capabilities()];
    return { prefilter: both.every(c => c.prefilter), exactCanonicalIds: both.every(c => c.exactCanonicalIds) };
  }
  async index(passages: readonly CanonicalPassage[], corpusHash: string): Promise<void> {
    this.#passages = new Map(passages.map(p => [p.id, structuredClone(p)])); this.#corpusHash = corpusHash;
    await this.#lexical.index(passages, corpusHash); await this.#semantic.index(passages, corpusHash);
  }
  async search(input: { query: string; universe: AuthorizedUniverse; limit: number }): Promise<RetrievalCandidate[]> {
    if (input.universe.corpusHash !== this.#corpusHash || input.limit < 1 || !Number.isInteger(input.limit) || input.limit > 50) throw new Error('Invalid hybrid search');
    const depth = Math.max(this.configuration.candidateDepth, input.limit);
    const allowed = new Set(input.universe.passageIds);
    const validate = (raw: unknown) => {
      const rows = RetrievalCandidate.array().parse(raw);
      if (rows.length > depth || new Set(rows.map(r => r.passageId)).size !== rows.length || rows.some((r,i) => {
        const p = this.#passages.get(r.passageId);
        return !p || !allowed.has(r.passageId) || p.textHash !== r.textHash || p.documentVersionId !== r.documentVersionId || r.rank !== i+1;
      })) throw new Error('Hybrid branch violated canonical universe');
      return rows;
    };
    // Either branch failing fails the whole request; never label lexical fallback as hybrid.
    const lexical = validate(await this.#lexical.search({ ...input, limit: depth }));
    const semantic = validate(await this.#semantic.search({ ...input, limit: depth }));
    const union = [...new Set([...lexical, ...semantic].map(r => r.passageId))].map(id => {
      const l = lexical.find(r => r.passageId === id), s = semantic.find(r => r.passageId === id);
      const score = reciprocalRankFusion(l?.rank ?? null, s?.rank ?? null, this.configuration.rrfK);
      const origin = (s ?? l)!;
      return { ...origin, score, scoreKind: 'hybrid_rrf' as const,
        ranking: { lexical: l ? { rank: l.rank, score: l.score } : null,
          semantic: s ? { rank: s.rank, score: s.ranking?.semantic?.score ?? s.score } : null,
          combined: { rank: 1, score }, method: 'reciprocal_rank_fusion' as const, rrfK: this.configuration.rrfK,
          candidateDepth: depth, semanticMinCosine: this.configuration.semanticMinCosine,
          inclusionReason: l && s ? 'both' as const : l ? 'lexical_only' as const : 'semantic_only' as const } };
    });
    return union.sort((a,b) => b.score-a.score || a.passageId.localeCompare(b.passageId)).slice(0,input.limit)
      .map((r,i) => ({ ...r, rank: i+1, ranking: { ...r.ranking, combined: { rank: i+1, score: r.score } } }));
  }
}

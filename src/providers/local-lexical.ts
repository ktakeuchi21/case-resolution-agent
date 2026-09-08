import type { CanonicalPassage, RetrievalCandidate } from '../contracts.ts';
import type { AuthorizedUniverse, RetrievalProvider } from './provider.ts';

const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'in', 'for', 'of', 'to', 'and', 'what', 'which', 'this', 'it', 'we', 'do', 'does']);
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(t => !stopWords.has(t));
}

/** Actual lexical BM25 ranking over the prefiltered subset. No embeddings or semantic claims. */
export class LocalLexicalProvider implements RetrievalProvider {
  readonly descriptor = { id: 'local-bm25', version: 'v1', kind: 'lexical' as const, config: 'BM25 k1=1.2 b=0.75; stopwords-v1; ID tie-break; no query rewrite' };
  #passages: readonly CanonicalPassage[] = [];
  #corpusHash = '';
  capabilities() { return { prefilter: true, exactCanonicalIds: true }; }
  async index(passages: readonly CanonicalPassage[], corpusHash: string): Promise<void> {
    this.#passages = structuredClone(passages);
    this.#corpusHash = corpusHash;
  }
  async search({ query, universe, limit }: { query: string; universe: AuthorizedUniverse; limit: number }): Promise<RetrievalCandidate[]> {
    if (universe.corpusHash !== this.#corpusHash) throw new Error('Wrong index snapshot');
    const permitted = new Set(universe.passageIds);
    const rows = this.#passages.filter(p => permitted.has(p.id)).map(p => ({ p, terms: tokens(p.text) }));
    const terms = [...new Set(tokens(query))];
    const average = rows.reduce((sum, row) => sum + row.terms.length, 0) / (rows.length || 1);
    const scored = rows.map(({ p, terms: row }) => {
      let score = 0;
      for (const term of terms) {
        const tf = row.filter(t => t === term).length;
        if (!tf) continue;
        const df = rows.filter(r => r.terms.includes(term)).length;
        const idf = Math.log(1 + (rows.length - df + 0.5) / (df + 0.5));
        score += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * row.length / (average || 1)));
      }
      return { p, score };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id));
    return scored.slice(0, limit).map(({ p, score }, i) => ({ passageId: p.id, documentVersionId: p.documentVersionId,
      textHash: p.textHash, score: Number(score.toFixed(8)), rank: i + 1, scoreKind: 'lexical_bm25' }));
  }
}

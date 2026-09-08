import { z } from 'zod';
import { EmbeddingIdentity, validateVector } from './embedding.ts';
import type { EmbeddingProvider } from './embedding.ts';

const Response = z.object({ model: z.string(), data: z.array(z.object({ index: z.number().int().nonnegative(), embedding: z.array(z.number().finite()) })),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative(), total_tokens: z.number().int().nonnegative() }) });
/** Provider-specific HTTP stays here. No ambient login/credential-file discovery or fallback. */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly identity: EmbeddingIdentity;
  #apiKey: string;
  #fetch: typeof fetch;
  constructor(identity: EmbeddingIdentity, apiKey: string, transport: typeof fetch = fetch) {
    this.identity = Object.freeze(EmbeddingIdentity.parse(identity));
    if (identity.provider !== 'openai' || !['text-embedding-3-small', 'text-embedding-3-large'].includes(identity.model)) throw new Error('Unsupported OpenAI embedding model');
    if (identity.dimensions > (identity.model === 'text-embedding-3-small' ? 1536 : 3072)) throw new Error('Unsupported embedding dimensions');
    if (!apiKey.trim()) throw new Error('OPENAI_API_KEY is required; semantic retrieval was not run');
    this.#apiKey = apiKey; this.#fetch = transport;
  }
  async embed(texts: readonly string[]): Promise<{ vectors: number[][]; inputTokens: number }> {
    // Conservative UTF-8 byte bound is stricter than the documented token bound.
    if (!texts.length || texts.length > 64 || texts.some(t => !t.trim() || Buffer.byteLength(t) > 8000) || texts.reduce((n,t) => n+Buffer.byteLength(t),0) > 250000) {
      throw new Error('Embedding input exceeds prototype bounds');
    }
    let response: globalThis.Response;
    try {
      response = await this.#fetch('https://api.openai.com/v1/embeddings', { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${this.#apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.identity.model, dimensions: this.identity.dimensions, encoding_format: 'float', input: texts }),
        signal: AbortSignal.timeout(30000) });
    } catch { throw new Error('Embedding transport unavailable'); }
    if (!response.ok) throw new Error(`Embedding HTTP failure (${response.status}); no automatic retry`);
    let raw: z.infer<typeof Response>;
    try { raw = Response.parse(await response.json()); } catch { throw new Error('Embedding response contract violation'); }
    if (raw.model !== this.identity.model || raw.data.length !== texts.length || new Set(raw.data.map(r => r.index)).size !== texts.length ||
        raw.data.some(r => r.index >= texts.length)) throw new Error('Embedding response identity/order mismatch');
    const vectors = raw.data.sort((a,b) => a.index-b.index).map(r => r.embedding);
    vectors.forEach(v => validateVector(v, this.identity.dimensions));
    return { vectors, inputTokens: raw.usage.prompt_tokens };
  }
}

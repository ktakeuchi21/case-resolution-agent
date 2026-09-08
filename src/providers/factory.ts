import { LocalLexicalProvider } from './local-lexical.ts';
import { LocalSemanticProvider } from './semantic.ts';
import { LocalHybridProvider } from './hybrid.ts';
import { CachedEmbeddings, FileEmbeddingCache } from './embedding.ts';
import type { EmbeddingCache, EmbeddingProvider } from './embedding.ts';
import { OpenAIEmbeddingProvider } from './openai-embedding.ts';
import { RetrievalConfiguration } from './configuration.ts';

export function createRetrievalProvider(input: unknown, options: { apiKey?: string; cache?: EmbeddingCache; embeddingProvider?: EmbeddingProvider } = {}) {
  const config = RetrievalConfiguration.parse(input);
  const lexical = new LocalLexicalProvider();
  if (config.mode === 'lexical') return { provider: lexical, embeddings: null };
  const embeddings = new CachedEmbeddings(options.embeddingProvider ?? new OpenAIEmbeddingProvider(config.embedding, options.apiKey ?? ''),
    options.cache ?? new FileEmbeddingCache('.local/embeddings'));
  const semantic = new LocalSemanticProvider(embeddings, config);
  return { provider: config.mode === 'semantic' ? semantic : new LocalHybridProvider(lexical, semantic, config), embeddings };
}

import { z } from 'zod';
import { EmbeddingIdentity } from './embedding.ts';
export const RetrievalConfiguration = z.strictObject({
  mode: z.enum(['lexical', 'semantic', 'hybrid']).default('lexical'),
  candidateDepth: z.number().int().min(1).max(50).default(50),
  rrfK: z.number().int().min(1).max(1000).default(60),
  semanticMinCosine: z.number().min(-1).max(1).nullable().default(null),
  embedding: EmbeddingIdentity.default({ provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536, revision: 'configured-2026-09-07', normalization: 'none-v1' }),
});
export type RetrievalConfiguration = z.infer<typeof RetrievalConfiguration>;

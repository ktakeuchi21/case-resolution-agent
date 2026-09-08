import type { Sessions } from '../app/session.ts';
import { OpenAIEmbeddingProvider } from '../providers/openai-embedding.ts';
import { RetrievalConfiguration } from '../providers/configuration.ts';
import type { EmbeddingProvider } from '../providers/embedding.ts';
import { AgentProviderFailure, OpenAISynthesisProvider } from './provider.ts';

function positiveLimit(value: string | undefined, ceiling: number) {
 const n = Number(value ?? 0); return Number.isInteger(n) && n > 0 && n <= ceiling ? n : 0;
}
export function providerConfiguration() {
 const daily = positiveLimit(process.env.PATHWAY_PROVIDER_DAILY_REQUESTS, 500);
 const perSession = positiveLimit(process.env.PATHWAY_PROVIDER_SESSION_REQUESTS, 80);
 return { enabled: process.env.PATHWAY_LIVE_GENERATION === 'enabled' && !!process.env.OPENAI_API_KEY?.trim() && daily > 0 && perSession > 0, daily, perSession };
}
export function configuredProviders(sessions: Sessions, sessionHash: string) {
 const config = providerConfiguration();
 if (!config.enabled) return {};
 const reserve = () => reserveProviderRequest(sessions, sessionHash, config);
 const embedding = new OpenAIEmbeddingProvider(RetrievalConfiguration.parse({ mode: 'hybrid' }).embedding, process.env.OPENAI_API_KEY!);
 const boundedEmbedding: EmbeddingProvider = { identity: embedding.identity, embed: async texts => { await reserve(); return embedding.embed(texts); } };
 return { provider: new OpenAISynthesisProvider(process.env.OPENAI_API_KEY!, reserve), embeddingProvider: boundedEmbedding };
}

export async function reserveProviderRequest(sessions: Sessions, sessionHash: string, config: {daily:number;perSession:number}, day = new Date().toISOString().slice(0,10)) {
  const c = await sessions.db.pool.connect();
  try {
   await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock(402062)');
   for (const [bucket, limit] of [[`daily.${day}`, config.daily], [`session.${sessionHash}`, config.perSession]] as const) {
    await c.query('INSERT INTO portfolio.provider_budget(bucket,requests) VALUES($1,0) ON CONFLICT DO NOTHING', [bucket]);
    const row = (await c.query('SELECT requests FROM portfolio.provider_budget WHERE bucket=$1 FOR UPDATE', [bucket])).rows[0];
    if (row.requests >= limit) throw new AgentProviderFailure('PROVIDER_BUDGET_EXHAUSTED');
    await c.query('UPDATE portfolio.provider_budget SET requests=requests+1 WHERE bucket=$1', [bucket]);
   }
   await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

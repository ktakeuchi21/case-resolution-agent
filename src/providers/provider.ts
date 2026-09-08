import type { CanonicalPassage, RetrievalCandidate } from '../contracts.ts';

/** Only mechanics; callers cannot send arbitrary source IDs directly to the provider from the CLI. */
export interface AuthorizedUniverse {
  snapshotHash: string;
  corpusHash: string;
  passageIds: readonly string[];
}
export interface ProviderDescriptor {
  id: string;
  version: string;
  kind: 'lexical' | 'semantic' | 'hybrid';
  config: string;
}
export interface RetrievalProvider {
  readonly descriptor: ProviderDescriptor;
  capabilities(): { prefilter: boolean; exactCanonicalIds: boolean };
  index(passages: readonly CanonicalPassage[], corpusHash: string): Promise<void>;
  search(input: { query: string; universe: AuthorizedUniverse; limit: number }): Promise<RetrievalCandidate[]>;
}

export interface LexicalRetrievalProvider extends RetrievalProvider { readonly descriptor: ProviderDescriptor & { kind: 'lexical' } }
export interface SemanticRetrievalProvider extends RetrievalProvider { readonly descriptor: ProviderDescriptor & { kind: 'semantic' } }
export interface HybridRetrievalProvider extends RetrievalProvider { readonly descriptor: ProviderDescriptor & { kind: 'hybrid' } }
// RerankingProvider deliberately deferred until a measured error pattern justifies it.

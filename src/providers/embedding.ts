import { z } from 'zod';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hash, Id, Timestamp } from '../contracts.ts';
import { hash, textHash } from '../integrity.ts';

export const EmbeddingIdentity = z.strictObject({ provider: Id, model: Id, dimensions: z.number().int().min(1).max(65536),
  revision: Id, normalization: z.literal('none-v1') });
export type EmbeddingIdentity = z.infer<typeof EmbeddingIdentity>;
export interface EmbeddingProvider {
  readonly identity: EmbeddingIdentity;
  embed(texts: readonly string[]): Promise<{ vectors: number[][]; inputTokens: number }>;
}
export const VectorRecord = z.strictObject({ key: Hash, identity: EmbeddingIdentity, configurationHash: Hash,
  inputHash: Hash, contextHash: Hash, embeddedAt: Timestamp, vector: z.array(z.number().finite()), vectorHash: Hash });
export type VectorRecord = z.infer<typeof VectorRecord>;
export interface EmbeddingCache {
  get(key: string): Promise<VectorRecord | null>;
  put(record: VectorRecord): Promise<void>;
}
export function validateVector(vector: number[], dimensions: number): void {
  if (vector.length !== dimensions || vector.some(x => !Number.isFinite(x)) || !Number.isFinite(Math.hypot(...vector)) || Math.hypot(...vector) === 0) {
    throw new Error('Invalid embedding vector');
  }
}
export function validateEmbeddingRecord(input: unknown, key: string): VectorRecord {
  const row = VectorRecord.parse(input);
  validateVector(row.vector, row.identity.dimensions);
  if (row.key !== key || row.vectorHash !== hash(row.vector) || row.configurationHash !== hash(row.identity) ||
      key !== hash({ configurationHash: row.configurationHash, inputHash: row.inputHash, contextHash: row.contextHash })) throw new Error('Embedding cache integrity failure');
  return row;
}
export class MemoryEmbeddingCache implements EmbeddingCache {
  #rows = new Map<string, VectorRecord>();
  async get(key: string) { const row = this.#rows.get(Hash.parse(key)); return row ? validateEmbeddingRecord(structuredClone(row), key) : null; }
  async put(record: VectorRecord) {
    const row = validateEmbeddingRecord(record, record.key);
    const prior = this.#rows.get(row.key);
    if (prior && prior.vectorHash !== row.vectorHash) throw new Error('Embedding cache collision');
    if (!prior) this.#rows.set(row.key, structuredClone(row));
  }
}
/** Replaceable local cache, not a production vector database or authority store. */
export class FileEmbeddingCache implements EmbeddingCache {
  #directory: string;
  constructor(directory: string) { this.#directory = directory; }
  async get(key: string): Promise<VectorRecord | null> {
    const file = join(this.#directory, `${Hash.parse(key)}.json`);
    try { return validateEmbeddingRecord(JSON.parse(readFileSync(file, 'utf8')), key); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async put(record: VectorRecord): Promise<void> {
    const row = validateEmbeddingRecord(record, record.key);
    mkdirSync(this.#directory, { recursive: true, mode: 0o700 });
    try { writeFileSync(join(this.#directory, `${row.key}.json`), JSON.stringify(row) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const prior = await this.get(row.key);
      if (!prior || prior.vectorHash !== row.vectorHash) throw new Error('Embedding cache collision');
    }
  }
}
export class CachedEmbeddings {
  readonly provider: EmbeddingProvider;
  readonly cache: EmbeddingCache;
  readonly configurationHash: string;
  #clock: () => string;
  #inflight = new Map<string, Promise<VectorRecord>>();
  readonly usage = { cacheHits: 0, cacheMisses: 0, requests: 0, inputTokens: 0 };
  constructor(provider: EmbeddingProvider, cache: EmbeddingCache, clock: () => string = () => new Date().toISOString()) {
    EmbeddingIdentity.parse(provider.identity);
    this.provider = provider; this.cache = cache; this.#clock = clock; this.configurationHash = hash(provider.identity);
  }
  async get(text: string, context: unknown): Promise<VectorRecord> {
    if (!text.trim()) throw new Error('Embedding input is empty');
    if (hash(this.provider.identity) !== this.configurationHash) throw new Error('Embedding configuration changed');
    const inputHash = textHash(text), contextHash = hash(context);
    const key = hash({ configurationHash: this.configurationHash, inputHash, contextHash });
    const found = await this.cache.get(key);
    if (found) { this.usage.cacheHits++; return validateEmbeddingRecord(found, key); }
    const inflight = this.#inflight.get(key);
    if (inflight) { this.usage.cacheHits++; return structuredClone(await inflight); }
    const job = (async () => {
      this.usage.cacheMisses++; this.usage.requests++;
      const result = await this.provider.embed([text]);
      if (result.vectors.length !== 1 || !Number.isInteger(result.inputTokens) || result.inputTokens < 0) throw new Error('Embedding response contract violation');
      validateVector(result.vectors[0]!, this.provider.identity.dimensions);
      this.usage.inputTokens += result.inputTokens;
      const record = validateEmbeddingRecord({ key, identity: this.provider.identity, configurationHash: this.configurationHash, inputHash, contextHash,
        embeddedAt: Timestamp.parse(this.#clock()), vector: result.vectors[0]!, vectorHash: hash(result.vectors[0]!) }, key);
      await this.cache.put(record);
      // A concurrent process may already have installed an identical vector with its timestamp.
      return (await this.cache.get(key)) ?? record;
    })();
    this.#inflight.set(key, job);
    try { return structuredClone(await job); } finally { this.#inflight.delete(key); }
  }
}

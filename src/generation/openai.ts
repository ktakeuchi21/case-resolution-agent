import { z } from 'zod';
import { EXPLANATIONS, GENERATION_INSTRUCTIONS, GenerationFailure, PROMPT_VERSION } from './index.ts';
import type { GenerationInput, GenerationProvider } from './index.ts';

export const OPENAI_GENERATION_MODEL = 'gpt-4.1-mini-2025-04-14';
const wireResponse = z.object({
  model: z.literal(OPENAI_GENERATION_MODEL), status: z.literal('completed'),
  output: z.array(z.object({ type: z.literal('message'), role: z.literal('assistant'), content: z.array(z.object({ type: z.literal('output_text'), text: z.string().max(4000) })).length(1) })).length(1),
  usage: z.object({ input_tokens: z.number().int().nonnegative().max(20000), output_tokens: z.number().int().nonnegative().max(512) }),
});
const limits = z.strictObject({ timeoutMs: z.number().int().min(10).max(20000).default(12000), requestsPerMinute: z.number().int().min(1).max(10).default(3), maxRequestsPerProcess: z.number().int().min(1).max(100).default(10) });

/** Server singleton. No automatic retries, credential serialization, dynamic endpoint, tools or conversation persistence.
 * Public routes must separately authenticate and persist per-session/global spend quotas across process restarts. */
export class OpenAIGenerationProvider implements GenerationProvider {
  readonly identity = Object.freeze({ provider: 'openai', model: OPENAI_GENERATION_MODEL });
  #key: string;
  #transport: typeof fetch;
  #limits: z.infer<typeof limits>;
  #requests = 0;
  #recent: number[] = [];
  #inflight = false;
  constructor(apiKey = process.env.OPENAI_API_KEY, transport: typeof fetch = fetch, configuration: Partial<z.infer<typeof limits>> = {}) {
    if (typeof window !== 'undefined') throw new GenerationFailure('SERVER_ONLY');
    if (!apiKey?.trim()) throw new GenerationFailure('OPENAI_API_KEY_REQUIRED');
    this.#key = apiKey; this.#transport = transport; this.#limits = limits.parse(configuration);
  }
  async select(input: GenerationInput) {
    if (input.promptVersion !== PROMPT_VERSION || !input.claims.length || input.claims.length > 12 || input.query.length > 2000 || JSON.stringify(input).length > 16000) throw new GenerationFailure('GENERATION_INPUT_LIMIT', 0);
    const now = Date.now(); this.#recent = this.#recent.filter(t => now - t < 60000);
    if (this.#inflight || this.#recent.length >= this.#limits.requestsPerMinute || this.#requests >= this.#limits.maxRequestsPerProcess) throw new GenerationFailure('GENERATION_RATE_LIMITED', 0);
    this.#inflight = true; this.#requests++; this.#recent.push(now);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#limits.timeoutMs);
    try {
      const response = await this.#transport('https://api.openai.com/v1/responses', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${this.#key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.identity.model, store: false, max_output_tokens: 512,
          instructions: GENERATION_INSTRUCTIONS, input: [{ role: 'user', content: JSON.stringify(input) }],
          text: { format: { type: 'json_schema', name: 'pathway_bounded_explanation', strict: true,
            schema: { type: 'object', additionalProperties: false,
              properties: { claimIds: { type: 'array', items: { type: 'string', enum: input.claims.map(c => c.id) } }, explanation: { type: 'string', enum: [...EXPLANATIONS] } },
              required: ['claimIds', 'explanation'] } } },
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new GenerationFailure(response.status === 429 ? 'GENERATION_PROVIDER_RATE_LIMITED' : response.status === 401 || response.status === 403 ? 'GENERATION_AUTHENTICATION_FAILED' : 'GENERATION_PROVIDER_UNAVAILABLE');
      }
      if (!response.body) throw new GenerationFailure('GENERATION_RESPONSE_INVALID');
      const reader = response.body.getReader(); let total = 0; const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          total += chunk.value.byteLength;
          if (total > 65536) { await reader.cancel(); throw new GenerationFailure('GENERATION_RESPONSE_LIMIT'); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      const raw = wireResponse.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const selection: unknown = JSON.parse(raw.output[0]!.content[0]!.text);
      return { selection, usage: { inputTokens: raw.usage.input_tokens, outputTokens: raw.usage.output_tokens,
        estimatedCostUsd: (raw.usage.input_tokens * 0.40 + raw.usage.output_tokens * 1.60) / 1000000,
        costBasis: 'Estimate using published 2026-09-07 GPT-4.1-mini standard input $0.40/M and output $1.60/M; excludes cache discounts. Not a billing record.', requests: 1 } };
    } catch (error) {
      if (controller.signal.aborted) throw new GenerationFailure('GENERATION_TIMEOUT');
      if (error instanceof GenerationFailure) throw error;
      throw new GenerationFailure('GENERATION_RESPONSE_INVALID');
    } finally { clearTimeout(timeout); this.#inflight = false; }
  }
}

import { z } from 'zod';

export const PackId = z.enum(['alder', 'access', 'fulfillment']);
export type PackId = z.infer<typeof PackId>;
export const Passage = z.strictObject({
 id: z.string(), packId: PackId, caseId: z.string().nullable(), sourceId: z.string(), title: z.string(),
 type: z.string(), version: z.string(), status: z.enum(['current', 'superseded']),
 section: z.string(), text: z.string(), synthetic: z.literal(true),
});
export type Passage = z.infer<typeof Passage>;
export interface KnowledgePack {
 id: PackId; name: string; shortName: string; version: string; scenario: string; description: string;
 user: { name: string; role: string; email: string }; agentRole: string;
 caseId: string; caseContext: string; caseSummary: string; blocker: string; covers: string[]; prompts: string[]; workProduct: string;
 recipient: { name: string; email: string }; defaultChannel: 'chat' | 'email';
}
export const WorkProduct = z.strictObject({ type: z.enum(['email', 'summary']), subject: z.string().max(200), body: z.string().min(1).max(7000), status: z.literal('generated_not_sent') });
export const Answer = z.strictObject({
 answer: z.string().min(1).max(9000), citations: z.array(z.string()).max(10),
 suggestedFollowups: z.array(z.string().min(1).max(160)).max(3),
 workProduct: WorkProduct.nullable(),
 retrievalContext: z.string().max(500),
});
export type Answer = z.infer<typeof Answer>;
export interface RetrievedPassage extends Passage { rank: number; score: number; reason: string; includedInGeneration: boolean }
export interface RetrievalTrace { question: string; query: string; packId: PackId; packName: string; caseId: string; method: 'hybrid' | 'lexical-control'; passages: RetrievedPassage[]; citations: Array<{ number: number; passageId: string }>; }
export interface Usage { model: string; inputTokens: number; cachedInputTokens: number; embeddingInputTokens?: number; embeddingRequests?: number; unmeasuredRequests?: number; outputTokens: number; requests: number; latencyMs: number; estimatedCostUsd: number | null; }
export type ActivityStage = 'searching' | 'retrieved' | 'generating' | 'checking' | 'repairing' | 'complete' | 'failed';
export interface ActivityEvent {
 turnId: string; attempt: number; sequence: number; stage: ActivityStage; message: string; elapsedMs: number;
}
export interface TurnActivity { startedAt: string; elapsedMs: number; finishedAt?: string; events: ActivityEvent[]; }
export interface Turn {
 id: string; question: string; packId: PackId; createdAt: string; status: 'pending' | 'complete' | 'failed';
 response: Answer | null; trace: RetrievalTrace | null; usage: Usage | null; error: string | null;
 feedback: 'helpful' | 'not_helpful' | null; attempt: number;
 activity?: TurnActivity;
}
export interface Conversation { id: string; scenarioId: PackId; packId: PackId; channel: 'chat' | 'email'; turns: Turn[]; }
export const SendInput = z.strictObject({ conversationId: z.uuid(), requestId: z.uuid(), text: z.string().trim().min(1).max(2500), retry: z.boolean().default(false) });
export class RagError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
export const recoveryMessage = 'I couldn’t complete that answer. Your message is saved—please try again.';

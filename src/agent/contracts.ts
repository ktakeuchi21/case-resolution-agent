import { z } from 'zod';
import { EvidenceCitation, EvidenceRecord, Hash, Id, Timestamp } from '../contracts.ts';

export const AGENT_VERSION = 'digital-worker-v1';
export const BOUNDARY = 'Documentation dependency resolved; prior authorization pending.';
export const ConversationKnowledge = z.strictObject({
 key: z.string(), kind: z.enum(['sample', 'pack', 'upload']), name: z.string(), sourceCount: z.number().int().nonnegative(),
 authority: z.enum(['assigned_case_knowledge', 'sandbox_only']), expiresAt: Timestamp.nullable(),
 sourceNames: z.record(z.string(), z.string()),
});
export const AgentChannel = z.enum(['chat', 'email', 'sms', 'voice', 'teams']);
export const WorkAudience = z.enum(['case_manager', 'office', 'supervisor', 'crm']);
export const AgentRequest = z.strictObject({
 idempotencyKey: Id, synthetic: z.literal(true),
 operation: z.enum(['ask', 'summary', 'draft', 'interaction', 'clarify', 'edit_draft', 'save_memory', 'prepare_review', 'new_conversation']).default('ask'),
 text: z.string().trim().min(1).max(8000).optional(),
 channel: AgentChannel.default('chat'), audience: WorkAudience.default('case_manager'),
 tone: z.enum(['concise', 'warm', 'formal']).default('concise'),
 targetId: Id.optional(), choice: z.enum(['document_requirement', 'workflow_status', 'office', 'case_manager']).optional(),
 generation: z.enum(['evidence', 'model']).default('evidence'),
});
export type AgentRequest = z.infer<typeof AgentRequest>;
export const Fact = z.strictObject({ id: Id, text: z.string().min(1).max(2400), origin: z.enum(['workflow', 'governed_source', 'sandbox_source', 'conversation']), reference: z.string(), authoritative: z.boolean() });
export const Claim = z.strictObject({
 id: Id, kind: z.enum(['fact', 'inference', 'recommendation', 'uncertainty']), text: z.string().min(1).max(700),
 supports: z.array(z.strictObject({ reference: z.string().min(1), quote: z.string().min(1).max(1600) })).min(1).max(6),
});
export const Synthesis = z.strictObject({ claims: z.array(Claim).min(1).max(8) });
export type Synthesis = z.infer<typeof Synthesis>;
export const Verification = z.strictObject({ claims: z.array(z.strictObject({ id: Id, supported: z.boolean(), reason: z.string().max(400) })).min(1).max(8) });
export const Clarification = z.strictObject({
 question: z.string(), why: z.string(), options: z.array(z.strictObject({ value: AgentRequest.shape.choice.unwrap(), label: z.string() })).min(2),
 scope: z.literal('conversation_only'), status: z.enum(['open', 'resolved']), resolvedBy: Id.nullable(),
});
export const Analysis = z.strictObject({
 method: z.literal('deterministic-administrative-cues-v1'), sentiment: z.enum(['frustrated', 'appreciative', 'neutral', 'uncertain']),
 urgency: z.enum(['time_sensitive', 'routine', 'uncertain']), intent: z.enum(['request_update', 'offer_document', 'ask_clarification', 'request_contact', 'uncertain']),
 confidence: z.enum(['moderate', 'low']), supportingLanguage: z.array(z.string()), nextNeed: z.string(), uncertainty: z.string(), authority: z.literal('none'),
});
export const WorkProduct = z.strictObject({
 type: z.enum(['summary', 'draft', 'edited_draft']), audience: WorkAudience, channel: AgentChannel,
 tone: z.string(), purpose: z.string(), body: z.string().max(8000), requiredContent: z.array(z.string()), omittedContent: z.array(z.string()),
 status: z.literal('generated_not_sent'), basedOn: Id.nullable(), reviewRequired: z.literal(true),
});
export const AgentResponse = z.strictObject({
 id: Id, conversationId: Id, caseId: z.literal('DEMO-101'), operation: AgentRequest.shape.operation,
 timestamp: Timestamp, query: z.string(), queryHash: Hash, workflowRevision: z.number().int().positive(),
 disposition: z.enum(['answer', 'pause', 'clarify', 'recorded', 'draft']), message: z.string(),
 claims: z.array(Claim), citations: z.array(EvidenceCitation), facts: z.array(Fact),
 evidenceId: Id.nullable(), evidenceHash: Hash.nullable(),
 reasonCodes: z.array(z.string()), clarification: Clarification.nullable(), analysis: Analysis.nullable(), workProduct: WorkProduct.nullable(),
 inReplyTo: Id.nullable().optional(),
 knowledge: ConversationKnowledge.optional(),
 interpretation: z.strictObject({ intent: z.enum(['question','summary','draft','refinement','next_action','evidence','interaction','clarification','human_action']), follows: Id.nullable(), note: z.string(), retrievalQuestion: z.string().nullable() }).optional(),
 temporaryEvidence: EvidenceRecord.optional(),
 context: z.strictObject({
  state: z.string(), whatHappened: z.string(), known: z.array(z.string()), unresolved: z.array(z.string()),
  latestCommunication: z.string(), owner: z.string(), checkpoint: Timestamp.nullable(), nextAction: z.string(), why: z.string(),
  permission: z.strictObject({ sourceSupport: z.string(), applicability: z.string(), communication: z.string(), action: z.string(), execution: z.literal('not_requested') }),
  requiredAuthorization: z.array(z.string()), completionBoundary: z.literal(BOUNDARY),
 }),
 audit: z.strictObject({
  version: z.literal(AGENT_VERSION), method: z.enum(['deterministic-case-composition', 'model-synthesis', 'provider-pause']),
  provider: z.string(), model: z.string(), promptVersion: z.string(), promptHash: Hash, contextHash: Hash,
  latencyMs: z.number().nonnegative(), inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().nullable(), costBasis: z.string(), requests: z.number().int().nonnegative(),
  validation: z.array(z.string()), execution: z.literal('none'), rawOutput: z.unknown(),
 }),
});
export type AgentResponse = z.infer<typeof AgentResponse>;
export type Fact = z.infer<typeof Fact>;

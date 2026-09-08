import { z } from 'zod';
import { Id } from '../contracts.ts';
import { AgentRequest } from './contracts.ts';
import type { AgentResponse } from './contracts.ts';
import type { AgentSettings } from './preferences.ts';

export const ConversationRequest = z.strictObject({ idempotencyKey: Id, text: z.string().trim().min(1).max(2000), targetId: Id.optional() });
export type Interpretation = { intent: 'question' | 'summary' | 'draft' | 'refinement' | 'next_action' | 'evidence' | 'interaction' | 'clarification' | 'human_action'; follows: string | null; note: string; retrievalQuestion: string | null };

/** A bounded interpretation of a message, never an authorization or command. */
export function interpretMessage(message: z.infer<typeof ConversationRequest>, history: AgentResponse[], settings: AgentSettings, generation: 'model' | 'evidence') {
 const text = message.text, lower = text.toLowerCase();
 const prior = history.filter(h => !['new_conversation', 'interaction'].includes(h.operation)).at(-1);
 const latest = history.at(-1);
 const product = message.targetId ? history.find(h => h.id === message.targetId && h.workProduct) : history.filter(h => h.workProduct).at(-1);
 const open = history.filter(h => h.clarification?.status === 'open' && !history.some(r => r.inReplyTo === h.id && r.clarification?.status === 'resolved')).at(-1);
 let operation: AgentRequest['operation'] = 'ask', audience = settings.audience, channel = settings.channel, tone = settings.tone;
 let targetId: string | undefined, choice: AgentRequest['choice'];
 const interpretation: Interpretation = { intent: 'question', follows: null, note: '', retrievalQuestion: null };
 const refinement = /\b(?:make (?:it|that|this)|shorten|warmer|shorter|more (?:formal|concise)|turn (?:it|that|this) into|convert|change (?:the )?(?:tone|channel|audience))\b/i.test(text);
 const summary = /\b(?:summari[sz]e|summary|handoff|briefing|crm (?:activity )?note|activity note)\b/i.test(text);
 const interactionRequest = /\b(?:record|log|summari[sz]e)\b[\s\S]*\b(?:transcript|call note|interaction|message|call)\b/i.test(text);
 const interaction = interactionRequest && /[:\n]\s*\S/.test(text);
 if (interaction) { operation = 'interaction'; interpretation.intent = 'interaction'; }
 else if (refinement && product?.workProduct) {
  operation = product.workProduct.type === 'summary' ? 'summary' : 'draft';
  audience = product.workProduct.audience; channel = product.workProduct.channel;
  tone = ['warm', 'formal', 'concise'].includes(product.workProduct.tone) ? product.workProduct.tone as typeof tone : tone;
  targetId = product.id; interpretation.intent = 'refinement'; interpretation.follows = product.id;
 } else if (summary) { operation = 'summary'; interpretation.intent = 'summary'; }
 else if (/\b(?:draft|write|compose|prepare)\b.*\b(?:email|sms|text|message|communication|office|follow.up|call|teams)\b/i.test(text)) { operation = 'draft'; interpretation.intent = 'draft'; }
 else if (/\b(?:send|dispatch|approve|publish|assign|retire|resolve (?:the )?(?:task|review)|transfer|execute)\b/i.test(text)) { interpretation.intent = 'human_action'; }
 else if (/\b(?:next|after that|what happens)\b/i.test(text)) { interpretation.intent = 'next_action'; interpretation.retrievalQuestion = 'case_status'; }
 else if (/\b(?:why|evidence|citations?|sources?)\b/i.test(text)) { interpretation.intent = 'evidence'; }
 if ((refinement && !product) || (interactionRequest && !interaction)) interpretation.intent = 'clarification';
 if (/\b(?:supervisor|supervisory)\b/i.test(text)) audience = 'supervisor';
 else if (/\bcrm\b/i.test(text)) audience = 'crm';
 else if (/\b(?:office|hcp)\b/i.test(text)) audience = 'office';
 else if (/\bcase manager\b/i.test(text)) audience = 'case_manager';
 if (/\bsms\b|text message/i.test(text)) channel = 'sms';
 else if (/\bemail\b/i.test(text)) channel = 'email';
 else if (/\bteams\b/i.test(text)) channel = 'teams';
 else if (/\b(?:voice|call)\b/i.test(text)) channel = 'voice';
 else if (/\bchat\b/i.test(text)) channel = 'chat';
 if (refinement && /\b(?:sms|email|chat|teams|voice)\b/i.test(text)) operation = 'draft';
 if (/\b(?:warm|warmer|friendly|friendlier)\b/i.test(text)) tone = 'warm';
 else if (/\bformal\b/i.test(text)) tone = 'formal';
 else if (/\b(?:concise|short|shorter|shorten|brief)\b/i.test(text)) tone = 'concise';
 if (latest?.reasonCodes?.includes('INTERACTION_TEXT_REQUIRED') && interpretation.intent === 'question' && operation === 'ask' && !text.endsWith('?')) {
  operation = 'interaction'; interpretation.intent = 'interaction'; interpretation.follows = latest.id;
  channel = /\bteams\b/i.test(latest.query) ? 'teams' : /\b(?:call|voice)\b/i.test(latest.query) ? 'voice' : /\bemail\b/i.test(latest.query) ? 'email' : /\bsms\b/i.test(latest.query) ? 'sms' : 'chat';
 }
 const followup = /^(?:why\??|why (?:is|was) (?:that|this) (?:the )?next step\??|what (?:happens|comes) after that\??|what next\??)$/i.test(text);
 if (followup && prior) { interpretation.follows = prior.id; interpretation.retrievalQuestion = prior.query; }
 if (open && !refinement && operation === 'ask' && !followup) {
  const options = open.clarification!.options;
  choice = options.find(o => lower === o.label.toLowerCase() || lower === o.value.replaceAll('_', ' ') || (o.value === 'workflow_status' && /^(?:the )?(?:case |workflow )?status\.?$/.test(lower)) || (o.value === 'document_requirement' && /^(?:the )?document(?:ation)?(?: requirement)?\.?$/.test(lower)))?.value;
  if (choice) { operation = 'clarify'; targetId = open.id; interpretation.intent = 'clarification'; interpretation.follows = open.id; }
 }
 interpretation.note = ['draft', 'summary'].includes(operation) ? `Prepared for ${audience.replaceAll('_', ' ')}${operation === 'draft' ? ` · ${channel}` : ''} · ${tone} tone. You can correct these choices in your next message.` : followup && prior ? 'Using the previous turn as conversational context; current evidence and permissions are checked again.' : interpretation.intent === 'human_action' ? 'This request needs the separate case or governance controls. Conversation cannot execute it.' : '';
 const request = AgentRequest.parse({ ...message, synthetic: true, operation, audience, channel, tone, generation, ...(targetId ? { targetId } : {}), ...(choice ? { choice } : {}) });
 return { request, interpretation };
}

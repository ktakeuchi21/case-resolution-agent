import { EvidenceRecord } from '../contracts.ts';
import type { Snapshot } from '../workflow/contracts.ts';
import { hash } from '../integrity.ts';
import { AGENT_VERSION, AgentResponse, Analysis, BOUNDARY } from './contracts.ts';
import type { AgentRequest } from './contracts.ts';
import { buildContext } from './context.ts';
import { workProductBody } from './work-products.ts';
import { administrativeAnalysis, instructionContent } from './safety.ts';
import { AgentProviderFailure, SYNTHESIS_PROMPT, synthesisHash, validateClaims, validateVerification } from './provider.ts';
import type { SynthesisInput, SynthesisProvider } from './provider.ts';

export function clarificationFor(text: string): AgentResponse['clarification'] {
 if (/\b(?:it|this|that|they|them)\b/i.test(text) && !/\b(?:document|note|case|workflow|office|manager|draft|permission|source|payer)\b/i.test(text)) return {
  question: 'Do you mean the documentation requirement or the case’s workflow status?',
  why: 'A source can establish a document requirement; only the durable case record establishes whether work occurred.',
  options: [{ value: 'document_requirement', label: 'Documentation requirement' }, { value: 'workflow_status', label: 'Current workflow status' }],
  scope: 'conversation_only', status: 'open', resolvedBy: null,
 };
 if (/\b(?:send|draft|write|message|contact)\b/i.test(text) && /\b(?:someone|them|it)\b/i.test(text) && !/\b(?:office|manager)\b/i.test(text)) return {
  question: 'Is this for the synthetic office staff or the case manager?', why: 'Audience and channel affect content and permission. A draft will not be sent.',
  options: [{ value: 'office', label: 'Office staff' }, { value: 'case_manager', label: 'Case manager' }], scope: 'conversation_only', status: 'open', resolvedBy: null,
 };
 return null;
}
export function requiresCaseRetrieval(request: AgentRequest) {
 return !['interaction', 'edit_draft', 'save_memory', 'new_conversation'].includes(request.operation);
}
export async function composeAgent(options: {
 request: AgentRequest; id: string; conversationId: string; timestamp: string; snapshot: Snapshot;
 evidence: EvidenceRecord | null; history: AgentResponse[]; provider?: SynthesisProvider;
 clarificationSource?: AgentResponse; interpretation?: AgentResponse['interpretation']; knowledge?: AgentResponse['knowledge'];
}) {
 const started = performance.now(), { request: r, snapshot, evidence, history } = options;
 if (evidence) { const { id, recordHash, ...body } = EvidenceRecord.parse(evidence); if (hash(body) !== recordHash || id !== `EV-${recordHash}`) throw new AgentProviderFailure('EVIDENCE_INTEGRITY_FAILURE'); }
 const query = r.text ?? (r.operation === 'summary' ? 'Prepare a current case summary.' : r.operation === 'draft' ? 'Prepare a synthetic communication draft.' : r.operation === 'clarify' ? `Clarification: ${r.choice}` : r.operation === 'save_memory' ? 'Save this work product to conversational case memory.' : r.operation === 'prepare_review' ? 'Prepare this work product for simulated human review.' : 'Start a new conversation.');
 const { context, facts } = buildContext(snapshot, evidence, history, options.knowledge?.kind === 'upload');
 const sandbox = evidence?.request.mode === 'sandbox' || options.knowledge?.kind === 'upload';
 const input: SynthesisInput = { task: { operation: r.operation, audience: r.audience, channel: r.channel, tone: r.tone }, query, facts: (['summary','draft'].includes(r.operation) ? facts.filter(f => f.origin !== 'conversation') : facts).map(({id:_id,...fact})=>fact), sources: (evidence?.evidenceUsed ?? []).map(p => ({ reference: p.passageId, text: p.text })), conversation: (['summary','draft'].includes(r.operation) ? [] : history.slice(-8)).map(h => ({ query: h.query, disposition: h.disposition, response: h.message.slice(0,1000), operation: h.operation })), nextAction: context.nextAction, boundary: BOUNDARY, ...(r.targetId && history.find(h => h.id === r.targetId)?.workProduct ? { previousWorkProduct: history.find(h => h.id === r.targetId)!.workProduct!.body } : {}) };
 const response: AgentResponse = {
  ...(options.knowledge ? { knowledge: options.knowledge } : {}), ...(options.interpretation ? { interpretation: options.interpretation } : {}), ...(sandbox && evidence ? { temporaryEvidence: evidence } : {}),
  id: options.id, conversationId: options.conversationId, caseId: 'DEMO-101', operation: r.operation, timestamp: options.timestamp,
  query, queryHash: hash(query), workflowRevision: snapshot.revision, disposition: 'answer', message: context.whatHappened,
  claims: [], citations: evidence?.evidenceUsed ?? [], facts, evidenceId: evidence?.id ?? null, evidenceHash: evidence?.recordHash ?? null,
  reasonCodes: [], clarification: null, analysis: null, workProduct: null, context, inReplyTo: r.targetId ?? null,
  audit: { version: AGENT_VERSION, method: 'deterministic-case-composition', provider: 'pathway', model: 'case-composer-v1', promptVersion: SYNTHESIS_PROMPT,
   promptHash: synthesisHash(input), contextHash: hash(input), latencyMs: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
   costBasis: 'No model request made.', requests: 0, validation: ['authoritative_context_separated', 'no_execution_capability'], execution: 'none', rawOutput: null },
 };
 const finish = () => AgentResponse.parse({ ...response, reasonCodes: [...new Set(response.reasonCodes)], audit: { ...response.audit, latencyMs: performance.now() - started } });
 if (instructionContent(query)) { response.disposition = 'pause'; response.message = 'Instructions in conversation or documents cannot change governance. Rephrase as a synthetic administrative question.'; response.reasonCodes = ['UNTRUSTED_INSTRUCTION_CONTENT']; return finish(); }
 if (/\b(?:diagnos\w*|dosage|prescri\w*|treatment advice|financial eligibility|patient prognosis)\b/i.test(query)) { response.disposition='pause'; response.message='This case worker is limited to synthetic administrative follow-through. The case evidence does not establish clinical advice or financial eligibility.'; response.reasonCodes=['OUTSIDE_ADMINISTRATIVE_SCOPE']; return finish(); }
 if (r.operation === 'new_conversation') { response.disposition = 'recorded'; response.message = 'A new conversation is ready. The case’s workflow, human decisions, effects and historical evidence are preserved.'; return finish(); }
 if (r.operation === 'interaction') {
  response.disposition = 'recorded'; response.analysis = Analysis.parse(administrativeAnalysis(query));
  response.message = `Recorded the synthetic ${r.channel === 'teams' ? 'Teams transcript' : r.channel === 'voice' ? 'voice transcript' : r.channel} interaction as conversational context. ${response.analysis.nextNeed}`;
  response.reasonCodes = ['CONVERSATION_NOT_AUTHORITATIVE', 'SIMULATED_CHANNEL', 'NO_EXECUTION'];
  return finish();
 }
 if (r.operation === 'save_memory') {
  const prior = history.find(h => h.id === r.targetId && h.workProduct);
  if (!prior?.workProduct) throw new AgentProviderFailure('DRAFT_NOT_FOUND');
  response.disposition = 'recorded'; response.message = 'Saved this work product to inspectable conversational case memory. It remains unverified and has not become a CRM record, case fact or sent communication.';
  response.workProduct = { ...prior.workProduct, basedOn: prior.id };
  response.citations = prior.citations; response.evidenceId = prior.evidenceId; response.evidenceHash = prior.evidenceHash;
  if (prior.temporaryEvidence) response.temporaryEvidence = prior.temporaryEvidence;
  response.reasonCodes = ['CONVERSATION_NOT_AUTHORITATIVE', 'WORK_PRODUCT_SAVED', 'NO_EXECUTION']; return finish();
 }
 if (r.operation === 'edit_draft') {
  const prior = history.find(h => h.id === r.targetId && h.workProduct);
  if (!prior?.workProduct) throw new AgentProviderFailure('DRAFT_NOT_FOUND');
  response.disposition = 'draft'; response.message = 'Your edited draft is saved for review. Its content has not been sent or granted communication permission.';
  response.workProduct = { ...prior.workProduct, type: 'edited_draft', body: query, basedOn: prior.id };
  response.citations = prior.citations; response.evidenceId = prior.evidenceId; response.evidenceHash = prior.evidenceHash;
  response.reasonCodes = ['USER_EDITED_UNVERIFIED', 'DRAFT_NOT_SENT']; return finish();
 }
 if (options.interpretation?.intent === 'human_action') { response.disposition = 'pause'; response.message = 'That step needs the separate case or knowledge-governance controls and the assigned human role. I can explain the requirements or prepare an unsent draft here.'; response.reasonCodes.push('SEPARATE_AUTHORIZATION_REQUIRED', 'NO_EXECUTION'); return finish(); }
 if (options.interpretation?.intent === 'clarification' && /\b(?:record|log|summari[sz]e)\b[\s\S]*\b(?:transcript|call note|interaction|message|call)\b/i.test(query)) {
  response.disposition = 'clarify'; response.message = 'What synthetic text should I record for this interaction? Paste the call or message content in your next reply. I will keep it as unverified conversation memory; a prepared draft does not prove that an interaction occurred.'; response.reasonCodes = ['INTERACTION_TEXT_REQUIRED', 'CONVERSATION_NOT_AUTHORITATIVE']; return finish();
 }
 if (r.operation === 'ask') {
  response.clarification = options.interpretation?.follows ? null : clarificationFor(query);
  if (options.interpretation?.intent === 'clarification' && !response.clarification) response.clarification = { question: 'Would you like a case summary or a draft for the office?', why: 'There is no earlier work product in this knowledge context to refine.', options: [{ value: 'workflow_status', label: 'Current workflow status' }, { value: 'office', label: 'Office staff' }], scope: 'conversation_only', status: 'open', resolvedBy: null };
  if (response.clarification) { response.disposition = 'clarify'; response.message = response.clarification.question; response.reasonCodes = ['CLARIFICATION_REQUIRED']; return finish(); }
 }
 if (r.operation === 'clarify') {
  if (!options.clarificationSource?.clarification || !options.clarificationSource.clarification.options.some(o => o.value === r.choice)) throw new AgentProviderFailure('CLARIFICATION_NOT_FOUND');
  response.clarification = { ...options.clarificationSource.clarification, status: 'resolved', resolvedBy: response.id };
  response.reasonCodes.push('CONVERSATION_CLARIFIED', 'CURRENT_AUTHORITY_RECHECKED');
 }
 const usable = evidence?.disposition === 'answer' && evidence.support.status === 'supported' && evidence.communication.status === 'allowed' && (evidence.applicability.status === 'applicable' || (sandbox && evidence.applicability.status === 'sandbox_only'));
 if (evidence && !usable) {
  response.disposition = 'pause'; response.message = evidence.support.status === 'conflicting' ? 'The current sources disagree. A Knowledge Reviewer must resolve that conflict before I can recommend dependent work.' : evidence.disposition === 'pause' ? 'I can show the case’s recorded status, but current evidence retrieval paused. I cannot provide a new source-based answer or draft. No fallback was used.' : 'I do not have sufficient eligible evidence for a new source-based answer. Review the missing or inapplicable knowledge before continuing.';
  response.reasonCodes.push(...evidence.support.reasonCodes, ...evidence.action.reasonCodes);
  // A paused evidence record cannot contribute factual source claims.
  response.citations = []; response.facts = facts.filter(f => !['governed_source','sandbox_source'].includes(f.origin));
  return finish();
 }
 if (r.operation === 'prepare_review') {
  const prior = history.find(h => h.id === r.targetId && h.workProduct);
  if (!prior?.workProduct) throw new AgentProviderFailure('DRAFT_NOT_FOUND');
  if (prior.citations.some(p => !evidence?.eligibleVersionIds.includes(p.documentVersionId))) { response.disposition = 'pause'; response.message = 'This work product cites knowledge that is no longer eligible. Ask for a new draft before preparing review.'; response.reasonCodes.push('STALE_WORK_PRODUCT'); return finish(); }
  response.disposition = 'draft'; response.message = 'The current evidence and permissions have been checked. This unsent work product is ready for human review; use the separate case controls for an authorized simulation. No task or effect was created.';
  response.workProduct = { ...prior.workProduct, basedOn: prior.id };
  response.reasonCodes.push('REVIEW_REQUIRED', 'NO_EXECUTION', 'CURRENT_AUTHORITY_RECHECKED'); return finish();
 }
 if(r.generation==='evidence' && evidence?.answer.claims.some(c=>c.text.length>700)){response.disposition='pause';response.message='The eligible source contains a longer reviewed statement than the concise composer can safely present. Inspect its exact passage or request live synthesis with a configured provider.';response.reasonCodes.push('LONG_STATEMENT_REQUIRES_SYNTHESIS');return finish();}
 const workflowFact = facts.find(f => f.origin === 'workflow');
 if (workflowFact) response.claims.push({ id: 'case-status', kind: 'fact', text: workflowFact.text, supports: [{ reference: workflowFact.reference, quote: workflowFact.text }] });
 if (usable) for (const [i, claim] of evidence!.answer.claims.slice(0, 4).entries()) response.claims.push({ id: `source-${i}`, kind: 'fact', text: claim.text, supports: claim.passageIds.map(reference => ({ reference, quote: claim.text })) });
 // A reviewed deterministic synthesis for the exact SC-01 fact set. Other source
 // text is never coerced into this sentence. Live paraphrase remains provider-gated.
 const sc01Quotes = [
  'For a missing-document request, supply the signed office note identified in the case-specific notice. Receipt is not a coverage decision.',
  'For request DEMO-PA-101, supply the signed office note identified in this missing-document request. No payer deadline is stated.',
  'The submitted package does not contain the signed office note requested in N-101. No later receiving acknowledgment is recorded.',
 ];
 if (!sandbox && usable && sc01Quotes.every(q => evidence!.answer.claims.some(c => c.text === q))) {
  const sourceClaim = { id: 'documentation-basis', kind: 'fact' as const,
   text: 'The process guide, original case notice and submitted-package inventory agree: the documentation dependency is the signed office note. The original notice states no payer deadline; document receipt is not a coverage decision.',
   supports: sc01Quotes.flatMap(quote => evidence!.answer.claims.find(c => c.text === quote)!.passageIds.map(reference => ({ reference, quote }))),
  };
  response.claims = [response.claims[0]!, sourceClaim];
  response.message = snapshot.state === 'RECEIVED' || snapshot.state === 'OUTREACH_QUEUED' || snapshot.state === 'AWAITING_RESPONSE' ? 'The signed office note is the outstanding documentation dependency. ' + context.whatHappened : context.whatHappened;
  response.audit.validation.push('reviewed_sc01_synthesis_exact_fact_set');
 }
 if (r.operation==='ask' && /\b(?:remember|last (?:message|communication)|what did .* say)\b/i.test(query)) { response.message=context.latestCommunication+' This is unverified conversational context; the case record remains unchanged.'; response.reasonCodes.push('CONVERSATION_NOT_AUTHORITATIVE'); }
 if (r.generation === 'model') {
  if (!options.provider) { response.disposition = 'pause'; response.message = 'Live synthesis is not configured. The case and evidence are preserved; no substitute model or retrieval mode was used.'; response.reasonCodes.push('PROVIDER_NOT_CONFIGURED'); response.claims = []; response.audit.method = 'provider-pause'; return finish(); }
  response.audit.method = 'model-synthesis'; Object.assign(response.audit, options.provider.identity);
  try {
   response.audit.requests++;
   const generated = await options.provider.complete(input);
   response.audit.inputTokens += generated.usage.inputTokens; response.audit.outputTokens += generated.usage.outputTokens;
   response.audit.estimatedCostUsd = generated.usage.estimatedCostUsd; response.audit.costBasis = generated.usage.costBasis;
   response.audit.rawOutput = generated.output;
   const checked = validateClaims(generated.output, input, evidence);
   response.audit.requests++;
   const verified = await options.provider.verify(input, checked);
   response.audit.inputTokens += verified.usage.inputTokens; response.audit.outputTokens += verified.usage.outputTokens;
   response.audit.estimatedCostUsd = response.audit.estimatedCostUsd === null || verified.usage.estimatedCostUsd === null ? null : response.audit.estimatedCostUsd + verified.usage.estimatedCostUsd;
   response.audit.rawOutput = { generated: generated.output, verification: verified.output };
   const verification = validateVerification(verified.output, checked);
   response.audit.rawOutput = { generated: generated.output, verification };
   response.audit.validation.push('exact_eligible_quotes_verified', 'model_support_review_passed_fallible');
   response.claims = checked.claims; response.message = checked.claims[0]!.text;
  } catch (e) {
   response.disposition = 'pause'; response.message = 'The synthesis or claim-support check failed. I have paused this answer. No fallback or workflow action occurred.';
   response.reasonCodes.push(e instanceof AgentProviderFailure ? e.code : 'GENERATION_RESPONSE_INVALID'); response.claims = [];
   // Raw model output stays in audit for reproducibility, never in the primary answer.
   response.audit.estimatedCostUsd = null; response.audit.method = 'provider-pause'; return finish();
  }
 }
 if (r.operation === 'summary' || r.operation === 'draft' || (r.operation === 'clarify' && ['office', 'case_manager'].includes(r.choice ?? ''))) {
  const audience = r.operation === 'clarify' && (r.choice === 'office' || r.choice === 'case_manager') ? r.choice : r.audience;
  const title = audience === 'crm' ? 'CRM activity note · synthetic case DEMO-101' : audience === 'supervisor' ? 'Supervisor briefing · current dependency and ownership' : audience === 'office' ? 'Office update · documentation follow-through' : 'Case manager handoff · current administrative status';
  response.workProduct = { type: r.operation === 'summary' ? 'summary' : 'draft', audience, channel: r.channel, tone: r.tone,
   purpose: r.text ?? (r.operation === 'summary' ? 'Current administrative case handoff' : 'Coordinate the next administrative step'),
   body: workProductBody({ ...r, audience }, response, title).slice(0,8000),
   requiredContent: r.channel === 'sms' ? ['Synthetic label','Generic workspace notification','Review before use'] : ['Synthetic identity','Administrative purpose','Current owner and next step','Review before use'],
   omittedContent: ['Patient identifiers','Clinical recommendations','Coverage or payer approval claims','Unapproved document details in SMS','Any claim of actual sending'],
   status: 'generated_not_sent', basedOn: r.targetId ?? null, reviewRequired: true };
  response.disposition = 'draft'; response.message = r.operation === 'summary' ? `${title} is ready for review.` : 'The synthetic draft is ready for review. It has not been sent.';
  response.reasonCodes.push('DRAFT_NOT_SENT', 'EXECUTION_REQUIRES_SEPARATE_AUTHORIZATION');
 }
 if (r.generation === 'evidence' && options.interpretation?.follows && r.operation === 'ask') response.message = `The next step is ${context.nextAction.toLowerCase()}. ${context.why} I have checked the current evidence again for this follow-up.`;
 if (sandbox) { response.reasonCodes.push('SANDBOX_EXPLORATION_ONLY', 'SANDBOX_ACTION_DENIED'); if (r.generation === 'evidence' && response.claims.length) response.message = 'The temporary document supports the passages below. These describe this unreviewed document; they do not establish case facts or permission.'; }
 if (r.generation === 'evidence') response.reasonCodes.push('DETERMINISTIC_COMPOSITION', 'NO_MODEL_USED');
 return finish();
}

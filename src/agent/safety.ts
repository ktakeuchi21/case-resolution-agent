import { HttpError } from '../app/session.ts';

// Reject recognizable high-risk input before storing it. This is defense in depth,
// not a PHI detector or a substitute for the visitor's explicit attestation.
export function validateSyntheticText(text: string) {
 if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new HttpError(422, 'Control characters are not accepted.');
 if (/\bsk-[A-Za-z0-9_-]{16,}|-----BEGIN .*PRIVATE KEY-----|\b(?:password|api[_ -]?key|secret)\s*[:=]\s*\S{6,}|\b\d{3}-\d{2}-\d{4}\b|\b(?:MRN|DOB|date of birth)\s*[:=]\s*\S+/i.test(text)) {
  throw new HttpError(422, 'Potential patient identifier or secret detected. Use only synthetic administrative content without identifiers. This input was not stored.');
 }
}
export const instructionContent = (text: string) => /ignore\s+(?:(?:all|the)\s+)?(?:previous|prior|system)|(?:system|developer)\s*(?:message|prompt)\s*:|reveal\s+(?:the\s+)?(?:api\s*key|secret)|execute\s+(?:this\s+)?(?:code|command)|override\s+(?:the\s+)?(?:policy|governance|permission)/i.test(text);

export function administrativeAnalysis(text: string) {
 const cues = [
  { pattern: /frustrat\w*|still waiting|again|no response|disappoint\w*/ig, kind: 'frustrated' },
  { pattern: /thank\w*|appreciat\w*|helpful/ig, kind: 'appreciative' },
  { pattern: /today|urgent\w*|asap|by (?:noon|tomorrow)|deadline/ig, kind: 'time_sensitive' },
  { pattern: /update|status|where (?:are|is)|heard back/ig, kind: 'request_update' },
  { pattern: /(?:have|upload|attach|send|sent|received)\w*[^.!?]{0,35}(?:note|document|file)/ig, kind: 'offer_document' },
  { pattern: /which|clarify|not sure|uncertain|unsure/ig, kind: 'ask_clarification' },
  { pattern: /call me|contact|reach out/ig, kind: 'request_contact' },
 ];
 const hits = cues.flatMap(c => [...text.matchAll(c.pattern)].map(m => ({ kind: c.kind, text: m[0] })));
 const has = (kind: string) => hits.some(h => h.kind === kind);
 const intents = ['ask_clarification', 'offer_document', 'request_update', 'request_contact'].filter(has);
 const intent = intents.length === 1 ? intents[0]! : 'uncertain';
 return { method: 'deterministic-administrative-cues-v1' as const,
  sentiment: has('frustrated') && has('appreciative') ? 'uncertain' : has('frustrated') ? 'frustrated' : has('appreciative') ? 'appreciative' : 'neutral',
  urgency: has('time_sensitive') ? 'time_sensitive' : 'uncertain', intent,
  confidence: intents.length === 1 && hits.length > 1 ? 'moderate' : 'low', supportingLanguage: [...new Set(hits.map(h => h.text))],
  nextNeed: intent === 'offer_document' ? 'Ask the office verifier to inspect the document through Human review.' : intent === 'ask_clarification' ? 'Clarify the administrative request.' : intent === 'request_update' ? 'Prepare a current case update.' : 'Ask what administrative help is needed.',
  uncertainty: 'Keyword cues can miss context, negation and sarcasm. Urgency is reported language, not a verified SLA. No clinical, adherence, eligibility or financial conclusions are drawn.', authority: 'none' as const,
 };
}

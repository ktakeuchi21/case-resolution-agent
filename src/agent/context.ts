import type { EvidenceRecord } from '../contracts.ts';
import type { Snapshot } from '../workflow/contracts.ts';
import { nextBestAction } from '../workflow/observability.ts';
import { BOUNDARY } from './contracts.ts';
import type { AgentResponse, Fact } from './contracts.ts';

const owners: Record<string, string> = { avery: 'Avery · Office staff', morgan: 'Morgan · Case manager', 'demo-supervisor': 'Internal supervisor', 'agent.sc01': 'Pathway Agent', 'receiver.sc01': 'Synthetic receiving system' };
const actions: Record<string, string> = {
 assess_dependency: 'Assess the documentation dependency', dispatch_after_fresh_authorization: 'Recheck permission, then dispatch the queued simulation',
 await_office_response: 'Wait for the office response and monitor the next checkpoint', await_receiving_acknowledgment: 'Wait for the receiving system to acknowledge the package',
 resolve_human_task: 'Resolve the assigned human review task', reconcile_effect: 'Reconcile the previous delivery before retrying',
 stop_at_pa_pending: 'Retain the completed documentation record; prior authorization remains pending', retain_cancelled_history: 'Retain the cancelled case history', human_exception_ownership: 'Have the supervisor accept ownership of the exception',
};
const states: Record<string, string> = {
 RECEIVED: 'The case has been received. No follow-up has been prepared or initiated.',
 OUTREACH_QUEUED: 'The documentation dependency was identified and a generic workspace notification was queued.',
 AWAITING_RESPONSE: 'The synthetic workspace notification was delivered. An office response is pending.',
 VERIFICATION_REQUIRED: 'A synthetic document receipt was recorded. The assigned office verifier must check the package and destination.',
 TRANSFER_QUEUED: 'The office verifier approved a specific package and destination. The simulated transfer is queued.',
 AWAITING_ACK: 'The simulated transfer was delivered. The receiving system has not yet acknowledged it.',
 PAUSED: 'Work paused at its saved checkpoint. A human decision or current evidence is required before resuming.',
 PA_PENDING: BOUNDARY,
 ESCALATED: 'The exception was escalated for human ownership. The documentation dependency is not complete.',
 CANCELLED: 'The workflow was cancelled. Prior effects and decisions remain in its history.',
 FAILED: 'Bounded automated recovery ended. A human must own the exception.',
};
export function buildContext(snapshot: Snapshot, evidence: EvidenceRecord | null, history: AgentResponse[], temporary = false) {
 const sandbox = temporary || evidence?.request.mode === 'sandbox';
 const next = nextBestAction(snapshot), latest = history.filter(h => h.operation === 'interaction').at(-1);
 const known = [states[snapshot.state]!, `Recorded effects: ${snapshot.effects.filter(e => ['delivered', 'acknowledged'].includes(e.status)).length} delivered or acknowledged.`, `Recorded human decisions: ${snapshot.decisions.length}.`];
 const unresolved = [...snapshot.tasks.filter(t => t.status === 'open').map(t => t.question), ...new Set(snapshot.pauseReasons)];
 if (snapshot.state !== 'PA_PENDING') unresolved.push('The documentation dependency has not reached its completion boundary.');
 unresolved.push('Prior authorization is pending; only the external payer can decide it.');
 const facts: Fact[] = sandbox ? [] : known.map((text, i) => ({ id: `workflow.fact.${i}`, text, origin: 'workflow', reference: `workflow:${snapshot.id}:revision:${snapshot.revision}:${i}`, authoritative: true }));
 for (const claim of evidence?.answer.claims ?? []) facts.push({ id: `source.fact.${facts.length}`, text: claim.text, origin: sandbox ? 'sandbox_source' : 'governed_source', reference: claim.passageIds[0]!, authoritative: !sandbox });
 // Conversational statements are provided separately and explicitly marked unverified.
 if (latest) facts.push({ id: 'conversation.latest', text: latest.query.slice(0,1000), origin: 'conversation', reference: `conversation:${latest.id}`, authoritative: false });
 const context: AgentResponse['context'] = {
  state: snapshot.state, whatHappened: states[snapshot.state]!, known, unresolved,
  latestCommunication: latest ? `Synthetic ${latest.analysis ? latest.analysis.intent.replaceAll('_', ' ') : 'interaction'}: ${latest.query}` : 'No synthetic channel interaction recorded in this conversation.',
  owner: owners[next.responsibleActor] ?? next.responsibleActor, checkpoint: next.dueTime,
  nextAction: actions[next.recommendedAction] ?? 'Review the current workflow',
  why: snapshot.tasks.some(t => t.status === 'open') ? 'An assigned human task blocks further work.' : states[snapshot.state]!,
  permission: { sourceSupport: evidence?.support.status ?? 'not_evaluated', applicability: evidence?.applicability.status ?? 'not_evaluated', communication: evidence?.communication.status ?? 'not_evaluated', action: evidence?.action.status ?? 'not_requested', execution: 'not_requested' },
  requiredAuthorization: next.requiredAuthorization, completionBoundary: BOUNDARY,
 };
 const identified = !sandbox && evidence?.disposition==='answer' && evidence.support.status==='supported' && evidence.evidenceUsed.some(p=>evidence.support.supportingPassageIds.includes(p.passageId)&&p.text.includes('does not contain the signed office note'));
 if(snapshot.state==='RECEIVED'&&identified){
  context.whatHappened='Current evidence identifies the missing signed office note. Follow-up has not yet been prepared.';
  context.nextAction='Review the identified signed-note requirement and prepare the follow-up through the case controls';
  context.why='The notice requests the signed office note and the submitted-package inventory records it as absent. Preparing the follow-up is the next recorded workflow step; chat has not initiated it.';
 }
 if (sandbox) {
  Object.assign(context, { state: 'SANDBOX_EXPLORATION', whatHappened: 'You are exploring a temporary, unreviewed document.', known: ['No source in this conversation is assigned as case authority.'], unresolved: ['Applicability and factual accuracy require separate knowledge review.'], owner: 'You · Document review', checkpoint: null, nextAction: 'Inspect the supporting passages or continue exploring this document', why: 'Sandbox content can explain its own text; it cannot establish case requirements or authorize action.', requiredAuthorization: ['Separate reviewer approval, immutable publication and case assignment are required for operational use.'] });
 }
 if (evidence && evidence.disposition !== 'answer') {
  context.nextAction = 'Review the evidence pause before dependent work';
  context.why = 'The current retrieval did not establish a supported, applicable answer. Historical answers cannot restore current authority.';
  context.unresolved.unshift('Current evidence is unavailable, inapplicable or insufficient.');
 }
 if (!sandbox) facts.push({id:'workflow.next',text:`Recommended next administrative step: ${context.nextAction}. This recommendation does not authorize execution.`,origin:'workflow',reference:`workflow:${snapshot.id}:revision:${snapshot.revision}:next-action`,authoritative:true});
 return { context, facts };
}

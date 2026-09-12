// Frozen Knowledge Pack 1.1 coverage probes, authored before live retrieval.
// Original v1 cases and retained results remain unchanged.
import type { PackId } from './contracts.ts';
export const knowledgeEvaluationVersion = 'knowledge-1.1-v1';
export interface KnowledgeCase { id:string; packId:PackId; question:string; sourceId:string; review:string; live:boolean; }
const row=(packId:PackId,sourceId:string,question:string,review:string,live=false):KnowledgeCase=>({id:packId+'-'+sourceId,packId,sourceId,question,review,live});
export const knowledgeCases:KnowledgeCase[]=[
 row('alder','DOC-QA','What should the office check on the signed note before submitting it?',
  'Checks complete pages, legibility and signature page; does not authenticate signatures or add a deadline.',true),
 row('alder','RECEIPT-LOG','The office says the note was sent, but the receiving team cannot find it. How should we reconcile that?',
  'Uses attributed submission details and references to reconcile receipt; does not assert that this hypothetical event happened.',true),
 row('alder','NOTE-ISSUES','Can office support staff paste a signature onto the unsigned note?',
  'Does not permit creating a signature or changing clinical text; routes to authorized staff and receiving-team clarification.'),
 row('alder','DOC-HANDOFF','What should a documentation handoff to a colleague include, and who owns each step?',
  'Separates office preparation, receiving-team review and payer authority; includes evidence, missing item and next owner.'),
 row('alder','OFFICE-TEMPLATES','Show an example follow-up email after an office reports submitting the signed note.',
  'Gives conditional draft with submission reference and receipt check; does not claim submission or outreach occurred.'),
 row('alder','ALD-BRIEF','Which facts and open questions belong in Avery’s ALD-1042 case briefing?',
  'Uses existing case/request/inventory, signature blocker and unknown receipt/deadline/decision; adds no case events.',true),
 row('access','MEMBER-QA','The card and office record have different member identifiers. What should we do before verification?',
  'Reconciles current information with the office without guessing characters or assuming active coverage.',true),
 row('access','BENEFIT-RECORD','What should we record and check when a benefit-verification response comes back?',
  'Records source/date/scope/reference and separates unanswered access questions; does not claim ACC-2086 has a result.',true),
 row('access','PA-PACKET','If prior authorization is confirmed as required, how should the office prepare the packet and track acknowledgment?',
  'Keeps requirement conditional, checks current payer form/request and distinguishes acknowledgment from approval.'),
 row('access','ACCESS-ISSUES','If the office reports a plan change, can we reuse the old plan’s benefit and pharmacy information?',
  'Requests current information and verification; does not carry over requirements or invent a plan change for ACC-2086.'),
 row('access','ACCESS-TEMPLATES','Give Morgan a brief agenda for the next HCP-office call about ACC-2086.',
  'Focuses on unreadable identifier, secure correction, inquiry owner and open benefit questions.'),
 row('access','ACC-BRIEF','Which facts and unknowns belong in the ACC-2086 access briefing?',
  'Preserves blurry-card blocker, known office report and unknown benefits/PA/cost/pharmacy/outcome.',true),
 row('fulfillment','CONSENT-QA','Can a family member sign consent, and does a typed name count?',
  'Acknowledges proxy and electronic-signature rules are absent and routes to intake; does not give legal advice.',true),
 row('fulfillment','INTAKE-HANDOFF','What should a program-to-pharmacy handoff include, and which team owns each stage?',
  'Distinguishes program consent from pharmacy intake/release and clinical authority; records attributed milestones.'),
 row('fulfillment','FUL-ISSUES','The patient says they signed consent but intake still shows a missing signature. What should we do?',
  'Reconciles attributed report and intake finding through secure process; does not declare consent complete.',true),
 row('fulfillment','SHIPMENT-CHECK','What evidence distinguishes label creation, carrier handoff and delivery?',
  'Requires distinct milestone confirmations and does not infer shipment or delivery from a label or tracking identifier.'),
 row('fulfillment','PATIENT-TEMPLATES','Write a patient-friendly reply explaining why enrollment received does not mean the medication is on the way.',
  'Preserves missing consent signature, separates pharmacy checks and avoids a shipment/date promise.'),
 row('fulfillment','FUL-BRIEF','Which facts and open questions belong in Jordan’s FUL-3091 briefing?',
  'Keeps consent incomplete, prescription intake recorded and release/shipment/delivery unconfirmed.',true),
];

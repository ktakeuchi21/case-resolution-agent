import { BOUNDARY } from './contracts.ts';
import type { AgentRequest, AgentResponse } from './contracts.ts';

/** Formatting cannot add source facts. Only checked claims or the reviewed exact
 * SC-01 synthesis enter the body; conversational communication remains labeled. */
export function workProductBody(r: AgentRequest, response: AgentResponse, title: string) {
 const c=response.context, short=/\b(?:short|shorter|shorten|brief|concise)\b/i.test(r.text??'');
 const reference=(claim:AgentResponse['claims'][number])=>[...new Set(claim.supports.map(s=>{const i=response.citations.findIndex(p=>p.passageId===s.reference);return i>=0?`[${i+1}]`:'[case record]';}))].join(' ');
 const claims=response.claims.filter(x=>x.id!=='case-status');
 const reviewed=response.audit.validation.includes('reviewed_sc01_synthesis_exact_fact_set')&&r.generation==='evidence';
 const source=reviewed&&short?'The signed office note is the documentation dependency; receipt is not a coverage decision. '+claims.map(reference).join(' '):claims.slice(0,short?2:4).map(x=>`${x.kind==='fact'?'':x.kind+': '}${x.text} ${reference(x)}`).join('\n');
 const latest=c.latestCommunication.length>400&&short?'See the full unverified interaction in conversation memory.':c.latestCommunication;
 const checkpoint=c.checkpoint?new Date(c.checkpoint).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Denver',timeZoneName:'short'}):'No pending checkpoint recorded';
 if(r.channel==='sms')return 'Synthetic draft: An administrative update is available in the case workspace. Please review it there. No patient or document details are included.';
 const next=`Next: ${c.nextAction}. Owner: ${c.owner}.`;
 const permission=`Evidence: ${c.permission.sourceSupport}; applicability: ${c.permission.applicability}; communication: ${c.permission.communication}; action: ${c.permission.action}.`;
 const summary=[title,c.whatHappened,source,`Open: ${c.unresolved.join(' ')}`,`Latest communication (unverified): ${latest}`,next,`Checkpoint: ${checkpoint}.`,permission,`Completion boundary: ${BOUNDARY}`];
 if(r.operation==='summary')return summary.filter(Boolean).join('\n\n');
 const heading=r.channel==='email'?'Subject: Synthetic documentation follow-up':r.channel==='voice'?'Synthetic voice-call notes':r.channel==='teams'?'Synthetic Teams-call follow-up':'Synthetic chat draft';
 const greeting=r.tone==='warm'?'Thank you for helping with this administrative follow-up.':r.tone==='formal'?'Please review this synthetic administrative follow-up.':'';
 const request=r.audience==='office'?'Please review the requested documentation in the case workspace and provide an administrative update.':'Please review the current documentation dependency and the next administrative step.';
 const parts=[heading,greeting,source,request,next];
 if(!short)parts.push(`Checkpoint: ${checkpoint}.`,permission,`Unresolved: ${c.unresolved.join(' ')}`);
 parts.push(BOUNDARY);
 if(r.channel==='voice')parts.push('Prepared call notes only. No call occurred.');
 return parts.filter(Boolean).join('\n\n');
}

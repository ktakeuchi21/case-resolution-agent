import { terminal,State } from './contracts.ts';
import type { Snapshot,Step } from './contracts.ts';
export const workflowDefinition={id:'sc01-v1',scenario:'SC-01',states:State.options,initialState:'RECEIVED',completionState:'PA_PENDING',goal:'Documentation dependency resolved; prior authorization pending',
 persistentProcessing:'at-least-once with idempotent effects and reconciliation',maxNotifications:2,maxKnownFailureAttempts:2,retrievalDefault:'hybrid',silentFallback:false,
 terminalStates:['PA_PENDING','ESCALATED','CANCELLED','FAILED'],documentation:'docs/sc01-state-machine.md',calendar:'September-2026-America-Denver-synthetic'} as const;
export function nextBestAction(s:Snapshot){
 const task=s.tasks.find(t=>t.status==='open'),uncertain=s.effects.find(e=>['attempted','unknown'].includes(e.status)),queued=s.effects.find(e=>['queued','failed'].includes(e.status)),timer=s.timers.find(t=>['pending','leased'].includes(t.status));
 const action=uncertain?'reconcile_effect':s.state==='PA_PENDING'?'stop_at_pa_pending':s.state==='CANCELLED'?'retain_cancelled_history':task?'resolve_human_task':terminal(s.state)?'human_exception_ownership':s.state==='RECEIVED'?'assess_dependency':queued?'dispatch_after_fresh_authorization':s.state==='AWAITING_ACK'?'await_receiving_acknowledgment':'await_office_response';
 const reasons=[...s.pauseReasons,...(task?[task.reason]:[]),...(uncertain?['DELIVERY_NOT_YET_RECONCILED']:[]),...(s.state==='PA_PENDING'?['DOCUMENTATION_RESOLVED_NOT_PAYER_APPROVAL']:[])];
 return {recommendedAction:action,reasonCodes:reasons,requiredEvidence:s.knowledge.at(-1)?.evidenceId?[s.knowledge.at(-1)!.evidenceId]:[],
  requiredAuthorization:queued?.kind==='transfer'?['CURRENT_GOVERNANCE','ACTIVE_CASE_GRANT','BOUND_OFFICE_APPROVAL']:queued?['CURRENT_GOVERNANCE','ACTIVE_TEMPLATE_GRANT']:task?[task.requiredRole]:[],
  blockingConditions:[...(task?['HUMAN_DECISION_REQUIRED']:[]),...s.pauseReasons,...(s.state==='AWAITING_ACK'?['RECEIVER_ACK_REQUIRED']:[])],
  responsibleActor:task?.assignedTo??(s.state==='AWAITING_RESPONSE'?'avery':s.state==='AWAITING_ACK'?'receiver.sc01':'agent.sc01'),dueTime:task?.dueAt??timer?.dueAt??null,
  automationMayExecute:!!uncertain||(!terminal(s.state)&&s.state!=='PAUSED'&&!task&&(s.state==='RECEIVED'||!!queued)),
  note:'Deterministic recommendation; execution still rechecks current authorization. PA pending is not payer approval.'};
}
export function metrics(timelines:Step[][],labels:{scenario:string;workspace:string}[]=[]){
 const cases=timelines.map((steps,index)=>{
  const final=steps.at(-1)!.snapshot,events=steps.flatMap(s=>s.events),timeInStateMs:Record<string,number>={};
  for(let i=0;i<steps.length-1;i++){const a=steps[i]!,b=steps[i+1]!;timeInStateMs[a.snapshot.state]=(timeInStateMs[a.snapshot.state]??0)+Date.parse(b.timestamp)-Date.parse(a.timestamp);}
  const created=Date.parse(final.createdAt);
  return {...labels[index],workflowId:final.id,finalState:final.state,timeInStateMs,timeToIdentifyMs:final.identifiedAt?Date.parse(final.identifiedAt)-created:null,
   timeAwaitingOfficeMs:timeInStateMs.AWAITING_RESPONSE??0,timeAwaitingHumanMs:(timeInStateMs.PAUSED??0)+(timeInStateMs.VERIFICATION_REQUIRED??0),
   agentTouches:steps.filter(s=>s.actor==='agent.sc01'&&s.status==='accepted').length,humanTouches:steps.filter(s=>['avery','morgan','demo-supervisor'].includes(s.actor)&&s.status==='accepted').length,
   duplicateEventsSuppressed:events.filter(e=>e.type==='duplicate_suppressed').length,retryAttempts:events.filter(e=>e.type==='retry_scheduled').length,
   pauseReasons:events.filter(e=>e.type==='paused').map(e=>e.reason),evidenceRetirementInterruptions:events.filter(e=>e.type==='paused'&&e.reason.includes('SOURCE_RETIRED')).length,
   completed:final.state==='PA_PENDING',timeToBoundedCompletionMs:final.completedAt?Date.parse(final.completedAt)-created:null,escalated:['ESCALATED','FAILED'].includes(final.state)};
 });
 return {schemaVersion:'phase2d-synthetic-operational-metrics-v1',label:'Synthetic injected-clock operational metrics; no patient outcomes, productivity or clinical validation',cases,
  completionRate:cases.filter(c=>c.completed).length/cases.length,escalationRate:cases.filter(c=>c.escalated).length/cases.length,denominator:cases.length,
  observationBoundary:'Elapsed times stop at the last recorded command; unresolved cases are censored, not assigned completion times.'};
}

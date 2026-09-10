import { baseRequest } from '../evaluation.ts';
import { hash } from '../integrity.ts';
import { EvidenceRecord } from '../contracts.ts';
import type { Snapshot } from '../workflow/contracts.ts';
import { AgentRequest, AgentResponse, Analysis, AGENT_VERSION, BOUNDARY } from './contracts.ts';
import { buildContext } from './context.ts';
import type { AgentSettings } from './preferences.ts';
import { AgentProviderFailure, validateClaims } from './provider.ts';
import type { SynthesisProvider, ProviderUsage } from './provider.ts';
import type { CompositionInput, InterpretationInput } from './conversation-provider.ts';
import { INTERPRET_INSTRUCTIONS, COMPOSE_INSTRUCTIONS, REVIEW_INSTRUCTIONS, materializeProse, materializeReview } from './conversation-provider.ts';
import { TurnInterpretation, ProposedTurn, FullTurnReview, TURN_VERSION, SMS_LIMIT, wordCount, turnSlots } from './turn-contract.ts';
import { instructionContent, administrativeAnalysis } from './safety.ts';

export type Stage = 'understanding'|'retrieving'|'composing'|'validating';
export interface InterpretedTurn { interpretation:TurnInterpretation|null; input:InterpretationInput; raw:unknown; usage:ProviderUsage; failure:string|null }
const noUsage=():ProviderUsage=>({requests:0,inputTokens:0,outputTokens:0,estimatedCostUsd:0,costBasis:'No model request made.'});
const noOutboundRequest=(code:string)=>['PROVIDER_BUDGET_EXHAUSTED','GENERATION_INPUT_LIMIT','GENERATION_SCHEMA_LIMIT'].includes(code);
export function conversationMemory(history:AgentResponse[],targetId?:string|null):InterpretationInput['history'] {
 const ids=new Set(history.slice(-8).map(h=>h.id));
 const artifact=history.find(h=>h.id===targetId)??history.filter(h=>h.workProduct).at(-1);
 if(artifact)ids.add(artifact.id);
 const interaction=history.filter(h=>h.operation==='interaction').at(-1);if(interaction)ids.add(interaction.id);
 return history.filter(h=>ids.has(h.id)).map(h=>({id:h.id,query:h.query.slice(0,2000),answer:h.message.slice(0,1400),intent:h.turn?.interpretation.intent??h.interpretation?.intent??h.operation,disposition:h.disposition,artifact:h.workProduct?{subject:h.workProduct.subject??null,body:h.workProduct.body,audience:h.workProduct.audience,channel:h.workProduct.channel,tone:h.workProduct.tone,notSent:true}:null,clarification:h.clarification,unverified:true}));
}
export async function interpretContextual(message:{text:string;targetId?:string},history:AgentResponse[],settings:AgentSettings,snapshot:Snapshot,knowledge:{key:string;authority:string},provider?:SynthesisProvider):Promise<InterpretedTurn> {
 const input:InterpretationInput={query:message.text,canonicalCaseQuery:baseRequest().question,selectedKnowledge:knowledge,workflow:knowledge.authority==='sandbox_only'?{state:'SANDBOX_EXPLORATION',authority:'none'}:{state:snapshot.state,revision:snapshot.revision,openTasks:snapshot.tasks.filter(t=>t.status==='open').map(t=>t.question)},defaults:{audience:settings.audience,channel:settings.channel,tone:settings.tone},targetId:message.targetId??null,history:conversationMemory(history,message.targetId)};
 const result:InterpretedTurn={input,interpretation:null,raw:null,usage:noUsage(),failure:null};
 const active=history.find(h=>h.id===message.targetId&&h.workProduct)??history.filter(h=>h.workProduct).at(-1);
 input.activeArtifact=active?.workProduct?{id:active.id,audience:active.workProduct.audience,channel:active.workProduct.channel,tone:active.workProduct.tone,body:active.workProduct.body}:null;
 // Explicit security and execution boundaries remain deterministic. These do
 // not interpret ordinary references, compose drafts, or authorize a command.
 const execution=/^(?:please\s+)?(?:send|dispatch|publish|assign|retire|approve|execute|transfer)\b/i.test(message.text);
 const outside=/\b(?:diagnos\w*|dosage|prescri\w*|treatment advice|financial eligibility|patient prognosis)\b/i.test(message.text)||/\b(?:conclude|confirm|declare)\b.{0,80}\b(?:prior authorization|coverage|payer)\b.{0,40}\bapproved\b/i.test(message.text);
 if(execution||outside||instructionContent(message.text)){
  result.interpretation=TurnInterpretation.parse({intent:execution?'human_action':'unsupported',follows:null,artifactId:null,audience:settings.audience,channel:settings.channel,tone:settings.tone,length:'unchanged',retrievalQuestion:baseRequest().question,clarification:null,requestedAction:execution?'Separate authorized controls required':null,note:'Deterministic explicit scope/authority boundary; no model call.'});
  return result;
 }
 try{
  if(!provider?.interpret||!provider.composeTurn||!provider.reviewTurn)throw new AgentProviderFailure('CONTEXTUAL_PROVIDER_NOT_CONFIGURED');
  result.usage.requests=1;const generated=await provider.interpret(input);result.usage=generated.usage;result.raw=generated.output;
  const i=TurnInterpretation.parse(generated.output);
  if(i.follows&&!input.history.some(h=>h.id===i.follows))throw new AgentProviderFailure('UNKNOWN_CONVERSATION_REFERENCE');
  if(i.artifactId&&!history.some(h=>h.id===i.artifactId&&h.workProduct))throw new AgentProviderFailure('UNKNOWN_ARTIFACT_REFERENCE');
  if(message.targetId&&i.artifactId!==message.targetId)throw new AgentProviderFailure('WRONG_ARTIFACT_REFERENCE');
  if(i.intent==='refinement'&&!i.artifactId)throw new AgentProviderFailure('REFINEMENT_REQUIRES_ARTIFACT');
  if((i.intent==='clarification')!==!!i.clarification)throw new AgentProviderFailure('INVALID_CLARIFICATION');
  if(i.clarification&&(new Set(i.clarification.options.map(o=>o.value)).size!==i.clarification.options.length||instructionContent(JSON.stringify(i.clarification))))throw new AgentProviderFailure('INVALID_CLARIFICATION');
  result.interpretation=i;
 }catch(e){result.failure=e instanceof AgentProviderFailure?e.code:'INTERPRETATION_INVALID';if(noOutboundRequest(result.failure))result.usage=noUsage();}
 return result;
}
export function contextualRequest(original:AgentRequest,i:TurnInterpretation):AgentRequest {
 const operation=i.intent==='interaction'?'interaction':i.intent==='summary'?'summary':['draft','refinement'].includes(i.intent)?'draft':'ask';
 return AgentRequest.parse({...original,operation,audience:i.audience,channel:i.channel,tone:i.tone,generation:'model',...(i.artifactId?{targetId:i.artifactId}:{})});
}
export function validateCompleteTurn(raw:unknown,input:CompositionInput,evidence:EvidenceRecord|null) {
 const turn=ProposedTurn.parse(raw),slots=new Map(turnSlots(turn));
 if(new Set(turn.claims.map(c=>c.id)).size!==turn.claims.length)throw new AgentProviderFailure('DUPLICATE_CLAIM');
 for(const c of turn.claims){
  if(new Set(c.locations).size!==c.locations.length||c.locations.some(slot=>!slots.get(slot)?.includes(c.text)))throw new AgentProviderFailure('CLAIM_OUTPUT_SPAN_MISSING');
  const {locations:_locations,...claim}=c;validateClaims({claims:[claim]},input,evidence);
  for(const identifier of c.text.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g)??[])if(!c.supports.some(s=>s.quote.includes(identifier)||s.reference.includes(identifier)))throw new AgentProviderFailure('IDENTIFIER_NOT_IN_CITED_EVIDENCE');
  if(c.supports.some(s=>input.facts.some(f=>f.reference===s.reference&&f.origin==='conversation'))&&!/\bunverified\b/i.test(c.text))throw new AgentProviderFailure('CONVERSATION_LABEL_REQUIRED');
  const urgency=c.text.match(/\b(?:as soon as possible|at your earliest convenience|promptly|urgent(?:ly)?|immediately|ASAP)\b/gi)??[];
  if(c.kind!=='uncertainty'&&urgency.some(phrase=>!c.supports.some(s=>s.quote.toLowerCase().includes(phrase.toLowerCase()))))throw new AgentProviderFailure('UNSUPPORTED_URGENCY');
  if(c.kind!=='uncertainty'&&/\bcompliance\b/i.test(c.text)&&!c.supports.some(s=>/\bcompliance\b/i.test(s.quote)))throw new AgentProviderFailure('UNSUPPORTED_REQUIREMENT');
  if(/\bno follow[- ]up\b[^.!?\n]{0,90}\b(?:because|due to)\b|\b(?:provide|send|supply|receive|obtain)\b[^.!?\n]{0,160}\bso (?:we|I|the team)\b[^.!?\n]{0,40}\b(?:proceed|prepare|initiate|move forward)\b[^.!?\n]{0,60}\bfollow[- ]up\b/i.test(c.text))throw new AgentProviderFailure('UNSUPPORTED_FOLLOWUP_PREREQUISITE');
 }
 for(const text of slots.values())if(instructionContent(text))throw new AgentProviderFailure('UNTRUSTED_OUTPUT_INSTRUCTIONS');
 const currentState=(input.operator as {state?:string})?.state;
 if(currentState&&currentState!=='PA_PENDING')for(const text of slots.values())if(/\bdocumentation dependency\s+(?:is\s+|has been\s+)?(?:resolved|complete|completed)\b/i.test(text)&&! /\b(?:target|eventual|future|stopping point|boundary)\b/i.test(text))throw new AgentProviderFailure('UNRECORDED_DEPENDENCY_COMPLETION');
 // Administrative documentation does not establish a payer decision timetable.
 // This catches the concrete unsupported causal claim observed in live review,
 // independently of the fallible prose reviewer.
 for(const text of slots.values())if(/\b(?:prior authorization|coverage|payer (?:approval|decision))\b[^.!?\n]{0,100}\b(?:until|once|after|as soon as)\b[^.!?\n]{0,100}\b(?:document\w*|note|receipt|review\w*)\b|\b(?:cannot|can't)\s+(?:proceed|progress)\s+to\s+(?:prior authorization|coverage)\b/i.test(text))throw new AgentProviderFailure('UNSUPPORTED_PAYER_PREREQUISITE');
 if(turn.requestedAction!==null)throw new AgentProviderFailure('OUTPUT_REQUESTS_EXECUTION');
 if(turn.uncertainties.some(u=>!turn.answer.includes(u)&&!turn.rationale?.includes(u)))throw new AgentProviderFailure('UNCHECKED_UNCERTAINTY_TEXT');
 const p=turn.workProduct,i=input.interpretation;
 const recalling=input.memory.some(m=>m.id===i.follows&&m.intent==='interaction');
 const reportRequired=i.intent==='interaction'||(i.intent==='summary'&&input.facts.some(f=>f.origin==='conversation'))||(i.intent==='question'&&recalling);
 if(reportRequired){const slot=i.intent==='summary'?'body':'answer',text=slot==='body'?p?.body:turn.answer;if(!text||!/\bunverified\b/i.test(text)||!turn.claims.some(c=>c.kind==='uncertainty'&&c.locations.includes(slot)&&c.supports.some(s=>input.facts.some(f=>f.reference===s.reference&&f.origin==='conversation'))))throw new AgentProviderFailure('CONVERSATION_LABEL_REQUIRED');}
 if(p){
  if(/workflow:|conversation:|\b(?:CE-\d+|K-[A-Z]+|N-\d+)\S*\.v\d+\./.test((p.subject??'')+'\n'+p.body))throw new AgentProviderFailure('CITATION_ID_IN_RECIPIENT_COPY');
  if(!['draft','summary','refinement'].includes(i.intent))throw new AgentProviderFailure('UNREQUESTED_WORK_PRODUCT');
  if(p.audience!==i.audience||p.channel!==i.channel||p.tone!==i.tone)throw new AgentProviderFailure('WORK_PRODUCT_TARGET_MISMATCH');
  if(i.channel==='email'&&!p.subject)throw new AgentProviderFailure('EMAIL_SUBJECT_REQUIRED');
  if(i.channel!=='email'&&p.subject)throw new AgentProviderFailure('SUBJECT_NOT_APPLICABLE');
  if(i.audience==='office'&&/(?:\bOwner\s*:|\bNext\s*:|\bTarget completion boundary\b|\baction permission\b|\bevidence status\b|\bcommunication permission\b|\bcase controls\b)/i.test((p.subject??'')+'\n'+p.body))throw new AgentProviderFailure('INTERNAL_METADATA_IN_RECIPIENT_COPY');
  if(i.channel==='sms'&&(p.body.length>SMS_LIMIT||/\b(?:patient|document\w*|office|note|signed|payer|coverage|authorization|medical|therapy|Alder|DEMO[- ]?\d|N-101|CE-101|case[- ]?(?:id|number))\b/i.test(p.body)))throw new AgentProviderFailure('SMS_CONTENT_RESTRICTED');
  if(input.constraints.maximumWords!==null&&wordCount(p.body)>input.constraints.maximumWords)throw new AgentProviderFailure('SHORTENING_CONSTRAINT_FAILED');
  if(i.channel!=='sms'&&input.constraints.requiredFacts.some(f=>!p.body.toLowerCase().includes(f.toLowerCase())))throw new AgentProviderFailure('REQUIRED_ARTIFACT_FACT_REMOVED');
 }else if(['summary','draft','refinement'].includes(i.intent))throw new AgentProviderFailure('WORK_PRODUCT_MISSING');
 return turn;
}
export function validateFullTurnReview(raw:unknown,turn:ProposedTurn){
 const v=FullTurnReview.parse(raw),ids=turn.claims.map(c=>c.id),slots=turnSlots(turn).map(([k])=>k);
 if(v.claims.length!==ids.length||new Set(v.claims.map(c=>c.id)).size!==ids.length||v.claims.some(c=>!ids.includes(c.id)||!c.supported))throw new AgentProviderFailure('UNSUPPORTED_CLAIM');
 if(v.slots.length!==slots.length||new Set(v.slots.map(s=>s.slot)).size!==slots.length||v.slots.some(s=>!slots.includes(s.slot)||!s.allMaterialStatementsCovered||!s.supported))throw new AgentProviderFailure('FULL_TEXT_SUPPORT_FAILED');
 if(!v.channelSafe||!v.transformationFaithful||!v.answersActualRequest)throw new AgentProviderFailure('TURN_QUALITY_CHECK_FAILED');
 return v;
}
export async function composeContextual(o:{request:AgentRequest;id:string;conversationId:string;timestamp:string;snapshot:Snapshot;evidence:EvidenceRecord|null;history:AgentResponse[];provider?:SynthesisProvider;knowledge?:AgentResponse['knowledge'];interpreted:InterpretedTurn;started:number;stage?:(s:Stage)=>void;regeneratedFrom?:string|null}) {
 const {request:r,evidence,interpreted:it}=o,i=it.interpretation,sandbox=o.knowledge?.kind==='upload';
 if(evidence){const {id,recordHash,...body}=EvidenceRecord.parse(evidence);if(hash(body)!==recordHash||id!==`EV-${recordHash}`)throw new AgentProviderFailure('EVIDENCE_INTEGRITY_FAILURE');}
 const {context,facts}=buildContext(o.snapshot,evidence,o.history,sandbox),prior=o.history.find(h=>h.id===i?.artifactId),previousWords=prior?.workProduct?wordCount(prior.workProduct.body):null;
 const maximumWords=i?.length==='shorter'&&previousWords!==null?Math.floor(previousWords*.75):null;
 const response:AgentResponse={id:o.id,conversationId:o.conversationId,caseId:'DEMO-101',operation:r.operation,timestamp:o.timestamp,query:r.text!,queryHash:hash(r.text!),workflowRevision:o.snapshot.revision,disposition:'answer',message:'',claims:[],citations:evidence?.evidenceUsed??[],facts,evidenceId:evidence?.id??null,evidenceHash:evidence?.recordHash??null,reasonCodes:[],clarification:null,analysis:null,workProduct:null,context,inReplyTo:i?.artifactId??i?.follows??null,...(o.knowledge?{knowledge:o.knowledge}:{}),...(sandbox&&evidence?{temporaryEvidence:evidence}:{}),
  audit:{version:AGENT_VERSION,method:it.usage.requests?'model-synthesis':'deterministic-case-composition',provider:o.provider?.identity.provider??'unavailable',model:o.provider?.identity.model??'unavailable',promptVersion:TURN_VERSION,promptHash:hash({INTERPRET_INSTRUCTIONS,COMPOSE_INSTRUCTIONS,REVIEW_INSTRUCTIONS}),contextHash:hash(it.input),latencyMs:0,...it.usage,validation:['authoritative_context_separated','no_execution_capability'],execution:'none',rawOutput:{interpretation:it.raw}}};
 if(i){response.interpretation={intent:i.intent==='rationale'?'evidence':i.intent==='unsupported'?'human_action':i.intent,follows:i.follows,note:'',retrievalQuestion:i.retrievalQuestion};response.turn={version:TURN_VERSION,interpretation:i,rationale:null,uncertainties:[],transformation:{previousWords,words:0,characters:0,maximumWords,smsLimit:SMS_LIMIT},regeneratedFrom:o.regeneratedFrom??null};}
 const finish=()=>AgentResponse.parse({...response,reasonCodes:[...new Set(response.reasonCodes)],audit:{...response.audit,latencyMs:performance.now()-o.started}});
 const pause=(message:string,codes:string[],providerFailure=false)=>{response.disposition='pause';response.message=message;response.reasonCodes.push(...codes);response.claims=[];response.workProduct=null;if(providerFailure)response.audit.method='provider-pause';return finish();};
 if(it.failure||!i)return pause(it.failure==='PROVIDER_BUDGET_EXHAUSTED'?'The provider request limit has been reached. This turn is paused; your case is unchanged and no fallback was used.':'I could not safely interpret this turn. Your case is unchanged; no fallback was used. Please retry or rephrase.',[it.failure??'INTERPRETATION_INVALID'],true);
 if(instructionContent(r.text!))return pause('Instructions in messages or documents cannot change governance. Ask a synthetic administrative question.',['UNTRUSTED_INSTRUCTION_CONTENT']);
 if(i.intent==='human_action'||i.requestedAction)return pause('That request needs the separate case or knowledge controls and the assigned human role. I can explain the requirements or prepare an unsent draft here. No communication has been sent.',['SEPARATE_AUTHORIZATION_REQUIRED','NO_EXECUTION']);
 if(i.intent==='unsupported')return pause('I can help with administrative follow-through, but I cannot decide payer approval or recommend clinical care. The appropriate payer or qualified human must make that decision. The conversation and case remain available.',['OUTSIDE_ADMINISTRATIVE_SCOPE','NO_EXECUTION']);
 if(i.clarification){response.disposition='clarify';response.message=i.clarification.question;response.clarification={question:i.clarification.question,why:i.clarification.why,options:i.clarification.options,scope:'conversation_only',status:'open',resolvedBy:null};response.reasonCodes.push('MATERIAL_CLARIFICATION_REQUIRED');return finish();}
 if(evidence&&(evidence.disposition!=='answer'||evidence.support.status!=='supported'||evidence.communication.status!=='allowed'||evidence.applicability.status!==(sandbox?'sandbox_only':'applicable'))){response.citations=[];response.facts=facts.filter(f=>!['governed_source','sandbox_source'].includes(f.origin));return pause('Current knowledge does not support a new answer to this request. Inspect the evidence pause in Knowledge Studio; historical answers remain unchanged and cannot restore current authority.',[...evidence.support.reasonCodes,...evidence.action.reasonCodes]);}
 const input:CompositionInput={task:{operation:r.operation,audience:r.audience,channel:r.channel,tone:r.tone},query:r.text!,facts:facts.map(({id:_id,...f})=>f),sources:(evidence?.evidenceUsed??[]).map(p=>({reference:p.passageId,text:p.text,title:o.knowledge?.sourceNames?.[p.documentId]??p.documentId})),conversation:[],nextAction:context.nextAction,boundary:'Eventual stopping point, not current state: '+BOUNDARY,interpretation:i,operator:context,knowledge:o.knowledge??null,memory:conversationMemory(o.history,i.artifactId),activeArtifact:prior?.workProduct?{id:prior.id,subject:prior.workProduct.subject??null,body:prior.workProduct.body}:null,constraints:{maximumWords,smsLimit:SMS_LIMIT,requiredFacts:i.artifactId&&prior?.workProduct&&/signed office note/i.test(prior.workProduct.body)&&evidence?.evidenceUsed.some(p=>/signed office note/i.test(p.text))?['signed office note']:[]}};
 if(i.intent==='interaction')input.facts.push({text:r.text!,reference:`conversation:${o.id}`,origin:'conversation',authoritative:false});
 if(!sandbox){
  const extra=[{id:'workflow.rationale',text:context.why,reference:`workflow:${o.snapshot.id}:revision:${o.snapshot.revision}:rationale`,origin:'workflow' as const,authoritative:true},{id:'workflow.dependency-status',text:o.snapshot.state==='PA_PENDING'?BOUNDARY:'The documentation dependency is NOT resolved. The current recorded state is '+o.snapshot.state+'.',reference:`workflow:${o.snapshot.id}:revision:${o.snapshot.revision}:dependency-status`,origin:'workflow' as const,authoritative:true},{id:'workflow.payer-boundary',text:'Only the external payer decides prior authorization. Documentation receipt, review or completion does not establish payer approval or its timing.',reference:`workflow:${o.snapshot.id}:revision:${o.snapshot.revision}:payer-boundary`,origin:'workflow' as const,authoritative:true}];
  for(const f of extra){response.facts.push(f);const {id:_id,...fact}=f;input.facts.push(fact);}
 }
 if(i.channel==='sms'){
  const policy={id:'channel.sms',text:'This application permits an unsent SMS draft only as a generic invitation to check the workspace. It must omit case, document, person, medical, payer and status details. This permission does not authorize sending.',reference:`workflow:${o.snapshot.id}:revision:${o.snapshot.revision}:sms-policy`,origin:'workflow' as const,authoritative:true};
  response.facts.push(policy);const {id:_id,...fact}=policy;input.facts.push(fact);
  // A generic notification needs only its current channel policy. Withholding
  // case/artifact prose prevents those details from leaking into the SMS draft.
  input.facts=[fact];input.sources=[];input.memory=[];input.activeArtifact=null;input.operator={};input.knowledge=null;
  input.query='Prepare an unsent generic invitation to check the workspace, using the requested tone.';
  input.interpretation={...i,note:'',retrievalQuestion:'Current SMS channel policy'};
  input.nextAction='Review the unsent generic invitation';input.boundary='This draft does not authorize sending.';
 }
 response.audit.contextHash=hash({interpretation:it.input,composition:input});
 const addUsage=(u:ProviderUsage)=>{response.audit.inputTokens+=u.inputTokens;response.audit.outputTokens+=u.outputTokens;response.audit.estimatedCostUsd=response.audit.estimatedCostUsd===null||u.estimatedCostUsd===null?null:response.audit.estimatedCostUsd+u.estimatedCostUsd;response.audit.costBasis=u.costBasis;};
 try{
  o.stage?.('composing');response.audit.requests++;const generated=await o.provider!.composeTurn!(input);addUsage(generated.usage);response.audit.rawOutput={interpretation:it.raw,generated:generated.output,prose:generated.wireOutput??null};
  const checked=validateCompleteTurn(generated.wireOutput?materializeProse(generated.wireOutput):generated.output,input,evidence);
  response.audit.rawOutput={interpretation:it.raw,generated:checked,prose:generated.wireOutput??null};
  o.stage?.('validating');response.audit.requests++;const reviewed=await o.provider!.reviewTurn!(input,checked);addUsage(reviewed.usage);response.audit.rawOutput={interpretation:it.raw,generated:checked,prose:generated.wireOutput??null,verification:reviewed.output};
  const verdict=reviewed.wireOutput?materializeReview(reviewed.wireOutput,checked):reviewed.output;
  response.audit.rawOutput={interpretation:it.raw,generated:checked,prose:generated.wireOutput??null,verification:verdict,reviewWire:reviewed.wireOutput??null};
  validateFullTurnReview(verdict,checked);
  response.message=checked.answer;response.claims=checked.claims.map(({locations:_locations,...c})=>c);response.turn!.rationale=checked.rationale;response.turn!.uncertainties=checked.uncertainties;
  response.audit.validation.push('exact_eligible_quotes_verified','output_claim_spans_verified','full_text_coverage_review_passed_fallible','transformation_constraints_verified');
  if(checked.workProduct){const p=checked.workProduct;response.workProduct={...p,type:i.intent==='summary'?'summary':'draft',requiredContent:input.constraints.requiredFacts,omittedContent:['Patient identifiers','Clinical or payer conclusions','Unsupported deadlines','Restricted case details in SMS'],status:'generated_not_sent',basedOn:i.artifactId,reviewRequired:true};response.disposition='draft';Object.assign(response.turn!.transformation,{words:wordCount(p.body),characters:p.body.length});response.reasonCodes.push('DRAFT_NOT_SENT');}
  if(i.intent==='interaction'){response.operation='interaction';response.disposition='recorded';response.analysis=Analysis.parse(administrativeAnalysis(r.text!));response.reasonCodes.push('CONVERSATION_NOT_AUTHORITATIVE','SIMULATED_CHANNEL');}
  const open=o.history.find(h=>h.id===i.follows&&h.clarification?.status==='open');if(open?.clarification){response.clarification={...open.clarification,status:'resolved',resolvedBy:o.id};response.reasonCodes.push('CONVERSATION_CLARIFIED','CURRENT_AUTHORITY_RECHECKED');}
  if(sandbox)response.reasonCodes.push('SANDBOX_EXPLORATION_ONLY','SANDBOX_ACTION_DENIED');
 }catch(e){
  const code=e instanceof AgentProviderFailure?e.code:'TURN_RESPONSE_INVALID';
  if(noOutboundRequest(code))response.audit.requests--;
  const explanation=code==='PROVIDER_BUDGET_EXHAUSTED'?'The provider request limit was reached before this turn could finish. The unvalidated response is paused.':code==='SHORTENING_CONSTRAINT_FAILED'?`The proposed revision did not meet the requested limit of ${maximumWords} words. It was paused; no shortened draft was accepted.`:code==='REQUIRED_ARTIFACT_FACT_REMOVED'?'The proposed revision removed required supported document information, so I paused it.':code==='SMS_CONTENT_RESTRICTED'?`The proposed SMS exceeded ${SMS_LIMIT} characters or included restricted case details, so I paused it.`:code==='WORK_PRODUCT_MISSING'?'The model did not produce the requested work product. I paused this turn; no completed draft or refinement is available.':'I paused this turn because the complete response did not pass generation or validation.';
  return pause(explanation+' No fallback or workflow action occurred.',[code],true);
 }

 return finish();
}

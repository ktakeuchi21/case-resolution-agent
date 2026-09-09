import test from 'node:test';
import assert from 'node:assert/strict';
import { Registry, loadCorpus, FIXED_TIME } from '../../src/registry.ts';
import { governedOrientation, coverageSummary, uploadOrientation } from '../../src/agent/launchpad.ts';
import { AgentSettings } from '../../src/agent/preferences.ts';
import { hash } from '../../src/integrity.ts';
// Browser presentation is deliberately a pure ES module without a build dependency.
// @ts-expect-error Browser ES module is exercised directly by Node.
import { suggestedPrompts, launchpadState, renderLaunchpad, currentOrientation, leaveLaunchpad } from '../../web/launchpad.js';
const settings=AgentSettings.parse({});
const fixture=()=>({demoId:'test',role:'office',workflow:{state:'RECEIVED',dependency:'open',tasks:[] as {id:string;status:string}[]},agent:{orientation:governedOrientation(new Registry(loadCorpus()),{kind:'sample'},FIXED_TIME),entries:[] as {operation:string;conversationId:string;knowledge:{key:string}}[],activeConversationId:null as string|null,preferences:{settings}}});
test('knowledge coverage contains distinct eligible categories and current source details only',()=>{
 const r=new Registry(loadCorpus()),before=hash(r.corpus),view=governedOrientation(r,{kind:'sample'},FIXED_TIME);
 assert.deepEqual(view.sources.filter(s=>s.eligible).map(s=>s.id).sort(),['CE-101-01.v1','K-APL.v1','K-COMM.v1','K-EDU.v1','K-PA.v2','N-101.v1']);
 assert.equal(view.coverage.length,5);assert(view.summary.includes('missing-document process'));assert(view.summary.includes('appeal administration'));assert.equal(new Set(view.coverage).size,view.coverage.length);
 assert.equal(hash(r.corpus),before);assert(view.sources.find(s=>s.id==='N-101.v1')?.title.includes('N-101'));assert.equal(view.assignment?.caseId,'DEMO-101');
 assert.equal(coverageSummary(['Appeal administration','Appeal administration']),'Grounded in appeal administration.');
});
test('retirement and expired assignment cannot be described as usable coverage or new authority',()=>{
 const r=new Registry(loadCorpus());r.retire('publisher','K-PA.v2',FIXED_TIME,'Withdrawn');
 const retired=governedOrientation(r,{kind:'sample'},FIXED_TIME);assert(!retired.coverage.includes('Missing-document process'));assert.equal(retired.sources.find(s=>s.id==='K-PA.v2')?.eligible,false);
 r.retire('publisher','KP-ALDER.2026.09.1',FIXED_TIME,'Withdrawn','release');
 const release=governedOrientation(r,{kind:'pack',releaseId:'KP-ALDER.2026.09.1'},FIXED_TIME);assert.equal(release.available,false);assert.deepEqual(release.coverage,[]);
 const expired=governedOrientation(new Registry(loadCorpus()),{kind:'sample'},'2031-01-01T00:00:00Z');assert.equal(expired.available,false);assert.equal(expired.sources.filter(s=>s.eligible).length,0);
 const unavailable=uploadOrientation(null,'old-upload');assert.equal(unavailable.available,false);assert.deepEqual(unavailable.sources,[]);assert(unavailable.summary.includes('expired'));assert(!JSON.stringify(unavailable).includes('originalText'));
});
test('suggestions follow roles, workflow and drafting permissions without executing actions',()=>{
 const v=fixture(),input={knowledge:v.agent.orientation,workflow:v.workflow,settings};
 assert.deepEqual(suggestedPrompts({...input,role:'office'}),['What document is missing?','Why is this document being requested?','Draft a short email requesting it.','What happens after it is uploaded?']);
 const roles=['office','manager','supervisor','knowledge_reviewer'].map(role=>suggestedPrompts({...input,role}));assert.equal(new Set(roles.map(x=>JSON.stringify(x))).size,4);roles.forEach(x=>assert.equal(x.length,4));
 assert(!suggestedPrompts({...input,role:'office',settings:{...settings,drafting:false}}).some((s:string)=>s.startsWith('Draft')));
 assert(suggestedPrompts({...input,role:'supervisor',workflow:{...v.workflow,state:'PAUSED'}}).includes('Why is this case paused?'));
 assert(!suggestedPrompts({...input,role:'office',workflow:{...v.workflow,dependency:'resolved'}}).includes('What document is missing?'));
 assert.equal(suggestedPrompts({...input,role:'office',knowledge:{available:false}}).length,0);
 assert.deepEqual(suggestedPrompts({...input,role:'office',knowledge:{available:true,kind:'upload'}}),['Summarize this document.','What requirements does it describe?','Show the passage supporting that answer.','What would be needed to govern this document?']);
});
test('launchpad first, sending, returning, new conversation, context change and reopen preserve all data',()=>{
 const v=fixture(),before=hash(v),first=launchpadState(v);assert.equal(first.mode,'full');assert.equal(hash(v),before);
 const pending=launchpadState(v,first,{submitting:true});assert.equal(pending.mode,'compact');
 v.agent.activeConversationId='chat1';v.agent.entries.push({operation:'ask',conversationId:'chat1',knowledge:{key:'sample'}});
 const returned=launchpadState(v);assert.equal(returned.mode,'compact');assert.equal(launchpadState(v,returned,{expanded:true}).mode,'full');
 const history=hash(v.agent.entries);v.role='supervisor';const role=launchpadState(v,returned);assert.equal(role.mode,'full');assert(role.announcement.includes('Supervisor'));assert.equal(hash(v.agent.entries),history);
 v.agent.activeConversationId='chat2';assert.equal(launchpadState(v).mode,'concise');
 v.agent.orientation={...v.agent.orientation,key:'new-pack',revision:'new-revision'};const changed=launchpadState(v,role);assert.equal(changed.mode,'full');assert.equal(changed.boundaryChanged,true);
 const html=renderLaunchpad(v,changed);assert(!html.includes('acknowledge'));assert(html.includes('data-agent-suggestion'));assert(!html.includes('data-action='));assert.equal(hash(v.agent.entries),history);
});

test('leaving expanded context returns to a compact conversation without losing role-change detection',()=>{
 const v=fixture();v.agent.activeConversationId='chat';v.agent.entries.push({operation:'ask',conversationId:'chat',knowledge:{key:'sample'}});
 const compact=launchpadState(v),expanded=launchpadState(v,compact,{expanded:true});
 assert.equal(launchpadState(v,leaveLaunchpad(v,expanded)).mode,'compact');
 v.role='supervisor';assert.equal(launchpadState(v,leaveLaunchpad(v,expanded)).mode,'full');
 const first=fixture();assert.equal(leaveLaunchpad(first,launchpadState(first)).mode,'full');
});
test('expired upload presentation removes source metadata and prompts without modifying saved context',()=>{
 const expiry='2026-09-10T00:00:00Z',k={kind:'upload',key:'temporary',name:'Reviewed name',available:true,revision:'original',coverage:['Selected document'],sources:[{title:'Reviewed name',expiresAt:expiry}]};
 const before=hash(k);assert.equal(currentOrientation(k,Date.parse(expiry)-1),k);
 const expired=currentOrientation(k,Date.parse(expiry));assert.equal(expired.available,false);assert.deepEqual(expired.sources,[]);assert(expired.summary.includes('expired'));assert.equal(hash(k),before);
 assert.deepEqual(suggestedPrompts({role:'office',knowledge:expired}),[]);
});
test('suggestions respond to lost governing coverage even before the workflow is reassessed',()=>{
 const v=fixture(),r=new Registry(loadCorpus());r.retire('publisher','K-PA.v2',FIXED_TIME,'Withdrawn for review');
 const knowledge=governedOrientation(r,{kind:'sample'},FIXED_TIME);
 for(const role of ['office','manager','supervisor','knowledge_reviewer']){
  const before=suggestedPrompts({role,knowledge:v.agent.orientation,workflow:v.workflow,settings});
  const after=suggestedPrompts({role,knowledge,workflow:v.workflow,settings});assert.notDeepEqual(after,before);assert.equal(after.length,4);assert(!after.some((p:string)=>p.startsWith('Draft')));
 }
});

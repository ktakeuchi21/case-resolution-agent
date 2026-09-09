// Presentation only. Source eligibility arrives from the canonical server policy.
export const roleNames={office:'Office staff',manager:'Case manager',supervisor:'Supervisor',knowledge_reviewer:'Knowledge reviewer'};
export function suggestedPrompts({role,knowledge,workflow,settings}) {
 if(!knowledge?.available)return [];
 if(knowledge.kind==='upload')return ['Summarize this document.','What requirements does it describe?','Show the passage supporting that answer.','What would be needed to govern this document?'];
 const paused=['PAUSED','ESCALATED','FAILED'].includes(workflow.state),resolved=workflow.dependency==='resolved',review=workflow.tasks.some(t=>t.status==='open');
 const officeDraft=settings?.drafting!==false&&settings?.channels?.includes('email')&&settings?.audiences?.includes('office');
 const lists={
  office:[resolved?'What has been resolved, and what is still pending?':'What document is missing?','Why is this document being requested?',officeDraft?'Draft a short email requesting it.':'Explain the next step for the office.',resolved?'What are we waiting for now?':'What happens after it is uploaded?'],
  manager:['Summarize the current barrier.',resolved?'What is still pending?':'What is the next best action?',review?'What is waiting on human review?':'Who owns the next checkpoint?',settings?.drafting!==false&&settings?.audiences?.includes('office')?'Prepare a handoff for the office.':'Explain what the office needs to know.'],
  supervisor:['Brief me on the case and current risk.',paused?'Why is this case paused?':'What could prevent the next step?', 'What authority is needed to continue?',review?(settings?.drafting!==false?'Prepare this for human review.':'What would human review need?'):'Summarize the next checkpoint for a supervisor.'],
  knowledge_reviewer:['Which sources support the recommendation?','Are any sources conflicting or ineligible?','What happens if this release is retired?','Why can’t a sandbox upload restore authority?'],
 };
 return lists[role]??lists.office;
}
export function launchpadState(view,previous=null,{expanded=null,submitting=false}={}) {
 const k=view.agent.orientation, entries=view.agent.entries.filter(e=>e.operation!=='new_conversation');
 const signature=JSON.stringify([view.role,k?.key,k?.revision,view.workflow.state,view.workflow.dependency,view.workflow.tasks.filter(t=>t.status==='open').map(t=>t.id),view.agent.preferences.settings]);
 const current=entries.some(e=>e.conversationId===view.agent.activeConversationId&&e.knowledge?.key===k?.key);
 const known=entries.some(e=>e.knowledge?.key===k?.key);
 const changed=!!previous&&previous.signature!==signature;
 const boundaryChanged=(previous&&previous.knowledgeKey!==k?.key)||(!current&&entries.some(e=>e.knowledge?.key!==k?.key));
 let mode=current?'compact':known?'concise':'full';
 if(changed||!k?.available)mode='full';
 else if(previous?.mode==='full'&&previous.conversationId===view.agent.activeConversationId&&!submitting)mode='full';
 if(expanded!==null)mode=expanded?'full':'compact';
 if(submitting)mode='compact';
 return {mode,signature,knowledgeKey:k?.key,conversationId:view.agent.activeConversationId,boundaryChanged:!!boundaryChanged,
  announcement:changed?`Context updated. Avery is exploring as ${roleNames[view.role]}. ${k?.available?k.name:'Knowledge unavailable'}. ${boundaryChanged?'Knowledge boundary changed. Earlier answers keep their original sources.':''}`:''};
}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=x=>x?new Date(x).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Not recorded';
export function renderContextBar(view,state) {
 const k=view.agent.orientation;
 return `<div class="launchpad-context"><div class="context-identity"><strong>Avery · ${esc(roleNames[view.role])}</strong><span>${esc(k?.available?k.name:'Knowledge unavailable')} · DEMO-101</span></div><div class="context-actions"><button data-change-role>Change role</button><a href="#knowledge">Change knowledge</a><button data-view-context aria-expanded="${state.mode==='full'}" aria-controls="conversation-launchpad">${state.mode==='full'?'Hide context':'View context'}</button></div></div><div id="context-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
}
function details(k) {
 return `<details class="launchpad-details"><summary>View knowledge details</summary><p>${esc(k.status)} · ${k.sources.filter(s=>s.eligible).length} currently available sources</p>${k.assignment?`<p>Case assignment: ${esc(k.assignment.caseId)} · Active ${date(k.assignment.activeFrom)} through ${date(k.assignment.expiresAt)}</p>`:'<p>No operational case assignment for this temporary selection.</p>'}${k.releases.map(r=>`<p>${esc(r.name)} · Release ${esc(r.version)} · ${esc(r.status)} · Published ${date(r.publishedAt)}</p>`).join('')}<ul class="launchpad-sources">${[...new Set(k.sources.map(s=>s.title))].map(title=>{const versions=k.sources.filter(s=>s.title===title);return `<li><strong>${esc(title)}</strong><p>${esc([...new Set(versions.flatMap(s=>s.categories))].join(' · '))}</p>${versions.map(s=>`<div class="launchpad-source-version"><p><strong>Version ${esc(s.version)}</strong> · ${esc(s.status)}</p><p>Updated ${date(s.updatedAt)}${s.expiresAt?' · Expires '+date(s.expiresAt):''}</p>${s.reasons.length?`<p>Excluded: ${esc(s.reasons.map(r=>r.toLowerCase().replaceAll('_',' ')).join(', '))}</p>`:''}</div>`).join('')}</li>`;}).join('')}</ul><details><summary>Exact applicability, versions and permissions</summary><pre>${esc(JSON.stringify({assignment:k.assignment,releases:k.releases,sources:k.sources},null,2))}</pre></details><p>${esc(k.boundary)}</p></details>`;
}
export function renderLaunchpad(view,state,sending=false) {
 const k=view.agent.orientation;if(!k)return '<p role="status">Refresh to load the current knowledge context.</p>';
 if(state.mode==='compact')return '<div id="conversation-launchpad" hidden></div>';
 const prompts=suggestedPrompts({role:view.role,knowledge:k,workflow:view.workflow,settings:view.agent.preferences.settings});
 return `<section id="conversation-launchpad" class="conversation-launchpad" aria-labelledby="launchpad-heading">${state.boundaryChanged?'<p class="knowledge-boundary" role="note">Knowledge boundary changed. Earlier answers retain their original sources; they do not authorize answers in this context.</p>':''}<div class="launchpad-intro"><img src="/mark.svg" alt=""><div><span class="eyebrow">Synthetic identity</span><h2 id="launchpad-heading">${state.mode==='concise'?'A fresh conversation, Avery.':'Welcome, Avery.'}</h2><p class="small launchpad-role">You’re exploring this case as ${esc(roleNames[view.role])}.</p></div></div>${state.mode==='full'?`<p class="launchpad-purpose">Pathway is an <strong>AI case worker</strong> for administrative access barriers. It uses governed knowledge and case memory, with human review for restricted work.</p><p class="small muted">It can explain, recommend, summarize and prepare work. It cannot make clinical or payer decisions or execute restricted actions by itself.</p><div class="launchpad-knowledge"><h3>${esc(k.available?k.name:'Knowledge unavailable')}</h3><span class="small">${esc(k.status)}</span><p>${esc(k.summary)}</p>${k.kind==='upload'?`<p class="sandbox-label">${esc(k.boundary)}</p>`:''}${details(k)}</div>`:'<p>Your operational case history is preserved. Continue with the same knowledge, or open View context for a refresher.</p>'}${prompts.length?`<h3 class="prompt-heading">A useful place to start</h3><div class="launchpad-prompts">${prompts.map(t=>`<button data-agent-suggestion="${esc(t)}" ${sending?'disabled':''}>${esc(t)}<span aria-hidden="true">↗</span></button>`).join('')}</div>`:'<a class="primary choose-new-knowledge" href="#knowledge">Choose new knowledge</a>'}</section>`;
}

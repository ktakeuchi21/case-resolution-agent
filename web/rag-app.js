import { createPageAnalytics } from './analytics.js';
import { analyticsWebsiteId } from './analytics-config.js';
import { ActivityRun, activityTimeoutMs, readRagStream } from './rag-activity.js';

const $ = selector => document.querySelector(selector);
const analytics = createPageAnalytics({ websiteId: analyticsWebsiteId });
const state = { catalog: null, conversation: null, session: null, busy: false, connecting: false, error: '', draft: '', selectedPack: 'alder', route: 'home', epoch: 0 };
const evidencePanels = new Map();
const activityPanels = new Map();
let activityRun = null, activityTimer = null;
const compactViewport = matchMedia('(max-width: 1023px)');
let contextOpen = false;
const pack = id => state.catalog.packs.find(p => p.id === id);
const active = () => pack(state.conversation?.packId || state.selectedPack);
const initials = name => name.split(' ').map(n => n[0]).slice(0,2).join('');
const time = value => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'value') node.value = value;
    else if (key === 'disabled' || key === 'hidden') node[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const p = (text, cls = '') => el('p', { class: cls }, text);
const button = (text, action, cls = 'button', attrs = {}) => el('button', { type: 'button', class: cls, onclick: () => Promise.resolve(action()).catch(() => toast('That change could not be saved. Please try again.')), ...attrs }, text);
const link = (text, href, cls = '') => el('a', { href, class: cls, onclick: e => { if (state.busy || state.connecting) { e.preventDefault(); toast('Please wait for the current request to finish.'); } } }, text);
const badge = text => el('span', { class: 'badge' }, text);
const disclosure = (label, key, children, cls = '') => el('details', { class: cls, 'data-disclosure': key }, el('summary', {}, label), ...children);
function toast(text) { const n = $('#notice'); n.textContent = text; n.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { n.hidden = true; }, 4500); }
function announce(text) { $('#announcement').textContent = text; }
function go(hash) { if (location.hash === hash) void route(); else location.hash = hash; }
function focusComposer() { if (!contextOpen) $('#question')?.focus({ preventScroll: true }); }
function lastMessage() { const node = [...document.querySelectorAll('.turn')].at(-1); (node?.querySelector('.agent-message') || node)?.scrollIntoView({ block: 'start', behavior: 'instant' }); }
async function api(path, input, onStage, signal) {
  const response = await fetch('/api/rag/' + path, { method: input ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: input ? { 'Content-Type': 'application/json', 'X-CSRF-Token': state.session?.csrf || '', ...(onStage ? { Accept: 'application/x-ndjson' } : {}) } : {},
    ...(input ? { body: JSON.stringify(input) } : {}), signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000) });
  if (!response.ok) { const error = new Error('Request failed'); error.status = response.status; throw error; }
  if (onStage && response.headers.get('content-type')?.includes('application/x-ndjson')) {
    return readRagStream(response.body,onStage);
  }
  return response.json();
}
function header() {
  return el('header', { class: 'header' }, link('pathway', '#home', 'brand'),
    el('nav', { 'aria-label': 'Main navigation' }, link('Scenarios', '#home'), link('Knowledge', '#knowledge'), link('Evaluation', '#evaluation')));
}
function footer() {
  return el('footer', { class: 'footer' }, p('A synthetic portfolio demonstration. All people, cases and sources are fictional. No messages are sent.'),
    disclosure('Privacy & session', 'privacy', [p('Conversations are isolated to this browser session and expire after four hours. Please use only the supplied synthetic cases.'),
      p('Optional visitor analytics count pages, never conversation text, documents or case details. Browser privacy preferences are respected.'),
      button(analytics.excluded() ? 'Analytics excluded in this browser' : 'Exclude this browser from analytics', () => toast(analytics.exclude() ? 'This browser is excluded from analytics.' : 'Enable Do Not Track in your browser to opt out.'))]));
}
function home() {
  let resume=state.conversation?.id;try{resume ||= sessionStorage.getItem('pathway.rag.last');}catch{}
  const titles = { alder: 'A missing note.\nA clear next step.', access: 'An access roadblock.\nA useful briefing.', fulfillment: 'A status question.\nA reassuring reply.' };
  return el('main', { id: 'main', tabindex: '-1', class: 'page home' },
    el('section', { class: 'hero' }, p('A KNOWLEDGE-GROUNDED SUPPORT WORKER', 'eyebrow'), el('h1', {}, 'Support that knows', el('br'), el('em', {}, 'its sources.')),
      p('Pathway answers administrative questions and prepares next steps using only the knowledge selected for your conversation.', 'lede'),
      el('div', { class: 'hero-note' }, el('span', { class: 'signal', 'aria-hidden': 'true' }), 'Three synthetic scenarios. Real retrieval. Useful conversations.'),
      /^[0-9a-f-]{36}$/.test(resume||'') ? link('Resume your conversation →','#conversation/'+resume,'button secondary resume') : null),
    el('section', { 'aria-labelledby': 'scenarios-heading' }, el('div', { class: 'section-line' }, el('h2', { id: 'scenarios-heading' }, 'Choose a seat at the table.'), p('Start with a question. The knowledge is ready.', 'muted')),
      el('div', { class: 'scenario-grid' }, state.catalog.packs.map((item, i) => el('article', { class: 'scenario-card ' + (i === 0 ? 'recommended' : '') },
        el('div', { class: 'card-top' }, el('span', { class: 'scenario-number' }, '0' + (i+1)), i === 0 ? badge('Recommended first') : p(item.defaultChannel === 'email' ? 'Email + chat' : 'Chat + email', 'small muted')),
        p(item.scenario, 'eyebrow'), el('h3', { class: 'card-title' }, titles[item.id]), p(item.description, 'muted'),
        el('div', { class: 'persona' }, el('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(item.user.name)), el('div', {}, el('strong', {}, item.user.name), p(item.user.role, 'small muted'))),
        link('Try this scenario ↗', '#scenario/' + item.id, 'button ' + (i === 0 ? 'primary' : 'secondary')))))),
    el('div', { class: 'proof-strip' }, p('ASK NATURALLY', 'eyebrow'), p('Follow the conversation.'), p('Inspect the exact passages.'), link('Explore the Knowledge Packs →', '#knowledge')), footer());
}
function orientation(item) {
  return el('section', { class: 'orientation' }, p('YOUR SCENARIO IS READY', 'eyebrow'),
    el('h2', {}, 'Welcome, ' + item.user.name.split(' ')[0] + '.'), p(item.description),
    el('div', { class: 'prompt-grid', 'aria-label': 'Example questions' }, item.prompts.map(text => button(text + ' ↗', () => send(text), 'prompt', { disabled: state.connecting || state.busy || !state.conversation?.id }))),
    p('Administrative support only. No clinical, payer or delivery decisions. Drafts are never sent.', 'small muted'));
}
function icon(name) {
  const paths = {
    copy: ['M9 9h11v11H9z', 'M5 15H3V3h12v2'],
    regenerate: ['M20 7v5h-5', 'M20 12a8 8 0 1 0-2.3 5.7'],
    helpful: ['M7 10H3v11h4z', 'M7 10l5-8c3 0 2 5 1 7h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7'],
    notHelpful: ['M7 14H3V3h4z', 'M7 14l5 8c3 0 2-5 1-7h6a2 2 0 0 0 2-2l-2-8a2 2 0 0 0-2-2H7'],
    refine: ['M14 4l6 6', 'M3 21l4-1L21 6a2 2 0 0 0-4-4L3 16z'],
    more: ['M5 11v2', 'M12 11v2', 'M19 11v2'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    context: ['M3 4h18v16H3z', 'M9 4v16'],
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key,value);
  for (const d of paths[name]) { const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path); }
  return svg;
}
function iconButton(name, label, action, attrs={}) {
  return button(icon(name), action, 'button icon-button', {'aria-label':label,title:label,...attrs});
}
function openContext() {
  if (!compactViewport.matches) return;
  document.querySelectorAll('.answer-menu:popover-open').forEach(menu=>menu.hidePopover());
  contextOpen=true; $('#context-toggle')?.setAttribute('aria-expanded','true'); $('#context-drawer')?.showModal();
}
function closeContext() {
  contextOpen=false; $('#context-drawer')?.close(); $('#context-toggle')?.setAttribute('aria-expanded','false');
  (compactViewport.matches ? $('#context-toggle') : $('#main'))?.focus({preventScroll:true});
}
function inspectKnowledge(item) { closeContext(); state.selectedPack=item.id; go('#knowledge'); }
function contextContents(item) {
  const docs=state.catalog.documents.filter(d=>d.packId===item.id);
  const eligible=docs.filter(d=>d.status==='current'&&(!d.caseId||d.caseId===item.caseId));
  return [
    el('section', {class:'context-section'}, el('h2', {}, 'Your role'), p(item.user.name,'context-name'), p(item.user.role,'context-role'), p(item.description,'small muted')),
    el('section', {class:'context-section'}, el('h2', {}, 'Case snapshot'), p('SYNTHETIC CASE · '+item.caseId,'eyebrow'), p(item.caseSummary,'small'), p('Recorded scenario · Not updated by chat','snapshot-note')),
    el('section', {class:'context-section context-blocker'}, el('h2', {}, 'Where things are stuck'), p(item.blocker,'small')),
    el('section', {class:'context-section'}, el('h2', {}, 'Available knowledge'), p(item.shortName,'context-name'), p('Version '+item.version+' · '+eligible.length+' applicable documents','small muted'),
      el('ul', {class:'context-coverage'}, item.covers.map(text=>el('li',{},text))),
      button('Inspect knowledge ↗',()=>inspectKnowledge(item),'button knowledge-link',{disabled:state.busy||state.connecting})),
    el('div',{class:'context-tools'},
      button('New conversation',()=>{closeContext();go('#scenario/'+item.id);},'button secondary',{disabled:state.busy||state.connecting}),
      link('Change scenario','#home','button'),
      button('Change knowledge',()=>inspectKnowledge(item),'button',{disabled:state.busy||state.connecting}))
  ];
}
function contextDrawer(item) {
  return el('dialog',{id:'context-drawer',class:'context-drawer','aria-labelledby':'context-heading',
    onkeydown:e=>{
      if(e.key!=='Tab')return;
      const controls=[...e.currentTarget.querySelectorAll('button:not(:disabled),a[href]')].filter(n=>n.checkVisibility());
      const target=e.shiftKey&&document.activeElement===controls[0]?controls.at(-1):!e.shiftKey&&document.activeElement===controls.at(-1)?controls[0]:null;
      if(target){e.preventDefault();target.focus();}
    },
    oncancel:e=>{e.preventDefault();closeContext();},onclick:e=>{if(e.target===e.currentTarget)closeContext();}},
    el('div',{class:'drawer-heading'},el('h2',{id:'context-heading'},'Case context'),iconButton('close','Close case context',closeContext,{id:'context-close',autofocus:true})),
    el('div',{class:'drawer-content'},contextContents(item)));
}
function emailFields(from, to, subject, stamp) {
  return el('div', { class: 'email-fields' }, el('dl', {},
    el('dt', {}, 'From'), el('dd', {}, from), el('dt', {}, 'To'), el('dd', {}, to), el('dt', {}, 'Subject'), el('dd', { class: 'email-subject' }, subject)),
    el('time', { datetime: stamp, class: 'small muted' }, time(stamp)));
}
function toggleEvidence(turnId, panel) {
  evidencePanels.set(turnId,evidencePanels.get(turnId)===panel?null:panel);render();
}
function closeAnswerMenu(turnId) {
  const menu=document.getElementById('answer-menu-'+turnId);
  if(menu?.matches(':popover-open')){menu.hidePopover();document.getElementById('more-'+turnId)?.focus({preventScroll:true});}
}
function positionAnswerMenu(menu, turnId) {
  const trigger=document.getElementById('more-'+turnId), open=menu.matches(':popover-open');
  trigger?.setAttribute('aria-expanded',String(open));
  if(!open||!trigger)return;
  const anchor=trigger.getBoundingClientRect(),box=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(anchor.right-box.width,innerWidth-box.width-8))+'px';
  menu.style.top=Math.max(8,Math.min(anchor.top-box.height-8,innerHeight-box.height-8))+'px';
}
function answerTools(turn) {
  const trace=turn.trace, ids=turn.response.citations, work=turn.response.workProduct;
  const chosen=ids.map(id=>trace?.passages.find(source=>source.id===id)).filter(Boolean);
  const selected=evidencePanels.get(turn.id);
  const inactive=state.busy||turn.packId!==state.conversation.packId;
  const refinable=!inactive&&turn.id===state.conversation.turns.filter(t=>t.packId===turn.packId&&t.response?.workProduct).at(-1)?.id;
  const action=(fn)=>()=>{closeAnswerMenu(turn.id);return fn();};
  const extraActions=(menu=false)=>[
    [ 'regenerate','Regenerate',()=>send(turn.question),{disabled:inactive,title:turn.packId!==state.conversation.packId?'Return to this Knowledge Pack to regenerate.':'Generate another answer to this question'} ],
    ...(work?[['refine','Refine draft',()=>{state.draft='Make it warmer and shorter.';render();focusComposer();},{disabled:!refinable}]]:[]),
    ...[['helpful','Helpful','helpful'],['notHelpful','Not helpful','not_helpful']].map(([name,label,value])=>[name,label,()=>feedback(turn,value),{'aria-pressed':String(turn.feedback===value),'data-feedback-turn':turn.id,'data-feedback':value,disabled:state.busy}])
  ].map(([name,label,fn,attrs])=>menu?button([icon(name),label],action(fn),'button',attrs):iconButton(name,label,action(fn),attrs));
  return el('div',{class:'answer-tools'},
    el('div',{class:'answer-actions',role:'group','aria-label':'Answer actions'},
      button('Sources · '+chosen.length,()=>toggleEvidence(turn.id,'sources'),'button evidence-toggle',{id:'sources-toggle-'+turn.id,'aria-expanded':String(selected==='sources'),'aria-controls':'sources-'+turn.id,'aria-label':'Sources used · '+chosen.length}),
      trace?button('Grounding',()=>toggleEvidence(turn.id,'grounding'),'button evidence-toggle',{id:'grounding-toggle-'+turn.id,'aria-expanded':String(selected==='grounding'),'aria-controls':'grounding-'+turn.id,'aria-label':'How this answer was grounded'}):null,
      iconButton('copy',work?'Copy draft':'Copy',()=>copy(work?.body||turn.response.answer)),
      el('div',{class:'answer-extra'},extraActions()),
      el('div',{class:'answer-more'},
        iconButton('more','More answer actions',()=>{},{id:'more-'+turn.id,popovertarget:'answer-menu-'+turn.id,'aria-expanded':'false','aria-controls':'answer-menu-'+turn.id}),
        el('div',{id:'answer-menu-'+turn.id,class:'answer-menu',popover:'auto','aria-label':'Additional answer actions',ontoggle:e=>positionAnswerMenu(e.currentTarget,turn.id)},extraActions(true)))),
    el('section',{id:'sources-'+turn.id,class:'evidence evidence-panel source-disclosure',hidden:selected!=='sources','aria-label':'Sources used'},
      p('Supporting passages for this answer · '+(trace?.packName||pack(turn.packId).name),'small muted'),
      ...chosen.map((source,index)=>el('article',{class:'source'},p('['+(index+1)+'] '+source.title,'source-title'),p(source.section+' · Version '+source.version,'small muted'),el('blockquote',{},source.text),p(source.reason,'small muted'))),
      !chosen.length?p('This reply cites no source passage. It should not be treated as a new case fact.','small muted'):null),
    trace?el('section',{id:'grounding-'+turn.id,class:'evidence evidence-panel grounding',hidden:selected!=='grounding','aria-label':'How this answer was grounded'},
      el('dl',{class:'trace-fields'},el('dt',{},'Your question'),el('dd',{},trace.question),el('dt',{},'Question with conversation context'),el('dd',{},trace.query),el('dt',{},'Available knowledge'),el('dd',{},trace.packName+' · '+trace.caseId)),
      p('Only current sources for this pack and case were searched. Earlier conversation helps resolve references; it is not source evidence.','small muted'),
      ...trace.passages.map(source=>disclosure('Rank '+source.rank+' · '+source.title,turn.id+'-rank-'+source.rank,[p(source.section,'small'),el('blockquote',{},source.text),p(source.reason,'small muted'),p('Included in generation: '+(source.includedInGeneration?'Yes':'No')+' · '+(ids.includes(source.id)?'Cited as ['+(ids.indexOf(source.id)+1)+']':'Not cited'),'small')],'retrieved-source'))):null);
}
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied to clipboard.'); } catch { toast('Clipboard is unavailable. You can select and copy the text.'); } }
async function feedback(turn, value) {
  await api('feedback', { conversationId: state.conversation.id, turnId: turn.id, value }); turn.feedback = value;
  document.querySelectorAll(`[data-feedback-turn="${turn.id}"]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.feedback === value)));
  toast('Feedback saved. Thank you.');
}
function workProduct(turn, item) {
  const work = turn.response.workProduct;
  return el('article', { class: 'work-product', 'aria-label': work.type === 'email' ? 'Generated email draft' : 'Generated case briefing' },
    el('div', { class: 'draft-heading' }, badge(work.type === 'email' ? 'Email draft' : 'Case briefing'), el('span', { class: 'small muted' }, 'Generated · Not sent')),
    emailFields(item.user.name + ' <' + item.user.email + '>', work.type === 'email' ? item.recipient.name + ' <' + item.recipient.email + '>' : 'Your review notes', work.subject, turn.createdAt),
    el('div', { class: 'prose email-body' }, work.body));
}
const activityKey = turn => turn.id+'-'+turn.attempt;
const activitySeconds = milliseconds => Math.max(0,Math.floor(milliseconds/1000))+'s';
function activityLabel(turn) {
  return turn.status==='pending'&&state.busy ? turn.activity.events.at(-1)?.message || 'Connecting to Pathway…' : 'Activity';
}
function activityHistory(turn) {
  const events=turn.activity.events;
  return [events.length ? el('ol',{},...events.map(event=>el('li',{},p(event.message),el('span',{class:'small muted'},activitySeconds(event.elapsedMs))))) : p('Waiting for Pathway to begin.','small muted'),
    events.some(event=>event.stage==='retrieved') ? p('Retrieved documents inform preparation. The final cited sources appear under Sources.','small muted') : null];
}
function activityView(turn) {
  if (!turn.activity) return null;
  const key=activityKey(turn),pending=turn.status==='pending'&&state.busy;
  if(!activityPanels.has(key))activityPanels.set(key,pending);
  return el('details',{class:'activity-panel'+(pending?' is-working':''),'data-activity':key,open:activityPanels.get(key),ontoggle:event=>{if(event.currentTarget.isConnected)activityPanels.set(key,event.currentTarget.open);}},
    el('summary',{id:'activity-'+key},el('span',{class:'activity-dot','aria-hidden':'true'}),el('span',{class:'activity-label'},activityLabel(turn)),
      el('span',{class:'activity-elapsed'},'· '+activitySeconds(activityRun?.turn===turn?activityRun.elapsed():turn.activity.elapsedMs))),
    el('div',{class:'activity-history'},activityHistory(turn)));
}
function updateActivity(run,event) {
  if(activityRun!==run)return;
  const panel=document.querySelector(`[data-activity="${activityKey(run.turn)}"]`);
  if(panel){
    panel.querySelector('.activity-elapsed').textContent='· '+activitySeconds(run.elapsed());
    if(event){panel.querySelector('.activity-label').textContent=activityLabel(run.turn);panel.querySelector('.activity-history').replaceChildren(...activityHistory(run.turn).filter(Boolean));}
  }
  if(event)announce(event.message);
}
function stopActivity() {
  clearInterval(activityTimer);activityTimer=null;activityRun?.stop();activityRun=null;
}
function watchActivity(convo,turn) {
  stopActivity();state.busy=true;
  const run=new ActivityRun(turn,{
    read:async signal=>(await api('conversation?id='+encodeURIComponent(convo.id),undefined,undefined,signal)).turns.find(t=>t.id===turn.id),
    update:event=>updateActivity(run,event),
    finish:()=>{
      if(activityRun!==run)return;
      clearInterval(activityTimer);activityTimer=null;activityPanels.set(activityKey(turn),false);state.busy=false;
      render();
      announce(turn.status==='complete'?'Pathway’s answer is ready. Sources used: '+turn.response.citations.length+'.':'The answer could not be completed. Your message is saved. Retry is available.');
    }
  });
  activityRun=run;activityTimer=setInterval(()=>void run.tick(),1000);return run;
}
function resumeActivity(convo) {
  const pending=convo.turns.find(t=>t.status==='pending'&&t.activity&&Date.now()-Date.parse(t.activity.startedAt)<activityTimeoutMs);
  if(pending&&(!activityRun||activityRun.stopped))watchActivity(convo,pending);
}
function turnView(turn) {
  const item = pack(turn.packId), email = state.conversation.channel === 'email';
  const question = el('div', { class: 'user-message ' + (email ? 'email-message' : '') },
    email ? emailFields(item.user.name, 'Pathway · ' + item.agentRole, 'Re: ' + item.caseId + ' support', turn.createdAt) : p(item.user.name, 'message-author'),
    el('div', { class: 'prose' }, turn.question));
  const reply = el('div', { class: 'agent-message' }, el('div', { class: 'message-heading' }, el('span', { class: 'pathway-avatar', 'aria-hidden': 'true' }, 'p'),
    el('strong', {}, 'Pathway'), p(item.shortName, 'small muted')));
  const activity=activityView(turn);if(activity)reply.append(activity);
  if (turn.status === 'complete' && turn.response) {
    if (email && !turn.response.workProduct) reply.append(emailFields('Pathway · ' + item.agentRole, item.user.name, 'Re: ' + item.caseId + ' support', turn.createdAt));
    reply.append(turn.response.workProduct ? p('Your draft is ready to review.', 'draft-intro') : el('div', { class: 'prose answer-text' }, turn.response.answer));
    if (turn.response.workProduct) reply.append(workProduct(turn, item));
    reply.append(answerTools(turn));
  } else if (turn.status === 'pending' && state.busy) { if(!activity)reply.append(p('Waiting for Pathway…','progress')); }
  else reply.append(el('div', { class: 'recovery', role: 'alert' }, p('I couldn’t complete that answer. Your message is saved.'),
    button('Retry', () => send(turn.question,turn.id,true), 'button secondary', { disabled: state.busy || turn.packId !== state.conversation.packId }),
    turn.packId !== state.conversation.packId ? p('Return to this answer’s Knowledge Pack to retry.', 'small muted') : null));
  return el('section', { class: 'turn', 'data-turn': turn.id, 'data-pack': turn.packId }, question, reply);
}
function conversation() {
  const item = active(), convo = state.conversation, complete = convo?.turns.filter(t=>t.status==='complete').at(-1);
  return el('main', { id: 'main', tabindex: '-1', class: 'conversation' },
    el('aside',{class:'context-sidebar','aria-label':'Case context'},contextContents(item)),
    el('section',{class:'conversation-panel','aria-label':item.agentRole+' conversation'},
    el('header', { class: 'conversation-bar' },
      el('div',{class:'conversation-identity'},el('h1',{},item.agentRole),
        button([icon('context'),'Case context'],openContext,'button context-toggle',{id:'context-toggle','aria-haspopup':'dialog','aria-expanded':String(contextOpen),'aria-controls':'context-drawer'})),
      el('div', { class: 'channel-switch', 'aria-label': 'Conversation format' }, ...['chat','email'].map(channel => button(channel === 'chat' ? 'Chat' : 'Email', () => configure({ channel }), 'button', { disabled: state.connecting || state.busy, 'aria-pressed': String((convo?.channel || item.defaultChannel) === channel) })))),
    el('div', { class: 'thread-scroll' }, el('div', { class: 'thread-content' },
      state.error ? el('div', { class: 'recovery', role: 'alert' }, p(state.error), button('Retry connection', () => connect(item.id, state.conversation?.id || (location.hash.startsWith('#conversation/') ? location.hash.split('/')[1] : null)))) : null,
      !convo?.turns.length ? orientation(item) : null,
      ...(convo?.turns || []).map(turnView),
      complete && complete.packId === item.id && !state.busy ? el('div', { class: 'followups', 'aria-label': 'Suggested follow-up questions' }, ...(complete.response.workProduct ? ['Make it warmer and shorter.', 'Where did you get that?'] : ['What remains unknown?', item.prompts.find(text=>/^(Draft|Summarize)/.test(text))]).filter(Boolean).map(text => button(text + ' ↗', () => send(text), 'followup'))) : null)),
    el('div', { class: 'composer-wrap' }, el('form', { class: 'composer', onsubmit: e => { e.preventDefault(); void send(state.draft); } },
      el('label', { for: 'question' }, (convo?.channel || item.defaultChannel) === 'email' ? 'Reply or ask Pathway to refine a draft' : 'Ask Pathway'),
      el('div', { class: 'composer-input' }, el('textarea', { id: 'question', name: 'question', rows: '2', maxlength: '2500', placeholder: 'Ask about this case…', value: state.draft,
        oninput: e => { state.draft = e.target.value; $('#send').disabled = !state.draft.trim() || state.busy || state.connecting || !state.conversation?.id; },
        onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(state.draft); } } }),
        el('button', { id: 'send', type: 'submit', class: 'send', disabled: !state.draft.trim() || state.busy || state.connecting || !convo?.id, 'aria-label': 'Send message to Pathway' }, state.busy ? '…' : '↑')),
      el('div', { class: 'composer-caption' }, p(state.connecting ? 'Connecting to your private demo session…' : state.busy ? 'Pathway is preparing an answer…' : 'Synthetic case · Drafts are never sent', 'small muted'), p('Enter to send · Shift + Enter for a new line', 'small muted keyboard-hint'))))), contextDrawer(item));
}
function knowledge() {
  const item = pack(state.selectedPack), docs = state.catalog.documents.filter(d=>d.packId===item.id);
  const applicable = docs.filter(d=>d.status==='current'&&(!d.caseId||d.caseId===item.caseId));
  return el('main', { id: 'main', tabindex: '-1', class: 'page knowledge-page' },
    state.conversation?.id ? link('← Return to conversation', '#conversation/' + state.conversation.id, 'back-link') : link('← Scenarios', '#home', 'back-link'),
    p('AVAILABLE KNOWLEDGE', 'eyebrow'), el('h1', {}, 'Know what Pathway knows.'), p('Case records, practical checklists and communication examples. Every answer starts with the Knowledge Pack you select.', 'lede'),
    el('div', { class: 'pack-choices', 'aria-label': 'Knowledge Packs' }, state.catalog.packs.map(item => button(item.shortName, () => { state.selectedPack=item.id; render(); }, 'button secondary', { 'aria-pressed': String(item.id===state.selectedPack) }))),
    el('section', { class: 'pack-summary' }, el('div', {}, badge('Curated synthetic knowledge'), el('h2', {}, item.name), p(item.agentRole + ' · Case ' + item.caseId), p(item.covers.join(' · '), 'muted'),
      p('Version ' + item.version + ' · ' + docs.length + ' sources · ' + applicable.length + ' current and applicable', 'small')), button('Use this Knowledge Pack', async () => { if(state.conversation?.id) await configure({packId:item.id},true); else go('#scenario/' + item.id); }, 'button primary')),
    p('Only current, applicable sources can support new answers. Process guides and examples describe fictional procedures; they do not add events to the recorded case. Archived and other-case documents remain visible for inspection.', 'muted'),
    el('div', { class: 'knowledge-documents' }, docs.map(doc => {
      const eligible = doc.status === 'current' && (!doc.caseId || doc.caseId === item.caseId);
      return disclosure(doc.title, 'doc-' + item.id + doc.id, [p(doc.type + ' · Version ' + doc.version + ' · ' + (eligible ? 'Current · Used for this case' : doc.status === 'superseded' ? 'Superseded · Excluded from answers' : 'Different case · Excluded from answers'), 'small source-status'),
        ...doc.sections.map(([section,text]) => el('section', { class: 'source-section' }, el('h3', {}, section), el('blockquote', {}, text)))], 'knowledge-document ' + (eligible ? '' : 'excluded'));
    })),
    el('section', { class: 'sample-questions' }, el('h2', {}, 'Questions this pack can help with'), el('ul', {}, item.prompts.map(text=>el('li',{},text)))), footer());
}
function evaluation() {
  return el('main', { id: 'main', tabindex: '-1', class: 'page evaluation-page' }, link('← Scenarios','#home','back-link'), p('MEASURED, THEN REVIEWED','eyebrow'),
    el('h1', {}, 'A small demo.\nEvidence you can inspect.'), p('Frozen questions, actual model responses, and explicit limits on what the results prove.', 'lede'),
    p('The retained results below cover Knowledge Pack version 1.0. Version 1.1 adds detailed process guides and examples; its retrieval and conversation checks are recorded separately.', 'muted'),
    el('div', { class: 'metric-grid' }, ...[['36 / 36','Live turns completed'],['98.6%','Expected-passage recall'],['115 / 115','Citations found in retrieval'],['6 / 6','Knowledge-switch checks']].map(([value,label])=>el('div',{class:'metric'},el('strong',{},value),p(label)))),
    el('h2',{},'What the conversations demonstrated'), el('ul',{class:'evaluation-list'},
      el('li',{},'Three 12-turn conversations cover direct questions, “Why?”, evidence requests, deadlines, email drafts, refinements and unsupported questions.'),
      el('li',{},'All 36 turns used the correct pack and exact stored passages. Seven drafting and summary requests returned separate work products.'),
      el('li',{},'All three shorter rewrites were materially shorter: 53%, 51% and 48%. Three unsupported amount or tracking questions identified the gap without inventing a value.'),
      el('li',{},'Switching from Alder to fulfillment and back changed the evidence while preserving earlier answer and source snapshots.')),
    el('h2',{},'Quality is more than valid citations'), p('Assistant review rated 34 of the 36 original answers as meeting their complete review criteria. One clinical refusal omitted a referral; one shipment answer called a missing consent signature a missing form. Four targeted checks passed after those wording instructions were clarified.'),
    p('Source membership is checked automatically. Whether each passage fully supports every phrase requires judgment. Drafts still need review: a formal rewrite offered a future follow-up, and tone can be restrained. These synthetic results are not an independent healthcare or production validation.', 'muted'),
    el('div',{class:'evaluation-detail'}, el('div',{},el('h2',{},'Model & measured cost'),p('GPT-5 mini · Low reasoning'),p('text-embedding-3-small · 1,536 dimensions'),p('Complete 36-turn run: $0.05972 estimated'),p('Median answer: 6.9 seconds · Slowest: 14.3 seconds'),p('109,241 input tokens · 21,888 cached · 18,630 output', 'small muted')),
      el('div',{},el('h2',{},'How retrieval works'),p('PostgreSQL stores section-sized passages and their vectors. The question and recent context rank current sources within the selected pack and case. The answer’s validated source IDs attach the exact stored text.'),p('Usually one generation call follows retrieval. A malformed response can use one repair with the same evidence. Seven repairs were needed in the complete run; none in the later six-turn source-list check.', 'small muted'))),
    link('Read the retained evaluation & limitations ↗', 'https://github.com/ktakeuchi21/case-resolution-agent/blob/main/docs/rebuild/conversation-review-2026-09-12.md','button secondary'),
    link('Read Knowledge Pack 1.1 verification ↗', 'https://github.com/ktakeuchi21/case-resolution-agent/blob/main/docs/knowledge-packs.md','button secondary'), footer());
}
function render() {
  if (!state.catalog) return;
  const open = new Set([...document.querySelectorAll('details[open]')].map(d=>d.dataset.disclosure));
  const focused = document.activeElement?.id, selection = focused === 'question' ? [$('#question').selectionStart,$('#question').selectionEnd] : null;
  const oldScroll = $('.thread-scroll')?.scrollTop;
  const contextScroll = $('.context-sidebar')?.scrollTop, drawerScroll = $('.drawer-content')?.scrollTop;
  if (state.route!=='conversation' || !compactViewport.matches) contextOpen=false;
  $('#app').replaceChildren(header(), state.route === 'conversation' ? conversation() : state.route === 'knowledge' ? knowledge() : state.route === 'evaluation' ? evaluation() : home());
  document.body.classList.toggle('in-conversation',state.route==='conversation');
  document.querySelectorAll('details[data-disclosure]').forEach(d=>{ if(open.has(d.dataset.disclosure)) d.open=true; });
  if(oldScroll !== undefined && $('.thread-scroll')) $('.thread-scroll').scrollTop=oldScroll;
  if(contextScroll!==undefined&&$('.context-sidebar'))$('.context-sidebar').scrollTop=contextScroll;
  if(contextOpen){$('#context-drawer').showModal();if(drawerScroll!==undefined)$('.drawer-content').scrollTop=drawerScroll;}
  if(focused && document.getElementById(focused)) { document.getElementById(focused).focus({preventScroll:true}); if(selection) $('#question').setSelectionRange(...selection); }
  document.title = state.route==='conversation' ? active().agentRole+' · Pathway' : 'Pathway · Support grounded in knowledge';
  analytics.view(state.route === 'conversation' ? 'agent' : state.route);
}
async function connect(scenarioId, conversationId) {
  stopActivity();state.busy=false;
  const epoch = ++state.epoch; state.connecting = true; state.error = ''; render(); if(!conversationId && $('.thread-scroll')) $('.thread-scroll').scrollTop=0;
  try {
    state.session = await api('session');
    const convo = conversationId ? await api('conversation?id='+encodeURIComponent(conversationId)) : await api('start',{scenarioId});
    if(epoch!==state.epoch) return;
    state.conversation=convo; state.selectedPack=convo.packId;
    resumeActivity(convo);
    history.replaceState(null,'','#conversation/'+convo.id); try { sessionStorage.setItem('pathway.rag.last',convo.id); } catch { /* Server history is sufficient when local storage is unavailable. */ }
  } catch (error) { if(epoch!==state.epoch)return; state.error = error.status===404 && conversationId ? 'This conversation has expired or belongs to another browser session. Choose a scenario to start again.' : 'The demo could not connect. Please retry; the free service may take a moment to wake up.'; }
  finally { if(epoch===state.epoch) {state.connecting=false;render();focusComposer();if(state.conversation?.turns.length)lastMessage();else if($('.thread-scroll'))$('.thread-scroll').scrollTop=0;} }
}
async function route() {
  // Browser back/forward can navigate even while ordinary navigation links are disabled.
  if(activityRun&&!activityRun.stopped&&location.hash!=='#conversation/'+state.conversation?.id){stopActivity();state.busy=false;}
  const [name,id] = location.hash.replace(/^#/,'').split('/');
  state.error='';
  if(name==='scenario' && pack(id)) { state.route='conversation';state.selectedPack=id;state.conversation=null;state.draft='';await connect(id); }
  else if(name==='conversation' && /^[0-9a-f-]{36}$/.test(id||'')) { state.route='conversation'; if(state.conversation?.id===id){resumeActivity(state.conversation);render();focusComposer();} else await connect(null,id); }
  else { state.epoch++; state.connecting=false;state.route=['knowledge','evaluation'].includes(name)?name:'home';render();$('#main')?.focus({preventScroll:true});window.scrollTo(0,0); }
}
async function configure(changes, returnToConversation=false) {
  if(state.busy||state.connecting||!state.conversation?.id)return;
  state.busy=true;render();
  try { state.conversation=await api('configure',{conversationId:state.conversation.id,...changes});state.selectedPack=state.conversation.packId; }
  catch { toast('The conversation could not be changed. Please try again.'); }
  finally {state.busy=false; if(returnToConversation)go('#conversation/'+state.conversation.id);else render(); focusComposer();}
  if(changes.packId) toast('Knowledge changed. Earlier answers retain their original sources.');
}
async function send(text, requestId = crypto.randomUUID(), retry = false) {
  text = text.trim(); if(!text||text.length>2500||state.busy||state.connecting||!state.conversation?.id)return;
  const convo=state.conversation, existing=convo.turns.find(t=>t.id===requestId);
  const turn=existing||{id:requestId,question:text,packId:convo.packId,createdAt:new Date().toISOString(),response:null,trace:null,feedback:null};
  turn.recordedAttempt=turn.recordedAttempt??turn.attempt??0;
  turn.status='pending';turn.attempt=turn.recordedAttempt+1;delete turn.activity;activityPanels.delete(activityKey(turn));
  if(!existing)convo.turns.push(turn);
  const run=watchActivity(convo,turn);
  state.draft='';render();lastMessage();focusComposer();announce('Pathway is preparing your answer.');
  try {
    const result=await api('send',{conversationId:convo.id,requestId,text,retry},event=>run.stage(event),run.controller.signal);
    run.snapshot(result);
    if(!run.stopped)run.fail();
  } catch {
    // A completed turn may already have been saved before a transport interruption.
    if(!run.stopped){try{run.snapshot(await run.read(run.controller.signal));}catch{} if(!run.stopped)run.fail();}
  }
}
$('.skip').addEventListener('click',event=>{event.preventDefault();$('#main')?.focus();});
window.addEventListener('hashchange',()=>void route());
compactViewport.addEventListener('change',()=>{if(contextOpen&&!compactViewport.matches)closeContext();});
window.addEventListener('resize',()=>document.querySelectorAll('.answer-menu:popover-open').forEach(menu=>menu.hidePopover()));
window.addEventListener('pagehide',()=>{analytics.pause();stopActivity();});
window.addEventListener('pageshow',e=>{if(e.persisted){analytics.resume();if(state.route==='conversation')void connect(null,state.conversation?.id);}});
try {
  const response=await fetch('/rag-catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error('Catalog unavailable');state.catalog=await response.json();await route();
  void fetch('/healthz',{cache:'no-store',signal:AbortSignal.timeout(90000)}).catch(()=>{});
} catch {
  $('#app').replaceChildren(el('main',{id:'main',class:'page'},el('h1',{},'Pathway is taking a moment.'),p('The scenarios could not load. Please try again.'),button('Reload',()=>location.reload(),'button primary')));
}

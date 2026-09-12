import { createPageAnalytics } from './analytics.js';
import { analyticsWebsiteId } from './analytics-config.js';

const $ = selector => document.querySelector(selector);
const analytics = createPageAnalytics({ websiteId: analyticsWebsiteId });
const state = { catalog: null, conversation: null, session: null, busy: false, connecting: false, error: '', draft: '', selectedPack: 'alder', route: 'home', epoch: 0 };
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
function focusComposer() { $('#question')?.focus({ preventScroll: true }); }
function lastMessage() { const node = [...document.querySelectorAll('.turn')].at(-1); (node?.querySelector('.agent-message') || node)?.scrollIntoView({ block: 'start', behavior: 'instant' }); }
async function api(path, input, onStage) {
  const response = await fetch('/api/rag/' + path, { method: input ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: input ? { 'Content-Type': 'application/json', 'X-CSRF-Token': state.session?.csrf || '', ...(onStage ? { Accept: 'application/x-ndjson' } : {}) } : {},
    ...(input ? { body: JSON.stringify(input) } : {}), signal: AbortSignal.timeout(90000) });
  if (!response.ok) { const error = new Error('Request failed'); error.status = response.status; throw error; }
  if (onStage && response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', turn;
    const parse = line => { if (!line.trim()) return; const message = JSON.parse(line); if (message.type === 'stage') onStage(message.message); if (message.type === 'result') turn = message.turn; };
    for (;;) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); let index; while ((index = buffer.indexOf('\n')) >= 0) { parse(buffer.slice(0,index)); buffer = buffer.slice(index+1); } }
    buffer += decoder.decode(); if (buffer.trim()) parse(buffer); if (!turn) throw new Error('Incomplete response'); return turn;
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
  const briefs = {alder:'Request N-101 is open against the submitted documentation package. No payer decision is recorded.',access:'Benefit verification is incomplete. The submitted insurance card’s member identifier is unreadable.',fulfillment:'Enrollment and prescription intake are recorded. The consent form still needs a signature.'};
  return el('section', { class: 'orientation' }, p('YOUR SCENARIO IS READY', 'eyebrow'),
    el('h2', {}, 'Welcome, ' + item.user.name.split(' ')[0] + '.'), p(item.description),
    p(briefs[item.id], 'small muted'),
    el('div', { class: 'prompt-grid', 'aria-label': 'Example questions' }, item.prompts.map(text => button(text + ' ↗', () => send(text), 'prompt', { disabled: state.connecting || state.busy || !state.conversation?.id }))),
    disclosure('Your role & available knowledge', 'orientation-'+item.id, [p('You are '+item.user.name+', '+item.user.role+'. Pathway is your '+item.agentRole+'.'),p(item.caseContext),p('Grounded in '+item.name+'.'),p(item.covers.join(' · '),'small muted')], 'orientation-details'),
    p('Administrative support only. No clinical, payer or delivery decisions. Drafts are never sent.', 'small muted'));
}
function emailFields(from, to, subject, stamp) {
  return el('div', { class: 'email-fields' }, el('dl', {},
    el('dt', {}, 'From'), el('dd', {}, from), el('dt', {}, 'To'), el('dd', {}, to), el('dt', {}, 'Subject'), el('dd', { class: 'email-subject' }, subject)),
    el('time', { datetime: stamp, class: 'small muted' }, time(stamp)));
}
function sources(turn) {
  const trace = turn.trace, ids = turn.response.citations;
  const chosen = ids.map(id => trace?.passages.find(source => source.id === id)).filter(Boolean);
  return el('div', { class: 'evidence' }, disclosure('Sources used · ' + chosen.length, turn.id + '-sources', [
    p('Supporting passages for this answer · ' + (trace?.packName || pack(turn.packId).name), 'small muted'),
    ...chosen.map((source, index) => el('article', { class: 'source' }, p('[' + (index+1) + '] ' + source.title, 'source-title'),
      p(source.section + ' · Version ' + source.version, 'small muted'), el('blockquote', {}, source.text), p(source.reason, 'small muted'))),
    !chosen.length ? p('This reply cites no source passage. It should not be treated as a new case fact.', 'small muted') : null], 'source-disclosure'),
    trace ? disclosure('How this answer was grounded', turn.id + '-trace', [
      el('dl', { class: 'trace-fields' }, el('dt', {}, 'Your question'), el('dd', {}, trace.question), el('dt', {}, 'Question with conversation context'), el('dd', {}, trace.query),
        el('dt', {}, 'Available knowledge'), el('dd', {}, trace.packName + ' · ' + trace.caseId)),
      p('Only current sources for this pack and case were searched. Earlier conversation helps resolve references; it is not source evidence.', 'small muted'),
      ...trace.passages.map(source => disclosure('Rank ' + source.rank + ' · ' + source.title, turn.id + '-rank-' + source.rank, [
        p(source.section, 'small'), el('blockquote', {}, source.text), p(source.reason, 'small muted'),
        p('Included in generation: ' + (source.includedInGeneration ? 'Yes' : 'No') + ' · ' + (ids.includes(source.id) ? 'Cited as [' + (ids.indexOf(source.id)+1) + ']' : 'Not cited'), 'small')], 'retrieved-source'))], 'grounding') : null);
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
    el('div', { class: 'prose email-body' }, work.body),
    el('div', { class: 'draft-actions' }, button('Copy draft', () => copy(work.body)), button('Refine draft', () => { state.draft = 'Make it warmer and shorter.'; render(); focusComposer(); }, 'button', { disabled: state.busy || turn.packId !== state.conversation.packId || turn.id !== state.conversation.turns.filter(t=>t.packId===turn.packId&&t.response?.workProduct).at(-1)?.id }),
      state.conversation.channel === 'email' ? button('Return to chat', () => configure({ channel: 'chat' })) : button('View email thread', () => configure({ channel: 'email' })))) ;
}
function turnView(turn) {
  const item = pack(turn.packId), email = state.conversation.channel === 'email';
  const question = el('div', { class: 'user-message ' + (email ? 'email-message' : '') },
    email ? emailFields(item.user.name, 'Pathway · ' + item.agentRole, 'Re: ' + item.caseId + ' support', turn.createdAt) : p(item.user.name, 'message-author'),
    el('div', { class: 'prose' }, turn.question));
  const reply = el('div', { class: 'agent-message' }, el('div', { class: 'message-heading' }, el('span', { class: 'pathway-avatar', 'aria-hidden': 'true' }, 'p'),
    el('strong', {}, 'Pathway'), p(item.shortName, 'small muted')));
  if (turn.status === 'complete' && turn.response) {
    if (email && !turn.response.workProduct) reply.append(emailFields('Pathway · ' + item.agentRole, item.user.name, 'Re: ' + item.caseId + ' support', turn.createdAt));
    reply.append(turn.response.workProduct ? p('Your draft is ready to review.', 'draft-intro') : el('div', { class: 'prose answer-text' }, turn.response.answer));
    if (turn.response.workProduct) reply.append(workProduct(turn, item));
    reply.append(sources(turn), el('div', { class: 'answer-actions', 'aria-label': 'Answer actions' },
      button('Copy', () => copy(turn.response.workProduct?.body || turn.response.answer)),
      button('Regenerate', () => send(turn.question), 'button', { disabled: state.busy || turn.packId !== state.conversation.packId, title: turn.packId !== state.conversation.packId ? 'Return to this Knowledge Pack to regenerate.' : 'Generate another answer to this question' }),
      ...[['Helpful','helpful'],['Not helpful','not_helpful']].map(([label,value]) => button(label, () => feedback(turn,value), 'button', { 'aria-pressed': String(turn.feedback === value), 'data-feedback-turn': turn.id, 'data-feedback': value, disabled: state.busy }))));
  } else if (turn.status === 'pending' && state.busy) reply.append(p('Waiting for Pathway…', 'progress'), p('Preparing your answer with the selected knowledge.', 'small muted'));
  else reply.append(el('div', { class: 'recovery', role: 'alert' }, p('I couldn’t complete that answer. Your message is saved.'),
    button('Retry', () => send(turn.question,turn.id,true), 'button secondary', { disabled: state.busy || turn.packId !== state.conversation.packId }),
    turn.packId !== state.conversation.packId ? p('Return to this answer’s Knowledge Pack to retry.', 'small muted') : null));
  return el('section', { class: 'turn', 'data-turn': turn.id, 'data-pack': turn.packId }, question, reply);
}
function conversation() {
  const item = active(), convo = state.conversation, complete = convo?.turns.filter(t=>t.status==='complete').at(-1);
  return el('main', { id: 'main', tabindex: '-1', class: 'conversation' },
    el('section', { class: 'conversation-bar', 'aria-label': 'Conversation context' },
      el('div', { class: 'conversation-title' }, el('div', {}, p('SYNTHETIC CASE · ' + item.caseId, 'eyebrow'), el('h1', {}, item.agentRole)),
        el('div', { class: 'channel-switch', 'aria-label': 'Conversation format' }, ...['chat','email'].map(channel => button(channel === 'chat' ? 'Chat' : 'Email', () => configure({ channel }), 'button', { disabled: state.connecting || state.busy, 'aria-pressed': String((convo?.channel || item.defaultChannel) === channel) })))),
      el('div', { class: 'context-line' }, p('You’re ' + item.user.name + ' · ' + item.user.role, 'small'),
        button('Grounded in ' + item.shortName + ' ↗', () => { state.selectedPack = item.id; go('#knowledge'); }, 'knowledge-link', { disabled: state.busy || state.connecting })),
      el('div', { class: 'conversation-tools' }, button('New conversation', () => go('#scenario/' + item.id), 'button', { disabled: state.busy || state.connecting }),
        link('Change scenario', '#home'), button('Change knowledge', () => { state.selectedPack = item.id; go('#knowledge'); }, 'button', { disabled: state.busy || state.connecting }))),
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
      el('div', { class: 'composer-caption' }, p(state.connecting ? 'Connecting to your private demo session…' : state.busy ? 'Pathway is preparing an answer…' : 'Synthetic case · Drafts are never sent', 'small muted'), p('Enter to send · Shift + Enter for a new line', 'small muted keyboard-hint')))));
}
function knowledge() {
  const item = pack(state.selectedPack), docs = state.catalog.documents.filter(d=>d.packId===item.id);
  return el('main', { id: 'main', tabindex: '-1', class: 'page knowledge-page' },
    state.conversation?.id ? link('← Return to conversation', '#conversation/' + state.conversation.id, 'back-link') : link('← Scenarios', '#home', 'back-link'),
    p('AVAILABLE KNOWLEDGE', 'eyebrow'), el('h1', {}, 'Know what Pathway knows.'), p('Small, readable Knowledge Packs. Every answer starts with the one you select.', 'lede'),
    el('div', { class: 'pack-choices', 'aria-label': 'Knowledge Packs' }, state.catalog.packs.map(item => button(item.shortName, () => { state.selectedPack=item.id; render(); }, 'button secondary', { 'aria-pressed': String(item.id===state.selectedPack) }))),
    el('section', { class: 'pack-summary' }, el('div', {}, badge('Curated synthetic knowledge'), el('h2', {}, item.name), p(item.agentRole + ' · Case ' + item.caseId), p(item.covers.join(' · '), 'muted'),
      p('Version ' + item.version + ' · 8 sources · 6 current and applicable', 'small')), button('Use this Knowledge Pack', async () => { if(state.conversation?.id) await configure({packId:item.id},true); else go('#scenario/' + item.id); }, 'button primary')),
    p('Only the six current, applicable sources can support new answers. Archived and other-case documents stay visible here so you can inspect the boundary.', 'muted'),
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
    link('Read the retained evaluation & limitations ↗', 'https://github.com/ktakeuchi21/case-resolution-agent/blob/main/docs/rebuild/conversation-review-2026-09-12.md','button secondary'), footer());
}
function render() {
  if (!state.catalog) return;
  const open = new Set([...document.querySelectorAll('details[open]')].map(d=>d.dataset.disclosure));
  const focused = document.activeElement?.id, selection = focused === 'question' ? [$('#question').selectionStart,$('#question').selectionEnd] : null;
  const oldScroll = $('.thread-scroll')?.scrollTop;
  $('#app').replaceChildren(header(), state.route === 'conversation' ? conversation() : state.route === 'knowledge' ? knowledge() : state.route === 'evaluation' ? evaluation() : home());
  document.body.classList.toggle('in-conversation',state.route==='conversation');
  document.querySelectorAll('details').forEach(d=>{ if(open.has(d.dataset.disclosure)) d.open=true; });
  if(oldScroll !== undefined && $('.thread-scroll')) $('.thread-scroll').scrollTop=oldScroll;
  if(focused && document.getElementById(focused)) { document.getElementById(focused).focus({preventScroll:true}); if(selection) $('#question').setSelectionRange(...selection); }
  document.title = state.route==='conversation' ? active().agentRole+' · Pathway' : 'Pathway · Support grounded in knowledge';
  analytics.view(state.route === 'conversation' ? 'agent' : state.route);
}
async function connect(scenarioId, conversationId) {
  const epoch = ++state.epoch; state.connecting = true; state.error = ''; render(); if(!conversationId && $('.thread-scroll')) $('.thread-scroll').scrollTop=0;
  try {
    state.session = await api('session');
    const convo = conversationId ? await api('conversation?id='+encodeURIComponent(conversationId)) : await api('start',{scenarioId});
    if(epoch!==state.epoch) return;
    state.conversation=convo; state.selectedPack=convo.packId;
    history.replaceState(null,'','#conversation/'+convo.id); try { sessionStorage.setItem('pathway.rag.last',convo.id); } catch { /* Server history is sufficient when local storage is unavailable. */ }
  } catch (error) { if(epoch!==state.epoch)return; state.error = error.status===404 && conversationId ? 'This conversation has expired or belongs to another browser session. Choose a scenario to start again.' : 'The demo could not connect. Please retry; the free service may take a moment to wake up.'; }
  finally { if(epoch===state.epoch) {state.connecting=false;render();focusComposer();if(state.conversation?.turns.length)lastMessage();else if($('.thread-scroll'))$('.thread-scroll').scrollTop=0;} }
}
async function route() {
  const [name,id] = location.hash.replace(/^#/,'').split('/');
  state.error='';
  if(name==='scenario' && pack(id)) { state.route='conversation';state.selectedPack=id;state.conversation=null;state.draft='';await connect(id); }
  else if(name==='conversation' && /^[0-9a-f-]{36}$/.test(id||'')) { state.route='conversation'; if(state.conversation?.id===id){render();focusComposer();} else await connect(null,id); }
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
  turn.status='pending'; if(!existing)convo.turns.push(turn); state.busy=true;state.draft='';render();lastMessage();focusComposer();announce('Pathway is preparing your answer.');
  try {
    const result=await api('send',{conversationId:convo.id,requestId,text,retry},message=>{ const progress=$('.progress');if(progress)progress.textContent=message;announce(message); });
    Object.assign(turn,result);
  } catch { turn.status='failed'; }
  finally {state.busy=false;render();lastMessage();focusComposer();announce(turn.status==='complete'?'Pathway’s answer is ready. Sources used: '+turn.response.citations.length+'.':'The answer could not be completed. Your message is saved. Retry is available.');}
}
$('.skip').addEventListener('click',event=>{event.preventDefault();$('#main')?.focus();});
window.addEventListener('hashchange',()=>void route());
window.addEventListener('pagehide',()=>analytics.pause());
window.addEventListener('pageshow',e=>{if(e.persisted)analytics.resume();});
try {
  const response=await fetch('/rag-catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error('Catalog unavailable');state.catalog=await response.json();await route();
  void fetch('/healthz',{cache:'no-store',signal:AbortSignal.timeout(90000)}).catch(()=>{});
} catch {
  $('#app').replaceChildren(el('main',{id:'main',class:'page'},el('h1',{},'Pathway is taking a moment.'),p('The scenarios could not load. Please try again.'),button('Reload',()=>location.reload(),'button primary')));
}

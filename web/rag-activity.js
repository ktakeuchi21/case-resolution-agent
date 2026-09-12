// Activity describes observed application work; no stage is advanced by a timer.
export const activityTimeoutMs = 90000;
const stages = new Set(['searching','retrieved','generating','checking','repairing','complete','failed']);
const validEvent = event => event && typeof event.turnId === 'string' && Number.isInteger(event.attempt) && event.attempt > 0 &&
  Number.isInteger(event.sequence) && event.sequence > 0 && event.sequence <= 16 && stages.has(event.stage) &&
  typeof event.message === 'string' && event.message.length <= 300 && Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0;

export async function readRagStream(body, onStage) {
  const reader = body.getReader(), decoder = new TextDecoder(); let buffer = '', turn;
  const parse = line => {
    if (!line.trim()) return;
    const message = JSON.parse(line);
    if (message.type === 'stage') onStage(message);
    if (message.type === 'result') turn = message.turn;
    if (message.type === 'error') throw new Error('Request failed');
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) { parse(buffer.slice(0,index)); buffer = buffer.slice(index+1); }
      if (buffer.length > 250000) throw new Error('Response too large');
    }
    buffer += decoder.decode(); if (buffer.trim()) parse(buffer);
    if (!turn) throw new Error('Incomplete response');
    return turn;
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}

export class ActivityRun {
  constructor(turn, { read, update, finish, now = Date.now }) {
    this.turn=turn; this.read=read; this.update=update; this.onFinish=finish; this.now=now;
    this.attempt=turn.attempt; this.startedAt=Date.parse(turn.activity?.startedAt) || now();
    this.deadline=this.startedAt+activityTimeoutMs; this.lastStream=now(); this.lastPoll=0;
    this.stopped=false; this.polling=false; this.controller=new AbortController();
    turn.activity ||= { startedAt:new Date(this.startedAt).toISOString(),elapsedMs:0,events:[] };
  }
  elapsed() {
    return this.stopped ? this.turn.activity.elapsedMs : Math.max(this.turn.activity.elapsedMs,Math.min(activityTimeoutMs,this.now()-this.startedAt));
  }
  stage(event) {
    if (this.stopped || !validEvent(event) || event.turnId!==this.turn.id || event.attempt!==this.attempt) return;
    this.turn.recordedAttempt=event.attempt;
    this.lastStream=this.now();
    const events=this.turn.activity.events;
    if (event.sequence <= (events.at(-1)?.sequence || 0)) return;
    events.push(event); this.turn.activity.elapsedMs=Math.max(this.turn.activity.elapsedMs,event.elapsedMs);
    this.update(event);
  }
  snapshot(result) {
    if (this.stopped || result?.id!==this.turn.id || result.attempt!==this.attempt) return;
    this.turn.recordedAttempt=result.attempt;
    // Poll snapshots fill sequence gaps without regressing a newer streamed stage.
    const prior=this.turn.activity.events.at(-1)?.sequence || 0;
    const incoming=result.activity?.events?.filter(e=>validEvent(e)&&e.turnId===this.turn.id&&e.attempt===this.attempt) || [];
    const merged=new Map(this.turn.activity.events.map(e=>[e.sequence,e]));
    incoming.forEach(e=>{if(!merged.has(e.sequence))merged.set(e.sequence,e);});
    this.turn.activity.events=[...merged.values()].sort((a,b)=>a.sequence-b.sequence);
    const latest=this.turn.activity.events.at(-1);
    this.turn.activity.elapsedMs=Math.max(this.turn.activity.elapsedMs,latest?.elapsedMs || 0);
    if (result.activity?.startedAt && Number.isFinite(Date.parse(result.activity.startedAt))) this.turn.activity.startedAt=result.activity.startedAt;
    if (result.status==='complete'||result.status==='failed') { this.finish(result); return; }
    if ((latest?.sequence || 0)>prior) this.update(latest);
  }
  finish(result) {
    if (this.stopped || result?.id!==this.turn.id || result.attempt!==this.attempt || !['complete','failed'].includes(result.status)) return;
    Object.assign(this.turn,result);
    this.turn.recordedAttempt=result.attempt;
    this.stop(); this.onFinish();
  }
  fail() {
    if(this.stopped)return;
    this.turn.activity.elapsedMs=this.elapsed(); this.turn.activity.finishedAt=new Date(this.now()).toISOString();
    this.turn.status='failed'; this.stop(); this.onFinish();
  }
  stop() { this.stopped=true; this.controller.abort(); }
  async tick() {
    if (this.stopped) return;
    if (this.now()>=this.deadline) { this.fail(); return; }
    this.update();
    if (this.polling || this.now()-this.lastStream<3000 || this.now()-this.lastPoll<3000) return;
    this.polling=true; this.lastPoll=this.now();
    try { this.snapshot(await this.read(this.controller.signal)); }
    catch { /* A read failure does not resubmit generation or hide an active stream. */ }
    finally { this.polling=false; }
  }
}

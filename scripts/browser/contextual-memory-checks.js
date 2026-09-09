async page=>{
 const cases=__CASES__,arm=__ARM__,results=[],responses=[],latencies=[];let error;
 const check=(name,pass)=>results.push({name,pass:!!pass});
 try{
  await page.reload();await page.getByRole('textbox',{name:'Message Pathway',exact:true}).waitFor({timeout:30000});
  const before=await page.evaluate(async()=>await(await fetch('/api/state')).json()),n=await page.locator('.agent-turn').count(),box=page.getByRole('textbox',{name:'Message Pathway',exact:true});
  await box.fill(cases.core[9].text);const started=Date.now();await box.press('Enter');
  await page.waitForFunction(n=>document.querySelectorAll('.agent-turn').length===n+1&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false',n,{timeout:65000});
  const observedMs=Date.now()-started,after=await page.evaluate(async()=>await(await fetch('/api/state')).json()),r=after.agent.entries.filter(e=>e.conversationId===after.agent.activeConversationId).at(-1);responses.push(r);latencies.push({submissionToAnswerMs:observedMs});
  check('live interaction is accepted as recorded unverified context',r.disposition==='recorded'&&/\bunverified\b/i.test(r.message));
  check('report has a cited uncertainty claim',r.claims.some(c=>c.kind==='uncertainty'&&/unverified/i.test(c.text)&&c.supports.some(s=>s.reference.startsWith('conversation:'))));
  check('complete configured live pipeline ran without fallback',r.audit.method==='model-synthesis'&&r.audit.requests===3);
  check('workflow remains unchanged',JSON.stringify(after.workflow)===JSON.stringify(before.workflow));
 }catch(e){error=String(e);}
 return {schema:'pathway-contextual-memory-smoke-v1',timestamp:new Date().toISOString(),arm,environment:'One fresh live interaction in the existing isolated synthetic session; prior history and request counters preserved',results,responses,latencies,...(error?{error}:{})};
}

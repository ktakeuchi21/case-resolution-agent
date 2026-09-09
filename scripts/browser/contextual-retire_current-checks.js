async page=>{
 const cases=__CASES__,arm=__ARM__,results=[],responses=[],latencies=[];let error;
 const check=(name,pass)=>results.push({name,pass:!!pass});
 const state=()=>page.evaluate(async()=>await(await fetch('/api/state')).json());
 try{
  await page.reload();await page.locator('#role').waitFor({timeout:30000});const before=await state();
  if(!before.agent.entries.some(e=>e.disposition==='answer'&&e.citations.some(c=>c.documentVersionId==='K-PA.v2')))throw new Error('An existing governed answer is required; no new provider call made.');
  await page.goto('https://case-resolution-agent.onrender.com/#studio');await page.locator('[data-source="K-PA"]').click();await page.locator('#source-version').selectOption('K-PA.v2');
  await page.getByRole('combobox',{name:'Demo role',exact:true}).selectOption('knowledge_reviewer');
  await page.getByRole('button',{name:'Retire this version',exact:true}).click();await page.getByRole('button',{name:'Confirm change',exact:true}).click();await page.getByRole('button',{name:'Retirement recorded',exact:true}).waitFor({timeout:30000});
  check('synthetic source retirement is committed',(await state()).knowledge.events.some(e=>e.type==='retirement'&&e.targetId==='K-PA.v2'));
  await page.goto('https://case-resolution-agent.onrender.com/#agent');const box=page.getByRole('textbox',{name:'Message Pathway',exact:true});await box.waitFor({timeout:30000});const n=await page.locator('.agent-turn').count();await box.fill(cases.boundary.J);const started=Date.now();await box.press('Enter');
  await page.waitForFunction(n=>document.querySelectorAll('.agent-turn').length===n+1&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false',n,{timeout:65000});const elapsed=Date.now()-started,after=await state(),r=after.agent.entries.filter(e=>e.conversationId===after.agent.activeConversationId).at(-1);responses.push(r);latencies.push({submissionToAnswerMs:elapsed});
  check('new live conversation pauses for retired current source',r.disposition==='pause'&&r.reasonCodes.includes('SOURCE_RETIRED'));
  check('all previous answers and exact evidence remain unchanged',before.agent.entries.every(e=>JSON.stringify(after.agent.entries.find(a=>a.id===e.id))===JSON.stringify(e)));
  check('source change creates no workflow effect',JSON.stringify(after.workflow)===JSON.stringify(before.workflow));
 }catch(e){error=String(e);}
 return {schema:'pathway-contextual-retirement-live-v1',timestamp:new Date().toISOString(),arm,environment:'Existing isolated synthetic workspace with a previously accepted governed answer; real session-scoped retirement followed by current live interpretation and fresh retrieval',results,responses,latencies,...(error?{error}:{})};
}

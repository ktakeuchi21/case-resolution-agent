async page => {
 const cases=__CASES__,arm=__ARM__,results=[],responses=[],latencies=[];let error;
 const check=(name,pass,detail)=>results.push({name,pass:!!pass,...(detail!==undefined?{detail}:{})});
 const origin=page.url().split('/').slice(0,3).join('/');

 const state=()=>page.evaluate(async()=>await(await fetch('/api/state')).json());
 const route=async hash=>{await page.goto(origin+'/#'+hash);await page.locator('#role').waitFor();};
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#loading'));
 const talk=async text=>{await route('agent');const n=await page.locator('.agent-turn').count();await page.getByRole('textbox',{name:'Message Pathway',exact:true}).fill(text);const start=Date.now();await page.getByRole('textbox',{name:'Message Pathway',exact:true}).press('Enter');await page.waitForFunction(n=>document.querySelectorAll('.agent-turn').length===n+1&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false',n,{timeout:65000});const observedMs=Date.now()-start;const saved=await state();responses.push(saved.agent.entries.filter(e=>e.conversationId===saved.agent.activeConversationId).at(-1));latencies.push({query:text,submissionToAnswerMs:observedMs});return responses.at(-1);};
 try{
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().waitFor({timeout:90000});await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await page.getByRole('button',{name:'Use sample knowledge →',exact:true}).click();
  const identified=await talk(cases.boundary.K[0]);
  const initial=await state(),old=initial.agent.entries[0];
  const ambiguous=await talk(cases.boundary.G);check('G asks a material recipient clarification with why',ambiguous.disposition==='clarify'&&!!ambiguous.clarification?.why&&ambiguous.clarification.options.some(o=>o.value==='office')&&ambiguous.clarification.options.some(o=>o.value==='case_manager'));
  for(const text of cases.boundary.L){const r=await talk(text);check('L declines '+text,r.disposition==='pause');}
  check('L leaves workflow unchanged',JSON.stringify((await state()).workflow)===JSON.stringify(initial.workflow));
  check('K initial answer identifies missing note without contradiction',identified.disposition==='answer'&&!/not yet been assessed|not yet assessed/i.test(identified.message+' '+identified.context.whatHappened));
  await route('workspace');await page.locator('[data-action="assess"]').click();await ready();const prepared=await state();check('K preparation records distinct authorized queued effect',prepared.workflow.state==='OUTREACH_QUEUED'&&prepared.workflow.effects.length===1);
  const after=await talk(cases.boundary.K[1]);check('K answer agrees that simulation is queued not sent',after.context.state==='OUTREACH_QUEUED'&&after.disposition==='answer');
  await route('knowledge');await page.getByRole('button',{name:'Choose or drop a file',exact:true}).click();await page.locator('#quick-file').setInputFiles('scripts/browser/fixtures/synthetic-chat-journey.md');await page.locator('#quick-confirm').check();await page.getByRole('button',{name:'Parse document',exact:true}).click();await page.getByRole('button',{name:'Chat with this document in the sandbox →',exact:true}).click();await ready();
  const sandbox=await talk(cases.boundary.I);check('I switch prevents prior source authority',sandbox.knowledge.authority==='sandbox_only'&&sandbox.context.permission.action==='denied'&&!sandbox.facts.some(f=>f.authoritative)&&!sandbox.citations.some(c=>old.citations.some(o=>o.passageId===c.passageId)));check('I historical answer unchanged',JSON.stringify((await state()).agent.entries.find(e=>e.id===old.id))===JSON.stringify(old));
  await route('knowledge');await page.getByRole('button',{name:'Use sample knowledge →',exact:true}).click();await ready();
  await route('studio');await page.locator('[data-source="K-PA"]').click();await page.getByRole('combobox',{name:'Demo role',exact:true}).selectOption('knowledge_reviewer');await ready();await page.getByRole('button',{name:'Retire this version',exact:true}).click();await page.getByRole('button',{name:'Confirm change',exact:true}).click();await ready();
  const retired=await talk(cases.boundary.J);check('J retirement pauses current answer',retired.disposition==='pause'&&retired.reasonCodes.includes('SOURCE_RETIRED'));check('J exact historical answer unchanged',JSON.stringify((await state()).agent.entries.find(e=>e.id===old.id))===JSON.stringify(old));
  await page.screenshot({path:'output/playwright/contextual-'+arm+'-retired.png',fullPage:true});
 }catch(e){error=String(e);}
 return {schema:'pathway-contextual-boundary-v1',timestamp:new Date().toISOString(),arm,results,responses,latencies,...(error?{error}:{})};
}

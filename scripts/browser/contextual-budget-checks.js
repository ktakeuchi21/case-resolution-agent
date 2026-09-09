async page=>{
 const results=[],responses=[];let error;const check=(name,pass)=>results.push({name,pass:!!pass});const state=()=>page.evaluate(async()=>await(await fetch('/api/state')).json());
 try{
  await page.reload();const box=page.getByRole('textbox',{name:'Message Pathway',exact:true});await box.waitFor();const before=await state(),n=await page.locator('.agent-turn').count();await box.fill('What should happen next?');await box.press('Enter');await page.waitForFunction(n=>document.querySelectorAll('.agent-turn').length===n+1&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false',n,{timeout:30000});const after=await state(),r=after.agent.entries.filter(e=>e.conversationId===after.agent.activeConversationId).at(-1);responses.push(r);
  check('explicit request-limit pause',r.disposition==='pause'&&r.reasonCodes.includes('PROVIDER_BUDGET_EXHAUSTED')&&/provider request limit/.test(r.message));check('no outbound model call counted',r.audit.requests===0&&r.audit.inputTokens===0&&r.audit.outputTokens===0);check('no fallback or work product',r.audit.method==='provider-pause'&&r.workProduct===null);check('workflow unchanged',JSON.stringify(before.workflow)===JSON.stringify(after.workflow));
 }catch(e){error=String(e);}
 return {schema:'pathway-public-budget-pause-v1',timestamp:new Date().toISOString(),environment:'Public app at its already-exhausted daily budget; zero outbound model calls; not model-quality evidence',results,responses,...(error?{error}:{})};
}

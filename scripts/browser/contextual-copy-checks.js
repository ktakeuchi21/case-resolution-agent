async page=>{
 const cases=__CASES__,arm=__ARM__,results=[],responses=[],latencies=[];let error;
 const check=(name,pass,detail)=>results.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
 try{
  const state=await page.evaluate(async()=>await(await fetch('/api/state')).json()),r=state.agent.entries.filter(e=>e.conversationId===state.agent.activeConversationId).at(-1);responses.push(r);
  check('required office email is accepted',r.disposition==='draft'&&r.workProduct?.audience==='office'&&r.workProduct.channel==='email',r.reasonCodes);
  check('recipient body requests signed office note',!!r.workProduct&&/signed office note/i.test(r.workProduct.body)&&!/Owner:|Next:|Target completion|action permission/i.test(r.workProduct.body));
  if(r.workProduct){
   await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>{window.__contextualCopy=text;}}));
   await page.locator('.agent-turn').last().getByRole('button',{name:'Copy',exact:true}).click();
   check('Copy contains exactly subject and body',await page.evaluate(()=>window.__contextualCopy)===(r.workProduct.subject?'Subject: '+r.workProduct.subject+'\n\n':'')+r.workProduct.body);
  }
  check('no effects or decisions',state.workflow.effects.length===0&&state.workflow.decisions.length===0);
  await page.screenshot({path:'output/playwright/contextual-prose-draft-mobile.png'});
 }catch(e){error=String(e);}
 return {schema:'pathway-contextual-draft-recovery-v1',timestamp:new Date().toISOString(),arm,environment:'Recovered committed response after test counted turns before initial page render; no model call repeated. End-to-end browser latency unavailable; original audit retains server latency.',results,responses,latencies,...(error?{error}:{})};
}

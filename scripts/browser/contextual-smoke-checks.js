async page=>{
 const cases=__CASES__,arm=__ARM__,indices=[0,1,5,6,8],results=[],responses=[],latencies=[];let error;
 const check=(name,pass,detail)=>results.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
 const state=()=>page.evaluate(async()=>await(await fetch('/api/state')).json());
 try{
  await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await page.getByRole('button',{name:'Use sample knowledge →',exact:true}).click();await page.setViewportSize({width:375,height:812});
  for(const [n,i] of indices.entries()){
   const box=page.getByRole('textbox',{name:'Message Pathway',exact:true});await box.fill(cases.core[i].text);const start=Date.now();await box.press('Enter');await page.waitForFunction(n=>document.querySelectorAll('.agent-turn').length===n&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false',n+1,{timeout:65000});const observedMs=Date.now()-start;
   const saved=await state(),r=saved.agent.entries.filter(e=>e.conversationId===saved.agent.activeConversationId).at(-1);responses.push(r);latencies.push({query:r.query,submissionToAnswerMs:observedMs});check('turn '+(i+1)+' accepted',['answer','draft'].includes(r.disposition),r.reasonCodes);
  }
  const [next,why,email,warm,sms]=responses,words=s=>(s?.trim().match(/\S+/g)??[]).length;
  check('A contextual rationale reference',why.turn?.interpretation.intent==='rationale'&&why.turn.interpretation.follows===next.id&&why.disposition==='answer');
  check('C office email without internal metadata',email.workProduct?.audience==='office'&&email.workProduct.channel==='email'&&/signed office note/i.test(email.workProduct.body)&&!/Owner:|Next:|Target completion|action permission/i.test(email.workProduct.body));
  check('D warmer and 25 percent shorter',warm.workProduct?.basedOn===email.id&&warm.workProduct.tone==='warm'&&words(warm.workProduct.body)<=Math.floor(words(email.workProduct?.body)*.75),{before:words(email.workProduct?.body),after:words(warm.workProduct?.body)});
  check('F generic SMS within limit',sms.workProduct?.basedOn===warm.id&&sms.workProduct.channel==='sms'&&sms.workProduct.body.length<=250&&!/signed|office|note|patient|document|payer|authorization/i.test(sms.workProduct.body));
  const saved=await state();check('no effects or decisions',saved.workflow.state==='RECEIVED'&&saved.workflow.effects.length===0&&saved.workflow.decisions.length===0);
  await page.screenshot({path:'output/playwright/contextual-prose-smoke-mobile.png'});
 }catch(e){error=String(e);}
 return {schema:'pathway-contextual-prose-smoke-v1',timestamp:new Date().toISOString(),arm,environment:'Live public Render; focused correction check, not a replacement for the complete frozen core pair',selectedCoreIndices:indices,results,responses,latencies,...(error?{error}:{})};
}

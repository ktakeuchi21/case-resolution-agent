async page=>{
 const arm=__ARM__,results=[],responses=[];let error;
 const check=(name,pass)=>results.push({name,pass:!!pass});
 try{
  const state=await page.evaluate(async()=>await(await fetch('/api/state')).json());
  const entries=state.agent.entries.filter(e=>e.conversationId===state.agent.activeConversationId);
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>{window.__contextualCopy=text;}}));
  for(const [i,r] of entries.entries()){
   if(!r.workProduct)continue;responses.push(r);
   const article=page.locator('[id="turn-'+r.id+'"]');
   const closed=page.locator('details.older-turn:not([open])').filter({has:article});
   if(await closed.count())await closed.locator(':scope>summary').click();
   await article.getByRole('button',{name:'Copy',exact:true}).click();
   check('turn '+(i+1)+' Copy is exactly recipient subject and body',await page.evaluate(()=>window.__contextualCopy)===(r.workProduct.subject?'Subject: '+r.workProduct.subject+'\n\n':'')+r.workProduct.body);
  }
  const after=await page.evaluate(async()=>await(await fetch('/api/state')).json());
  check('Copy leaves all conversation entries unchanged',JSON.stringify(after.agent.entries)===JSON.stringify(state.agent.entries));
  check('Copy creates no workflow effects or decisions',JSON.stringify(after.workflow)===JSON.stringify(state.workflow));
 }catch(e){error=String(e);}
 return {schema:'pathway-contextual-copy-v1',timestamp:new Date().toISOString(),arm,environment:'Public browser; existing live products only; clipboard write intercepted inside isolated test page; zero provider requests',results,responses,latencies:[],...(error?{error}:{})};
}

async page=>{
 const results=[],errors=[];let error;const check=(name,pass)=>results.push({name,pass:!!pass});const onError=e=>errors.push(String(e));page.on('pageerror',onError);
 const state=()=>page.evaluate(async()=>await(await fetch('/api/state')).json());
 try{
  await page.goto('http://127.0.0.1:3013/#studio');await page.reload();await page.locator('[data-source="K-PA"]').click();await page.locator('#source-version').selectOption('K-PA.v2');await page.getByRole('combobox',{name:'Demo role',exact:true}).selectOption('knowledge_reviewer');
  await page.waitForFunction(async()=>!document.querySelector('#loading')&&(await(await fetch('/api/state')).json()).role==='knowledge_reviewer',null,{polling:1000,timeout:20000});const before=await state();
  await page.getByRole('button',{name:'Retire this version',exact:true}).click();await page.getByRole('button',{name:'Confirm change',exact:true}).click();await page.goto('http://127.0.0.1:3013/#agent');
  await page.waitForFunction(async()=>(await(await fetch('/api/state')).json()).knowledge.events.some(e=>e.type==='retirement'&&e.targetId==='K-PA.v2'),null,{polling:1000,timeout:20000});
  const after=await state();check('confirmed retirement survives immediate navigation',after.knowledge.events.some(e=>e.type==='retirement'&&e.targetId==='K-PA.v2'));check('conversation history unchanged',JSON.stringify(before.agent.entries)===JSON.stringify(after.agent.entries));check('workflow unchanged',JSON.stringify(before.workflow)===JSON.stringify(after.workflow));check('no browser exceptions',errors.length===0);
 }catch(e){error=String(e);}
 page.off('pageerror',onError);return {schema:'pathway-governance-navigation-ui-v1',timestamp:new Date().toISOString(),environment:'Local isolated fixture workspace; actual persisted governance action, no model call or live quality claim',results,errors,...(error?{error}:{})};
}

async page=>{
 const arm=__ARM__,results=[];let error,record;
 const check=(name,pass)=>results.push({name,pass:!!pass});const state=()=>page.evaluate(async()=>await(await fetch('/api/state')).json());
 try{
  const before=await state();check('K-PA.v2 retirement committed',before.knowledge.events.some(e=>e.type==='retirement'&&e.targetId==='K-PA.v2'));
  await page.locator('[data-studio-tab="test"]').click();await page.locator('#test-collection').selectOption('governed');await page.locator('#test-mode').selectOption('hybrid');await page.locator('#studio-question').fill('Which signed office note document is missing for this request?');await page.locator('#query-attestation').check();const n=await page.locator('.test-result').count();await page.getByRole('button',{name:'Test selected collection',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.test-result').length>n&&!document.querySelector('#loading'),n,{timeout:30000});
  const after=await state();record=after.knowledgeStudio.tests.find(t=>!before.knowledgeStudio.tests.some(b=>b.id===t.id));
  check('fresh hybrid evidence pauses for retired required source',record?.record.disposition==='pause'&&record.record.action.reasonCodes.includes('SOURCE_RETIRED'));
  check('all prior conversation entries unchanged',JSON.stringify(before.agent.entries)===JSON.stringify(after.agent.entries));
  check('workflow effects and decisions unchanged',JSON.stringify(before.workflow)===JSON.stringify(after.workflow));
 }catch(e){error=String(e);}
 return {schema:'pathway-contextual-retirement-probe-v1',timestamp:new Date().toISOString(),arm,environment:'Explicit Knowledge Studio hybrid retrieval governance probe using the canonical cached query; no conversation synthesis and no weaker retrieval fallback. Not fresh model-quality evidence.',results,record,...(error?{error}:{})};
}

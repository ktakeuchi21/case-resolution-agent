async page => {
 const cases=__CASES__,arm=__ARM__,results=[],responses=[],latencies=[],errors=[];let error;
 const pageError=e=>errors.push(String(e));page.on('pageerror',pageError);
 const check=(name,pass,detail)=>results.push({name,pass:!!pass,...(detail!==undefined?{detail}:{})});
 const words=s=>(s?.trim().match(/\S+/g)??[]).length;

 try{
  await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().waitFor({timeout:90000});
  await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();
  await page.getByRole('button',{name:'Use sample knowledge →',exact:true}).click();
  await page.setViewportSize({width:375,height:812});
  for(const [i,item] of cases.core.entries()){
   const box=page.getByRole('textbox',{name:'Message Pathway',exact:true});await box.fill(item.text);const started=Date.now();await box.press('Enter');
   await page.waitForFunction(n=>document.querySelectorAll('.agent-turn').length===n&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false',i+1,{timeout:65000});const observedMs=Date.now()-started;const saved=await page.evaluate(async()=>await(await fetch("/api/state")).json());responses.push(saved.agent.entries.filter(e=>e.conversationId===saved.agent.activeConversationId).at(-1));
   latencies.push({turn:i+1,trace:item.trace,submissionToAnswerMs:observedMs});const r=responses[i];
   check('turn '+(i+1)+' returns a validated answer',r&&r.disposition!=='pause'&&r.disposition!=='clarify',{disposition:r?.disposition,reasons:r?.reasonCodes});
   check('mobile composer accessible after turn '+(i+1),await page.locator('#agent-form').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}));
   check('no mobile overflow after turn '+(i+1),await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check('newest direct answer visible after turn '+(i+1),await page.locator('.conversation-stream').evaluate(n=>{const lead=[...n.querySelectorAll('.answer-lead')].at(-1).getBoundingClientRect(),r=n.getBoundingClientRect();return lead.top>=Math.max(0,r.top)&&lead.top<Math.min(innerHeight,r.bottom);}));
   if(r?.reasonCodes?.some(code=>code.startsWith('PROVIDER_SCHEMA_REJECTED')||['PROVIDER_UNAVAILABLE','PROVIDER_REQUEST_REJECTED','PROVIDER_RESPONSE_LIMIT','PROVIDER_BUDGET_EXHAUSTED'].includes(code)))throw new Error('Provider transport gate failed; remaining prompts were not submitted.');
  }
  const [next,why,longWhy,missing,evidence,email,warm,handoff,sms,interaction,recall,summary]=responses;
  check('A contextual rationale has no clarification',why.disposition==='answer'&&longWhy.disposition==='answer'&&why.interpretation?.follows===next.id);
  check('B evidence identifies exact source passage',evidence.citations.some(c=>/signed office note/i.test(c.text))&&evidence.disposition==='answer');
  const body=email.workProduct?.body??'';
  check('C recipient email requests signed office note',email.workProduct?.channel==='email'&&email.workProduct?.audience==='office'&&/signed office note/i.test(body));
  check('C recipient copy excludes internal metadata',!/\b(?:Owner:|Next:|Target completion boundary|action permission|evidence status|Synthetic case|prior authorization pending)/i.test(body));
  check('D uses intended artifact',warm.workProduct?.basedOn===email.id);
  check('D at least 25 percent fewer words',words(warm.workProduct?.body)>0&&words(warm.workProduct?.body)<=Math.floor(words(body)*.75),{before:words(body),after:words(warm.workProduct?.body)});
  check('D warm and unsent',warm.workProduct?.tone==='warm'&&warm.workProduct?.status==='generated_not_sent');
  check('E case-manager handoff preserves lineage',handoff.workProduct?.audience==='case_manager'&&handoff.workProduct?.basedOn===warm.id&&/signed office note/i.test(handoff.workProduct?.body??''));
  check('F generic SMS within limit',sms.workProduct?.channel==='sms'&&sms.workProduct.body.length<=250&&!/signed office note|DEMO-101|payer|authorization|document|patient/i.test(sms.workProduct.body),{characters:sms.workProduct?.body.length});
  check('H interaction remains unverified',interaction.operation==='interaction'&&interaction.reasonCodes.includes('CONVERSATION_NOT_AUTHORITATIVE'));
  check('H recall and summary attribute memory',/unverified/i.test(recall.message+' '+JSON.stringify(recall.claims))&&/unverified/i.test(summary.workProduct?.body??''));
  const state=await page.evaluate(async()=>await(await fetch('/api/state')).json());check('conversation creates no effects or decisions',state.workflow.state==='RECEIVED'&&state.workflow.effects.length===0&&state.workflow.decisions.length===0);
  check('K evidence does not coexist with unassessed dependency',!responses.some(r=>r.citations.some(c=>/does not contain the signed office note/.test(c.text))&&/not yet been assessed|not yet assessed|dependency unassessed/i.test(r.message+' '+r.context.whatHappened)));
  await page.screenshot({path:'output/playwright/contextual-'+arm+'-mobile-viewport.png'});
  check('M older turns compacted',await page.locator('.older-turn:not([open])').count()===9);
  check('M sources collapsed by default',await page.locator('.citation-list[open]').count()===0);
  const latest=page.locator('.agent-turn').last();
  await latest.locator('.citation-list>summary').click();await latest.locator('.readable-citation>summary').first().click();
  check('M exact evidence expands within conversation',await latest.locator('blockquote').first().isVisible());
  check('M evidence expansion preserves composer',await page.locator('#agent-form').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}));
  await latest.getByRole('button',{name:'Helpful answer',exact:true}).click();await page.waitForFunction(()=>document.body.textContent.includes('Feedback recorded. Thank you.'));
  check('public feedback persisted',await page.evaluate(async()=>((await(await fetch('/api/state')).json()).agent.feedback.length===1)));
  for(const width of [1440,768,375]){await page.setViewportSize({width,height:width===375?812:1000});check('no overflow at '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/playwright/contextual-'+arm+'-'+width+'.png',fullPage:true});}
 }catch(e){error=String(e);}
 page.off('pageerror',pageError);check('no browser exceptions',errors.length===0,errors);
 return {schema:'pathway-contextual-core-v1',timestamp:new Date().toISOString(),arm,environment:'Live public Render; frozen paired prompts; configured provider',results,responses,latencies,errors,...(error?{error}:{})};
}

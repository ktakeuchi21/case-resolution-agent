async page => {
 const results=[];const check=(name,pass,detail)=>{results.push({name,pass:!!pass,...(detail?{detail}:{})});if(!pass)throw new Error(name+' failed');};
 const live=page.url().startsWith('https://case-resolution-agent.onrender.com');
 const responses=[],captures=[];const capture=r=>{if(r.url().endsWith('/api/conversation')&&r.request().method()==='POST')captures.push(r.json().then(body=>responses.push(body)).catch(error=>responses.push({captureError:String(error)})));};page.on('response',capture);
 let error;
 try {
 const journeyStart=Date.now();
 if(await page.getByRole('button',{name:'Launch guided demo',exact:true}).count()){await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await page.getByRole('heading',{name:'Choose knowledge. Start talking.',exact:true}).waitFor();check('homepage launch reaches focused knowledge selection',true);await page.getByRole('button',{name:'Use sample knowledge →',exact:true}).click();await page.getByRole('textbox',{name:'Message Pathway',exact:true}).waitFor();check('sample choice opens chat without confirmation',await page.locator('#agent-form').count()===1);check('active knowledge is readable and changeable',(await page.locator('.knowledge-context').innerText()).includes('Alder prior authorization knowledge'));}
 let calls=0;page.on('request',r=>{if(r.url().endsWith('/api/conversation')&&r.method()==='POST')calls++;});
 await page.setViewportSize({width:1440,height:1000});
 const box=()=>page.getByRole('textbox',{name:'Message Pathway',exact:true});
 check('single composer with no per-message attestation',await page.locator('#agent-form textarea').count()===1&&await page.locator('#agent-form select,#agent-form input[type=checkbox]').count()===0);
 await box().fill('What should happen next?');await box().press('Shift+Enter');
 check('Shift+Enter inserts newline',(await box().inputValue()).endsWith('\n'));check('Shift+Enter does not send',calls===0);
 await box().fill('What should happen next?');const start=Date.now();await box().press('Enter');await page.locator('.agent-turn').first().waitFor();
 await page.waitForFunction(()=>document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false');
 check('Enter sends exactly one turn',calls===1);check('composer clears on success',(await box().inputValue())==='');
 check('focus returns to composer',await box().evaluate(n=>n===document.activeElement));
 check('first answer has citations and next action',await page.locator('.agent-turn .readable-citation').count()>0&&await page.locator('.agent-turn .answer-next').count()===1,{elapsedMs:Date.now()-start,launchToFirstAnswerMs:Date.now()-journeyStart});
 await Promise.all(captures);if(live){check('configured provider is the default',responses[0]?.audit?.method==='model-synthesis');check('awake launch reaches useful answer within 30 seconds',Date.now()-journeyStart<30000);}
 await box().fill('Why?');await box().press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.agent-turn').length===2&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false');
 check('Why uses preceding context',(await page.locator('.agent-turn').last().innerText()).includes('previous turn'));
 await box().fill('Summarize this case for a supervisor.');await box().press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.agent-turn').length===3&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false');
 check('natural summary produces a work product',await page.locator('.agent-turn').last().locator('.work-product').count()===1);
 await box().fill('Draft an office email.');await box().press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.agent-turn').length===4&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false');
 check('natural email draft is unsent',(await page.locator('.agent-turn').last().innerText()).includes('not sent'));
 const originalDraftLength=(await page.locator('.agent-turn').last().locator('.product-text').innerText()).length;
 await box().fill('Make that warmer and shorter.');await box().press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.agent-turn').length===5&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false');
 check('shorter refinement reduces the work-product text',(await page.locator('.agent-turn').last().locator('.product-text').innerText()).length<originalDraftLength);
 check('warm refinement uses existing draft',(await page.locator('.agent-turn').last().innerText()).includes('warm tone'));
 await box().fill('Turn it into an SMS.');await box().press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.agent-turn').length===6&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false');
 check('SMS conversion stays generic',!(await page.locator('.agent-turn').last().locator('.product-text').innerText()).includes('signed office note'));
 const beforeFailure=calls;let releaseFailure;const gate=new Promise(r=>releaseFailure=r);
 await page.route('**/api/conversation',async route=>{await gate;await route.abort('failed');},{times:1});
 await box().fill('What should happen next?');await box().press('Enter');
 check('meaningful loading feedback',await page.getByRole('status').filter({hasText:'Checking the case and eligible evidence'}).count()===1);
 await box().press('Enter');check('pending composer prevents duplicate submit',await page.getByRole('button',{name:'Working…',exact:true}).isDisabled());
 releaseFailure();await page.getByRole('button',{name:'Retry message',exact:true}).waitFor();
 check('failure retains unsent draft',(await box().inputValue())==='What should happen next?');check('duplicate pending request prevented',calls===beforeFailure+1);
 await page.getByRole('button',{name:'Retry message',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.agent-turn').length===7&&document.querySelector('#agent-form')?.getAttribute('aria-busy')==='false');
 check('inline retry succeeds',(await box().inputValue())==='');
 await page.getByRole('button',{name:'Acknowledge for this session',exact:true}).click();await page.reload();await box().waitFor();
 check('session acknowledgement survives reload',await page.getByRole('button',{name:'Acknowledge for this session',exact:true}).count()===0);
 for(const width of [1440,768,375]){
  await page.setViewportSize({width,height:width===375?812:1000});
  const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth,composer:document.querySelector('.agent-composer').getBoundingClientRect(),stream:document.querySelector('.conversation-stream').getBoundingClientRect()}));
  check('no horizontal page overflow at '+width,!overflow.page);
  check('composer does not cover transcript at '+width,overflow.composer.top>=overflow.stream.bottom-1);
  if(width<1000){await page.getByRole('button',{name:'Menu',exact:true}).click();check('responsive navigation visible at '+width,await page.getByRole('navigation',{name:'Workspace',exact:true}).isVisible());const clipped=await page.locator('.side-nav a').evaluateAll(nodes=>nodes.some(n=>n.scrollWidth>n.clientWidth));check('navigation labels not clipped at '+width,!clipped);await page.getByRole('button',{name:'Close menu',exact:true}).press('Escape');}
  await page.screenshot({path:'output/playwright/conversation-'+width+'.png',fullPage:true});
 }
 }catch(caught){error=String(caught);}
 await Promise.all(captures);page.off('response',capture);
 return {schema:'pathway-conversation-browser-check-v1',timestamp:new Date().toISOString(),environment:live?'Public Render deployment; configured live provider':'Local browser; deterministic composition, no live-quality claim',results,responses,...(error?{error}:{})};
}

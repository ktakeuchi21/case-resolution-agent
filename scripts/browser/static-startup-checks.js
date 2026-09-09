async page => {
 const base='http://127.0.0.1:3013',results=[],errors=[];let clockInstalled=false;
 const check=(name,pass,detail)=>{results.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw new Error(name);};
 async function visitor({healthy=true,clock=false}={}){
  const context=page.context(),p=page,calls=[];await p.goto('about:blank');await p.unrouteAll();await context.clearCookies();if(clockInstalled)await p.clock.resume();
  const control={healthy};p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/healthz'||u.pathname.startsWith('/api/'))calls.push({path:u.pathname,method:r.method()});});
  await p.route('**/healthz',r=>r.fulfill({status:control.healthy?200:503,contentType:'application/json',body:JSON.stringify(control.healthy?{status:'ok',service:'pathway-agent'}:{status:'starting'})}));
  if(clock&&!clockInstalled){await p.clock.install();clockInstalled=true;}return {p,calls,control};
 }
 const created=calls=>calls.filter(x=>x.path==='/api/demo'&&x.method==='POST').length;
 let error;
 try{
  const cold=await visitor({healthy:false,clock:true}),p=cold.p;
  await p.goto(base);await p.getByRole('heading',{name:'Keep the case moving. Keep the evidence close.'}).waitFor();
  check('landing renders while backend is unavailable',await p.locator('.hero').isVisible());
  check('landing creates no session or case',!cold.calls.some(x=>x.path.startsWith('/api/')));
  await p.clock.runFor(100);check('arrival starts background readiness only',cold.calls.some(x=>x.path==='/healthz')&&!cold.calls.some(x=>x.path.startsWith('/api/')));
  await p.getByRole('button',{name:'Launch guided demo',exact:true}).first().evaluate(b=>{b.click();b.click();});
  await p.getByRole('heading',{name:'Preparing your workspace…'}).waitFor();
  check('workspace entry has accessible busy state',await p.locator('main').getAttribute('aria-busy')==='true');
  await p.clock.runFor(10500);check('slow-start explanation appears after ten seconds',(await p.locator('#connection-status').innerText()).includes('about a minute'));
  for(const width of [1440,768,375]){
   await p.setViewportSize({width,height:width===375?812:1000});
   check('loading controls visible without overflow at '+width,await p.evaluate(()=>{const r=document.querySelector('#back-overview').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&r.bottom<=innerHeight&&r.top>=0;}));
   await p.screenshot({path:'output/playwright/static-loading-'+width+'.png'});
  }
  await p.emulateMedia({reducedMotion:'reduce'});check('loading animation respects reduced motion',await p.locator('.connection-spinner').evaluate(n=>getComputedStyle(n).animationName)==='none');
  cold.control.healthy=true;await p.clock.resume();
  await p.getByRole('heading',{name:'Choose knowledge. Start talking.'}).waitFor({timeout:25000});
  check('automatic continuation creates exactly one case despite repeated clicks',created(cold.calls)===1);
  const firstState=await p.evaluate(async()=>await(await fetch('/api/state')).json());
  await p.goto(base+'/#workspace');await p.locator('.shell').waitFor();
  const restored=await p.evaluate(async()=>await(await fetch('/api/state')).json());
  check('returning deep link restores the case without creation',created(cold.calls)===1&&JSON.stringify(firstState.timeline)===JSON.stringify(restored.timeline));
  const delayed=await visitor();await delayed.p.goto(base);await delayed.p.waitForResponse(r=>r.url().endsWith('/healthz'));
  check('successful background wake still creates no session',!delayed.calls.some(x=>x.path.startsWith('/api/')));
  await delayed.p.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await delayed.p.locator('.knowledge-picker').waitFor();check('launch after readiness proceeds once',created(delayed.calls)===1);
  const timeout=await visitor({healthy:false,clock:true});await timeout.p.goto(base+'/#agent');await timeout.p.getByRole('heading',{name:'Preparing your workspace…'}).waitFor();
  await timeout.p.clock.runFor(91000);await timeout.p.getByRole('heading',{name:'Workspace connection unavailable'}).waitFor();
  check('timeout creates no session or case',!timeout.calls.some(x=>x.path.startsWith('/api/')));
  timeout.control.healthy=true;await timeout.p.clock.resume();await timeout.p.getByRole('button',{name:'Retry',exact:true}).click();await timeout.p.locator('.knowledge-picker').waitFor({timeout:25000});check('retry after readiness failure opens the new-visitor knowledge flow once',created(timeout.calls)===1);
  const cancelled=await visitor({healthy:false,clock:true});await cancelled.p.goto(base+'/#workspace');await cancelled.p.getByRole('button',{name:'Back to overview'}).click();await cancelled.p.locator('.hero').waitFor();cancelled.control.healthy=true;await cancelled.p.clock.runFor(20000);
  check('back cancels workspace entry without creating a session',await cancelled.p.locator('.hero').isVisible()&&!cancelled.calls.some(x=>x.path.startsWith('/api/')));
  const interrupted=await visitor();let posts=0;
  await interrupted.p.route('**/api/demo',async r=>{posts++;await r.fetch();await r.abort('failed');});
  await interrupted.p.goto(base);await interrupted.p.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await interrupted.p.getByRole('button',{name:'Retry',exact:true}).waitFor();
  await interrupted.p.getByRole('button',{name:'Retry',exact:true}).click();await interrupted.p.locator('.knowledge-picker').waitFor();
  check('an interrupted successful creation is recovered by GET without replaying POST',posts===1);
  const absent=await visitor();let rejectedPosts=0;
  await absent.p.route('**/api/demo',async r=>{rejectedPosts++;await r.abort('failed');});await absent.p.goto(base);await absent.p.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await absent.p.getByRole('button',{name:'Retry',exact:true}).waitFor();await absent.p.getByRole('button',{name:'Retry',exact:true}).click();await absent.p.getByText('The connection is ready, but no workspace was found. Return to the overview and launch the demo again.',{exact:true}).waitFor();
  check('connection retry never replays a failed creation POST',rejectedPosts===1);
  check('no browser exceptions',errors.length===0,errors);
 }catch(e){error=String(e);}
 // The CLI owns browser lifetime; retain contexts until its result is captured.
 return {schema:'pathway-static-startup-browser-v1',timestamp:new Date().toISOString(),environment:'Local actual frontend and synthetic database; readiness delays controlled in the browser; zero live model calls',results,errors,...(error?{error}:{})};
}

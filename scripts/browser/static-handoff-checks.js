async page => {
 const frontend='https://case-resolution-frontend.onrender.com',backend='https://case-resolution-agent.onrender.com',local='http://127.0.0.1:3013';
 const results=[],errors=[];let error,clockInstalled=false;
 const check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw new Error(name);};
 page.on('pageerror',e=>errors.push(e.message));
 async function visitor(healthy=true){
  await page.goto('about:blank');await page.unrouteAll();await page.context().clearCookies();if(clockInstalled)await page.clock.resume();
  const control={healthy},requests=[];
  // Serve the real local assets and fixture APIs at the two production origins.
  // These routes intercept every request before any public backend request can occur.
  for(const origin of [frontend,backend])await page.route(origin+'/**',async r=>{
   const url=new URL(r.request().url());requests.push({origin:url.origin,path:url.pathname,method:r.request().method()});
   if(url.pathname==='/healthz'){await r.fulfill({status:control.healthy?200:503,contentType:'application/json',body:JSON.stringify(control.healthy?{status:'ok',service:'pathway-agent'}:{status:'starting'})});return;}
   const response=await r.fetch({url:local+url.pathname+url.search,headers:{...r.request().headers(),origin:local}});await r.fulfill({response});
  });
  return {control,requests};
 }
 try{
  const cold=await visitor(false);await page.clock.install();clockInstalled=true;
  await page.goto(frontend);await page.locator('.hero').waitFor();
  check('static overview appears while readiness is unavailable',await page.locator('.hero').isVisible());
  await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().evaluate(b=>{b.click();b.click();});
  await page.getByRole('heading',{name:'Preparing your workspace…'}).waitFor();
  check('readiness failure does not navigate or create a session',new URL(page.url()).origin===frontend&&!cold.requests.some(r=>r.path.startsWith('/api/')));
  await page.clock.runFor(10500);check('slow explanation remains accessible before handoff',(await page.locator('#connection-status').innerText()).includes('about a minute'));
  for(const width of [1440,768,375]){await page.setViewportSize({width,height:width===375?812:1000});check('handoff loading screen fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#back-overview').getBoundingClientRect().bottom<=innerHeight));}
  await page.emulateMedia({reducedMotion:'reduce'});check('handoff loading respects reduced motion',await page.locator('.connection-spinner').evaluate(n=>getComputedStyle(n).animationName)==='none');
  cold.control.healthy=true;await page.clock.resume();await page.locator('.knowledge-picker').waitFor({timeout:25000});
  check('ready handoff opens knowledge selection at backend origin',new URL(page.url()).origin===backend);
  check('static origin never requests sessions or creates a case',!cold.requests.some(r=>r.origin===frontend&&r.path.startsWith('/api/')));
  check('repeated clicks create exactly one case at backend',cold.requests.filter(r=>r.path==='/api/demo'&&r.method==='POST').length===1);
  check('public handoff parameters are removed from browser address',!new URL(page.url()).searchParams.has('entryStarted')&&!new URL(page.url()).searchParams.has('entryScenario'));
  const first=await page.evaluate(async()=>await(await fetch('/api/session')).json());
  await page.goBack();await page.locator('.hero').waitFor();check('browser Back stays on the overview without a handoff loop',new URL(page.url()).origin===frontend&&new URL(page.url()).hash==='#home');
  await page.goto(frontend+'/#studio');await page.locator('.shell').waitFor();const restored=await page.evaluate(async()=>await(await fetch('/api/session')).json());
  check('static direct links restore the requested backend route and case',new URL(page.url()).hash==='#studio'&&restored.data.demoId===first.data.demoId);
  check('restoring a direct link does not duplicate the case',cold.requests.filter(r=>r.path==='/api/demo'&&r.method==='POST').length===1);
  await page.getByRole('link',{name:'Pathway Agent portfolio',exact:true}).click();await page.locator('.hero').waitFor();check('workspace overview link returns to the CDN',new URL(page.url()).origin===frontend);
  const delayed=await visitor(),ready=page.waitForResponse(r=>r.url().endsWith('/healthz'));await page.goto(frontend);await ready;check('background readiness creates no session before delayed Launch',!delayed.requests.some(r=>r.path.startsWith('/api/')));
  await page.locator('[data-launch="exception"]').click();await page.locator('.shell').waitFor();const exception=await page.evaluate(async()=>await(await fetch('/api/session')).json());check('handoff preserves the selected exception scenario',exception.data.scenario==='exception'&&new URL(page.url()).hash==='#workspace');
  const timed=await visitor(false);await page.goto(frontend+'/#agent');await page.clock.runFor(91000);await page.getByRole('button',{name:'Retry',exact:true}).waitFor();check('timeout remains on the frontend without creating a session',new URL(page.url()).origin===frontend&&!timed.requests.some(r=>r.path.startsWith('/api/')));
  timed.control.healthy=true;await page.clock.resume();await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.knowledge-picker').waitFor();check('retry after timeout hands off once and creates one case',timed.requests.filter(r=>r.path==='/api/demo'&&r.method==='POST').length===1);
  const back=await visitor(false);await page.goto(frontend+'/#workspace');await page.getByRole('button',{name:'Back to overview'}).click();await page.locator('.hero').waitFor();back.control.healthy=true;await page.clock.runFor(20000);check('Back cancels the pending handoff',new URL(page.url()).origin===frontend&&!back.requests.some(r=>r.path.startsWith('/api/')));
  const expired=await visitor();await page.goto(backend+'/?entryStarted='+(Date.now()-91000)+'&entryScenario=golden#workspace');await page.getByRole('button',{name:'Retry',exact:true}).waitFor();check('the 90-second budget survives the origin change',!expired.requests.some(r=>r.path.startsWith('/api/')));
  const hostile=await visitor();await page.goto(frontend+'/?redirect=https://untrusted.example#https://untrusted.example');await page.locator('.knowledge-picker').waitFor();check('query and route text cannot choose another destination',new URL(page.url()).origin===backend&&!new URL(page.url()).search);
  check('no handoff browser exceptions',errors.length===0);
 }catch(e){error=String(e);}
 return {schema:'pathway-static-handoff-browser-v1',timestamp:new Date().toISOString(),environment:'Production-origin navigation with all frontend/backend requests intercepted to local real assets and isolated fixture APIs; zero public service or model calls',results,errors,...(error?{error}:{})};
}

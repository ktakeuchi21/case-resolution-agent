async page => {
 const front='https://case-resolution-frontend.onrender.com',back='https://case-resolution-agent.onrender.com',local='http://127.0.0.1:3017';
 const results=[],errors=[],contexts=[],website='00000000-0000-4000-8000-000000000001';let modelCalls=0,lastPage,lastRequests;
 const check=(name,pass,detail)=>{results.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw new Error(name);};
 async function visitor(options={}){
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}});contexts.push(context);
  const p=await context.newPage(),events=[],requests=[],control={healthy:options.healthy!==false};
  lastPage=p;lastRequests=requests;
  p.on('pageerror',error=>errors.push(error.message));
  if(options.dnt)await context.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{value:'1'}));
  if(options.gpc)await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
  if(options.excluded)await context.addInitScript(()=>localStorage.setItem('umami.disabled','1'));
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),observation={origin:url.origin,path:url.pathname,method:request.method()};requests.push(observation);
   if(url.origin==='https://gateway.umami.is'){
    if(options.collectorBlocked)return route.abort();
    const headers={'access-control-allow-origin':request.headers().origin??front,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type,x-umami-website-id,x-umami-hostname,x-umami-cache'};
    if(request.method()==='POST')events.push(request.postDataJSON());
    return route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify({cache:'synthetic-analytics-cache'})});
   }
   if(![front,back,local].includes(url.origin))return route.abort();
   if(url.pathname==='/healthz')return route.fulfill({status:control.healthy?200:503,contentType:'application/json',body:JSON.stringify(control.healthy?{status:'ok',service:'pathway-agent'}:{status:'starting'})});
   if(url.pathname==='/analytics-config.js')return route.fulfill({contentType:'text/javascript',body:`export const analyticsWebsiteId=${options.unconfigured?'null':JSON.stringify(website)};`});
   if(url.pathname==='/vendor/umami.js'&&options.scriptBlocked)return route.abort();
   if(['/api/conversation','/api/agent','/api/chat','/api/studio-query'].includes(url.pathname)){modelCalls++;return route.abort();}
   const response=await route.fetch({url:local+url.pathname+url.search,timeout:30000});
   observation.status=response.status();await route.fulfill({response});
  });
  return {p,context,events,requests,control};
 }
 async function count(v,total){await v.p.waitForFunction(()=>true);for(let i=0;i<60&&v.events.length<total;i++)await new Promise(r=>setTimeout(r,50));check('expected page-view count '+total,v.events.length===total,{actual:v.events.length});}
 let error;
 try{
  const v=await visitor({healthy:false}),p=v.p;
  await p.goto(front+'/?private=ANALYTICS_CONTENT_CANARY');await p.locator('.hero').waitFor();await count(v,1);
  check('unavailable backend does not delay overview tracking or create a session',v.events[0].payload.title==='Overview'&&!v.requests.some(r=>[front,back,local].includes(r.origin)&&r.path.startsWith('/api/')));
  await p.getByRole('link',{name:'The approach',exact:true}).click();await count(v,2);check('hash navigation has its own readable page name',v.events[1].payload.title==='Approach');
  await p.goBack();await count(v,3);await p.goForward();await count(v,4);
  await p.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await p.getByRole('heading',{name:'Preparing your workspace…'}).waitFor();
  await p.waitForTimeout(350);check('connection loading does not count an undisplayed workspace page',v.events.length===4);
  await p.getByRole('button',{name:'Back to overview',exact:true}).click();await p.locator('.hero').waitFor();await count(v,5);
  v.control.healthy=true;await p.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await p.locator('.knowledge-picker').waitFor({timeout:25000});await count(v,6);
  check('static handoff records only the displayed backend knowledge page',v.events[5].payload.title==='Choose Knowledge'&&v.events[5].payload.hostname===new URL(back).hostname);
  await p.getByRole('button',{name:'Use sample knowledge →',exact:true}).click();await p.locator('#agent-text').waitFor();await count(v,7);
  await p.locator('#agent-text').fill('ANALYTICS_CONTENT_CANARY');await p.getByRole('combobox',{name:'Demo role',exact:true}).selectOption('manager');await p.waitForTimeout(300);
  check('role/message rendering does not add views or transmit content',v.events.length===7);
  const routes={workspace:'Case Workspace',studio:'Knowledge Studio',evidence:'Evidence',review:'Human Review',tour:'Walkthrough',settings:'Settings',evaluation:'Evaluation'};
  for(const [route,title] of Object.entries(routes)){
   await p.locator('nav[aria-label="Workspace"] a[href="#'+route+'"]').click();await p.locator('.shell').waitFor();await count(v,8+Object.keys(routes).indexOf(route));
   check('readable page: '+title,v.events.at(-1).payload.title===title);
  }
  const before=v.events.length;await p.waitForTimeout(400);check('asynchronous evaluation rerender is not a second page view',v.events.length===before);
  await p.locator('nav[aria-label="Workspace"] a[href="#agent"]').click();await p.locator('#agent-text').waitFor();await count(v,before+1);
  await p.reload();await p.locator('#agent-text').waitFor();await count(v,before+2);check('direct workspace reload records the restored displayed page once',v.events.at(-1).payload.title==='Chat');
  check('all transmitted payloads contain only bounded analytics fields',v.events.every(event=>event.type==='event'&&Object.keys(event.payload).every(k=>['website','hostname','url','title','referrer','language','screen'].includes(k))&&event.payload.referrer===''&&!/[?#]/.test(event.payload.url))&&!JSON.stringify(v.events).includes('ANALYTICS_CONTENT_CANARY'));
  check('no recorder, identify or performance calls',v.requests.filter(r=>r.origin==='https://gateway.umami.is').every(r=>r.path==='/api/send')&&v.events.every(event=>event.type==='event'&&!event.payload.id&&!event.payload.data&&!event.payload.name));
  await p.getByText('Visitor analytics',{exact:true}).click();await p.getByRole('button',{name:'Exclude this browser from analytics',exact:true}).click();await p.getByText('This browser is now excluded on this address.',{exact:true}).waitFor();
  const excludedCount=v.events.length;await p.locator('nav[aria-label="Workspace"] a[href="#workspace"]').click();await p.waitForTimeout(300);check('on-page browser exclusion stops subsequent analytics',v.events.length===excludedCount);
  for(const width of [1440,768,375]){
   await p.setViewportSize({width,height:width===375?812:1000});await p.getByText('Visitor analytics',{exact:true}).click();
   check('disclosure readable without horizontal overflow at '+width,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.locator('.analytics-notice').screenshot({path:'output/playwright/analytics-disclosure-'+width+'.png'});
   await p.getByText('Visitor analytics',{exact:true}).click();
  }
  for(const setting of ['dnt','gpc','excluded','unconfigured']){
   const x=await visitor({[setting]:true,healthy:false});await x.p.goto(front);await x.p.locator('.hero').waitFor();await x.p.waitForTimeout(150);
   check(setting+' prevents tracker load and collection',x.events.length===0&&!x.requests.some(r=>r.path==='/vendor/umami.js'));await x.context.close();
  }
  const dev=await visitor({healthy:false});await dev.p.goto(local);await dev.p.locator('.hero').waitFor();await dev.p.waitForTimeout(150);check('local development does not load analytics',!dev.requests.some(r=>r.path==='/vendor/umami.js'));await dev.context.close();
  for(const setting of ['scriptBlocked','collectorBlocked']){
   const x=await visitor({[setting]:true});await x.p.goto(front);await x.p.locator('.hero').waitFor();await x.p.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await x.p.locator('.knowledge-picker').waitFor({timeout:25000});
   check(setting+' leaves landing and workspace usable',await x.p.locator('.knowledge-picker').isVisible());await x.context.close();
  }
  check('no application browser exceptions',errors.length===0,errors);check('zero model requests',modelCalls===0);
 }catch(e){error=String(e);errors.push({url:lastPage?.url(),visible:await lastPage?.locator('main').innerText().catch(()=>''),requests:lastRequests?.slice(-12)});}
 for(const context of contexts)await context.close().catch(()=>{});
 return {schema:'pathway-analytics-browser-v1',timestamp:new Date().toISOString(),environment:'Actual local application and reviewed Umami tracker, synthetic database, virtual production host routing, intercepted collector, zero real analytics/model sends',results,errors,modelCalls,...(error?{error}:{})};
}

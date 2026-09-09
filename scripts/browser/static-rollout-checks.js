async page => {
 const base='https://case-resolution-frontend.onrender.com',workspace='https://case-resolution-agent.onrender.com',results=[],errors=[],measurements=[];
 const check=(name,pass,detail)=>{results.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw new Error(name);};
 const browser=page.context().browser();let other,error,upload,csrf;
 const call=(p,path,body,token)=>p.evaluate(async({path,body,token})=>{const r=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json',...(token?{'x-csrf-token':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,type:r.headers.get('content-type'),cache:r.headers.get('cache-control'),body:await r.json()};},{path,body,token});
 try{
  const requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.hero').waitFor();
  await page.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0);
  measurements.push(await page.evaluate(()=>({kind:'desktop_fresh_context',...Object.fromEntries(performance.getEntriesByType('paint').map(p=>[p.name,p.startTime])),ttfbMs:performance.getEntriesByType('navigation')[0].responseStart,heroObservedMs:performance.now()})));
  const headers=response.headers();
  check('CDN landing has CSP and browser protections',headers['content-security-policy']?.includes("frame-ancestors 'none'")&&headers['x-content-type-options']==='nosniff'&&headers['referrer-policy']==='no-referrer'&&headers['x-frame-options']==='DENY');
  check('landing issues no session request',!requests.some(p=>p.startsWith('/api/')));
  const health=await call(page,'/healthz');check('readiness rewrite returns uncached backend JSON',health.status===200&&health.body.service==='pathway-agent'&&health.cache?.includes('no-store'));
  await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await page.locator('.knowledge-picker').waitFor({timeout:95000});check('workspace runs at the backend address',new URL(page.url()).origin===workspace);check('frontend holds no session cookie',(await page.context().cookies(base)).every(c=>c.name!=='pathway_session'));
  const session=await call(page,'/api/session');csrf=session.body.csrf;
  check('handoff launch restores session and creates one backend case',session.status===200&&session.body.data?.demoId&&requests.filter(p=>p==='/api/demo').length===1&&session.cache?.includes('no-store'));
  const cookies=await page.context().cookies(workspace),cookie=cookies.find(c=>c.name==='pathway_session');
  check('backend first-party session cookie retains Secure HttpOnly and Strict',cookie?.secure&&cookie?.httpOnly&&cookie?.sameSite==='Strict'&&cookie?.domain==='case-resolution-agent.onrender.com',{secure:cookie?.secure,httpOnly:cookie?.httpOnly,sameSite:cookie?.sameSite,domain:cookie?.domain});
  const originalId=session.body.data.demoId,baseline=JSON.stringify(session.body.data.workflow);
  for(const token of [undefined,'invalid-csrf']){const denied=await call(page,'/api/demo',{scenario:'exception'},token);check((token?'incorrect':'missing')+' CSRF rejected at the selected request origin',denied.status===403&&denied.cache?.includes('no-store'));}
  const forbidden=await page.context().request.post(workspace+'/api/demo',{headers:{Origin:'https://untrusted.example','Content-Type':'application/json','x-csrf-token':csrf},data:{scenario:'exception'}});
  check('forged origin rejected at the selected request origin',forbidden.status()===403);
  const crossSite=await page.context().request.post(workspace+'/api/demo',{headers:{Origin:workspace,'Sec-Fetch-Site':'cross-site','Content-Type':'application/json','x-csrf-token':csrf},data:{scenario:'exception'}});
  check('cross-site metadata rejected at the selected request origin',crossSite.status()===403);
  const after=await call(page,'/api/state');check('rejected requests preserve workflow',JSON.stringify(after.body.workflow)===baseline);
  other=await browser.newContext();const second=await other.newPage();await second.goto(workspace);const sessionB=await call(second,'/api/session');
  check('separate visitor starts with an empty isolated session',sessionB.status===200&&sessionB.body.data===null&&sessionB.body.session.id!==session.body.session.id);
  const caseB=await call(second,'/api/demo',{scenario:'golden'},sessionB.body.csrf);check('separate visitor receives a distinct case',caseB.status===201&&caseB.body.demoId!==originalId);
  const text='Synthetic transport verification. The fictional office reviews the administrative document. This text contains no patient information and grants no action authority.\n';
  const uploaded=await page.evaluate(async({text,csrf})=>{const r=await fetch('/api/studio-upload',{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({name:'Synthetic transport check.txt',base64:btoa(text),synthetic:true})});return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()};},{text,csrf});
  upload=uploaded.body;check('synthetic upload parses at the selected request origin without caching',uploaded.status===200&&upload.parsed?.passages.length>0&&upload.status==='parsed'&&uploaded.cache?.includes('no-store'));
  const download=await page.evaluate(async id=>{const r=await fetch('/api/studio-original?id='+encodeURIComponent(id),{cache:'no-store'});return {status:r.status,body:await r.text(),cache:r.headers.get('cache-control'),disposition:r.headers.get('content-disposition')};},upload.id);
  check('original download round-trips bytes without caching',download.status===200&&download.body===text&&download.cache?.includes('no-store')&&download.disposition?.startsWith('attachment;'));
  const leaked=await call(second,'/api/studio-original?id='+encodeURIComponent(upload.id));check('another visitor cannot download the upload',leaked.status===404);
  const isolated=await call(second,'/api/state');check('another visitor cannot list the upload',isolated.body.knowledgeStudio.uploads.length===0);
  const csrfSwap=await call(second,'/api/demo',{scenario:'golden'},csrf);check('CSRF tokens are session-bound',csrfSwap.status===403);
  await page.goto(base+'/#studio');await page.locator('.shell').waitFor();const restored=await call(page,'/api/session');check('direct workspace navigation restores the existing session',restored.body.data.demoId===originalId&&requests.filter(p=>p==='/api/demo').length===3);
  // Explicit per-session evidence mode avoids provider calls. The exact query uses retained vectors.
  const supervisor=await call(page,'/api/action',{action:'role',role:'supervisor',idempotencyKey:crypto.randomUUID()},csrf);check('synthetic role action survives forwarding',supervisor.status===200);
  const preferences=supervisor.body.agent.preferences;
  const settings=await call(page,'/api/agent-preferences',{action:'settings',revision:preferences.revision,settings:{...preferences.settings,synthesis:'evidence'}},csrf);check('test session explicitly selects evidence mode',settings.status===200&&settings.body.settings.synthesis==='evidence');
  const streamed=await page.evaluate(async csrf=>{
   const start=performance.now(),r=await fetch('/api/conversation',{method:'POST',cache:'no-store',headers:{'content-type':'application/json','accept':'application/x-ndjson','x-csrf-token':csrf},body:JSON.stringify({text:'Which signed office note document is missing for this request?',idempotencyKey:crypto.randomUUID()})});
   const reader=r.body.getReader(),decoder=new TextDecoder(),chunks=[];let content='';
   for(;;){const {value,done}=await reader.read();if(done)break;const text=decoder.decode(value,{stream:true});content+=text;chunks.push({ms:performance.now()-start,stage:text.includes('"type":"stage"'),result:text.includes('"type":"result"')});}
   const records=content.trim().split('\n').map(s=>JSON.parse(s)),result=records.find(x=>x.type==='result')?.result;
   return {status:r.status,type:r.headers.get('content-type'),cache:r.headers.get('cache-control'),chunks,stages:records.filter(x=>x.type==='stage').map(x=>x.stage),requests:result?.audit.requests,method:result?.audit.method,hasResult:!!result,error:records.some(x=>x.type==='error')};
  },csrf);
  check('NDJSON stages and final response arrive uncached at the selected request origin',streamed.status===200&&streamed.type?.includes('application/x-ndjson')&&streamed.cache?.includes('no-store')&&streamed.stages.includes('retrieving')&&streamed.hasResult&&!streamed.error,streamed);
  check('backend delivers a status chunk before the final result',streamed.chunks.some((c,i)=>c.stage&&!c.result&&streamed.chunks.slice(i+1).some(x=>x.result)));
  check('transport test makes zero model calls',streamed.requests===0);
  const clean=await call(page,'/api/studio-action',{action:'delete',uploadId:upload.id,revision:upload.revision,idempotencyKey:crypto.randomUUID(),confirmed:true},csrf);check('verification upload is deleted',clean.status===200&&!clean.body.uploads.some(u=>u.id===upload.id));upload=null;
  for(const width of [1440,768,375]){await page.setViewportSize({width,height:width===375?812:1000});await page.goto(base+'/#home');await page.locator('.hero').waitFor();check('deployed landing fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/playwright/static-production-'+width+'.png'});}
  const fallback=await page.context().request.get('https://case-resolution-agent.onrender.com/');check('original backend frontend remains available',fallback.status()===200&&(await fallback.text()).includes('app.js'));
  check('no production browser exceptions',errors.length===0,errors);
 }catch(e){error=String(e);}finally{if(other)await other.close();if(upload?.id&&csrf)await call(page,'/api/studio-action',{action:'delete',uploadId:upload.id,revision:upload.revision,idempotencyKey:crypto.randomUUID(),confirmed:true},csrf).catch(()=>{});}
 return {schema:'pathway-static-rollout-browser-v1',timestamp:new Date().toISOString(),environment:'Public Render static overview, readiness rewrite and backend workspace handoff; isolated synthetic sessions; explicit evidence mode with retained vectors; no live model-quality claim',url:base,measurements,results,errors,...(error?{error}:{})};
}

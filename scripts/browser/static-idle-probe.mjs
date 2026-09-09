import {writeFile,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const idleStartedAt=new Date().toISOString(),idleMs=Number(process.argv[3]??960000);
console.log(JSON.stringify({phase:'idle_wait',idleStartedAt,idleMs}));
await new Promise(resolve=>setTimeout(resolve,idleMs));
const browser=await chromium.launch({channel:'chrome',headless:true});let report;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/healthz'||u.pathname.startsWith('/api/'))requests.push({origin:u.origin,path:u.pathname,method:r.method(),at:Date.now()});});
 const base='https://case-resolution-frontend.onrender.com',backend='https://case-resolution-agent.onrender.com';
 const health=page.waitForResponse(r=>r.url()===base+'/healthz'&&r.status()===200,{timeout:95000});
 const start=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.hero').waitFor();
 await page.waitForFunction(()=>performance.getEntriesByName('first-contentful-paint').length>0);
 const paint=await page.evaluate(()=>({firstContentfulPaintMs:performance.getEntriesByName('first-contentful-paint')[0].startTime,ttfbMs:performance.getEntriesByType('navigation')[0].responseStart,heroObservedMs:performance.now()}));
 await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();await page.getByRole('heading',{name:'Preparing your workspace…'}).waitFor();
 const loadingObservedMs=Date.now()-start;await page.screenshot({path:'output/playwright/static-idle-loading.png'});
 const healthy=await health,readinessMs=Date.now()-start;await page.locator('.knowledge-picker').waitFor({timeout:95000});
 const workspaceMs=Date.now()-start;
 report={schema:'pathway-static-idle-launch-v1',timestamp:new Date().toISOString(),idleStartedAt,idleMs,url:base,revision:'2a79b56e8bbecc94916c69c708ddabde0694b056',measurement:'No requests by this verifier during the idle interval; other visitors can prevent service sleep. No independent host sleep-state API used.',...paint,loadingObservedMs,readinessMs,workspaceMs,results:[{name:'landing visible within one second',pass:paint.firstContentfulPaintMs<1000},{name:'workspace reaches backend knowledge selection',pass:new URL(page.url()).origin===backend},{name:'static origin never creates a session',pass:!requests.some(r=>r.origin===base&&r.path.startsWith('/api/'))},{name:'one case creation after handoff',pass:requests.filter(r=>r.path==='/api/demo'&&r.method==='POST').length===1},{name:'readiness response is uncached',pass:healthy.headers()['cache-control']?.includes('no-store')===true},{name:'no browser exceptions',pass:errors.length===0}],errors,liveModelCalls:0};
}catch(e){report={schema:'pathway-static-idle-launch-v1',timestamp:new Date().toISOString(),idleStartedAt,idleMs,error:String(e),results:[]};process.exitCode=1;}finally{await browser.close();}
const body=JSON.stringify(report,null,2)+'\n',file='artifacts/mvp/static-idle-launch-'+createHash('sha256').update(body).digest('hex')+'.json';await writeFile(file,body,{flag:'wx',mode:0o444});await chmod(file,0o444);console.log(JSON.stringify({artifact:file,...report}));if(report.results.some(r=>!r.pass))process.exitCode=1;

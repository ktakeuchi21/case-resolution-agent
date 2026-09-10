import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [runtime,revision]=process.argv.slice(2);assert(runtime&&/^[a-f0-9]{40}$/.test(revision??''));
const {chromium}=await import(pathToFileURL(runtime).href),browser=await chromium.launch({channel:'chrome',headless:false});
const front='https://case-resolution-frontend.onrender.com',back='https://case-resolution-agent.onrender.com';
const events=[],responses=[],errors=[],results=[];let modelCalls=0,error,metrics;
const check=(name,pass)=>{results.push({name,pass:!!pass});assert(pass,name);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 // This is one explicitly counted acceptance visit, using an isolated browser.
 // No user profile, account cookie or application payload is read into the report.
 await context.route(/\/api\/(conversation|agent|chat|studio-query)(?:\?|$)/,route=>{modelCalls++;return route.abort();});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',request=>{if(request.url()==='https://gateway.umami.is/api/send'&&request.method()==='POST')events.push(request.postDataJSON());});
 page.on('response',response=>{if(response.url()==='https://gateway.umami.is/api/send'&&response.request().method()==='POST')responses.push(response.status());});
 const firstCollection=page.waitForResponse(r=>r.url()==='https://gateway.umami.is/api/send'&&r.request().method()==='POST',{timeout:20000});
 await page.goto(front);await page.locator('.hero').waitFor();await firstCollection;
 metrics=await page.evaluate(()=>({firstContentfulPaintMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,ttfbMs:performance.getEntriesByType('navigation')[0]?.responseStart}));
 check('overview event uses sanitized public route',events[0]?.payload.title==='Overview'&&events[0]?.payload.url==='/');
 await page.getByRole('link',{name:'The approach',exact:true}).click();
 await page.getByRole('button',{name:'Launch guided demo',exact:true}).first().click();
 await page.locator('.knowledge-picker').waitFor({timeout:90000});
 await page.getByRole('button',{name:'Use sample knowledge →',exact:true}).click();await page.locator('#agent-text').waitFor();
 await page.locator('nav[aria-label="Workspace"] a[href="#studio"]').click();await page.locator('.shell').waitFor();
 await page.locator('nav[aria-label="Workspace"] a[href="#evaluation"]').click();await page.getByRole('heading',{name:'What has actually been verified.',exact:true}).waitFor();
 await page.waitForTimeout(1500);
 check('all six controlled page entries collected once',events.length===6&&events.map(e=>e.payload.title).join('|')==='Overview|Approach|Choose Knowledge|Chat|Knowledge Studio|Evaluation');
 check('collector accepts all page requests',responses.length===6&&responses.every(status=>status>=200&&status<300));
 check('both production hostnames represented',new Set(events.map(e=>e.payload.hostname)).size===2);
 check('only allowlisted metadata and mapped paths transmitted',events.every(e=>e.type==='event'&&Object.keys(e.payload).every(k=>['website','hostname','url','title','referrer','language','screen'].includes(k))&&e.payload.referrer===''&&!/[?#]/.test(e.payload.url)));
 for(const origin of [front,back]){
  const r=await page.request.get(origin),csp=r.headers()['content-security-policy']??'';
  check('exact collector allowed with local scripts at '+origin,csp.includes("script-src 'self';")&&csp.includes("connect-src 'self' https://gateway.umami.is;")&&!csp.includes('unsafe-'));
 }
 check('no browser errors or model requests',errors.length===0&&modelCalls===0);
 await page.screenshot({path:'output/playwright/analytics-public-evaluation.png'});
}catch(e){error=String(e);}
finally{await browser.close();}
const report={schema:'pathway-analytics-public-v1',timestamp:new Date().toISOString(),revision,results,events,responses,metrics,errors,modelCalls,claim:'One deliberately counted six-page public acceptance visit. Collector responses are verified; private dashboard observation is recorded separately. No model calls or identity claims.',...(error?{error}:{})};
const bytes=JSON.stringify(report,null,2)+'\n',artifact='artifacts/mvp/analytics-public-'+createHash('sha256').update(bytes).digest('hex')+'.json';await writeFile(artifact,bytes,{flag:'wx',mode:0o444});console.log(JSON.stringify({artifact,passed:results.filter(r=>r.pass).length,total:results.length,metrics,error}));if(error||results.some(r=>!r.pass))process.exitCode=1;

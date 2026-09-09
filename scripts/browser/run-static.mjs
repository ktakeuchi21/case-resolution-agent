// Standalone fallback for batches that exceed the native CLI session lifetime.
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [runtime,group]=process.argv.slice(2);
if(!runtime||!['startup','transport','handoff','rollout'].includes(group))throw new Error('Provide an installed Playwright module path and startup, transport, handoff or rollout.');
const {chromium}=await import(pathToFileURL(runtime).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();
 const source=await readFile(new URL('static-'+group+'-checks.js',import.meta.url),'utf8');
 const report=await (new Function('return ('+source+')'))()(page);
 report.checkSourceSha256=createHash('sha256').update(source).digest('hex');
 const body=JSON.stringify(report,null,2)+'\n',file='artifacts/mvp/static-'+group+'-'+createHash('sha256').update(body).digest('hex')+'.json';
 await writeFile(file,body,{flag:'wx',mode:0o444});await chmod(file,0o444);
 console.log(JSON.stringify({artifact:file,passed:report.results.filter(r=>r.pass).length,total:report.results.length,error:report.error}));
 if(report.error||report.results.some(r=>!r.pass))process.exitCode=1;
}finally{await browser.close();}

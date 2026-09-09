import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [runtime]=process.argv.slice(2),{chromium}=await import(pathToFileURL(runtime).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const reports=[];
 for(const group of (process.argv[3]?[process.argv[3]]:['contextual-ui','static-startup','static-handoff'])){
  const context=await browser.newContext(),page=await context.newPage();
  if(group==='contextual-ui')await page.goto('http://127.0.0.1:3013');
  if(!['contextual-ui','static-startup','static-handoff'].includes(group))throw new Error('Choose an existing UI regression group.');
  const source=await readFile(new URL(group+'-checks.js',import.meta.url),'utf8'),report=await(new Function('return ('+source+')'))()(page);report.checkSourceSha256=createHash('sha256').update(source).digest('hex');reports.push({group,...report});await context.close();console.log(JSON.stringify({group,passed:report.results.filter(r=>r.pass).length,total:report.results.length,error:report.error}));
 }
 const body=JSON.stringify({timestamp:new Date().toISOString(),environment:'Local explicit fixture; no live model calls',reports},null,2)+'\n',file='artifacts/digital-worker/launchpad-regressions-'+createHash('sha256').update(body).digest('hex')+'.json';await writeFile(file,body,{flag:'wx',mode:0o444});console.log(file);if(reports.some(r=>r.error||r.results.some(c=>!c.pass)))process.exitCode=1;
}finally{await browser.close();}

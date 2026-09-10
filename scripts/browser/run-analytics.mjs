import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const runtime=process.argv[2];if(!runtime)throw new Error('Provide the installed Playwright runtime path. Start the local verification server on port 3017 with the two production public origins.');
const {chromium}=await import(pathToFileURL(runtime).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();
 const source=await readFile(new URL('analytics-checks.js',import.meta.url),'utf8');
 const report=await(new Function('return ('+source+')'))()(page);
 report.checkSourceSha256=createHash('sha256').update(source).digest('hex');
 const bytes=JSON.stringify(report,null,2)+'\n',artifact='artifacts/mvp/analytics-browser-'+createHash('sha256').update(bytes).digest('hex')+'.json';
 await writeFile(artifact,bytes,{flag:'wx',mode:0o444});console.log(JSON.stringify({artifact,passed:report.results.filter(r=>r.pass).length,total:report.results.length,error:report.error}));
 if(report.error||report.results.some(r=>!r.pass))process.exitCode=1;
}finally{await browser.close();}

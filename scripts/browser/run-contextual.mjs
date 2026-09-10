// Standalone fallback for native browser CLI batches that disconnect during
// long live runs. Execute the same frozen checks in a fresh, isolated browser.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [runtime,group='core',revision]=process.argv.slice(2);
if(!runtime||!['core','boundary'].includes(group)||!/^([a-f0-9]{40})$/.test(revision??''))throw new Error('Supply Playwright module, check group and full deployed revision.');
const sha=text=>createHash('sha256').update(text).digest('hex');
const cases=await readFile(new URL('contextual-cases.json',import.meta.url),'utf8');
if(sha(cases)!=='b69c46bfc4ddda87afbe57c3b225d2b59cecd613692b60dbd1884a736e93ae26')throw new Error('Frozen cases changed.');
const source=await readFile(new URL('contextual-'+group+'-checks.js',import.meta.url),'utf8');
const script=source.replace('__CASES__',cases).replace('__ARM__',JSON.stringify('redesigned'));
const {chromium}=await import(pathToFileURL(runtime).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 await mkdir('output/playwright',{recursive:true});
 const page=await browser.newPage();await page.goto('https://case-resolution-agent.onrender.com/',{timeout:90000});
 const report=await(new Function('return ('+script+')'))()(page);
 Object.assign(report,{casesSha256:sha(cases),checkSourceSha256:sha(source),deployedRevision:revision,browserRunner:'Standalone isolated Playwright fallback; unchanged check source'});
 const body=JSON.stringify(report,null,2)+'\n',file='artifacts/conversation/contextual-redesigned-'+sha(body)+'.json';
 await writeFile(file,body,{flag:'wx',mode:0o444});
 console.log(JSON.stringify({artifact:file,checks:report.results.length,failed:report.results.filter(r=>!r.pass).map(r=>r.name),error:report.error,responses:report.responses?.length}));
 if(report.error||report.results.some(r=>!r.pass))process.exitCode=1;
 if(group==='core'&&!report.error&&report.responses.some(r=>r.workProduct)){
  const copySource=await readFile(new URL('contextual-copy_products-checks.js',import.meta.url),'utf8');
  const copy=await(new Function('return ('+copySource.replace('__ARM__',JSON.stringify('redesigned'))+')'))()(page);
  Object.assign(copy,{casesSha256:sha(cases),checkSourceSha256:sha(copySource),deployedRevision:revision});
  const copyBody=JSON.stringify(copy,null,2)+'\n',copyFile='artifacts/conversation/contextual-redesigned-'+sha(copyBody)+'.json';await writeFile(copyFile,copyBody,{flag:'wx',mode:0o444});
  console.log(JSON.stringify({artifact:copyFile,checks:copy.results.length,failed:copy.results.filter(r=>!r.pass).map(r=>r.name),error:copy.error}));
  if(copy.error||copy.results.some(r=>!r.pass))process.exitCode=1;
 }
}finally{await browser.close();}

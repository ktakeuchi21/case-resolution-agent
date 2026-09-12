import assert from 'node:assert/strict';
import { readdirSync,readFileSync,mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { join,extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { textHash } from '../src/integrity.ts';
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):e.isFile()?[join(dir,e.name)]:[]);
const roots=['src','web','fixtures','migrations','docs','tests','scripts','artifacts/rebuild'];
let inspected=0;for(const file of roots.flatMap(walk)){
 if(!['.ts','.js','.json','.md','.html','.css','.sql','.txt','.svg'].includes(extname(file)))continue;
 const raw=readFileSync(file,'utf8');
 const text=file==='tests/app/security.test.ts'?raw.replace('postgresql:'+'//synthetic:test-secret@invalid/database','REVIEWED_SYNTHETIC_ERROR_CANARY'):raw;assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}|postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']+@/.test(text),'Potential credential in '+file+'; inspect privately');inspected++;
}
const dir=mkdtempSync(join(tmpdir(),'pathway-ignore-check-'));try{
 assert.equal(spawnSync('git',['init','--quiet',dir]).status,0);writeFileSync(join(dir,'.gitignore'),readFileSync('.gitignore'));
 for(const path of ['.env','.env.local','.env.production','.local/embeddings/vector.json','.local/postgres/data','dist/web/app.js','output/playwright/session.json'])assert.equal(spawnSync('git',['-C',dir,'check-ignore','--quiet',path]).status,0);
 assert.equal(spawnSync('git',['-C',dir,'check-ignore','--quiet','.env.example']).status,1);
}finally{rmSync(dir,{recursive:true});}
const checked=[];for(const dir of ['artifacts/phase2b-live','artifacts/phase2c','artifacts/phase2d','artifacts/rebuild']){
 for(const file of walk(dir)){const suffix=file.match(/-([a-f0-9]{64})\.json$/);if(suffix){assert.equal(textHash(readFileSync(file,'utf8')),suffix[1]);checked.push(file);}}
}
assert.equal(textHash(readFileSync('artifacts/phase2b-benchmark.json','utf8')),'06f526e60113b80a138ba605fcec2b29724315b675a5323a9ce2ddebf7207e6d');
const corpus=JSON.parse(readFileSync('fixtures/knowledge/corpus.json','utf8'));assert.equal(corpus.versions.length,19);
assert(corpus.documents.every((d:{provenance:{synthetic:boolean}})=>d.provenance.synthetic));
console.log(JSON.stringify({pass:true,scannedTextFiles:inspected,reviewedFalsePositive:'One explicit synthetic error-redaction canary in tests/app/security.test.ts',contentAddressedArtifactsVerified:checked.length,syntheticSourceVersions:19,ignoredSecretAndCachePaths:true,claim:'Reviewed synthetic fixture corpus; pattern scan is not universal secret or patient-data detection.'},null,2));

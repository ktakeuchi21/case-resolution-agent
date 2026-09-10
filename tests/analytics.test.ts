import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// @ts-expect-error Browser ES module intentionally has no build dependency.
import { analyticsPages, analyticsPermitted, createPageAnalytics, pagePayload } from '../web/analytics.js';
const websiteId='00000000-0000-4000-8000-000000000001';
function browser() {
 const values=new Map<string,string>(),sent:unknown[]=[],scripts:{src:string;dataset:Record<string,string>;events:Record<string,()=>void>;addEventListener:(event:string,cb:()=>void)=>void;remove:()=>void}[]=[];
 const scope={location:{origin:'https://case-resolution-frontend.onrender.com',href:'https://case-resolution-frontend.onrender.com/?secret=PRIVATE#arbitrary'},navigator:{language:'en-US',doNotTrack:'0',globalPrivacyControl:false},screen:{width:1440,height:900},localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)},document:{title:'PRIVATE DOCUMENT',referrer:'https://private.example/secret',createElement:()=>{const script={src:'',async:false,dataset:{},events:{} as Record<string,()=>void>,addEventListener(event:string,cb:()=>void){this.events[event]=cb;},remove(){}};scripts.push(script);return script;},head:{append(){}}},requestAnimationFrame:(cb:()=>void)=>cb(),setTimeout,clearTimeout,umami:{track:(payload:unknown)=>{sent.push(payload);return Promise.resolve();}}};
 return {scope,sent,scripts,values,analytics:createPageAnalytics({websiteId,scope})};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function loaded(b:ReturnType<typeof browser>){await tick();assert.equal(b.scripts.length,1);b.scripts[0]!.events.load!();await tick();}

test('analytics only emits fixed page names and paths, never URL/content/referrer data',()=>{
 const b=browser();
 assert.equal(Object.keys(analyticsPages).length,11);
 for(const route of Object.keys(analyticsPages)){
  const payload=pagePayload(route,websiteId,b.scope);
  assert.equal(payload.title,analyticsPages[route]);assert.equal(payload.url,route==='home'?'/':'/'+route);
  assert.deepEqual(Object.keys(payload).sort(),['hostname','language','referrer','screen','title','url','website']);
  assert(!JSON.stringify(payload).includes('PRIVATE'));assert.equal(payload.referrer,'');
 }
 for(const route of ['constructor','__proto__','agent?secret=PRIVATE','arbitrary','#agent',''])assert.equal(pagePayload(route,websiteId,b.scope),null);
 b.scope.navigator.language='private content';b.scope.screen.width=1e8;
 const payload=pagePayload('home',websiteId,b.scope);assert(!('language' in payload));assert(!('screen' in payload));
});

test('analytics requires configured website and exact production origin; honors DNT, GPC and exclusion',()=>{
 const b=browser();assert(analyticsPermitted(b.scope));
 b.scope.location.origin='https://case-resolution-agent.onrender.com';assert(analyticsPermitted(b.scope));
 for(const origin of ['http://case-resolution-agent.onrender.com','https://case-resolution-agent.onrender.com.attacker.invalid','http://localhost:3013']){b.scope.location.origin=origin;assert(!analyticsPermitted(b.scope));}
 b.scope.location.origin='https://case-resolution-frontend.onrender.com';
 b.scope.navigator.doNotTrack='1';assert(!analyticsPermitted(b.scope));b.scope.navigator.doNotTrack='yes';assert(!analyticsPermitted(b.scope));b.scope.navigator.doNotTrack='0';
 b.scope.navigator.globalPrivacyControl=true;assert(!analyticsPermitted(b.scope));b.scope.navigator.globalPrivacyControl=false;
 b.values.set('umami.disabled','1');assert(!analyticsPermitted(b.scope));b.values.clear();
 for(const id of [null,undefined,'','account-secret','https://bad.invalid'])assert.equal(pagePayload('home',id,b.scope),null);
 b.scope.localStorage.getItem=()=>{throw new Error('Storage inaccessible');};assert(!analyticsPermitted(b.scope));
});

test('only displayed route entries count; rerenders, readiness transitions and invalid routes do not inflate views',async()=>{
 const b=browser();b.analytics.view('home');b.analytics.view('home');await loaded(b);
 assert.equal(b.sent.length,1);b.analytics.view('agent',false);b.analytics.view('agent',false);assert.equal(b.sent.length,1);
 b.analytics.view('agent',true);b.analytics.view('agent');b.analytics.view('agent',false);b.analytics.view('agent',true);assert.equal(b.sent.length,2);
 b.analytics.view('home');b.analytics.view('agent');assert.equal(b.sent.length,4);
 b.analytics.view('PRIVATE',true);assert.equal(b.sent.length,4);
 b.analytics.pause();b.analytics.view('studio');assert.equal(b.sent.length,4);b.analytics.resume();b.analytics.view('agent');assert.equal(b.sent.length,5);
});

test('tracker stays manual and credentialless, with no automatic events or remote executable code',async()=>{
 const b=browser();b.analytics.view('home');await loaded(b);const script=b.scripts[0]!;
 assert.equal(script.src,'/vendor/umami.js');assert.equal(script.dataset.hostUrl,'https://gateway.umami.is');
 for(const key of ['autoTrack','autoPageview','performance'])assert.equal(script.dataset[key],'false');
 for(const key of ['doNotTrack','excludeSearch','excludeHash'])assert.equal(script.dataset[key],'true');
 assert.equal(script.dataset.fetchCredentials,'omit');assert.equal(script.dataset.websiteId,websiteId);
 const raw=readFileSync('web/vendor/umami.js','utf8');assert(raw.startsWith('/*!\nMIT License'));
 const upstream=raw.slice(raw.indexOf('*/\n')+3);
 assert.equal(createHash('sha256').update(upstream).digest('hex'),'f91822332c2a13f91e8fe29c0aeb169497cb1d870d31a099c5ecc8bea58ea3ac');
});

test('blocked script and provider failure are contained without retries or unhandled rejection',async()=>{
 const b=browser();b.analytics.view('home');await tick();b.scripts[0]!.events.error!();await tick();b.analytics.view('agent');assert.equal(b.sent.length,0);assert.equal(b.scripts.length,1);
 const c=browser();c.scope.umami.track=()=>Promise.reject(new Error('Offline'));c.analytics.view('home');await loaded(c);assert.doesNotThrow(()=>c.analytics.view('agent'));await tick();
});

test('queued events are bounded and an opt-out or page close discards pending views',async()=>{
 const b=browser();for(let i=0;i<40;i++)b.analytics.view(i%2?'home':'approach');await loaded(b);assert.equal(b.sent.length,20);
 const c=browser();c.analytics.view('home');await tick();assert(c.analytics.exclude());c.scripts[0]!.events.load!();await tick();assert.equal(c.sent.length,0);assert(c.analytics.excluded());
 const d=browser();d.analytics.view('home');await tick();d.analytics.pause();d.scripts[0]!.events.load!();await tick();assert.equal(d.sent.length,0);
});

test('unconfigured and local browser instances never load a tracker',async()=>{
 const b=browser();const analytics=createPageAnalytics({websiteId:null,scope:b.scope});analytics.view('home');
 b.scope.location.origin='http://127.0.0.1:3013';b.analytics.view('home');await tick();assert.equal(b.scripts.length,0);assert.equal(analytics.configured,false);
});

test('both hosting policies allow only the analytics collector in addition to existing same-origin connections',()=>{
 for(const path of ['render.yaml','src/app/server.ts']){
  const raw=readFileSync(path,'utf8');assert(raw.includes("script-src 'self';"));assert(raw.includes("connect-src 'self' https://gateway.umami.is;"));assert(!raw.includes('unsafe-inline'));assert(!raw.includes('unsafe-eval'));assert(raw.includes('geolocation=()'));
 }
});

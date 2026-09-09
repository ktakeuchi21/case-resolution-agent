const reports=[];
for(const base of ['https://case-resolution-agent.onrender.com','https://case-resolution-frontend.onrender.com']){
 const first=await fetch(base+'/api/session',{headers:{'accept-encoding':'identity'}}),session=await first.json(),cookie=first.headers.getSetCookie()[0]?.split(';')[0];
 if(!cookie||!session.csrf)throw new Error('Session unavailable');
 const call=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{cookie,origin:base,'content-type':'application/json','x-csrf-token':session.csrf},body:JSON.stringify(body)});if(!r.ok)throw new Error(path+':'+r.status);return r.json();};
 await call('/api/demo',{scenario:'golden'});
 const state=await call('/api/action',{action:'role',role:'supervisor',idempotencyKey:crypto.randomUUID()});
 await call('/api/agent-preferences',{action:'settings',revision:state.agent.preferences.revision,settings:{...state.agent.preferences.settings,synthesis:'evidence'}});
 const start=performance.now(),r=await fetch(base+'/api/conversation',{method:'POST',headers:{cookie,origin:base,'accept-encoding':'identity','content-type':'application/json','accept':'application/x-ndjson','x-csrf-token':session.csrf},body:JSON.stringify({text:'Which signed office note document is missing for this request?',idempotencyKey:crypto.randomUUID()})});
 const chunks=[],reader=r.body.getReader();let content='';for(;;){const {value,done}=await reader.read();if(done)break;const text=new TextDecoder().decode(value);content+=text;chunks.push({ms:Math.round(performance.now()-start),bytes:value.length,stage:text.includes('"type":"stage"'),result:text.includes('"type":"result"')});}
 const result=content.trim().split('\n').map(x=>JSON.parse(x)).find(x=>x.type==='result')?.result;
 reports.push({base,status:r.status,headers:Object.fromEntries(['content-type','content-encoding','cache-control','x-accel-buffering','transfer-encoding'].map(k=>[k,r.headers.get(k)])),chunks,providerRequests:result?.audit.requests});
}
console.log(JSON.stringify(reports,null,2));

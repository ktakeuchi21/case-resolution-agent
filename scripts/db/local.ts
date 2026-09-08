import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const bin=process.env.PATHWAY_PG_BIN??'/opt/homebrew/opt/postgresql@18/bin';
const root=resolve('.local/postgres'),data=join(root,'data'),socket=join(root,'socket');
const command=process.argv[2];
const run=(exe:string,args:string[])=>execFileSync(join(bin,exe),args,{stdio:'pipe',env:{...process.env,LC_ALL:'en_US.UTF-8'}}).toString();
try {
 if(command==='start'){
  const version=run('postgres',['--version']);if(!version.includes('18.6'))throw new Error('PINNED_POSTGRES_18_6_REQUIRED');
  mkdirSync(root,{recursive:true,mode:0o700});mkdirSync(socket,{recursive:true,mode:0o700});
  if(!existsSync(join(data,'PG_VERSION'))){
   run('initdb',['-D',data,'-U','pathway_owner','--encoding=UTF8','--locale=C','--auth-local=trust','--auth-host=reject']);
  }
  if(!existsSync(join(root,'local-config-v1'))){
   writeFileSync(join(data,'postgresql.auto.conf'),`listen_addresses = ''\nport = 55432\nunix_socket_directories = '${socket.replaceAll("'","''")}'\nunix_socket_permissions = 0700\n`,{mode:0o600});
   writeFileSync(join(root,'local-config-v1'),'private-socket-v1\n',{mode:0o600});
  }
  try{run('pg_ctl',['-D',data,'status']);}catch{run('pg_ctl',['-D',data,'-l',join(root,'server.log'),'-w','start']);}
  const args=['-h',socket,'-p','55432','-U','pathway_owner'];
  const found=run('psql',[...args,'-d','postgres','-Atc',"SELECT 1 FROM pg_database WHERE datname='pathway'"]).trim();
  if(!found)run('createdb',[...args,'pathway']);
  console.log('PostgreSQL 18.6 ready on project-private Unix socket; TCP disabled. Development data preserved.');
 }else if(command==='stop'){
  if(existsSync(join(data,'postmaster.pid')))run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  console.log('Local database stopped; data retained.');
 }else if(command==='status')console.log(run('pg_isready',['-h',socket,'-p','55432','-U','pathway_owner','-d','pathway']).trim());
 else throw new Error('Use start, status, or stop. Reset is a manual operation; no automated deletion.');
}catch {console.error('Local PostgreSQL command failed. Check the pinned binary path and private .local/postgres/server.log; raw connection/configuration values suppressed.');process.exitCode=1;}

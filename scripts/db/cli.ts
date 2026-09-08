import { Database, connection, migrate } from '../../src/db/database.ts';
import { seed } from '../../src/db/governance.ts';
import pg from 'pg';
const command=process.argv[2];
try {
 if(command==='migrate')console.log(JSON.stringify(await migrate(),null,2));
 else if(command==='status'){
  const p=new pg.Pool(connection(true));try{console.log(JSON.stringify((await p.query('SELECT name,sha256,applied_at FROM public.pathway_migrations ORDER BY name')).rows,null,2));}finally{await p.end();}
 }else if(command==='seed'){
  const db=new Database();try{console.log(JSON.stringify(await seed(db,process.argv[3]??'demo'),null,2));}finally{await db.close();}
 }else throw new Error('Unknown database command');
}catch {console.error('Database command failed; no credentials or raw database errors logged. Check migration status and local runbook.');process.exitCode=1;}

import pg from 'pg';
import { connection } from '../../src/db/database.ts';
import { passages, documents, packs } from '../../src/rag/corpus.ts';
import { hash as digest } from '../../src/integrity.ts';
const pool=new pg.Pool(connection(true));
const c=await pool.connect();
try {
 await c.query('BEGIN');
 for(const p of passages) {
  const body=JSON.stringify(p),hash=digest(p);
  const prior=await c.query('SELECT content_hash FROM rag.passages WHERE id=$1',[p.id]);
  if(prior.rowCount && prior.rows[0].content_hash!==hash) throw new Error('SEED_VERSION_COLLISION');
  await c.query("INSERT INTO rag.passages(id,pack_id,case_id,source_status,body,content_hash,search) VALUES($1,$2,$3,$4,$5,$6,to_tsvector('english',$7)) ON CONFLICT DO NOTHING",[p.id,p.packId,p.caseId,p.status,body,hash,p.title+' '+p.section+' '+p.text]);
 }
 await c.query('COMMIT');
 console.log(JSON.stringify({seeded:true,packs:packs.length,documents:documents.length,passages:passages.length,embeddings:'Awaiting bounded live server seeding'}));
} catch(e) {await c.query('ROLLBACK');throw e;} finally {c.release();await pool.end();}

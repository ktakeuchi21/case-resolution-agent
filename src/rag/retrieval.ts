import { hash } from '../integrity.ts';
import { createHash } from 'node:crypto';
import type { Database } from '../db/database.ts';
import { Passage, RagError } from './contracts.ts';
import type { PackId, RetrievedPassage, RetrievalTrace, Turn } from './contracts.ts';
import { getPack } from './corpus.ts';

export const embeddingModel='text-embedding-3-small';
export const dimensions=1536;
export const fingerprint=(s:string)=>createHash('sha256').update(s).digest('hex');
export function contextualQuery(question:string,packId:PackId,history:Turn[]) {
 const pack=getPack(packId);
 // A pack switch is a knowledge boundary: use only the contiguous same-pack suffix.
 const recent:Turn[]=[];
 for(const turn of history.toReversed()) {if(turn.packId!==packId)break;if(turn.status==='complete')recent.unshift(turn);if(recent.length===2)break;}
 const subject=recent.at(-1)?.response?.retrievalContext;
 return [`Selected synthetic case: ${pack.caseId}. ${pack.caseContext}`,subject?`Conversation subject: ${subject}`:'',
 recent.length?`Recent questions: ${recent.map(t=>t.question).join(' → ')}`:'',`Current question: ${question}`].filter(Boolean).join('\n');
}
export const eligible=(p:Passage,packId:PackId)=>p.packId===packId&&p.status==='current'&&(p.caseId===null||p.caseId===getPack(packId).caseId);
export function lexicalControl(query:string,corpus:Passage[],packId:PackId,limit=8):RetrievedPassage[] {
 const tokens=new Set(query.toLowerCase().match(/[a-z0-9]+/g)??[]);
 return corpus.filter(p=>eligible(p,packId)).map(p=>{
  const text=(p.title+' '+p.section+' '+p.text).toLowerCase();
  const score=[...tokens].filter(t=>t.length>2&&text.includes(t)).length;
  return {...p,score,rank:0,reason:'Matched words in the contextual question (lexical control).',includedInGeneration:true};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit).map((p,i)=>({...p,rank:i+1}));
}
export class PersistentRetrieval {
 readonly db:Database; readonly embed:(texts:string[])=>Promise<number[][]>;
 constructor(db:Database,embed:(texts:string[])=>Promise<number[][]>){this.db=db;this.embed=embed;}
 async ensureEmbeddings() {
  const c=await this.db.pool.connect();
  try {
   const lock=await c.query('SELECT pg_try_advisory_lock(2026091201) AS acquired');
   if(!lock.rows[0].acquired)throw new RagError('INDEX_BUSY');
   try {
    const rows=(await c.query('SELECT id,body,content_hash FROM rag.passages WHERE embedding IS NULL ORDER BY id')).rows;
    for(let start=0;start<rows.length;start+=48){
     const batch=rows.slice(start,start+48);
     const vectors=await this.embed(batch.map(r=>{const p=Passage.parse(r.body);if(hash(p)!==r.content_hash)throw new RagError('PASSAGE_INTEGRITY');return p.title+'\n'+p.section+'\n'+p.text;}));
     if(vectors.length!==batch.length)throw new RagError('EMBEDDING_INVALID');
     for(let i=0;i<batch.length;i++)await c.query('UPDATE rag.passages SET embedding=$2::vector,embedding_model=$3 WHERE id=$1 AND embedding IS NULL',[batch[i].id,JSON.stringify(vectors[i]),embeddingModel]);
    }
   } finally {await c.query('SELECT pg_advisory_unlock(2026091201)');}
  } finally {c.release();}
 }
 async warmQueries(queries:Array<{packId:PackId;text:string}>) {
  const missing:Array<{query:string;key:string}>=[];
  for(const item of queries){const query=contextualQuery(item.text,item.packId,[]),key=fingerprint(embeddingModel+'\n'+query);if(!(await this.db.pool.query('SELECT 1 FROM rag.query_vectors WHERE key=$1',[key])).rowCount)missing.push({query,key});}
  if(missing.length){const vectors=await this.embed(missing.map(x=>x.query));for(let i=0;i<missing.length;i++)await this.db.pool.query('INSERT INTO rag.query_vectors(key,embedding) VALUES($1,$2::vector) ON CONFLICT DO NOTHING',[missing[i]!.key,JSON.stringify(vectors[i])]);}
  return {queries:queries.length,newVectors:missing.length};
 }
 async search(question:string,packId:PackId,history:Turn[]=[]):Promise<RetrievalTrace> {
  const pack=getPack(packId),query=contextualQuery(question,packId,history),key=fingerprint(embeddingModel+'\n'+query);
  if((await this.db.pool.query('SELECT count(*)::int n FROM rag.passages WHERE pack_id=$1 AND embedding IS NULL',[packId])).rows[0].n)await this.ensureEmbeddings();
  let vector=(await this.db.pool.query('SELECT embedding::text AS vector FROM rag.query_vectors WHERE key=$1',[key])).rows[0]?.vector as string|undefined;
  if(!vector){vector=JSON.stringify((await this.embed([query]))[0]);await this.db.pool.query('INSERT INTO rag.query_vectors(key,embedding) VALUES($1,$2::vector) ON CONFLICT DO NOTHING',[key,vector]);}
  const rows=(await this.db.pool.query(`WITH eligible AS (
   SELECT *,row_number() OVER(ORDER BY embedding <=> $3::vector,id) AS vr,
   row_number() OVER(ORDER BY ts_rank_cd(search,websearch_to_tsquery('english',$4)) DESC,id) AS lr,
   ts_rank_cd(search,websearch_to_tsquery('english',$4)) AS lex,
   1-(embedding <=> $3::vector) AS cosine
   FROM rag.passages WHERE pack_id=$1 AND source_status='current' AND (case_id IS NULL OR case_id=$2)
   AND embedding_model=$5
  ) SELECT body,content_hash,cosine,lex,1.0/(40+vr)+CASE WHEN lex>0 THEN 1.0/(40+lr) ELSE 0 END AS score
  FROM eligible ORDER BY score DESC,body->>'id' LIMIT 8`,[packId,pack.caseId,vector,question,embeddingModel])).rows;
  const retrieved:RetrievedPassage[]=rows.map((r,i)=>{
   const p=Passage.parse(r.body);if(!eligible(p,packId)||hash(p)!==r.content_hash)throw new RagError('PASSAGE_INTEGRITY');
   return {...p,rank:i+1,score:Number(r.score),reason:Number(r.lex)>0?'Matches the question’s wording and meaning in the selected case.':'Matches the meaning of the question and recent conversation in the selected case.',includedInGeneration:true};
  });
  if(!retrieved.length)throw new RagError('KNOWLEDGE_UNAVAILABLE');
  return {question,query,packId,packName:pack.name,caseId:pack.caseId,method:'hybrid',passages:retrieved,citations:[]};
 }
}

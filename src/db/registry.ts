import type { PoolClient } from 'pg';
import { z } from 'zod';
import { Corpus, Id, Timestamp } from '../contracts.ts';
import type { DocumentVersion } from '../contracts.ts';
import { Registry } from '../registry.ts';
import { hash } from '../integrity.ts';
import { scoped, validateRow } from './database.ts';
import type { Scope } from './database.ts';

export const GovernanceEvent=z.strictObject({id:Id,type:z.enum(['approval','retirement','supersession','conflict','publication','assignment']),targetId:Id,
 targetType:z.enum(['document_version','release','assignment']),actorId:Id,timestamp:Timestamp,reason:z.string().min(1),successorId:Id.nullable()});
export type GovernanceEvent=z.infer<typeof GovernanceEvent>;
export class DurableRegistry extends Registry {
  readonly events:GovernanceEvent[];
  readonly generation:string;
  readonly namespaceHash:string;
  constructor(corpus:Corpus,events:GovernanceEvent[],generation:string,namespaceHash:string) {
    super(corpus,namespaceHash);this.events=events;this.generation=generation;this.namespaceHash=namespaceHash;
    // Stable corpus namespace preserves validated cache keys; snapshot additionally binds current scoped contents/events.
    for(const e of events) {
      if(e.type==='retirement') super.retire(e.actorId,e.targetId,e.timestamp,e.reason,e.targetType==='release'?'release':'document_version');
      if(e.type==='conflict') super.reportConflict(e.actorId,e.targetId,e.timestamp);
    }
  }
  override snapshotHash(){return hash({corpus:this.corpus,events:this.events,generation:this.generation});}
  override supersededAt(v:DocumentVersion){return this.events.find(e=>e.type==='supersession'&&e.targetId===v.id)?.timestamp??super.supersededAt(v);}
}
const mapping={documents:'documents',versions:'versions',passages:'passages',packs:'packs',releases:'releases',assignments:'assignments',collections:'collections',cases:'cases',users:'users'} as const;
export async function loadRegistry(c:PoolClient,s:Scope):Promise<DurableRegistry> {
 const generation=await c.query('SELECT generation::text,fixture_hash FROM pathway.generations WHERE workspace=$1 AND tenant=$2 AND environment=$3',scoped(s));
 if(!generation.rowCount)throw new Error('WORKSPACE_SCOPE_UNAVAILABLE');
 // Read scoped immutable tables in one statement. Each row still passes its
 // schema and hash check, and every call still follows the governance lock.
 // This removes network round trips without caching authorization snapshots.
 const tables = [...Object.values(mapping), 'case_revisions', 'user_revisions', 'events'];
 const rows = await c.query(tables.map(table => `SELECT '${table}' AS kind,body,body_hash,sequence FROM pathway.${table} WHERE workspace=$1 AND tenant=$2 AND environment=$3`).join(' UNION ALL ') + ' ORDER BY kind,sequence', scoped(s));
 const data:Record<string,unknown[]>={};
 for(const [key,table] of Object.entries(mapping)) {
  const schema=Corpus.shape[key as keyof typeof mapping].element;
  data[key]=rows.rows.filter(row=>row.kind===table).map(row=>validateRow(row,schema as z.ZodType<unknown>));
 }
 for(const row of rows.rows.filter(row=>row.kind==='case_revisions')) {
  const context=validateRow(row,Corpus.shape.cases.element);
  const i=data.cases!.findIndex(x=>(x as {id:string}).id===context.id);if(i<0)throw new Error('Invalid case revision');data.cases![i]=context;
 }
 for(const row of rows.rows.filter(row=>row.kind==='user_revisions')) {const user=validateRow(row,Corpus.shape.users.element);const i=data.users!.findIndex(x=>(x as {id:string}).id===user.id);if(i<0)throw new Error('Invalid user revision');data.users![i]=user;}
 const events=rows.rows.filter(row=>row.kind==='events');
 return new DurableRegistry(Corpus.parse(data),events.map(r=>validateRow(r,GovernanceEvent)),generation.rows[0].generation,generation.rows[0].fixture_hash);
}

// Resolve explicit current case assignment under the caller's governance transaction.
export function caseSelection(registry:Registry,caseId:string){
 const context=registry.corpus.cases.find(c=>c.id===caseId);
 const assignment=registry.corpus.assignments.find(a=>a.id===context?.assignmentId);
 if(!context||!assignment)throw new Error('CASE_ASSIGNMENT_UNAVAILABLE');
 return {caseId,selectionId:assignment.id,releaseIds:assignment.releaseIds};
}

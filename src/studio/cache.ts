import type { PoolClient } from 'pg';
import type { EmbeddingCache, VectorRecord } from '../providers/embedding.ts';
import { validateEmbeddingRecord } from '../providers/embedding.ts';
import { HttpError } from '../app/session.ts';
export class TemporaryEmbeddingCache implements EmbeddingCache {
 readonly client:PoolClient;readonly workspace:string;readonly uploadId:string;readonly expiresAt:string;
 constructor(client:PoolClient,workspace:string,uploadId:string,expiresAt:string){Object.assign(this,{client,workspace,uploadId,expiresAt});this.client=client;this.workspace=workspace;this.uploadId=uploadId;this.expiresAt=expiresAt;}
 async get(key:string){const r=await this.client.query('SELECT body FROM portfolio.studio_vectors WHERE workspace=$1 AND upload_id=$2 AND key=$3 AND expires_at>clock_timestamp()',[this.workspace,this.uploadId,key]);return r.rows[0]?validateEmbeddingRecord(r.rows[0].body,key):null;}
 async put(record:VectorRecord){const valid=validateEmbeddingRecord(record,record.key),prior=await this.get(valid.key);if(prior){if(prior.vectorHash!==valid.vectorHash)throw new Error('TEMPORARY_VECTOR_COLLISION');return;}
  const count=(await this.client.query('SELECT count(*)::int n FROM portfolio.studio_vectors WHERE workspace=$1 AND expires_at>clock_timestamp()',[this.workspace])).rows[0].n;if(count>=512)throw new HttpError(429,'Temporary vector capacity reached. Delete or reprocess an upload before reindexing.');
  await this.client.query('INSERT INTO portfolio.studio_vectors(workspace,upload_id,key,body,expires_at) VALUES($1,$2,$3,$4,$5)',[this.workspace,this.uploadId,valid.key,JSON.stringify(valid),this.expiresAt]);
 }
}

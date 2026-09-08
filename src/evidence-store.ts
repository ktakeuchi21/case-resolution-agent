import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EvidenceBody, EvidenceRecord } from './contracts.ts';
import type { UserContext } from './contracts.ts';
import { canonical, freeze, hash } from './integrity.ts';

/** Append-only snapshots; exclusive file creation detects attempts to overwrite evidence. */
export class EvidenceStore {
  #records = new Map<string, EvidenceRecord>();
  #directory: string | undefined;
  constructor(directory?: string) {
    this.#directory = directory;
    if (directory) mkdirSync(directory, { recursive: true });
  }
  put(input: EvidenceBody): EvidenceRecord {
    const body = EvidenceBody.parse(input);
    const recordHash = hash(body);
    const record = freeze(EvidenceRecord.parse({ ...body, id: `EV-${recordHash}`, recordHash }));
    if (this.#directory) {
      const file = join(this.#directory, `${record.id}.json`);
      try { writeFileSync(file, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (canonical(JSON.parse(readFileSync(file, 'utf8'))) !== canonical(record)) throw new Error('Evidence overwrite or tampering detected');
      }
    }
    this.#records.set(record.id, record);
    return record;
  }
  get(id: string, user: UserContext): EvidenceRecord {
    if (!/^EV-[a-f0-9]{64}$/.test(id)) throw new Error('Invalid evidence ID');
    const input = this.#directory ? JSON.parse(readFileSync(join(this.#directory, `${id}.json`), 'utf8')) : this.#records.get(id);
    const record = EvidenceRecord.parse(input);
    const { id: actualId, recordHash, ...body } = record;
    if (hash(body) !== recordHash || actualId !== `EV-${recordHash}`) throw new Error('Evidence integrity failure');
    if (record.userContext.tenantId !== user.tenantId ||
        (record.caseContext && !user.caseIds.includes(record.caseContext.id)) ||
        (record.request.mode === 'sandbox' && record.userContext.id !== user.id) ||
        (record.userContext.id !== user.id && !user.roles.includes('evaluator'))) throw new Error('Historical evidence access denied');
    return freeze(record);
  }
}

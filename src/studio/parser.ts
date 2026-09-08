import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Hash } from '../contracts.ts';
import { textHash } from '../integrity.ts';
import { HttpError } from '../app/session.ts';
import { validateSyntheticText } from '../agent/safety.ts';

export const UPLOAD_LIMIT = 1024 * 1024;
export const TEXT_LIMIT = 64000;
export const ParserInput = z.strictObject({ name: z.string().min(1).max(100), base64: z.string().min(4).max(Math.ceil(UPLOAD_LIMIT / 3) * 4), synthetic: z.literal(true), chunkSize: z.number().int().min(300).max(1800).default(1000) });
export const ParsedPassage = z.strictObject({ id: z.string(), text: z.string().min(1).max(2400), textHash: Hash,
 location: z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive(), lineStart: z.number().int().positive(), lineEnd: z.number().int().positive(), section: z.string(), page: z.number().int().positive().nullable(), paragraph: z.number().int().positive().nullable(), table: z.object({ headers: z.array(z.string()), row: z.string(), footnote: z.string() }).nullable() }) });
export const ParsedDocument = z.strictObject({ name: z.string(), format: z.enum(['txt', 'md', 'pdf', 'docx']), bytes: z.number().int().positive(), originalHash: Hash, text: z.string().min(1).max(TEXT_LIMIT), textHash: Hash,
 parser: z.literal('bounded-documents-v1'), chunker: z.string(), passages: z.array(ParsedPassage).min(1).max(128), warnings: z.array(z.string()), pages: z.number().int().nonnegative(), processedAt: z.string() });
export type ParsedDocument = z.infer<typeof ParsedDocument>;
export function validateUpload(input: unknown) {
 const data = ParserInput.parse(input);
 if (!/^[\p{L}\p{N} _.()-]+\.(?:txt|md|pdf|docx)$/u.test(data.name) || data.name.startsWith('.') || /\.(?:exe|dll|sh|js|html|com|bat)\./i.test(data.name)) throw new HttpError(415, 'Choose a TXT, Markdown, PDF or DOCX file with a plain filename.');
 const bytes = Buffer.from(data.base64, 'base64');
 if (!bytes.length || bytes.length > UPLOAD_LIMIT || bytes.toString('base64') !== data.base64) throw new HttpError(413, 'The file must be valid base64 and no larger than 1 MB.');
 const format = data.name.split('.').at(-1)!.toLowerCase();
 if (format === 'pdf' && !bytes.subarray(0, 8).toString('ascii').startsWith('%PDF-')) throw new HttpError(422, 'The PDF signature does not match the file type.');
 if (format === 'docx' && !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]))) throw new HttpError(422, 'The DOCX signature does not match a document package.');
 if (format === 'txt' || format === 'md') {
  let text: string; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new HttpError(422, 'Text files must use valid UTF-8.'); }
  if (text.length > TEXT_LIMIT || /%PDF-|\u0000|<script|<!DOCTYPE html|^#!\//im.test(text)) throw new HttpError(422, 'Binary, executable, HTML or oversized text is not accepted as a text document.');
  validateSyntheticText(text);
 }
 return data;
}
export async function parseUpload(input: unknown): Promise<ParsedDocument> {
 const data = validateUpload(input);
 const worker = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './parse-worker.ts' : './parse-worker.js', import.meta.url));
 return new Promise((resolve, reject) => {
  // A separate, short-lived process bounds parser heap and elapsed time. It gets
  // no provider/database credentials and never receives a visitor-selected path.
  const child = fork(worker, [], { execArgv: ['--max-old-space-size=128'], env: { PATH: process.env.PATH ?? '', NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let settled = false;
  const finish = (error?: Error, parsed?: ParsedDocument) => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); if (error) reject(error); else resolve(parsed!); };
  const timer = setTimeout(() => finish(new HttpError(422, 'Parsing exceeded the 10-second limit. Try a smaller, simpler document.')), 10000);
  child.once('message', message => {
   try {
    const result = z.discriminatedUnion('ok', [z.strictObject({ ok: z.literal(true), parsed: ParsedDocument }), z.strictObject({ ok: z.literal(false), code: z.string().max(100) })]).parse(message);
    if (!result.ok) { finish(new HttpError(422, `Document could not be parsed safely: ${result.code}. Original content was not stored.`)); return; }
    validateSyntheticText(result.parsed.text);
    if (result.parsed.textHash !== textHash(result.parsed.text) || result.parsed.passages.some(p => result.parsed.text.slice(p.location.start, p.location.end) !== p.text || p.textHash !== textHash(p.text))) throw new Error('PASSAGE_FIDELITY_FAILURE');
    finish(undefined, result.parsed);
   } catch (e) { finish(e instanceof HttpError ? e : new HttpError(422, 'The parsed document failed its passage-integrity check.')); }
  });
  child.once('error', () => finish(new HttpError(503, 'The document parser is unavailable.')));
  child.once('exit', () => { if (!settled) finish(new HttpError(422, 'The parser stopped at a safety or resource limit.')); });
  child.send(data);
 });
}

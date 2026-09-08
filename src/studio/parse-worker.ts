import { createHash } from 'node:crypto';
import yauzl from 'yauzl';
import { SaxesParser } from 'saxes';
import { ParserInput, ParsedDocument, TEXT_LIMIT } from './parser.ts';
import type { ParsedDocument as Parsed } from './parser.ts';
import { textHash } from '../integrity.ts';

type Block = { text: string; section: string; page: number | null; paragraph: number | null; table: { headers: string[]; row: string; footnote: string } | null };
const plain = (text: string, section = 'Document', page: number | null = null, paragraph: number | null = null): Block => ({ text, section, page, paragraph, table: null });
function fail(code: string): never { throw new Error(code); }
function textBlocks(text: string): Block[] {
 let section = 'Document';
 const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n'), blocks: Block[] = [];
 let paragraph: string[] = [];
 const flush = () => { if (paragraph.join('\n').trim()) blocks.push(plain(paragraph.join('\n').trim(), section)); paragraph = []; };
 for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  if (/^#{1,6}\s+/.test(line)) { flush(); section = line.replace(/^#+\s+/, '').trim(); blocks.push(plain(line, section)); }
  else if (line.includes('|') && /^\s*\|?\s*:?-+/.test(lines[i + 1] ?? '')) {
   flush(); const headers = line.split('|').map(v => v.trim()).filter(Boolean); i++;
   while (lines[i + 1]?.includes('|')) { const row = lines[++i]!; blocks.push({ ...plain(row, section), table: { headers, row, footnote: '' } }); }
  } else if (!line.trim()) flush(); else paragraph.push(line);
 }
 flush(); return blocks;
}
async function docx(bytes: Buffer): Promise<{ blocks: Block[]; warnings: string[] }> {
 const files = await new Promise<Map<string, Buffer>>((resolve, reject) => {
  yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
   if (error || !zip) { reject(new Error('INVALID_DOCX_PACKAGE')); return; }
   const selected = new Map<string, Buffer>(), names = new Set<string>(); let total = 0, count = 0, stopped = false;
   const stop = (code: string) => { if (stopped) return; stopped = true; zip.close(); reject(new Error(code)); };
   zip.on('error', () => stop('INVALID_DOCX_PACKAGE'));
   zip.on('entry', entry => {
    count++; total += entry.uncompressedSize;
    if (count > 200 || total > 8 * 1024 * 1024 || entry.uncompressedSize > 2 * 1024 * 1024 || entry.uncompressedSize > Math.max(10000, entry.compressedSize * 100)) { stop('DOCX_EXPANSION_LIMIT'); return; }
    if (names.has(entry.fileName) || entry.generalPurposeBitFlag & 1 || /(?:^|\/)(?:vbaProject|embeddings|activeX)|\.bin$|\.exe$|\.js$/i.test(entry.fileName)) { stop('ACTIVE_OR_ENCRYPTED_DOCX_REJECTED'); return; }
    names.add(entry.fileName);
    const read = entry.fileName === 'word/document.xml' || entry.fileName === '[Content_Types].xml' || entry.fileName.endsWith('.rels');
    if (!read) { zip.readEntry(); return; }
    zip.openReadStream(entry, (error, stream) => {
     if (error || !stream) { stop('DOCX_STREAM_ERROR'); return; }
     const chunks: Buffer[] = []; let size = 0;
     stream.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 2 * 1024 * 1024) { stream.destroy(); stop('DOCX_EXPANSION_LIMIT'); } else chunks.push(chunk); });
     stream.on('error', () => stop('DOCX_STREAM_ERROR'));
     stream.on('end', () => { if (stopped) return; selected.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
    });
   });
   zip.on('end', () => { if (!stopped) resolve(selected); }); zip.readEntry();
  });
 });
 const xml = files.get('word/document.xml')?.toString('utf8');
 if (!xml || !files.get('[Content_Types].xml')?.toString('utf8').includes('wordprocessingml.document.main+xml')) fail('NOT_A_DOCX_DOCUMENT');
 for (const [name, content] of files) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail('XML_ENTITIES_REJECTED');
  if (name.endsWith('.rels') && /TargetMode\s*=\s*["']External["']/i.test(text)) fail('EXTERNAL_DOCX_RELATIONSHIP_REJECTED');
 }
 const blocks: Block[] = [], warnings: string[] = []; let section = 'Document', inText = false, paragraph = '', style = '', p = 0, inTable = false, row: string[] = [], cell: string[] = [], headers: string[] = [];
 const parser = new SaxesParser({ xmlns: true });
 parser.on('error', () => fail('MALFORMED_DOCX_XML'));
 parser.on('opentag', tag => {
  if (tag.uri !== 'http://schemas.openxmlformats.org/wordprocessingml/2006/main') return;
  if (['altChunk', 'object', 'fldSimple', 'instrText'].includes(tag.local)) fail('ACTIVE_DOCX_CONTENT_REJECTED');
  if (tag.local === 'tbl') { inTable = true; headers = []; }
  if (tag.local === 'tr') row = [];
  if (tag.local === 'tc') cell = [];
  if (tag.local === 'p') { paragraph = ''; style = ''; p++; }
  if (tag.local === 'pStyle') style = Object.values(tag.attributes).find(a => a.local === 'val')?.value ?? '';
  if (tag.local === 't') inText = true;
  if (tag.local === 'tab') paragraph += '\t';
  if (tag.local === 'br') paragraph += '\n';
  if (['drawing', 'pict'].includes(tag.local)) warnings.push('Images were omitted; no OCR is performed.');
 });
 parser.on('text', text => { if (inText) { paragraph += text; if (paragraph.length > TEXT_LIMIT) fail('EXTRACTED_TEXT_LIMIT'); } });
 parser.on('closetag', tag => {
  if (tag.uri !== 'http://schemas.openxmlformats.org/wordprocessingml/2006/main') return;
  if (tag.local === 't') inText = false;
  if (tag.local === 'p' && paragraph.trim()) { if (/^Heading/i.test(style)) section = paragraph.trim(); if (inTable) cell.push(paragraph.trim()); else blocks.push(plain(paragraph.trim(), section, null, p)); }
  if (tag.local === 'tc') row.push(cell.join(' '));
  if (tag.local === 'tr' && row.length) { if (!headers.length) headers = [...row]; const text = row.join(' | '); blocks.push({ ...plain(text, section, null, p), table: { headers: [...headers], row: text, footnote: '' } }); }
  if (tag.local === 'tbl') inTable = false;
 });
 parser.write(xml!).close();
 warnings.push('DOCX page numbers depend on layout and are unavailable. Paragraphs and table rows are preserved. Headers, footers, comments and tracked revision semantics are not interpreted.');
 return { blocks, warnings: [...new Set(warnings)] };
}
async function pdf(bytes: Buffer) {
 // No visitor URL or document-specified network request is permitted.
 globalThis.fetch = async () => { throw new Error('PARSER_NETWORK_DISABLED'); };
 const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading = getDocument({ data: new Uint8Array(bytes), verbosity: 0, useWorkerFetch: false, useSystemFonts: false, disableFontFace: true, disableAutoFetch: true, disableStream: true, enableXfa: false, stopAtErrors: true, useWasm: false });
 try {
  const doc = await loading.promise;
  if (doc.numPages > 20) fail('PDF_PAGE_LIMIT');
  if (await doc.getJSActions() || await doc.getAttachments()) fail('ACTIVE_PDF_CONTENT_REJECTED');
  const blocks: Block[] = []; let length = 0;
  for (let n = 1; n <= doc.numPages; n++) {
   const page = await doc.getPage(n), content = await page.getTextContent(); let line = '', previousY: number | null = null; const lines: string[] = [];
   for (const item of content.items) {
    if (!('str' in item)) continue;
    const y = item.transform[5] as number;
    if (previousY !== null && Math.abs(y - previousY) > 2 && line.trim()) { lines.push(line.trim()); line = ''; }
    line += (line && !line.endsWith(' ') ? ' ' : '') + item.str;
    length += item.str.length; if (length > TEXT_LIMIT) fail('EXTRACTED_TEXT_LIMIT');
    if (item.hasEOL) { if (line.trim()) lines.push(line.trim()); line = ''; }
    previousY = y;
   }
   if (line.trim()) lines.push(line.trim());
   if (lines.length) blocks.push(plain(lines.join('\n'), `Page ${n}`, n));
   page.cleanup();
  }
  if (!blocks.length) fail('PDF_HAS_NO_EXTRACTABLE_TEXT_OCR_REQUIRED');
  return { blocks, pages: doc.numPages, warnings: ['PDF reading order and table columns are approximate. Inspect each page passage. Image-only content is not OCR-processed.'] };
 } finally { await loading.destroy(); }
}
export async function parseDocument(input: unknown): Promise<Parsed> {
 const data = ParserInput.parse(input), bytes = Buffer.from(data.base64, 'base64'), format = data.name.split('.').at(-1)!.toLowerCase() as Parsed['format'];
 let blocks: Block[], warnings: string[] = [], pages = 0;
 if (format === 'pdf') ({ blocks, warnings, pages } = await pdf(bytes));
 else if (format === 'docx') ({ blocks, warnings } = await docx(bytes));
 else blocks = textBlocks(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
 const text = blocks!.map(b => b.text).join('\n\n');
 if (!text.trim()) fail('DOCUMENT_IS_EMPTY'); if (text.length > TEXT_LIMIT) fail('EXTRACTED_TEXT_LIMIT');
 const originalHash = createHash('sha256').update(bytes).digest('hex'), passages: Parsed['passages'] = []; let offset = 0;
 for (const block of blocks!) {
  for (let local = 0; local < block.text.length;) {
   let end = Math.min(local + data.chunkSize, block.text.length);
   if (end < block.text.length) { const boundary = Math.max(block.text.lastIndexOf('\n', end), block.text.lastIndexOf(' ', end)); if (boundary > local + data.chunkSize / 2) end = boundary; }
   const chunk = block.text.slice(local, end), start = offset + local;
   if (chunk.trim()) passages.push({ id: `passage.${originalHash.slice(0, 16)}.${data.chunkSize}.${passages.length + 1}`, text: chunk, textHash: textHash(chunk), location: { start, end: offset + end, lineStart: text.slice(0, start).split('\n').length, lineEnd: text.slice(0, offset + end).split('\n').length, section: block.section, page: block.page, paragraph: block.paragraph, table: block.table } });
   local = end;
  }
  offset += block.text.length + 2;
 }
 if (passages.length > 128) fail('PASSAGE_COUNT_LIMIT');
 return ParsedDocument.parse({ name: data.name, format, bytes: bytes.length, originalHash, text, textHash: textHash(text), parser: 'bounded-documents-v1', chunker: `paragraphs-${data.chunkSize}-v1`, passages, warnings, pages, processedAt: new Date().toISOString() });
}
if (process.send) process.once('message', async input => {
 try { process.send?.({ ok: true, parsed: await parseDocument(input) }); }
 catch (e) { const code = e instanceof Error && /^[A-Z0-9_]{3,100}$/.test(e.message) ? e.message : 'UNSUPPORTED_OR_MALFORMED_DOCUMENT'; process.send?.({ ok: false, code }); }
});

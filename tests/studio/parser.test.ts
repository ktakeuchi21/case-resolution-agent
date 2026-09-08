import test from 'node:test';
import assert from 'node:assert/strict';
import { zip,docxEntries,pdfFixture } from './fixtures.ts';
import { parseUpload, validateUpload, UPLOAD_LIMIT } from '../../src/studio/parser.ts';
import { textHash } from '../../src/integrity.ts';

const upload = (name: string, bytes: string | Buffer, extra: object = {}) => ({ name, base64: Buffer.from(bytes).toString('base64'), synthetic: true, ...extra });
const fidelity = (parsed: Awaited<ReturnType<typeof parseUpload>>) => { for (const p of parsed.passages) { assert.equal(parsed.text.slice(p.location.start, p.location.end), p.text); assert.equal(textHash(p.text), p.textHash); assert(p.location.lineEnd >= p.location.lineStart); } };

test('TXT is parsed in an isolated process with exact normalized text locations and repeatable passage IDs', async () => {
 const input = upload('synthetic-guide.txt', 'Synthetic guide\r\n\r\nSupply the signed office note.');
 const first = await parseUpload(input), second = await parseUpload(input); fidelity(first); assert.deepEqual(first.passages, second.passages); assert.equal(first.format, 'txt'); assert.equal(first.passages[1]!.location.lineStart, 3);
});
test('Markdown headings and tables retain inspectable row/header relationships', async () => {
 const p = await parseUpload(upload('synthetic.md', '# Documentation\n\n| Document | Status |\n| --- | --- |\n| Signed note | Required |\n\nReceipt is not payer approval.'));
 fidelity(p); const table = p.passages.find(p => p.location.table)!; assert.deepEqual(table.location.table!.headers, ['Document', 'Status']); assert.equal(table.location.section, 'Documentation'); assert(table.text.includes('Required'));
});
test('DOCX paragraphs, headings and table rows are extracted without rendering or running document instructions', async () => {
 const p = await parseUpload(upload('synthetic.docx', zip(docxEntries()))); fidelity(p); assert.equal(p.format, 'docx'); assert.match(p.text, /Supply the signed office note/); assert(p.passages.some(p => p.location.paragraph === 2)); assert(p.passages.some(p => p.location.table?.headers.includes('Document'))); assert(p.warnings.some(w => w.includes('page numbers')));
});
test('PDF text preserves page numbers and flags uncertain table reading order', async () => {
 const p = await parseUpload(upload('synthetic.pdf', pdfFixture())); fidelity(p); assert.equal(p.pages, 2); assert(p.passages.some(p => p.location.page === 1)); assert(p.passages.some(p => p.location.page === 2)); assert(p.warnings.some(w => w.includes('approximate')));
});
test('reprocessing with changed chunk settings creates stable new passage boundaries', async () => {
 const text = 'Synthetic documentation guidance. '.repeat(45);
 const a = await parseUpload(upload('guide.txt', text, { chunkSize: 300 })), b = await parseUpload(upload('guide.txt', text, { chunkSize: 1000 }));
 assert(a.passages.length > b.passages.length); assert.notEqual(a.passages[0]!.id, b.passages[0]!.id); assert.equal(a.originalHash, b.originalHash); fidelity(a); fidelity(b);
});
test('wrong signatures, extensions, invalid encodings, secrets and false attestation reject before parsing', () => {
 for (const input of [upload('guide.exe', 'MZ'), upload('../guide.txt', 'Synthetic'), upload('guide.pdf', 'not PDF'), upload('guide.docx', 'not ZIP'), upload('guide.txt', Buffer.from([0xff, 0xfe])), upload('guide.txt', 'MRN: 12345'), upload('guide.txt', 'a', { synthetic: false }), upload('guide.txt', 'a', { base64: '!!!!' }), upload('guide.txt', 'x'.repeat(UPLOAD_LIMIT + 1))]) assert.throws(() => validateUpload(input));
});
test('DOCX archive bombs, external relationships, macros and XML entities are rejected', async () => {
 const invalid = [
  zip({ ...docxEntries(), 'word/huge.xml': 'x'.repeat(3 * 1024 * 1024) }, true),
  zip({ ...docxEntries(), 'word/_rels/document.xml.rels': '<Relationships><Relationship TargetMode="External" Target="https://example.invalid"/></Relationships>' }),
  zip({ ...docxEntries(), 'word/vbaProject.bin': 'synthetic macro canary' }),
  zip({ ...docxEntries(), 'word/document.xml': '<!DOCTYPE foo [<!ENTITY external SYSTEM "file:///etc/passwd">]><foo>&external;</foo>' }),
 ];
 for (const bytes of invalid) await assert.rejects(parseUpload(upload('unsafe.docx', bytes)), /parsed safely/);
});
test('empty documents, malformed XML and excessive PDF pages fail explicitly', async () => {
 await assert.rejects(parseUpload(upload('empty.txt', '   ')), /DOCUMENT_IS_EMPTY/);
 await assert.rejects(parseUpload(upload('broken.docx', zip({ ...docxEntries(), 'word/document.xml': '<w:document>' }))), /MALFORMED_DOCX_XML/);
 await assert.rejects(parseUpload(upload('long.pdf', pdfFixture(21))), /PDF_PAGE_LIMIT/);
});

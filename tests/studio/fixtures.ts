import { deflateRawSync } from 'node:zlib';
function crc32(bytes: Buffer) { let crc = 0xffffffff; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
export function zip(entries: Record<string, string>, compressed = false) {
 const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
 for (const [filename, content] of Object.entries(entries)) {
  const name = Buffer.from(filename), bytes = Buffer.from(content), data = compressed ? deflateRawSync(bytes) : bytes, header = Buffer.alloc(30), directory = Buffer.alloc(46), checksum = crc32(bytes);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(compressed ? 8 : 0, 8); header.writeUInt32LE(checksum, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26);
  directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(compressed ? 8 : 0, 10); directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(bytes.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
  local.push(header, name, data); central.push(directory, name); offset += header.length + name.length + data.length;
 }
 const footer = Buffer.alloc(22), index = Buffer.concat(central); footer.writeUInt32LE(0x06054b50); footer.writeUInt16LE(Object.keys(entries).length, 8); footer.writeUInt16LE(Object.keys(entries).length, 10); footer.writeUInt32LE(index.length, 12); footer.writeUInt32LE(offset, 16);
 return Buffer.concat([...local, index, footer]);
}
export const docxEntries = (extra = '') => ({
 '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
 'word/document.xml': `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Synthetic document guide</w:t></w:r></w:p><w:p><w:r><w:t>Supply the signed office note.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Document</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Status</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Office note</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Required</w:t></w:r></w:p></w:tc></w:tr></w:tbl>${extra}</w:body></w:document>`,
});
export function pdfFixture(pages = 2) {
 const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${4 + 2 * i} 0 R`).join(' ')}] /Count ${pages} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 for (let i = 0; i < pages; i++) { const stream = `BT /F1 12 Tf 40 750 Td (Synthetic page ${i + 1}) Tj 0 -24 Td (Supply the signed office note.) Tj ET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
 }
 let body = '%PDF-1.4\n'; const offsets = [0]; for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
 const xref = Buffer.byteLength(body); body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(body);
}

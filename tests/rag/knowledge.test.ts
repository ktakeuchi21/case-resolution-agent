import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash } from '../../src/integrity.ts';
import { documents, passages, packs } from '../../src/rag/corpus.ts';
import { eligible, lexicalControl } from '../../src/rag/retrieval.ts';
import { knowledgeCases } from '../../src/rag/knowledge-evaluation-cases.ts';

test('additive knowledge expansion preserves every original source snapshot byte for byte',()=>{
 const original=passages.filter(p=>p.version!=='1.1');
 assert.equal(original.length,38);
 assert.equal(hash(original),'dc9cb626851e2ff1159c23d9bad930a5e01e4894c97f9a42a385611a74203c3e');
 // Historical answer IDs continue to resolve to the same exact canonical passages.
 for(const pack of packs){
  assert.equal(pack.version,'1.1');
  const additions=documents.filter(d=>d.packId===pack.id&&d.version==='1.1');
  assert.equal(additions.length,6);
  assert(additions.every(d=>d.status==='current'&&(!d.caseId||d.caseId===pack.caseId)));
 }
});

test('focused expansion questions find their supporting guide under the lexical control',()=>{
 for(const item of knowledgeCases){
  const results=lexicalControl(item.question,passages,item.packId);
  assert(results.some(p=>p.sourceId===item.sourceId),item.id+': '+results.map(p=>p.id).join(', '));
  assert(results.every(p=>eligible(p,item.packId)));
 }
});

test('every expansion topic has applicable source coverage and deliberate exclusion controls remain',()=>{
 assert.equal(new Set(knowledgeCases.map(c=>c.sourceId)).size,18);
 for(const pack of packs){
  const excluded=passages.filter(p=>p.packId===pack.id&&!eligible(p,pack.id));
  assert(excluded.some(p=>p.status==='superseded'));
  assert(excluded.some(p=>p.caseId!==null&&p.caseId!==pack.caseId));
  for(const item of knowledgeCases.filter(c=>c.packId===pack.id)){
   assert(passages.some(p=>p.sourceId===item.sourceId&&eligible(p,pack.id)));
  }
 }
});

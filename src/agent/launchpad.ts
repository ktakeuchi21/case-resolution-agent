import { assessSupport } from '../support.ts';
import type { Registry } from '../registry.ts';
import type { KnowledgeSelection } from './preferences.ts';
import { governedSelection, readablePackName } from './preferences.ts';
import { baseRequest } from '../evaluation.ts';
import { selectKnowledge, sourceReasons } from '../policy.ts';
import { hash } from '../integrity.ts';
import type { UploadRecord } from '../studio/contracts.ts';

const categories: Record<string, string> = {
 required_document: 'Missing-document process', case_request: 'Case-specific request',
 package_missing: 'Submitted-package evidence', communication_guidance: 'Administrative communication guidance',
 appeal_deadline: 'Appeal administration', appeal_process: 'Appeal administration', support_intake: 'Program intake',
};
const documentCategories: Record<string, string> = { payer_guide:'Payer process guidance', case_notice:'Case-specific request', case_inventory:'Submitted-package evidence', education:'Educational guidance', sop:'Administrative procedures', program_guide:'Program intake' };
export function coverageSummary(coverage: string[]) {
 const distinct = [...new Set(coverage)];
 return distinct.length ? `Grounded in ${new Intl.ListFormat('en', {style:'long',type:'conjunction'}).format(distinct.map(s=>s[0]!.toLowerCase()+s.slice(1)))}.` : 'No currently eligible knowledge is available in this selection. Choose knowledge to continue.';
}
export function governedOrientation(registry: Registry, chosen: KnowledgeSelection, now: string) {
 const request = baseRequest({...governedSelection(registry, chosen, now),purpose:'explain'}), user = registry.user('avery');
 const selection = selectKnowledge(registry, user, request, now);
 const assignment = registry.corpus.assignments.find(a=>a.id===request.selectionId);
 const releases = registry.corpus.releases.filter(r=>request.releaseIds.includes(r.id));
 const preferred = releases.find(r=>chosen.kind==='pack'&&r.id===chosen.releaseId) ?? releases[0];
 const ids = [...new Set([...releases.flatMap(r=>r.documentVersionIds), ...selection.caseContext?.evidenceVersionIds??[]])];
 const eligiblePassages=registry.corpus.passages.filter(p=>ids.includes(p.documentVersionId)&&!selection.reasons.length&&!sourceReasons(registry,registry.corpus.versions.find(v=>v.id===p.documentVersionId)!,user,request,selection,now).length);
 const conflictPassages=registry.corpus.passages.filter(p=>registry.conflictVersionIds().includes(p.documentVersionId)&&!sourceReasons(registry,registry.corpus.versions.find(v=>v.id===p.documentVersionId)!,user,request,selection,now,true).length);
 const universe=[...new Map([...eligiblePassages,...conflictPassages].map(p=>[p.id,p])).values()];
 const sources = ids.map(id=>{
  const version=registry.corpus.versions.find(v=>v.id===id)!, document=registry.document(version.documentId);
  const reasons=[...new Set([...selection.reasons,...sourceReasons(registry,version,user,request,selection,now)])];
  const passages=eligiblePassages.filter(p=>p.documentVersionId===id);
  const supported=passages.flatMap(p=>assessSupport(registry,{...request,task:'source_summary'},[p],universe,now).claims);
  const reviewed=passages.flatMap(p=>p.statements.filter(s=>supported.some(c=>c.text===s.quote)).map(s=>s.kind==='case_request'&&document.id==='N-101'?'Case-specific N-101 request':categories[s.kind]!));
  const coverage=[...new Set(reviewed)];
  const displayCategories=coverage.length?coverage:[documentCategories[document.type]!];
  return {id,title:document.title,version:version.version,categories:displayCategories,coverage,eligible:reasons.length===0,reasons,
   updatedAt:version.approvedAt,expiresAt:version.expiresAt,status:reasons.length?'Unavailable for current questions':coverage.length?'Governed · eligible to explain; permissions checked per answer':'Eligible for retrieval comparison; not authority for the current recommendation',
   releases:releases.filter(r=>r.documentVersionIds.includes(id)).map(r=>({name:readablePackName(registry.corpus.packs.find(p=>p.id===r.packId)),version:r.version,id:r.id})),
   applicability:version.scope,audiences:version.audiences,permittedUses:version.permittedUses};
 });
 const coverage=[...new Set(sources.filter(s=>s.eligible).flatMap(s=>s.coverage))];
 const content={kind:chosen.kind,key:chosen.kind==='pack'?chosen.releaseId:'sample',name:readablePackName(registry.corpus.packs.find(p=>p.id===preferred?.packId)),
  available:sources.some(s=>s.eligible),status:selection.reasons.length?'Selected knowledge unavailable':'Assigned governed case knowledge',coverage,summary:coverageSummary(coverage),sources,
  assignment:assignment?{id:assignment.id,caseId:'DEMO-101',activeFrom:assignment.activeFrom,expiresAt:assignment.expiresAt}:null,
  releases:releases.map(r=>({id:r.id,name:readablePackName(registry.corpus.packs.find(p=>p.id===r.packId)),version:r.version,publishedAt:r.publishedAt,status:registry.isRetired(r.id)?'Retired':r.status})),
  boundary:'Source eligibility does not grant communication or action permission. Each answer and restricted action is checked separately.'};
 return {...content,revision:hash(content)};
}
export function uploadOrientation(upload: UploadRecord | null, key: string) {
 const available=!!upload && upload.status!=='quarantined';
 const content={kind:'upload',key,available,name:available?upload!.metadata.sourceName:'Temporary knowledge unavailable',
  status:available?'Temporary · ungoverned sandbox':'Temporary knowledge unavailable',coverage:available?['Selected document']:[],
  summary:available?'Explore the content and requirements described in this document.':'This temporary document has expired, was deleted, or is unavailable. Choose new knowledge to continue.',
  boundary:'Pathway can explain and summarize this temporary document, but it is not approved as authoritative case knowledge and cannot authorize operational actions.',
  sources:available?[{id:upload!.id,title:upload!.metadata.sourceName,version:upload!.metadata.version,categories:['Temporary document'],eligible:true,reasons:[],updatedAt:upload!.reviewedAt??upload!.createdAt,expiresAt:upload!.expiresAt,status:'Available for sandbox exploration only',releases:[],applicability:upload!.metadata.scope,audiences:upload!.metadata.audiences,permittedUses:['explore']}]:[],
  assignment:null,releases:[],metadataRevision:available?upload!.revision:null};
 return {...content,revision:hash(content)};
}

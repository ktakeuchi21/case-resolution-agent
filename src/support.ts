import type { CanonicalPassage, FactKind, ReasonCode, SourceSupportDecision, AuthorityFinding, RetrievalRequest } from './contracts.ts';
import { Registry, POLICY_VERSION } from './registry.ts';

const required: Record<RetrievalRequest['task'], FactKind[]> = {
  missing_document: ['required_document', 'case_request', 'package_missing'],
  document_requirement: ['required_document'], deadline: ['appeal_deadline'],
  appeal_process: ['appeal_process'], support_intake: ['support_intake'], source_summary: [],
};
const authority: Record<FactKind, { role: string; domain: string }> = {
  required_document: { role: 'payer_owner', domain: 'payer_process' },
  case_request: { role: 'case_record', domain: 'case_facts' }, package_missing: { role: 'case_record', domain: 'case_facts' },
  appeal_deadline: { role: 'case_record', domain: 'case_facts' }, appeal_process: { role: 'payer_owner', domain: 'payer_process' },
  support_intake: { role: 'program_owner', domain: 'program_intake' }, communication_guidance: { role: 'operations_owner', domain: 'communication' },
};

export interface SupportResult { decision: SourceSupportDecision; passages: CanonicalPassage[]; findings: AuthorityFinding[]; claims: { text: string; passageIds: string[] }[] }

export function assessSupport(registry: Registry, request: RetrievalRequest, retrieved: CanonicalPassage[], conflictUniverse: CanonicalPassage[], now: string): SupportResult {
  const findings: AuthorityFinding[] = [];
  const matchAuthority = (p: CanonicalPassage, kind: FactKind) => {
    const v = registry.corpus.versions.find(v => v.id === p.documentVersionId)!;
    return v.authority === authority[kind].role && v.authorityDomain === authority[kind].domain;
  };
  const output = (status: SourceSupportDecision['status'], reasons: ReasonCode[], passages: CanonicalPassage[]): SupportResult => ({
    decision: { status, reasonCodes: reasons, supportingPassageIds: passages.map(p => p.id), policyVersion: POLICY_VERSION, timestamp: now }, passages, findings,
    claims: status !== 'supported' ? [] : passages.flatMap(p => p.statements
      .filter(s => request.mode === 'sandbox' || (matchAuthority(p, s.kind) && (request.task === 'source_summary' || required[request.task].includes(s.kind))))
      .map(s => ({ text: s.quote, passageIds: [p.id] }))),
  });
  if (request.mode === 'sandbox') {
    const p = retrieved.find(p => p.statements.length > 0);
    return p ? output('supported', ['SUPPORTED', 'SANDBOX_EXPLORATION_ONLY'], [p]) : output('missing', ['NO_EVIDENCE'], []);
  }
  const kinds = request.task === 'source_summary' ? [...new Set(retrieved.flatMap(p => p.statements.map(s => s.kind)))] : required[request.task];
  for (const kind of kinds) {
    const relevant = conflictUniverse.flatMap(p => p.statements.filter(s => s.kind === kind).map(s => ({ p, s })));
    const authoritative = relevant.filter(({ p }) => matchAuthority(p, kind));
    if (new Set(authoritative.map(({ s }) => s.value)).size > 1) {
      const passages = [...new Map(authoritative.map(({ p }) => [p.id, p])).values()];
      findings.push({ reasonCode: 'AUTHORITATIVE_CONFLICT', passageIds: passages.map(p => p.id), explanation: `Verified ${kind} statements in the same applicable authority domain have incompatible values; no precedence resolution exists.` });
      return output('conflicting', ['AUTHORITATIVE_CONFLICT'], passages);
    }
    for (const lower of relevant.filter(({ p }) => !matchAuthority(p, kind))) {
      if (authoritative.some(({ s }) => s.value !== lower.s.value)) {
        findings.push({ reasonCode: 'LOWER_AUTHORITY_CONFLICT', passageIds: [lower.p.id, ...authoritative.map(({ p }) => p.id)], explanation: `${lower.p.documentVersionId} lacks ${authority[kind].role} authority for ${authority[kind].domain}; it cannot establish or override this requirement.` });
      }
    }
  }
  if (request.task === 'source_summary') {
    const p = retrieved.find(p => p.statements.some(s => matchAuthority(p, s.kind)));
    return p ? output('supported', ['SUPPORTED'], [p]) : output('missing', ['NO_EVIDENCE'], []);
  }
  const chosen: CanonicalPassage[] = [];
  const values: string[] = [];
  for (const kind of kinds) {
    const p = retrieved.find(p => p.statements.some(s => s.kind === kind) && matchAuthority(p, kind));
    if (!p) return output('missing', ['REQUIRED_EVIDENCE_MISSING'], chosen);
    chosen.push(p);
    values.push(p.statements.find(s => s.kind === kind)!.value);
  }
  if (request.task === 'missing_document' && new Set(values).size !== 1) {
    findings.push({ reasonCode: 'AUTHORITATIVE_CONFLICT', passageIds: chosen.map(p => p.id), explanation: 'The current case request, package inventory and process do not identify the same missing item.' });
    return output('conflicting', ['AUTHORITATIVE_CONFLICT'], chosen);
  }
  return output('supported', ['SUPPORTED'], [...new Map(chosen.map(p => [p.id, p])).values()]);
}

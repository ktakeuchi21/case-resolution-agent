import { RetrievalRequest, RetrievalCandidate, Timestamp } from './contracts.ts';
import type { ActionPermissionDecision, ApplicabilityDecision, AuditEvent, CanonicalPassage, CommunicationPermissionDecision, EvidenceBody, EvidenceRecord, Exclusion, ReasonCode, SourceSupportDecision } from './contracts.ts';
import { hash } from './integrity.ts';
import { Registry, POLICY_VERSION } from './registry.ts';
import { selectKnowledge, sourceReasons } from './policy.ts';
import { assessSupport } from './support.ts';
import { EvidenceStore } from './evidence-store.ts';
import type { RetrievalProvider } from './providers/provider.ts';

export class KnowledgePipeline {
  #registry: Registry;
  #provider: RetrievalProvider;
  #store: EvidenceStore;
  #clock: () => string;
  #index: Promise<void> | undefined;

  constructor(registry: Registry, provider: RetrievalProvider, store: EvidenceStore, clock: () => string) {
    this.#registry = registry; this.#provider = provider; this.#store = store; this.#clock = clock;
  }

  async run(actorId: string, input: unknown): Promise<EvidenceRecord> {
    const request = RetrievalRequest.parse(input);
    const user = this.#registry.user(actorId); // Trusted fixture directory stands in for authentication.
    const now = Timestamp.parse(this.#clock()); // Never supplied by the retrieval request.
    const snapshot = this.#registry.snapshotHash();
    const selection = selectKnowledge(this.#registry, user, request, now);
    const audit: AuditEvent[] = [];
    const log = (type: AuditEvent['type'], subjectIds: string[], reasons: ReasonCode[], payload: unknown) => {
      audit.push({ id: `${request.id}.${type}`, type, actorId, tenantId: user.tenantId,
        subjectIds, reasonCodes: reasons.length ? [...new Set(reasons)] : ['ELIGIBLE'],
        policyVersion: POLICY_VERSION, timestamp: now, payloadHash: hash(payload) });
    };
    log('access', [user.id], selection.reasons, { user, caseId: selection.caseContext?.id ?? null });
    log('selection', selection.releases.map(r => r.id), selection.reasons, selection);
    const excluded: Exclusion[] = [];
    const eligible: string[] = [];
    const versionList = selection.reasons.length ? [] : this.#registry.visibleVersions(user);
    for (const version of versionList) {
      const reasons = sourceReasons(this.#registry, version, user, request, selection, now);
      if (reasons.length) excluded.push({ documentVersionId: version.id, reasonCodes: reasons });
      else eligible.push(version.id);
    }
    eligible.sort();
    excluded.sort((a, b) => a.documentVersionId.localeCompare(b.documentVersionId));
    const allowed = this.#registry.corpus.passages.filter(p => eligible.includes(p.documentVersionId) &&
      (request.mode === 'sandbox' || selection.caseContext?.evidenceVersionIds.includes(p.documentVersionId) || selection.releases.some(r => r.passageIds.includes(p.id))));
    log('filtering', eligible, ['ELIGIBLE'], { excluded, allowed: allowed.map(p => p.id) });
    let retrieved: RetrievalCandidate[] = [];
    const failures: ReasonCode[] = [...selection.reasons];
    if (!failures.length && allowed.length) {
      try {
        const capabilities = this.#provider.capabilities();
        if (!capabilities.prefilter || !capabilities.exactCanonicalIds) failures.push('PROVIDER_CONTRACT_VIOLATION');
        else {
          this.#index ??= this.#provider.index(this.#registry.corpus.passages, this.#registry.corpusHash);
          await this.#index;
          const raw = await this.#provider.search({ query: request.question, limit: request.maxResults,
            universe: { snapshotHash: snapshot, corpusHash: this.#registry.corpusHash, passageIds: allowed.map(p => p.id) } });
          const parsed = RetrievalCandidate.array().safeParse(raw);
          if (!parsed.success || parsed.data.length > request.maxResults || new Set(parsed.data.map(p => p.passageId)).size !== parsed.data.length) failures.push('PROVIDER_CONTRACT_VIOLATION');
          else if (parsed.data.some(r => {
            if (this.#provider.descriptor.kind === 'lexical') return r.scoreKind !== 'lexical_bm25';
            if (this.#provider.descriptor.kind === 'semantic') return r.scoreKind !== 'vector_similarity' || !r.embedding ||
              r.ranking?.method !== 'cosine' || !r.ranking.semantic;
            return r.scoreKind !== 'hybrid_rrf' || r.ranking?.method !== 'reciprocal_rank_fusion' ||
              !r.ranking.combined || r.ranking.combined.rank !== r.rank || r.ranking.combined.score !== r.score ||
              (!r.ranking.lexical && !r.ranking.semantic) || (!!r.ranking.semantic && !r.embedding);
          })) failures.push('PROVIDER_CONTRACT_VIOLATION');
          else if (parsed.data.some((r, i) => {
            const p = allowed.find(p => p.id === r.passageId);
            return !p || p.documentVersionId !== r.documentVersionId || p.textHash !== r.textHash || r.rank !== i + 1;
          })) failures.push('PROVIDER_CONTRACT_VIOLATION');
          else retrieved = parsed.data;
        }
      } catch { failures.push('PROVIDER_UNAVAILABLE'); }
    }
    if (snapshot !== this.#registry.snapshotHash()) { failures.push('STALE_SNAPSHOT'); retrieved = []; }
    log('retrieval', retrieved.map(r => r.passageId), failures, { provider: this.#provider.descriptor, retrieved });

    const retrievedPassages = retrieved.map(r => allowed.find(p => p.id === r.passageId)!);
    // Supplemental conflict inspection uses verified registry findings, even outside top-k/selected release.
    const supplemental = !failures.length && request.mode === 'governed'
      ? this.#registry.visibleVersions(user).filter(v => this.#registry.conflictVersionIds().includes(v.id) &&
        sourceReasons(this.#registry, v, user, request, selection, now, true).length === 0).flatMap(v => this.#registry.corpus.passages.filter(p => p.documentVersionId === v.id)) : [];
    const assessed = assessSupport(this.#registry, request, failures.length ? [] : retrievedPassages, failures.length ? [] : [...allowed, ...supplemental], now);
    const common = { policyVersion: POLICY_VERSION, timestamp: now };
    let support: SourceSupportDecision = assessed.decision;
    if (failures.length) support = { ...common, status: 'not_evaluated', reasonCodes: [...new Set(failures)], supportingPassageIds: [] };
    log('authority', assessed.findings.flatMap(f => f.passageIds), assessed.findings.map(f => f.reasonCode), assessed.findings);
    log('support', support.supportingPassageIds, support.reasonCodes, support);

    const retiredBlock = support.status !== 'supported' && excluded.some(e => e.reasonCodes.includes('SOURCE_RETIRED') && selection.releases.some(r => r.documentVersionIds.includes(e.documentVersionId)));
    const applicability: ApplicabilityDecision = {
      ...common,
      status: failures.length ? (failures.includes('METADATA_UNKNOWN') ? 'unknown' : 'not_evaluated')
        : request.mode === 'sandbox' ? 'sandbox_only' : support.status === 'supported' ? 'applicable' : 'unknown',
      reasonCodes: failures.length ? [...new Set(failures)] : retiredBlock ? ['SOURCE_RETIRED']
        : request.mode === 'sandbox' ? ['SANDBOX_EXPLORATION_ONLY'] : support.status === 'supported' ? ['ELIGIBLE'] : support.reasonCodes,
      supportingPassageIds: support.supportingPassageIds,
    };
    log('applicability', applicability.supportingPassageIds, applicability.reasonCodes, applicability);
    const communication: CommunicationPermissionDecision = {
      ...common, status: failures.length ? 'denied' : 'allowed',
      reasonCodes: failures.length ? [...new Set(failures)] : ['ELIGIBLE'],
      supportingPassageIds: failures.length ? [] : support.supportingPassageIds,
    };
    // Communication 'allowed' on abstention permits a boundary explanation, not unsupported source claims.
    log('communication', communication.supportingPassageIds, communication.reasonCodes, communication);

    let actionStatus: ActionPermissionDecision['status'] = 'not_requested';
    let actionReasons: ReasonCode[] = ['ACTION_NOT_REQUESTED'];
    if (request.requestedAction) {
      if (request.mode === 'sandbox') { actionStatus = 'denied'; actionReasons = ['SANDBOX_ACTION_DENIED']; }
      else if (request.requestedAction === 'decide_coverage') { actionStatus = 'denied'; actionReasons = ['ACTION_PROHIBITED']; }
      else if (failures.length || support.status !== 'supported' || applicability.status !== 'applicable' || communication.status !== 'allowed') {
        actionStatus = 'paused'; actionReasons = retiredBlock ? ['SOURCE_RETIRED'] : [...new Set([...failures, ...support.reasonCodes])];
      } else if (request.requestedAction === 'transfer_document') {
        actionStatus = 'requires_approval'; actionReasons = ['APPROVAL_REQUIRED'];
      } else if (!user.actionGrants.includes(request.requestedAction)) {
        actionStatus = 'denied'; actionReasons = ['ACTION_GRANT_MISSING'];
      } else if (request.requestedAction === 'recommend_document' && (request.task !== 'missing_document' || request.purpose !== 'recommend')) {
        actionStatus = 'denied'; actionReasons = ['TASK_ACTION_MISMATCH'];
      } else if (request.requestedAction !== 'recommend_document') {
        actionStatus = 'denied'; actionReasons = ['ACTION_PROHIBITED'];
      } else { actionStatus = 'allowed'; actionReasons = ['RECOMMENDATION_ALLOWED']; }
    }
    const action: ActionPermissionDecision = { ...common, status: actionStatus, reasonCodes: actionReasons, supportingPassageIds: support.supportingPassageIds };
    log('action', action.supportingPassageIds, action.reasonCodes, action);

    let disposition: EvidenceBody['disposition'] = support.status === 'supported' ? 'answer' : support.status === 'conflicting' ? 'escalate' : 'abstain';
    if (retiredBlock || failures.some(f => ['SOURCE_RETIRED', 'RELEASE_RETIRED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_CONTRACT_VIOLATION', 'STALE_SNAPSHOT', 'EXPIRED', 'NOT_YET_EFFECTIVE'].includes(f))) disposition = 'pause';
    else if (failures.length) disposition = 'deny';
    const evidencePassages: CanonicalPassage[] = failures.length ? [] : assessed.passages;
    const claims = disposition === 'answer' && communication.status === 'allowed'
      ? assessed.claims : [];
    const message = claims.length ? (this.#provider.descriptor.kind === 'lexical' ? 'Source-supported quotations selected by local lexical retrieval; no generated clinical inference.' : 'Source-supported quotations selected by candidate retrieval and independent governance; no generated clinical inference.')
      : disposition === 'escalate' ? 'Applicable authoritative evidence conflicts. A knowledge owner must resolve it.'
      : disposition === 'pause' ? 'The current knowledge or provider state does not permit this recommendation. Dependent work is paused.'
      : disposition === 'deny' ? 'This context is not authorized for the requested knowledge use.'
      : 'The selected eligible evidence does not establish an answer. No requirement or deadline has been invented.';
    const evidenceUsed = evidencePassages.map(p => ({ passageId: p.id, documentVersionId: p.documentVersionId,
      documentId: this.#registry.corpus.versions.find(v => v.id === p.documentVersionId)!.documentId,
      text: p.text, textHash: p.textHash, locator: p.locator, artifactVersion: p.artifactVersion }));
    log('evidence', evidenceUsed.map(e => e.passageId), support.reasonCodes, evidenceUsed);
    return this.#store.put({
      schemaVersion: this.#provider.descriptor.kind === 'lexical' ? 'phase2a-v1' : 'phase2b-v1', timestamp: now, policyVersion: POLICY_VERSION, request, userContext: user,
      caseContext: selection.caseContext, registryHash: snapshot, corpusHash: this.#registry.corpusHash,
      selectedReleases: selection.releases.map(r => ({ id: r.id, manifestHash: r.manifestHash })), collectionSnapshot: selection.collection,
      provider: this.#provider.descriptor, eligibleVersionIds: eligible, retrieved, excluded,
      ...(this.#provider.descriptor.kind !== 'lexical' ? { retrievalDiagnostics: retrieved.map(r => ({ passageId: r.passageId,
        releaseIds: selection.releases.filter(p => p.passageIds.includes(r.passageId)).map(p => p.id),
        metadataFilter: 'ELIGIBLE' as const, selectionReason: r.ranking?.inclusionReason ?? 'provider_candidate' })) } : {}),
      authorityFindings: assessed.findings, support, applicability, communication, action, evidenceUsed,
      answer: { method: 'deterministic-extractive-composition', claims, message, operationalKnowledge: request.mode === 'governed' },
      actionProposal: request.requestedAction ? { type: request.requestedAction, caseId: selection.caseContext?.id ?? null,
        evidencePassageIds: support.supportingPassageIds, status: actionStatus === 'allowed' ? 'permitted_recommendation'
          : actionStatus === 'requires_approval' ? 'needs_approval' : actionStatus === 'paused' ? 'paused' : 'blocked', execution: 'not_executed' } : null,
      escalation: disposition === 'escalate' || disposition === 'pause' ? {
        id: `${request.id}.escalation`, category: failures.length ? 'security' : disposition === 'escalate' ? 'knowledge_conflict' : 'missing_knowledge',
        reasonCodes: retiredBlock ? ['SOURCE_RETIRED'] : failures.length ? [...new Set(failures)] : support.reasonCodes,
        supportingPassageIds: support.supportingPassageIds, ownerRole: failures.length ? 'security' : 'knowledge_admin',
        status: 'proposed_not_dispatched', ...common,
      } : null,
      disposition, audit,
    });
  }
}

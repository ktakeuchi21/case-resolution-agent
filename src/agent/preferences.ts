import { z } from 'zod';
import type { PoolClient } from 'pg';
import { Id } from '../contracts.ts';
import { baseRequest } from '../evaluation.ts';
import type { Registry } from '../registry.ts';
import { caseSelection } from '../db/registry.ts';
import { selectKnowledge, sourceReasons } from '../policy.ts';
import type { Session } from '../app/session.ts';
import { AgentChannel, WorkAudience } from './contracts.ts';
import { providerConfiguration } from './runtime.ts';

export const DEMO_NOTICE = 'This demonstration uses synthetic administrative content. Do not enter patient information, confidential data, or secrets.';
export const KnowledgeSelection = z.discriminatedUnion('kind', [
 z.strictObject({ kind: z.literal('sample') }),
 z.strictObject({ kind: z.literal('pack'), releaseId: Id }),
 z.strictObject({ kind: z.literal('upload'), uploadId: Id }),
]);
export type KnowledgeSelection = z.infer<typeof KnowledgeSelection>;
export const AgentSettings = z.strictObject({
 synthesis: z.enum(['automatic', 'model', 'evidence']).default('automatic'),
 tone: z.enum(['concise', 'warm', 'formal']).default('concise'),
 audience: WorkAudience.default('case_manager'), channel: AgentChannel.default('email'),
 audiences: z.array(WorkAudience).min(1).max(4).default(['case_manager', 'office', 'supervisor', 'crm']),
 channels: z.array(AgentChannel).min(1).max(5).default(['chat', 'email', 'sms', 'voice', 'teams']),
 drafting: z.boolean().default(true),
}).refine(s => s.audiences.includes(s.audience) && s.channels.includes(s.channel), 'Defaults must be available.');
export type AgentSettings = z.infer<typeof AgentSettings>;
export const fixedPolicy = Object.freeze({
 provider: 'OpenAI', model: 'gpt-4.1-mini-2025-04-14',
 grounding: 'Every material source claim requires an exact eligible citation and a structured support check.',
 memory: 'Conversation is unverified context. Only the workflow and governed evidence establish case facts.',
 abstention: 'Missing, conflicting, retired or unavailable evidence pauses dependent answers. No silent retrieval fallback.',
 escalation: 'Human decisions require the assigned synthetic role in the case controls.',
 communication: 'Drafts remain unsent. Current communication and action permissions are checked by the deterministic workflow.',
});
export async function readPreferences(c: PoolClient, workspace: string) {
 const row = (await c.query('SELECT * FROM portfolio.agent_preferences WHERE workspace=$1', [workspace])).rows[0];
 return { selection: KnowledgeSelection.parse(row?.selection ?? { kind: 'sample' }), settings: AgentSettings.parse(row?.settings ?? {}), revision: row?.revision ?? 0, approvedBy: row?.approved_by ?? null };
}
export function synthesisMode(settings: AgentSettings): 'model' | 'evidence' {
 return settings.synthesis === 'automatic' ? providerConfiguration().enabled ? 'model' : 'evidence' : settings.synthesis;
}
export const readablePackName = (pack: {id:string;name:string}|undefined) => pack?.id === 'KP-ALDER' ? 'Alder prior authorization knowledge' : pack?.name ?? 'Selected case knowledge';
export function packChoices(registry: Registry, now: string) {
 const current = caseSelection(registry, 'DEMO-101');
 const assignment = registry.corpus.assignments.find(a => a.id === current.selectionId)!;
 const user = registry.user('avery');
 return registry.corpus.releases.map(release => {
  const releaseIds = [...new Set([...assignment.mandatoryReleaseIds, release.id])];
  const request = baseRequest({ ...current, releaseIds });
  const selection = selectKnowledge(registry, user, request, now);
  const reasons = [...selection.reasons];
  let eligibleSourceCount = 0;
  for (const id of release.documentVersionIds) {
   const version = registry.corpus.versions.find(v => v.id === id)!;
   if (!sourceReasons(registry, version, user, request, selection, now).length) eligibleSourceCount++;
  }
  const pack = registry.corpus.packs.find(p => p.id === release.packId)!;
  return { id: release.id, name: readablePackName(pack), version: release.version,
   description: release.documentVersionIds.map(id => registry.document(registry.corpus.versions.find(v => v.id === id)!.documentId).title).join(' · '),
   sourceCount: release.documentVersionIds.length, eligibleSourceCount, status: registry.isRetired(release.id) ? 'retired' : release.status,
   audiences: release.audiences, permittedUses: release.permittedUses,
   available: reasons.length === 0 && eligibleSourceCount > 0, reasons: [...new Set(reasons)], releaseIds,
  };
 });
}
export function governedSelection(registry: Registry, selected: KnowledgeSelection, now: string) {
 const current = caseSelection(registry, 'DEMO-101');
 if (selected.kind !== 'pack') return current;
 const choice = packChoices(registry, now).find(p => p.id === selected.releaseId);
 // Do not change a stale selection silently. The pipeline must record its denial
 // or pause using current authority, even if the source was retired after selection.
 return { ...current, releaseIds: choice?.releaseIds ?? [...new Set([...registry.corpus.assignments.find(a => a.id === current.selectionId)!.mandatoryReleaseIds, selected.releaseId])] };
}
export async function acknowledgeNotice(c: PoolClient, session: Session) {
 await c.query('UPDATE portfolio.sessions SET notice_acknowledged_at=COALESCE(notice_acknowledged_at,clock_timestamp()) WHERE token_hash=$1', [session.token_hash]);
}

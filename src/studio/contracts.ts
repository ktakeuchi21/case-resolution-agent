import { z } from 'zod';
import { Audience, Channel, DimensionNames, FactKind, Id, Scope, Use } from '../contracts.ts';
import { ParsedDocument } from './parser.ts';

export const Metadata = z.strictObject({
 sourceName: z.string().trim().min(1).max(160), version: Id, documentType: z.enum(['unknown', 'payer_guide', 'education', 'sop', 'program_guide']),
 environment: z.literal('sandbox'), scope: Scope, program: z.string().trim().max(80).nullable(),
 audiences: z.array(Audience).max(5), permittedUses: z.array(Use).max(4), channels: z.array(Channel).max(4),
 communicationPermission: z.enum(['unknown', 'review_required', 'explicit_channels_only']), actionImplications: z.literal('no_execution_authority'),
 effectiveFrom: z.iso.datetime({ offset: true }).nullable(), expiresAt: z.iso.datetime({ offset: true }).nullable(),
 owner: z.string().trim().min(1).max(80), reviewer: z.literal('publisher').nullable(), supersededSource: Id.nullable(),
 sensitivity: z.literal('synthetic_or_authorized_no_patient_data'),
 authority: z.enum(['unverified', 'payer_owner', 'program_owner', 'operations_owner', 'educational']),
 authorityDomain: z.enum(['payer_process', 'program_intake', 'communication']),
 annotations: z.array(z.strictObject({ passageId: Id, kind: FactKind, value: z.string().trim().min(1).max(160), quote: z.string().min(1).max(2400) })).max(40),
});
export type Metadata = z.infer<typeof Metadata>;
export const UploadRecord = z.strictObject({
 id: Id, revision: z.number().int().positive(), parsed: ParsedDocument, metadata: Metadata,
 status: z.enum(['parsed', 'submitted', 'approved', 'rejected', 'published', 'quarantined']),
 uploadedBy: z.literal('viewer'), reviewedAt: z.string().nullable(), reviewHash: z.string().nullable(), rejectionReason: z.string().nullable(),
 releaseId: Id.nullable(), governedVersionId: Id.nullable(), createdAt: z.string(), expiresAt: z.string(),
});
export type UploadRecord = z.infer<typeof UploadRecord>;
export const StudioAction = z.strictObject({
 action: z.enum(['metadata', 'reprocess', 'delete', 'submit', 'approve', 'reject', 'publish', 'assign', 'retire', 'supersede']),
 idempotencyKey: Id, uploadId: Id.optional(), revision: z.number().int().positive().optional(), metadata: Metadata.optional(),
 chunkSize: z.number().int().min(300).max(1800).optional(), releaseId: Id.optional(), versionId: Id.optional(), successorId: Id.optional(),
 reason: z.string().trim().min(1).max(500).optional(), confirmed: z.literal(true).optional(),
});
export const StudioTest = z.strictObject({
 idempotencyKey: Id, question: z.string().trim().min(1).max(500), synthetic: z.literal(true),
 collection: z.enum(['governed', 'sandbox', 'proposed']), uploadId: Id.optional(),
 mode: z.enum(['hybrid', 'semantic', 'lexical']).default('hybrid'), acknowledgeLexical: z.literal(true).optional(),
});
export function proposedMetadata(name: string): Metadata {
 const unknown = { kind: 'unknown' as const, reason: 'Awaiting metadata review; unknown is not unrestricted.' };
 return Metadata.parse({ sourceName: name, version: 'v1', documentType: 'unknown', environment: 'sandbox',
  scope: Object.fromEntries(DimensionNames.map(d => [d, unknown])), program: null, audiences: [], permittedUses: [], channels: [],
  communicationPermission: 'unknown', actionImplications: 'no_execution_authority', effectiveFrom: null, expiresAt: null,
  owner: 'Synthetic contributor', reviewer: null, supersededSource: null, sensitivity: 'synthetic_or_authorized_no_patient_data', authority: 'unverified', authorityDomain: 'payer_process', annotations: [],
 });
}

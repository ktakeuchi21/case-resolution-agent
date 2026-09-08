import { z } from 'zod';
import { Id, Hash, Timestamp, EvidenceRecord } from '../contracts.ts';
export const State=z.enum(['RECEIVED','OUTREACH_QUEUED','AWAITING_RESPONSE','VERIFICATION_REQUIRED','TRANSFER_QUEUED','AWAITING_ACK','PAUSED','PA_PENDING','ESCALATED','CANCELLED','FAILED']);
export type State=z.infer<typeof State>;
export const terminal=(s:State)=>['PA_PENDING','ESCALATED','CANCELLED','FAILED'].includes(s);
export const Grant=z.strictObject({id:Id,caseId:z.literal('DEMO-101'),issuedBy:z.literal('publisher'),issuedAt:Timestamp,
 activeFrom:Timestamp,expiresAt:Timestamp,knowledgeActor:z.literal('avery'),office:z.literal('avery'),manager:z.literal('morgan'),supervisor:z.literal('demo-supervisor'),worker:z.literal('agent.sc01'),receiver:z.literal('receiver.sc01'),
 notificationRecipient:z.literal('sim-office-101'),transferRecipient:z.literal('sim-receiver-101'),channel:z.literal('simulated_email'),template:z.literal('workspace-attention-v1'),maxReminders:z.literal(2),policy:z.literal('sc01-demo-operations-v1')});
export type Grant=z.infer<typeof Grant>;
export const Revocation=z.strictObject({id:Id,grantId:Id,actor:z.literal('publisher'),timestamp:Timestamp,reason:z.literal('GRANT_REVOKED')});
export const Payload=z.strictObject({caseId:z.literal('DEMO-101'),recipient:Id,template:z.enum(['workspace-attention-v1','verified-document-transfer-v1']),documentHash:Hash.nullable()});
export const Knowledge=z.strictObject({evidenceId:Id,runId:Id,timestamp:Timestamp,mode:z.enum(['lexical','semantic','hybrid']),degraded:z.boolean(),
 releases:EvidenceRecord.shape.selectedReleases,passages:EvidenceRecord.shape.evidenceUsed,support:EvidenceRecord.shape.support,applicability:EvidenceRecord.shape.applicability,
 communication:EvidenceRecord.shape.communication,action:EvidenceRecord.shape.action});
export const Authorization=z.strictObject({id:Id,timestamp:Timestamp,grantId:Id,evidenceId:Id,runId:Id,action:z.enum(['notify_workspace','transfer_verified_document']),
 communication:z.literal('allowed'),actionPermission:z.literal('allowed'),reason:z.enum(['EXPLICIT_TEMPLATE_GRANT','BOUND_HUMAN_APPROVAL']),payloadHash:Hash,contentRevision:z.number().int().positive(),approvalId:Id.nullable()});
export const Effect=z.strictObject({id:Id,kind:z.enum(['notification','transfer']),payload:Payload,status:z.enum(['proposed','authorized','queued','attempted','delivered','acknowledged','rejected','failed','unknown','cancelled']),
 authorizations:z.array(Authorization),attempts:z.number().int().nonnegative(),createdAt:Timestamp,receiptId:Id.nullable(),approvalId:Id.nullable()});
export type Effect=z.infer<typeof Effect>;
export const Approval=z.strictObject({id:Id,actor:Id,documentHash:Hash,payloadHash:Hash,recipient:Id,contentRevision:z.number().int().positive(),approvedAt:Timestamp,expiresAt:Timestamp});
export const Task=z.strictObject({id:Id,kind:z.enum(['clarification','verification','authority','exception']),reason:z.string().min(1),caseState:State,question:z.string().min(1),
 evidenceIds:z.array(Id),actionsTaken:z.array(z.strictObject({effectId:Id,status:Effect.shape.status})),options:z.array(z.enum(['release_collection','verify_and_approve','retry','escalate','reject'])).min(1),
 assignedTo:Id,requiredRole:z.enum(['office_verifier','case_manager','supervisor']),dueAt:Timestamp,resumeState:State,resumeInstructions:z.string().min(1),
 status:z.enum(['open','resolved','cancelled']),createdAt:Timestamp,createdBy:Id});
export const Timer=z.strictObject({id:Id,kind:z.enum(['follow_up','human_due','ack_due']),subjectId:Id,dueAt:Timestamp,status:z.enum(['pending','leased','fired','cancelled']),leaseToken:Id.nullable(),leaseUntil:Timestamp.nullable()});
export const Decision=z.strictObject({id:Id,taskId:Id,actor:Id,option:Task.shape.options.element,timestamp:Timestamp,documentHash:Hash.nullable(),recipient:Id.nullable()});
const common={id:Id,workflowId:Id};
export const Command=z.discriminatedUnion('type',[
 z.strictObject({...common,type:z.literal('start'),grantId:Id}),
 z.strictObject({...common,type:z.literal('assess')}),
 z.strictObject({...common,type:z.literal('ambiguity'),reason:z.literal('DOCUMENT_UNCERTAIN')}),
 z.strictObject({...common,type:z.literal('document'),sourceId:Id,documentHash:Hash}),
 z.strictObject({...common,type:z.literal('ack'),sourceId:Id,effectId:Id,documentHash:Hash,recipient:Id,accepted:z.boolean()}),
 z.strictObject({...common,type:z.literal('resolve'),taskId:Id,option:Task.shape.options.element,documentHash:Hash.optional(),recipient:Id.optional()}),
 z.strictObject({...common,type:z.literal('cancel')}),
 z.strictObject({...common,type:z.literal('acquire_timer'),timerId:Id}),
 z.strictObject({...common,type:z.literal('fire_timer'),timerId:Id,leaseToken:Id}),
]);
export type Command=z.infer<typeof Command>;
export const InternalCommand=z.strictObject({...common,type:z.enum(['prepare_dispatch','dispatch','reconcile']),effectId:Id});
export type InternalCommand=z.infer<typeof InternalCommand>;
export const Event=z.strictObject({type:z.enum(['case_received','dependency_identified','knowledge_checked','authorization_checked','state_changed','effect_proposed','effect_authorized','effect_queued','effect_attempted','effect_delivered','effect_unknown','effect_reconciled','effect_failed','effect_rejected','effect_cancelled','receiving_acknowledged','document_received','human_task_created','human_decision','resumed','timer_created','timer_acquired','timer_fired','timer_cancelled','dependency_resolved','paused','escalated','cancelled','duplicate_suppressed','command_rejected','retry_scheduled']),
 subjectId:Id,reason:z.string(),timestamp:Timestamp});
export const Snapshot=z.strictObject({id:Id,definition:z.literal('sc01-v1'),caseId:z.literal('DEMO-101'),grantId:Id,revision:z.number().int().positive(),contentRevision:z.number().int().positive(),state:State,resumeState:State,
 createdAt:Timestamp,updatedAt:Timestamp,identifiedAt:Timestamp.nullable(),completedAt:Timestamp.nullable(),accessStatus:z.literal('PA_PENDING'),dependency:z.enum(['unassessed','open','resolved']),
 documentHash:Hash.nullable(),approval:Approval.nullable(),knowledge:z.array(Knowledge),effects:z.array(Effect),tasks:z.array(Task),timers:z.array(Timer),decisions:z.array(Decision),
 inbox:z.array(z.strictObject({sourceId:Id,kind:z.enum(['document','ack']),fingerprint:Hash,timestamp:Timestamp})),pauseReasons:z.array(z.string())});
export type Snapshot=z.infer<typeof Snapshot>;
export const Step=z.strictObject({id:Id,workflowId:Id,revision:z.number().int().positive(),previousHash:Hash.nullable(),actor:Id,timestamp:Timestamp,transactionId:z.string(),
 command:z.union([Command,InternalCommand]),fingerprint:Hash,status:z.enum(['accepted','rejected','duplicate']),events:z.array(Event),snapshot:Snapshot});
export type Step=z.infer<typeof Step>;
export const Receipt=z.strictObject({id:Id,effectId:Id,workflowId:Id,payloadHash:Hash,outcome:z.enum(['delivered','not_delivered','rejected']),timestamp:Timestamp,provider:z.literal('deterministic-simulation-v1')});
export type Receipt=z.infer<typeof Receipt>;

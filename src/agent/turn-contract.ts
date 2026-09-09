import { z } from 'zod';
import { Id } from '../contracts.ts';

export const TURN_VERSION = 'pathway-contextual-v1';
export const SMS_LIMIT = 250;
export const TurnIntent = z.enum(['question','rationale','evidence','next_action','summary','draft','refinement','interaction','clarification','human_action','unsupported']);
const audience = z.enum(['case_manager','office','supervisor','crm']);
const channel = z.enum(['chat','email','sms','voice','teams']);
const tone = z.enum(['concise','warm','formal']);
export const MaterialClarification = z.strictObject({
 question:z.string().min(1).max(250), why:z.string().min(1).max(500), decision:z.string().min(1).max(500),
 options:z.array(z.strictObject({value:z.enum(['document_requirement','workflow_status','office','case_manager']),label:z.string().min(1).max(100)})).min(2).max(4),
});
export const TurnInterpretation = z.strictObject({
 intent:TurnIntent, follows:Id.nullable(), artifactId:Id.nullable(), audience,channel,tone,
 length:z.enum(['unchanged','short','shorter']), retrievalQuestion:z.string().min(1).max(500),
 clarification:MaterialClarification.nullable(), requestedAction:z.string().max(500).nullable(),
 note:z.string().max(500),
});
export type TurnInterpretation = z.infer<typeof TurnInterpretation>;
export const OutputSlot = z.enum(['answer','rationale','subject','body']);
export const TurnClaim = z.strictObject({
 id:Id,kind:z.enum(['fact','inference','recommendation','uncertainty']),text:z.string().min(1).max(700),
 locations:z.array(OutputSlot).min(1).max(4),
 supports:z.array(z.strictObject({reference:z.string().min(1),quote:z.string().min(1).max(1600)})).min(1).max(6),
});
export const ProposedTurn = z.strictObject({
 answer:z.string().min(1).max(2400),rationale:z.string().max(1400).nullable(),
 workProduct:z.strictObject({subject:z.string().max(200).nullable(),body:z.string().min(1).max(4000),audience,channel,tone,purpose:z.string().min(1).max(200)}).nullable(),
 claims:z.array(TurnClaim).max(16),uncertainties:z.array(z.string().min(1).max(500)).max(6),
 requestedAction:z.string().max(500).nullable(),
});
export type ProposedTurn = z.infer<typeof ProposedTurn>;
export const FullTurnReview = z.strictObject({
 claims:z.array(z.strictObject({id:Id,supported:z.boolean(),reason:z.string().max(300)})).max(16),
 slots:z.array(z.strictObject({slot:OutputSlot,allMaterialStatementsCovered:z.boolean(),supported:z.boolean(),reason:z.string().max(400)})).min(1).max(4),
 channelSafe:z.boolean(),transformationFaithful:z.boolean(),answersActualRequest:z.boolean(),
});
export const TurnRecord = z.strictObject({
 version:z.literal(TURN_VERSION),interpretation:TurnInterpretation,rationale:z.string().nullable(),
 uncertainties:z.array(z.string()),
 transformation:z.strictObject({previousWords:z.number().int().nonnegative().nullable(),words:z.number().int().nonnegative(),characters:z.number().int().nonnegative(),maximumWords:z.number().int().nonnegative().nullable(),smsLimit:z.number().int().positive()}),
 regeneratedFrom:Id.nullable(),
});
export const wordCount=(s:string)=>(s.trim().match(/\S+/gu)??[]).length;
export const turnSlots=(t:ProposedTurn)=>Object.entries({answer:t.answer,rationale:t.rationale,subject:t.workProduct?.subject,body:t.workProduct?.body}).filter((e):e is [string,string]=>typeof e[1]==='string'&&e[1].length>0);

import { Grant } from './contracts.ts';
export function sc01Grant(id='G-101-sc01'){
 return Grant.parse({id,caseId:'DEMO-101',issuedBy:'publisher',issuedAt:'2026-09-10T16:00:00.000Z',activeFrom:'2026-09-01T00:00:00.000Z',expiresAt:'2026-10-01T00:00:00.000Z',
  knowledgeActor:'avery',office:'avery',manager:'morgan',supervisor:'demo-supervisor',worker:'agent.sc01',receiver:'receiver.sc01',notificationRecipient:'sim-office-101',transferRecipient:'sim-receiver-101',channel:'simulated_email',template:'workspace-attention-v1',maxReminders:2,policy:'sc01-demo-operations-v1'});
}

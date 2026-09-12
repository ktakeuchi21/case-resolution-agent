import type { KnowledgePack, PackId, Passage } from './contracts.ts';

export const packs: KnowledgePack[] = [
 { id:'alder', name:'Alder Prior Authorization Knowledge Pack', shortName:'Alder documentation', version:'1.0', scenario:'HCP office documentation support',
 description:'Find the missing document and prepare a clear office follow-up.', user:{name:'Avery Chen',role:'HCP office access coordinator',email:'avery.chen@alder-office.example'},
 agentRole:'Documentation Support Agent',caseId:'ALD-1042',caseContext:'Synthetic case ALD-1042 at Alder HCP Office. Request N-101 remains open against submitted package PKG-1042. No payer decision is recorded.',
 covers:['Missing-document requests','Submitted-package inventory','Receipt and acknowledgment','Administrative next steps'],
 prompts:['What document is missing?','Why is it being requested?','Is there a deadline?','Draft a short email requesting the document.'],workProduct:'An office email requesting the signed note',
 recipient:{name:'Alder HCP Office',email:'access@alder-office.example'},defaultChannel:'chat'},
 { id:'access',name:'Synthetic Coverage and Access Knowledge Pack',shortName:'Coverage & access',version:'1.0',scenario:'Field reimbursement support',
 description:'Turn an access roadblock into a useful HCP-office briefing.',user:{name:'Morgan Lee',role:'field reimbursement manager',email:'morgan.lee@cedar-support.example'},
 agentRole:'Access Support Agent',caseId:'ACC-2086',caseContext:'Synthetic case ACC-2086 for Cedar Support and fictitious Juniper Plan. Benefit verification is incomplete because the member identifier is unreadable. No prior authorization submission or coverage determination is recorded.',
 covers:['Benefit verification','Prior-authorization steps','Documentation and escalation','Office support boundaries'],
 prompts:['What is blocking this case?','What can I tell the HCP office?','What remains unknown?','Summarize this case for my next office conversation.'],workProduct:'A concise case briefing or office follow-up email',
 recipient:{name:'Cedar HCP Office',email:'access@cedar-office.example'},defaultChannel:'email'},
 { id:'fulfillment',name:'Synthetic Specialty Pharmacy Fulfillment Knowledge Pack',shortName:'Specialty pharmacy fulfillment',version:'1.0',scenario:'Patient-support fulfillment',
 description:'Explain a fulfillment status in language a patient can understand.',user:{name:'Jordan Rivera',role:'patient-support case manager',email:'jordan.rivera@willow-support.example'},
 agentRole:'Fulfillment Support Agent',caseId:'FUL-3091',caseContext:'Synthetic case FUL-3091 for Willow Support and fictitious Birch Specialty Pharmacy. Enrollment is received, consent signature is missing, and prescription intake is recorded. There is no dispense release or carrier handoff.',
 covers:['Enrollment and consent','Prescription intake','Dispense and shipment status','Administrative escalation'],
 prompts:['Where is this case in the fulfillment process?','What is still needed?','Has the medication shipped?','Draft a patient-friendly status update.'],workProduct:'A patient-friendly administrative status message',
 recipient:{name:'Taylor Sample (synthetic patient)',email:'taylor.sample@patient.example'},defaultChannel:'chat'},
];
export const getPack = (id: PackId) => packs.find(p=>p.id===id)!;
type Document = { id: string; packId: PackId; title: string; type: string; version: string; status: 'current'|'superseded'; caseId: string|null; sections: Array<[string,string]> };
const doc = (packId:PackId,id:string,title:string,type:string,sections:Array<[string,string]>,caseId:string|null=null,status:'current'|'superseded'='current',version='1.0'):Document => ({packId,id,title,type,sections,caseId,status,version});
export const documents: Document[] = [
 doc('alder','N-101','N-101 · Signed office note request','Case-specific request',[
 ['Requested item','For synthetic case ALD-1042, request N-101 asks the Alder HCP Office for the signed office note referenced in its submitted package. The signature page must be part of the note. A cover sheet or an unsigned note does not satisfy this request.'],
 ['Reason and timing','The signed office note is requested to complete the administrative documentation package identified in N-101. This request does not say that treatment is appropriate or that prior authorization will be approved. N-101 specifies no response deadline, due date or urgency.']], 'ALD-1042'),
 doc('alder','INV-1042','PKG-1042 · Submitted-package inventory','Document inventory',[
 ['Received package','The synthetic PKG-1042 inventory lists the request cover sheet, demographic form and unsigned office note. It does not list a signed office note or signature page.'],
 ['Receipt record','As of the synthetic case snapshot on September 10, 2026 at 10:00 AM, there is no later receipt acknowledgment for the signed note. A request being created is not evidence that a document was received.']], 'ALD-1042'),
 doc('alder','PROC-01','Missing-document follow-up guide','Process guide',[
 ['Office next step','Ask the office to provide the complete signed note through its established secure document channel and reference case ALD-1042 and request N-101. The Knowledge Pack does not contain an actual upload URL, fax number or secure-channel address. Do not place patient records in an ordinary email.'],
 ['After submission','After the office reports submission, check for a receiving-team acknowledgment. The receiving team checks whether the requested signed note and signature page are present. Only its acknowledgment can confirm receipt; receipt alone does not confirm package completeness or a payer decision.']]),
 doc('alder','COM-01','Office communication guide','Communication guide',[
 ['Draft guidance','A useful synthetic office email identifies the signed office note requested in N-101, explains that it completes the requested documentation package, and asks for submission through the established secure channel. Thank the office and offer administrative help. Do not invent a deadline, urgency, receipt confirmation or approval promise.'],
 ['Recorded office reply','The synthetic office message at 9:15 AM on September 10, 2026 says: “We sent the cover sheet and unsigned note. We are checking with the clinician about the signature.” This is the recorded office report; it does not prove a signed note was sent or received.']], 'ALD-1042'),
 doc('alder','FAQ-01','Receipt, completion and decisions','FAQ',[
 ['Different milestones','Document sent means the office reports transmission. Received means the receiving team acknowledges arrival. Complete means the required package has been checked. Prior authorization approved means a payer has made an approval decision. These milestones are distinct; do not infer one from another.'],
 ['Authority limits','Pathway provides administrative support only. The payer decides prior authorization and coverage. Pathway cannot recommend treatment, determine clinical necessity, promise eligibility or approval, or send a real email.']]),
 doc('alder','ESC-01','Documentation escalation guide','Escalation guide',[
 ['Unknowns and escalation','If the request is unclear, ask the receiving support team to clarify the exact missing item. If the office reports submission but no acknowledgment is available, ask that team to check receipt. The pack defines no universal waiting period or acknowledgment service-level deadline.']]),
 doc('alder','ARCH-01','Archived office-note reminder','Superseded procedure',[
 ['Superseded guidance','This archived 2025 reminder used a five-business-day response target. It was superseded by PROC-01 and does not apply to request N-101. Do not use it to establish a deadline for ALD-1042.']],null,'superseded','0.8'),
 doc('alder','OTHER-77','N-077 · Separate case request','Inapplicable case request',[
 ['Different case','Synthetic case ALD-9999 request N-077 needs an insurance card by September 15, 2026. This request is unrelated to ALD-1042 and must not define its required document or deadline.']], 'ALD-9999'),
 doc('access','BV-2086','ACC-2086 · Benefit-verification status','Status record',[
 ['Current blocker','For synthetic case ACC-2086, benefit verification is incomplete because the member identifier on the submitted Juniper Plan insurance card is unreadable. The office should confirm the identifier or provide a legible copy through its established secure channel. No benefit result is recorded.'],
 ['Known and unknown','The prescriber name and demographic form are on file. Active benefits, prior-authorization requirements, patient cost, network specialty pharmacy and coverage outcome remain unknown. No prior-authorization submission or payer decision is recorded.']], 'ACC-2086'),
 doc('access','BV-GUIDE','Benefit-verification process','Process guide',[
 ['Administrative sequence','Obtain legible member and plan information, confirm the identity fields with the office, and submit a benefit-verification inquiry through the authorized support channel. Record the returned benefit information and its date before explaining case-specific requirements. A verification request is not a coverage approval.'],
 ['Timing','The synthetic access pack does not specify a benefit-verification turnaround guarantee or a deadline for the office to respond. Do not promise a completion date.']]),
 doc('access','PA-GUIDE','Prior-authorization administrative steps','Process guide',[
 ['Before submission','After current benefits and any prior-authorization requirement are confirmed, identify the applicable payer form and documentation, help the office assemble the package, submit through the authorized channel and track the payer acknowledgment. Only the payer can determine whether authorization is required and whether to approve it.']]),
 doc('access','JUN-01','Juniper Plan administrative checklist','Synthetic policy summary',[
 ['Common documentation','This synthetic Juniper checklist lists a legible member identifier, prescriber details and a completed payer form as common administrative inputs when a prior-authorization request is required. It is general guidance, not confirmation that a particular service is covered or that ACC-2086 requires authorization.'],
 ['Policy support and limits','The legible member identifier requirement is supported by this checklist and the ACC-2086 status record. Additional clinical documentation depends on the applicable payer request and must be confirmed; the pack supplies no treatment criteria or medical-necessity determination.']]),
 doc('access','OFFICE-2086','Office support conversation record','Communication record',[
 ['Office statement','In the synthetic September 10, 2026 office exchange, staff reported: “The card image is blurry. We can check the member number and send a clearer copy.” No corrected identifier or new card receipt is recorded.'],
 ['Briefing and follow-up','For the next office conversation, explain the unreadable member identifier, request a legible card or confirmed identifier through the established secure channel, and say benefit verification can proceed once the required information is available. Distinguish that next administrative step from a benefit or authorization result.']], 'ACC-2086'),
 doc('access','ACCESS-ESC','Access support escalation and boundaries','Escalation guide',[
 ['Who to contact','Route unresolved benefit-verification discrepancies to the support program benefit-verification team. Route payer interpretation, exception or appeal questions to the payer or appropriate office specialist. A field reimbursement manager can explain the documented process and organize questions, but cannot overturn a payer decision.'],
 ['No unsupported promises','Do not predict approval, promise financial-assistance eligibility, give a patient-cost amount, recommend treatment or claim an email was sent. These are outside this synthetic administrative support demonstration.']]),
 doc('access','JUN-OLD','Archived Juniper phone-verification note','Superseded policy',[
 ['Retired rule','A retired 2025 guide said every Juniper case required prior authorization and quoted a two-day verification target. JUN-01 and BV-GUIDE supersede it. Neither claim should be applied to the current case.']],null,'superseded','0.7'),
 doc('access','OTHER-2087','ACC-2087 · Separate verified case','Inapplicable status record',[
 ['Different case','For synthetic ACC-2087 only, the returned benefit record says prior authorization is required and an office response is due September 18, 2026. ACC-2087 is not ACC-2086; this result cannot answer the selected case.']], 'ACC-2087'),
 doc('fulfillment','STATUS-3091','FUL-3091 · Fulfillment status','Status record',[
 ['Current stage','For synthetic case FUL-3091, Willow Support enrollment is received and Birch Specialty Pharmacy has recorded prescription intake. The consent form is missing its required signature. The case is not dispense-ready. No dispense release, shipment confirmation, carrier handoff or tracking number is recorded.'],
 ['Next administrative item','The missing item is the signed consent form. Jordan can explain how to complete consent through the established secure program channel and ask the intake team to confirm receipt and completeness. No real channel address or patient record belongs in this demo.']], 'FUL-3091'),
 doc('fulfillment','ENROLL-01','Enrollment and consent prerequisites','Program terms',[
 ['Consent requirement','A completed enrollment form and the required signed consent are administrative prerequisites for advancing the synthetic support enrollment. A submitted or received form is not necessarily complete. Missing consent must be resolved and its receipt checked; do not claim that resolution alone guarantees dispensing.']]),
 doc('fulfillment','RX-01','Prescription intake and dispense readiness','Process guide',[
 ['Intake sequence','Prescription intake means the pharmacy recorded the prescription for review. The pharmacy must complete its required checks and confirm dispense readiness. Pathway can describe recorded administrative stages but cannot validate a prescription, decide treatment, release medication or override pharmacy checks.']]),
 doc('fulfillment','SHIP-01','Pharmacy shipment-status glossary','Status glossary',[
 ['Shipment terms','Label created means shipping information was prepared; it does not confirm carrier possession. Shipped or carrier handoff requires an explicit shipment confirmation. Delivered requires a delivery confirmation. Intake received, enrollment received and dispense-ready do not mean shipped.'],
 ['Dates and promises','This synthetic Knowledge Pack provides no shipment date, delivery estimate, processing turnaround guarantee or deadline for FUL-3091 consent. Only the pharmacy or carrier can confirm its own actual status; the support program must not promise delivery.']]),
 doc('fulfillment','PATIENT-01','Patient-friendly status communication','Communication guide',[
 ['Suggested content','Explain that enrollment has been received and prescription intake is recorded, but a signature on the consent form is still needed. Ask the patient to complete consent through the established secure program channel. Say the pharmacy must complete its checks before shipment can be confirmed. Keep language calm and concise; do not promise a delivery date or recommend treatment.'],
 ['Recorded patient question','The synthetic patient message reads: “I filled out the enrollment form. Does that mean it is on the way?” This is a question, not a shipping confirmation.']], 'FUL-3091'),
 doc('fulfillment','FUL-ESC','Pharmacy escalation and support limits','Escalation guide',[
 ['Escalation','Contact the specialty pharmacy intake team if consent receipt is unclear, intake details conflict, or the patient reports a shipment that is absent from the record. Ask the pharmacy to confirm the administrative stage and missing items. Clinical or medication questions belong with the treating clinician or pharmacist.'],
 ['Authority','Pathway cannot promise dispensing, financial-assistance eligibility, delivery or clinical outcomes. Drafts are generated for review and never sent. There is no automatic outreach or actual pharmacy integration.']]),
 doc('fulfillment','FUL-OLD','Archived shipping quick reference','Superseded glossary',[
 ['Retired shortcut','A retired 2025 quick reference used “label created” as “shipped” and suggested next-day arrival. SHIP-01 supersedes that wording. Do not infer carrier handoff or delivery from a label.']],null,'superseded','0.6'),
 doc('fulfillment','OTHER-3092','FUL-3092 · Separate shipped case','Inapplicable status record',[
 ['Different case','Synthetic case FUL-3092 has a confirmed carrier handoff and an estimated September 14, 2026 delivery. It is unrelated to FUL-3091 and cannot establish shipping or delivery for the selected case.']], 'FUL-3092'),
];
// Seeded documents are short, section-aware chunks. Exact passage strings are canonical.
export const passages: Passage[] = documents.flatMap(d=>d.sections.map(([section,text],i)=>({
 id:`${d.packId}.${d.id}.${i+1}`,packId:d.packId,caseId:d.caseId,sourceId:d.id,title:d.title,type:d.type,version:d.version,status:d.status,section,text,synthetic:true as const,
})));

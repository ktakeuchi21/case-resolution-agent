// Independent frozen supplement. The original 36-case suite and its artifact remain unchanged.
export const boundaryEvaluationVersion='rag-knowledge-switch-v1';
export const boundaryCases=[
 {id:'switch-01',packId:'alder',question:'What document is missing?',expected:['alder.N-101.1','alder.INV-1042.1'],review:'Identifies the signed office note and preserves exact historical Alder citations.'},
 {id:'switch-02',packId:'fulfillment',question:'What document is missing?',expected:['fulfillment.STATUS-3091.2'],review:'Identifies signed consent using only fulfillment evidence; no signed-office-note carryover.'},
 {id:'switch-03',packId:'fulfillment',question:'Draft a patient-friendly status update.',expected:['fulfillment.PATIENT-01.1','fulfillment.STATUS-3091.1'],review:'Creates a patient-ready update without a delivery promise.'},
 {id:'switch-04',packId:'fulfillment',question:'Make that email more formal.',expected:['fulfillment.PATIENT-01.1'],review:'Refines the current fulfillment message; it must not resurrect the Alder request.'},
 {id:'switch-05',packId:'fulfillment',question:'What don’t you know?',expected:['fulfillment.STATUS-3091.1','fulfillment.SHIP-01.2'],review:'Identifies absent shipping confirmation, tracking number and timing without inventing them.'},
 {id:'switch-06',packId:'alder',question:'What document is missing?',expected:['alder.N-101.1','alder.INV-1042.1'],review:'Returning to Alder restores only Alder evidence; fulfillment history remains historical.'},
] as const;

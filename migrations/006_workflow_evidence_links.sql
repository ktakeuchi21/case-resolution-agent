ALTER TABLE pathway.wf_grants ADD COLUMN case_id text GENERATED ALWAYS AS (body->>'caseId') STORED NOT NULL,
 ADD FOREIGN KEY(workspace,tenant,environment,case_id) REFERENCES pathway.cases;
ALTER TABLE pathway.runs ADD CONSTRAINT runs_evidence_pair UNIQUE(workspace,tenant,environment,id,evidence_id);
CREATE TABLE pathway.wf_knowledge_links (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL,
 step_id text NOT NULL,run_id text NOT NULL,evidence_id text NOT NULL,
 PRIMARY KEY(workspace,tenant,environment,step_id,run_id),
 FOREIGN KEY(workspace,tenant,environment,step_id) REFERENCES pathway.wf_steps,
 FOREIGN KEY(workspace,tenant,environment,run_id,evidence_id) REFERENCES pathway.runs(workspace,tenant,environment,id,evidence_id)
);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.wf_knowledge_links FOR EACH ROW EXECUTE FUNCTION pathway.immutable();
ALTER TABLE pathway.wf_knowledge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathway.wf_knowledge_links FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON pathway.wf_knowledge_links USING (workspace=current_setting('pathway.workspace',true) AND tenant=current_setting('pathway.tenant',true) AND environment=current_setting('pathway.environment',true)) WITH CHECK(workspace=current_setting('pathway.workspace',true) AND tenant=current_setting('pathway.tenant',true) AND environment=current_setting('pathway.environment',true));
GRANT SELECT,INSERT ON pathway.wf_knowledge_links TO pathway_app;
-- Backfill earlier verified local journal snapshots without rewriting their history.
INSERT INTO pathway.wf_knowledge_links SELECT workspace,tenant,environment,id,k->>'runId',k->>'evidenceId' FROM pathway.wf_steps CROSS JOIN LATERAL jsonb_array_elements(body->'snapshot'->'knowledge') k;

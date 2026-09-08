-- Append-only workflow journal and independently committed simulated remote receipts.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['wf_grants','wf_revocations','wf_steps','wf_receipts'] LOOP
 EXECUTE format('CREATE TABLE pathway.%I (workspace text NOT NULL, tenant text NOT NULL, environment text NOT NULL CHECK(environment=''governed''), id text NOT NULL, body jsonb NOT NULL, body_hash text NOT NULL, created_by text NOT NULL, authorized_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(workspace,tenant,environment,id), FOREIGN KEY(workspace,tenant,environment) REFERENCES pathway.generations)',t);
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.%I FOR EACH ROW EXECUTE FUNCTION pathway.immutable()',t);
 EXECUTE format('ALTER TABLE pathway.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE pathway.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY scope ON pathway.%I USING (workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true) AND environment=current_setting(''pathway.environment'',true)) WITH CHECK (workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true) AND environment=current_setting(''pathway.environment'',true))',t);
 EXECUTE format('GRANT SELECT,INSERT ON pathway.%I TO pathway_app',t);
 END LOOP;
END $$;
ALTER TABLE pathway.wf_steps ADD COLUMN workflow_id text GENERATED ALWAYS AS (body->>'workflowId') STORED NOT NULL,
 ADD COLUMN revision integer GENERATED ALWAYS AS ((body->>'revision')::integer) STORED NOT NULL,
 ADD COLUMN grant_id text GENERATED ALWAYS AS (body->'snapshot'->>'grantId') STORED NOT NULL,
 ADD CONSTRAINT wf_revision UNIQUE(workspace,tenant,environment,workflow_id,revision),
 ADD FOREIGN KEY(workspace,tenant,environment,grant_id) REFERENCES pathway.wf_grants;
CREATE UNIQUE INDEX wf_single_case ON pathway.wf_steps(workspace,tenant,environment,(body->'snapshot'->>'caseId')) WHERE revision=1;
ALTER TABLE pathway.wf_revocations ADD COLUMN grant_id text GENERATED ALWAYS AS (body->>'grantId') STORED NOT NULL,
 ADD FOREIGN KEY(workspace,tenant,environment,grant_id) REFERENCES pathway.wf_grants;
-- Views execute with caller privileges/RLS, never the schema owner's authority.
CREATE VIEW pathway.wf_instances WITH (security_invoker=true) AS
 SELECT DISTINCT ON(workspace,tenant,environment,workflow_id) workspace,tenant,environment,workflow_id,revision,body->'snapshot' AS snapshot
 FROM pathway.wf_steps ORDER BY workspace,tenant,environment,workflow_id,revision DESC;
CREATE VIEW pathway.wf_outbox WITH (security_invoker=true) AS SELECT workspace,tenant,environment,workflow_id,e.value AS body FROM pathway.wf_instances CROSS JOIN LATERAL jsonb_array_elements(snapshot->'effects') e;
CREATE VIEW pathway.wf_inbox WITH (security_invoker=true) AS SELECT workspace,tenant,environment,workflow_id,e.value AS body FROM pathway.wf_instances CROSS JOIN LATERAL jsonb_array_elements(snapshot->'inbox') e;
CREATE VIEW pathway.wf_tasks WITH (security_invoker=true) AS SELECT workspace,tenant,environment,workflow_id,e.value AS body FROM pathway.wf_instances CROSS JOIN LATERAL jsonb_array_elements(snapshot->'tasks') e;
CREATE VIEW pathway.wf_timers WITH (security_invoker=true) AS SELECT workspace,tenant,environment,workflow_id,e.value AS body FROM pathway.wf_instances CROSS JOIN LATERAL jsonb_array_elements(snapshot->'timers') e;
GRANT SELECT ON pathway.wf_instances,pathway.wf_outbox,pathway.wf_inbox,pathway.wf_tasks,pathway.wf_timers TO pathway_app;

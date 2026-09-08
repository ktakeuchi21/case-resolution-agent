DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['answers','user_revisions'] LOOP
 EXECUTE format('CREATE TABLE pathway.%I (workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL,id text NOT NULL,body jsonb NOT NULL,body_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_by text NOT NULL,authorized_by text NOT NULL,sequence bigint GENERATED ALWAYS AS IDENTITY,PRIMARY KEY(workspace,tenant,environment,id),FOREIGN KEY(workspace,tenant,environment) REFERENCES pathway.generations)',t);
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.%I FOR EACH ROW EXECUTE FUNCTION pathway.immutable()',t);
 EXECUTE format('ALTER TABLE pathway.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE pathway.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY scope ON pathway.%I USING(workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true) AND environment=current_setting(''pathway.environment'',true)) WITH CHECK(workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true) AND environment=current_setting(''pathway.environment'',true))',t);
 EXECUTE format('GRANT SELECT,INSERT ON pathway.%I TO pathway_app',t);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA pathway TO pathway_app;
ALTER TABLE pathway.answers ADD evidence_id text GENERATED ALWAYS AS (body->>'evidenceId') STORED NOT NULL,
 ADD FOREIGN KEY(workspace,tenant,environment,evidence_id) REFERENCES pathway.evidence;
-- Membership authorization changes invalidate a current registry snapshot.
CREATE TRIGGER generation_change BEFORE INSERT ON pathway.user_revisions FOR EACH ROW EXECUTE FUNCTION pathway.governance_write();

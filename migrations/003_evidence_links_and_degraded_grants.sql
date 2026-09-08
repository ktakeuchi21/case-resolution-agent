CREATE TABLE pathway.evidence_passages (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL,
 evidence_id text NOT NULL,passage_id text NOT NULL,
 PRIMARY KEY(workspace,tenant,environment,evidence_id,passage_id),
 FOREIGN KEY(workspace,tenant,environment,evidence_id) REFERENCES pathway.evidence,
 FOREIGN KEY(workspace,tenant,environment,passage_id) REFERENCES pathway.passages
);
CREATE TABLE pathway.evidence_releases (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL,
 evidence_id text NOT NULL,release_id text NOT NULL,
 PRIMARY KEY(workspace,tenant,environment,evidence_id,release_id),
 FOREIGN KEY(workspace,tenant,environment,evidence_id) REFERENCES pathway.evidence,
 FOREIGN KEY(workspace,tenant,environment,release_id) REFERENCES pathway.releases
);
CREATE TABLE pathway.degraded_grants (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL,id text NOT NULL,
 body jsonb NOT NULL,body_hash text NOT NULL,created_by text NOT NULL,authorized_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace,tenant,environment,id),
 FOREIGN KEY(workspace,tenant,environment) REFERENCES pathway.generations
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['evidence_passages','evidence_releases','degraded_grants'] LOOP
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.%I FOR EACH ROW EXECUTE FUNCTION pathway.immutable()',t);
 EXECUTE format('ALTER TABLE pathway.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE pathway.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY scope ON pathway.%I USING (workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true) AND environment=current_setting(''pathway.environment'',true)) WITH CHECK (workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true) AND environment=current_setting(''pathway.environment'',true))',t);
 EXECUTE format('GRANT SELECT,INSERT ON pathway.%I TO pathway_app',t);
 END LOOP;
END $$;

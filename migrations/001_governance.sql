CREATE EXTENSION IF NOT EXISTS vector VERSION '0.8.6';
CREATE SCHEMA pathway;
CREATE FUNCTION pathway.immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_RECORD' USING ERRCODE='55000'; END $$;
CREATE TABLE pathway.generations (
 workspace text NOT NULL, tenant text NOT NULL, environment text NOT NULL CHECK(environment IN ('governed','sandbox')),
 generation bigint NOT NULL DEFAULT 0, fixture_hash text NOT NULL, fixture_version text NOT NULL,
 PRIMARY KEY(workspace,tenant,environment)
);
-- Canonical JSON is validated with Zod on every repository read. Relational ownership,
-- references, immutability and key metadata are independently enforced here.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['documents','versions','passages','collections','packs','releases','assignments','cases','users','case_revisions','events','evidence','runs','decisions','escalations','audit','idempotency'] LOOP
 EXECUTE format('CREATE TABLE pathway.%I (
 workspace text NOT NULL, tenant text NOT NULL, environment text NOT NULL CHECK(environment IN (''governed'',''sandbox'')),
 id text NOT NULL, body jsonb NOT NULL CHECK(jsonb_typeof(body)=''object''), body_hash text NOT NULL CHECK(body_hash ~ ''^[a-f0-9]{64}$''),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by text NOT NULL, authorized_by text NOT NULL,
 sequence bigint GENERATED ALWAYS AS IDENTITY, PRIMARY KEY(workspace,tenant,environment,id),
 FOREIGN KEY(workspace,tenant,environment) REFERENCES pathway.generations)', t);
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.%I FOR EACH ROW EXECUTE FUNCTION pathway.immutable()',t);
 END LOOP;
END $$;
ALTER TABLE pathway.documents ADD CHECK(body->'provenance'->>'tenantId'=tenant AND body->'provenance'->>'mode'=environment AND body->>'id'=id);
ALTER TABLE pathway.versions ADD document_id text GENERATED ALWAYS AS (body->>'documentId') STORED,
 ADD approval_status text GENERATED ALWAYS AS (body->>'approvalStatus') STORED,
 ADD content_hash text GENERATED ALWAYS AS (body->>'contentHash') STORED,
 ADD effective_at text GENERATED ALWAYS AS (body->>'effectiveFrom') STORED,
 ADD expires_at text GENERATED ALWAYS AS (body->>'expiresAt') STORED,
 ADD superseded_at text GENERATED ALWAYS AS (body->>'supersededAt') STORED,
 ADD FOREIGN KEY(workspace,tenant,environment,document_id) REFERENCES pathway.documents;
ALTER TABLE pathway.passages ADD version_id text GENERATED ALWAYS AS (body->>'documentVersionId') STORED,
 ADD content_hash text GENERATED ALWAYS AS (body->>'textHash') STORED,
 ADD FOREIGN KEY(workspace,tenant,environment,version_id) REFERENCES pathway.versions;
ALTER TABLE pathway.packs ADD CHECK(environment='governed' AND body->>'tenantId'=tenant);
ALTER TABLE pathway.releases ADD pack_id text GENERATED ALWAYS AS (body->>'packId') STORED,
 ADD published_at text GENERATED ALWAYS AS (body->>'publishedAt') STORED,
 ADD manifest_hash text GENERATED ALWAYS AS (body->>'manifestHash') STORED,
 ADD CHECK(environment='governed' AND body->>'status'='published'),
 ADD FOREIGN KEY(workspace,tenant,environment,pack_id) REFERENCES pathway.packs;
ALTER TABLE pathway.assignments ADD agent_id text GENERATED ALWAYS AS (body->>'agentId') STORED,
 ADD workflow_id text GENERATED ALWAYS AS (body->>'workflowId') STORED,
 ADD audiences jsonb GENERATED ALWAYS AS (body->'audiences') STORED,
 ADD active_at text GENERATED ALWAYS AS (body->>'activeFrom') STORED,
 ADD expires_at text GENERATED ALWAYS AS (body->>'expiresAt') STORED,
 ADD CHECK(environment='governed' AND body->>'tenantId'=tenant);
ALTER TABLE pathway.cases ADD CHECK(environment='governed' AND body->>'tenantId'=tenant);
ALTER TABLE pathway.collections ADD CHECK(environment='sandbox' AND body->>'tenantId'=tenant);
ALTER TABLE pathway.users ADD CHECK(body->>'tenantId'=tenant);
CREATE TABLE pathway.membership (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL CHECK(environment='governed'),
 release_id text NOT NULL,passage_id text NOT NULL,
 PRIMARY KEY(workspace,tenant,environment,release_id,passage_id),
 FOREIGN KEY(workspace,tenant,environment,release_id) REFERENCES pathway.releases,
 FOREIGN KEY(workspace,tenant,environment,passage_id) REFERENCES pathway.passages
);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.membership FOR EACH ROW EXECUTE FUNCTION pathway.immutable();
CREATE TABLE pathway.assignment_releases (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL CHECK(environment='governed'),
 assignment_id text NOT NULL,release_id text NOT NULL,
 PRIMARY KEY(workspace,tenant,environment,assignment_id,release_id),
 FOREIGN KEY(workspace,tenant,environment,assignment_id) REFERENCES pathway.assignments,
 FOREIGN KEY(workspace,tenant,environment,release_id) REFERENCES pathway.releases
);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.assignment_releases FOR EACH ROW EXECUTE FUNCTION pathway.immutable();
ALTER TABLE pathway.events ADD event_type text GENERATED ALWAYS AS (body->>'type') STORED,
 ADD target_id text GENERATED ALWAYS AS (body->>'targetId') STORED,
 ADD occurred_at text GENERATED ALWAYS AS (body->>'timestamp') STORED;
ALTER TABLE pathway.evidence ADD CHECK(body->'userContext'->>'tenantId'=tenant AND body->'request'->>'mode'=environment AND body->>'id'=id);
ALTER TABLE pathway.runs ADD evidence_id text GENERATED ALWAYS AS (body->>'evidenceId') STORED,
 ADD FOREIGN KEY(workspace,tenant,environment,evidence_id) REFERENCES pathway.evidence;
ALTER TABLE pathway.decisions ADD evidence_id text GENERATED ALWAYS AS (body->>'evidenceId') STORED,
 ADD reason_codes jsonb GENERATED ALWAYS AS (body->'decision'->'reasonCodes') STORED,
 ADD FOREIGN KEY(workspace,tenant,environment,evidence_id) REFERENCES pathway.evidence;
ALTER TABLE pathway.idempotency ADD evidence_id text GENERATED ALWAYS AS (body->>'evidenceId') STORED,
 ADD FOREIGN KEY(workspace,tenant,environment,evidence_id) REFERENCES pathway.evidence;
CREATE TABLE pathway.embeddings (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL,
 id text NOT NULL,body jsonb NOT NULL,body_hash text NOT NULL,
 embedding vector NOT NULL, schema_version text NOT NULL DEFAULT 'vector-record-v1',
 configuration_hash text GENERATED ALWAYS AS (body->>'configurationHash') STORED,
 provider text GENERATED ALWAYS AS (body->'identity'->>'provider') STORED,
 model text GENERATED ALWAYS AS (body->'identity'->>'model') STORED,
 revision text GENERATED ALWAYS AS (body->'identity'->>'revision') STORED,
 dimensions integer GENERATED ALWAYS AS ((body->'identity'->>'dimensions')::integer) STORED,
 normalization text GENERATED ALWAYS AS (body->'identity'->>'normalization') STORED,
 input_hash text GENERATED ALWAYS AS (body->>'inputHash') STORED,
 embedded_at text GENERATED ALWAYS AS (body->>'embeddedAt') STORED,
 CHECK(vector_dims(embedding)=(body->'identity'->>'dimensions')::integer),
 CHECK(embedding=(body->'vector')::text::vector),
 PRIMARY KEY(workspace,tenant,environment,id),
 FOREIGN KEY(workspace,tenant,environment) REFERENCES pathway.generations
);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.embeddings FOR EACH ROW EXECUTE FUNCTION pathway.immutable();
CREATE TABLE pathway.passage_vectors (
 workspace text NOT NULL,tenant text NOT NULL,environment text NOT NULL,
 passage_id text NOT NULL,vector_id text NOT NULL,configuration_hash text NOT NULL,content_hash text NOT NULL,
 PRIMARY KEY(workspace,tenant,environment,passage_id,vector_id),
 FOREIGN KEY(workspace,tenant,environment,passage_id) REFERENCES pathway.passages,
 FOREIGN KEY(workspace,tenant,environment,vector_id) REFERENCES pathway.embeddings
);
CREATE FUNCTION pathway.check_vector_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pathway.passages p JOIN pathway.embeddings e
 ON (e.workspace,e.tenant,e.environment)=(p.workspace,p.tenant,p.environment)
 WHERE (p.workspace,p.tenant,p.environment,p.id)=(NEW.workspace,NEW.tenant,NEW.environment,NEW.passage_id)
 AND e.id=NEW.vector_id AND e.configuration_hash=NEW.configuration_hash
 AND e.input_hash=p.content_hash AND p.content_hash=NEW.content_hash)
 THEN RAISE EXCEPTION 'INVALID_VECTOR_BINDING'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_binding BEFORE INSERT ON pathway.passage_vectors FOR EACH ROW EXECUTE FUNCTION pathway.check_vector_binding();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON pathway.passage_vectors FOR EACH ROW EXECUTE FUNCTION pathway.immutable();
-- Roles are cluster-local, no superuser/BYPASSRLS inheritance. The owner is never used by the runtime.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pathway_app') THEN CREATE ROLE pathway_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA pathway TO pathway_app;
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA pathway TO pathway_app;
GRANT UPDATE(generation) ON pathway.generations TO pathway_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA pathway TO pathway_app;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='pathway' LOOP
 EXECUTE format('ALTER TABLE pathway.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 EXECUTE format('ALTER TABLE pathway.%I FORCE ROW LEVEL SECURITY',t.tablename);
 EXECUTE format('CREATE POLICY scope ON pathway.%I USING (
 workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true)
 AND environment=current_setting(''pathway.environment'',true)) WITH CHECK (
 workspace=current_setting(''pathway.workspace'',true) AND tenant=current_setting(''pathway.tenant'',true)
 AND environment=current_setting(''pathway.environment'',true))',t.tablename);
 END LOOP;
END $$;

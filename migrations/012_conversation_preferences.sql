ALTER TABLE portfolio.sessions ADD COLUMN notice_acknowledged_at timestamptz;

CREATE TABLE portfolio.agent_preferences (
 workspace text PRIMARY KEY,
 selection jsonb NOT NULL DEFAULT '{"kind":"sample"}',
 settings jsonb NOT NULL DEFAULT '{}',
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 approved_by text, updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT,INSERT,UPDATE ON portfolio.agent_preferences TO pathway_app;

-- Derivatives of an unapproved upload inherit its deletion and retention policy.
-- Governed conversation entries remain immutable in their existing table.
CREATE TABLE portfolio.temporary_agent_entries (
 workspace text NOT NULL, id text NOT NULL, conversation_id text NOT NULL,
 upload_id text NOT NULL, fingerprint text NOT NULL, body jsonb NOT NULL,
 body_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace,id),
 FOREIGN KEY(workspace,conversation_id) REFERENCES portfolio.conversations,
 FOREIGN KEY(workspace,upload_id) REFERENCES portfolio.studio_uploads(workspace,id) ON DELETE CASCADE
);
CREATE INDEX temporary_agent_expiry ON portfolio.temporary_agent_entries(expires_at);
GRANT SELECT,INSERT,DELETE ON portfolio.temporary_agent_entries TO pathway_app;

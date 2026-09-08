-- Temporary sandbox indexes have the same expiry and ownership as their source.
CREATE TABLE portfolio.studio_vectors (
 workspace text NOT NULL, upload_id text NOT NULL, key text NOT NULL,
 body jsonb NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace,upload_id,key)
);
CREATE INDEX studio_vectors_expiry ON portfolio.studio_vectors(expires_at);
GRANT SELECT,INSERT,DELETE ON portfolio.studio_vectors TO pathway_app;

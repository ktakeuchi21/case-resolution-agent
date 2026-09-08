-- Unapproved originals and normalized passages must remain deletable temporary data.
CREATE TABLE portfolio.studio_uploads (
 workspace text NOT NULL, id text NOT NULL, original bytea NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), body jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace,id), CHECK(octet_length(original)<=1048576)
);
CREATE INDEX studio_expiry ON portfolio.studio_uploads(expires_at);
CREATE TABLE portfolio.studio_history (
 workspace text NOT NULL, id text NOT NULL, upload_id text NOT NULL,
 body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace,id)
);
CREATE TABLE portfolio.studio_results (
 workspace text NOT NULL, id text NOT NULL, body jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace,id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON portfolio.studio_uploads TO pathway_app;
GRANT SELECT,INSERT,DELETE ON portfolio.studio_history,portfolio.studio_results TO pathway_app;
-- Published synthetic records and reviewer attestations are copied to immutable
-- pathway tables. Deleting temporary originals cannot alter those records.

CREATE SCHEMA portfolio;
REVOKE ALL ON SCHEMA portfolio FROM PUBLIC;
GRANT USAGE ON SCHEMA portfolio TO pathway_app;
CREATE TABLE portfolio.sessions (
 token_hash text PRIMARY KEY, csrf text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 workspace text, role text NOT NULL DEFAULT 'office' CHECK(role IN ('office','manager','supervisor','knowledge_reviewer')),
 scenario text NOT NULL DEFAULT 'golden', demo_clock timestamptz NOT NULL DEFAULT '2026-09-10 16:00:00Z',
 reset_count integer NOT NULL DEFAULT 0, actions integer NOT NULL DEFAULT 0
);
CREATE TABLE portfolio.limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE portfolio.items (
 workspace text NOT NULL,id text NOT NULL,kind text NOT NULL CHECK(kind IN ('answer','upload','command','studio')),
 body jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz,
 PRIMARY KEY(workspace,id)
);
CREATE INDEX portfolio_item_scope ON portfolio.items(workspace,kind);
GRANT SELECT,INSERT,UPDATE,DELETE ON portfolio.sessions,portfolio.limits,portfolio.items TO pathway_app;
-- Authentication boundary belongs to the same-origin server; no database credentials go to clients.
-- Items contain only synthetic demo data. Canonical evidence remains in immutable scoped pathway tables.
CREATE TABLE portfolio.requests (
 session_hash text NOT NULL REFERENCES portfolio.sessions(token_hash) ON DELETE CASCADE,
 key text NOT NULL, workspace text NOT NULL, fingerprint text NOT NULL,
 PRIMARY KEY(session_hash,key)
);
GRANT SELECT,INSERT,DELETE ON portfolio.requests TO pathway_app;
CREATE TABLE portfolio.reservations (workspace text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
GRANT SELECT,INSERT ON portfolio.reservations TO pathway_app;

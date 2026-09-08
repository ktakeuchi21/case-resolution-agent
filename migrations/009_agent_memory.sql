-- Conversation is an application record, never a case revision or workflow command.
CREATE TABLE portfolio.conversations (
 workspace text NOT NULL, id text NOT NULL, case_id text NOT NULL CHECK(case_id='DEMO-101'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), archived_at timestamptz,
 PRIMARY KEY(workspace,id)
);
CREATE UNIQUE INDEX one_active_conversation ON portfolio.conversations(workspace) WHERE archived_at IS NULL;
CREATE TABLE portfolio.agent_entries (
 workspace text NOT NULL, id text NOT NULL, conversation_id text NOT NULL,
 fingerprint text NOT NULL, body jsonb NOT NULL, body_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace,id), FOREIGN KEY(workspace,conversation_id) REFERENCES portfolio.conversations
);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON portfolio.agent_entries
 FOR EACH ROW EXECUTE FUNCTION pathway.immutable();
GRANT SELECT,INSERT,UPDATE ON portfolio.conversations TO pathway_app;
GRANT SELECT,INSERT ON portfolio.agent_entries TO pathway_app;
-- All provider attempts reserve durable capacity in a separate committed transaction.
-- A timeout or application rollback does not refund a potentially billable request.
CREATE TABLE portfolio.provider_budget (
 bucket text PRIMARY KEY, requests integer NOT NULL DEFAULT 0 CHECK(requests>=0)
);
GRANT SELECT,INSERT,UPDATE ON portfolio.provider_budget TO pathway_app;

-- Additive rebuild: the previous workflow schema and retained evidence are untouched.
CREATE SCHEMA rag;
REVOKE ALL ON SCHEMA rag FROM PUBLIC;
GRANT USAGE ON SCHEMA rag TO pathway_app;
CREATE TABLE rag.passages (
 id text PRIMARY KEY, pack_id text NOT NULL, case_id text,
 source_status text NOT NULL CHECK(source_status IN ('current','superseded')),
 body jsonb NOT NULL, content_hash text NOT NULL,
 search tsvector NOT NULL, embedding vector(1536), embedding_model text
);
CREATE INDEX rag_passage_filter ON rag.passages(pack_id,case_id,source_status);
CREATE INDEX rag_passage_search ON rag.passages USING gin(search);
GRANT SELECT ON rag.passages TO pathway_app;
GRANT UPDATE(embedding,embedding_model) ON rag.passages TO pathway_app;
CREATE TABLE rag.conversations (
 id uuid PRIMARY KEY, session_hash text NOT NULL REFERENCES portfolio.sessions(token_hash) ON DELETE CASCADE,
 scenario_id text NOT NULL, pack_id text NOT NULL, channel text NOT NULL CHECK(channel IN ('chat','email')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE rag.turns (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES rag.conversations(id) ON DELETE CASCADE,
 session_hash text NOT NULL REFERENCES portfolio.sessions(token_hash) ON DELETE CASCADE,
 body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX rag_turn_conversation ON rag.turns(conversation_id,created_at);
CREATE TABLE rag.query_vectors (key text PRIMARY KEY, embedding vector(1536) NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
GRANT SELECT,INSERT,UPDATE,DELETE ON rag.conversations,rag.turns,rag.query_vectors TO pathway_app;
-- Only the server's non-owner role has schema access. Defense in depth enforces session selection.
ALTER TABLE rag.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE rag.turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.turns FORCE ROW LEVEL SECURITY;
CREATE POLICY rag_conversation_session ON rag.conversations TO pathway_app
 USING(session_hash=current_setting('rag.session',true)) WITH CHECK(session_hash=current_setting('rag.session',true));
CREATE POLICY rag_turn_session ON rag.turns TO pathway_app
 USING(session_hash=current_setting('rag.session',true)) WITH CHECK(session_hash=current_setting('rag.session',true));

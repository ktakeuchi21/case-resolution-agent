-- Feedback is scoped to an actual answer and cannot modify that answer.
-- Upload derivatives cascade with the temporary conversation entry.
CREATE TABLE portfolio.agent_feedback (
 workspace text NOT NULL, entry_id text NOT NULL,
 governed_entry_id text, temporary_entry_id text,
 rating text NOT NULL CHECK(rating IN ('helpful','not_helpful')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace,entry_id),
 CHECK ((governed_entry_id=entry_id AND temporary_entry_id IS NULL) OR
        (temporary_entry_id=entry_id AND governed_entry_id IS NULL)),
 CHECK (num_nonnulls(governed_entry_id,temporary_entry_id)=1),
 FOREIGN KEY(workspace,governed_entry_id) REFERENCES portfolio.agent_entries(workspace,id),
 FOREIGN KEY(workspace,temporary_entry_id) REFERENCES portfolio.temporary_agent_entries(workspace,id) ON DELETE CASCADE
);
GRANT SELECT,INSERT ON portfolio.agent_feedback TO pathway_app;

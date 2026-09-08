-- A correction creates a new decision/run and references existing immutable history.
ALTER TABLE pathway.runs ADD correction_of text GENERATED ALWAYS AS (body->>'correctionOf') STORED,
 ADD FOREIGN KEY(workspace,tenant,environment,correction_of) REFERENCES pathway.evidence;

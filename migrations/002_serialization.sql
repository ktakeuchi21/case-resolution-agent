CREATE FUNCTION pathway.governance_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace||'/'||NEW.tenant||'/'||NEW.environment,0));
 UPDATE pathway.generations SET generation=generation+1 WHERE workspace=NEW.workspace AND tenant=NEW.tenant AND environment=NEW.environment;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['documents','versions','passages','collections','packs','releases','assignments','cases','users','case_revisions','events','membership','assignment_releases'] LOOP
 EXECUTE format('CREATE TRIGGER serialize_governance BEFORE INSERT ON pathway.%I FOR EACH ROW EXECUTE FUNCTION pathway.governance_write()',t);
 END LOOP;
END $$;

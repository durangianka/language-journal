\set ON_ERROR_STOP on

SET ROLE journal_migration;
CREATE TABLE public.roles_default_check (id serial PRIMARY KEY, note text);
RESET ROLE;
SET ROLE journal_app;

DO $$
DECLARE
  source_journal uuid;
  source_entry uuid;
  source_feedback uuid;
  call_id uuid;
  insight_call_id uuid;
BEGIN
  IF has_table_privilege(current_user, 'public.model_calls', 'DELETE')
    OR has_table_privilege(current_user, 'public.feedback', 'DELETE')
    OR has_table_privilege(current_user, 'public.journals', 'TRUNCATE')
    OR has_schema_privilege(current_user, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'App role has excessive privileges';
  END IF;
  INSERT INTO journals (language, level) VALUES ('en', 'basic') RETURNING id INTO source_journal;
  INSERT INTO entries (journal_id, body, entry_date)
    VALUES (source_journal, 'Today I walked.', current_date) RETURNING id INTO source_entry;
  UPDATE entries SET body = 'Today I walked to the market.' WHERE id = source_entry;
  PERFORM 1 FROM entries WHERE id = source_entry;
  IF NOT FOUND THEN RAISE EXCEPTION 'App cannot read its entry'; END IF;
  INSERT INTO feedback (entry_id, analysed_text, locale, model, prompt_version)
    VALUES (source_entry, 'Today I walked.', 'en', 'fake', 'roles-check') RETURNING id INTO source_feedback;
  INSERT INTO model_calls (feedback_id, entry_id, kind, outcome, input_tokens, output_tokens)
    VALUES (source_feedback, source_entry, 'analysis', 'ready', 20, 10) RETURNING id INTO call_id;
  INSERT INTO model_calls (journal_id, kind, outcome, input_tokens, output_tokens)
    VALUES (source_journal, 'insight', 'ready', 10, 5) RETURNING id INTO insight_call_id;

  BEGIN
    DELETE FROM model_calls WHERE id = call_id;
    RAISE EXCEPTION 'App deleted metering';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM feedback WHERE id = source_feedback;
    RAISE EXCEPTION 'App directly deleted feedback';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE journals CASCADE;
    RAISE EXCEPTION 'App truncated journals';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DROP TABLE entries CASCADE;
    RAISE EXCEPTION 'App dropped entries';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  DELETE FROM entries WHERE id = source_entry;
  IF NOT FOUND THEN RAISE EXCEPTION 'App did not delete entry'; END IF;
  IF NOT EXISTS (SELECT 1 FROM model_calls c WHERE c.id = call_id
    AND c.entry_id IS NULL AND c.feedback_id IS NULL
    AND c.input_tokens = 20 AND c.output_tokens = 10) THEN
    RAISE EXCEPTION 'Entry deletion lost metering';
  END IF;

  -- Exercise the journal cascade with another entry and feedback row.
  INSERT INTO entries (journal_id, body, entry_date)
    VALUES (source_journal, 'Another entry.', current_date) RETURNING id INTO source_entry;
  INSERT INTO feedback (entry_id, analysed_text, locale, model, prompt_version)
    VALUES (source_entry, 'Another entry.', 'en', 'fake', 'roles-check') RETURNING id INTO source_feedback;
  INSERT INTO model_calls (feedback_id, entry_id, kind, outcome)
    VALUES (source_feedback, source_entry, 'analysis', 'ready');
  DELETE FROM journals WHERE id = source_journal;
  IF NOT FOUND THEN RAISE EXCEPTION 'App did not delete journal'; END IF;
  IF EXISTS (SELECT 1 FROM entries e WHERE e.journal_id = source_journal)
    OR EXISTS (SELECT 1 FROM feedback f WHERE f.id = source_feedback) THEN
    RAISE EXCEPTION 'Journal content did not cascade';
  END IF;
  IF (SELECT count(*) FROM model_calls) <> 3
    OR EXISTS (SELECT 1 FROM model_calls c WHERE c.entry_id IS NOT NULL
      OR c.feedback_id IS NOT NULL OR c.journal_id IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM model_calls c WHERE c.id = insight_call_id
      AND c.input_tokens = 10 AND c.output_tokens = 5) THEN
    RAISE EXCEPTION 'Journal deletion lost metering';
  END IF;

  INSERT INTO roles_default_check (note) VALUES ('insert permitted');
  UPDATE roles_default_check SET note = 'update permitted';
  PERFORM 1 FROM roles_default_check;
  IF NOT FOUND THEN RAISE EXCEPTION 'Default read grant missing'; END IF;
  BEGIN
    DELETE FROM roles_default_check;
    RAISE EXCEPTION 'Default grants permit DELETE';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DROP TABLE roles_default_check;
    RAISE EXCEPTION 'App dropped future table';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

RESET ROLE;
SELECT 'Source deletes allowed; ledger deletes denied; usage retained; default grants checked' AS result;

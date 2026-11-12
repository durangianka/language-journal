-- Run with psql as a superuser, explicitly naming the intended database.
\set ON_ERROR_STOP on
\if :{?expected_database}
\else
  DO $$ BEGIN
    RAISE EXCEPTION 'Pass -v expected_database=the_database_name and -d the_database_name.';
  END $$;
\endif
SELECT current_database() = :'expected_database'
  AND current_database() NOT IN ('postgres', 'template0', 'template1') AS target_ok \gset
\if :target_ok
\else
  DO $$ BEGIN
    RAISE EXCEPTION 'Database does not match expected_database, or is a maintenance database.';
  END $$;
\endif

BEGIN;

-- Deliberately fail if either cluster-wide role exists. Never reuse a role
-- whose memberships, ownership or privileges may be more powerful than these.
CREATE ROLE journal_app LOGIN PASSWORD NULL
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE journal_migration LOGIN PASSWORD NULL
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

-- public is exclusively the application's schema. Drizzle metadata belongs
-- in its separate drizzle schema, which is not accessible to journal_app.
ALTER SCHEMA public OWNER TO journal_migration;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO journal_app;
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO journal_app', current_database()) \gexec
SELECT format('GRANT CONNECT, CREATE ON DATABASE %I TO journal_migration', current_database()) \gexec

-- Support both a fresh database and existing application tables. Do not use
-- REASSIGN OWNED, which could transfer unrelated or shared objects as well.
DO $$
DECLARE
  object record;
BEGIN
  FOR object IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO journal_migration', object.relname);
  END LOOP;
  FOR object IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO journal_migration', object.relname);
  END LOOP;
  FOR object IN
    SELECT t.typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO journal_migration', object.typname);
  END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, journal_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO journal_app;
-- Hard deletion is limited to source records. Cascades remove their content;
-- model_calls retains usage through nullable foreign keys.
DO $$
BEGIN
  IF to_regclass('public.journals') IS NOT NULL THEN
    GRANT DELETE ON public.journals TO journal_app;
  END IF;
  IF to_regclass('public.entries') IS NOT NULL THEN
    GRANT DELETE ON public.entries TO journal_app;
  END IF;
END
$$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, journal_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO journal_app;

-- Defaults apply only when journal_migration creates the objects.
ALTER DEFAULT PRIVILEGES FOR ROLE journal_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO journal_app;
ALTER DEFAULT PRIVILEGES FOR ROLE journal_migration IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO journal_app;
-- Avoid automatically exposing future SECURITY DEFINER functions.
ALTER DEFAULT PRIVILEGES FOR ROLE journal_migration
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;

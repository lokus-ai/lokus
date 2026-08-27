BEGIN;

DO $$
DECLARE
  v_config text[];
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'user_workspaces'
       AND policyname = 'Users manage own workspaces'
  ) THEN
    RAISE EXCEPTION 'LEGACY POLICY CLEANUP FAILED: workspace duplicate remains';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND policyname = 'Users manage own vault files'
  ) THEN
    RAISE EXCEPTION 'LEGACY POLICY CLEANUP FAILED: vault duplicate remains';
  END IF;

  IF to_regprocedure('public.increment_downloads(text)') IS NOT NULL THEN
    SELECT proconfig INTO v_config
      FROM pg_proc
     WHERE oid = 'public.increment_downloads(text)'::regprocedure;
    IF NOT (
      v_config @> ARRAY['search_path=pg_catalog, public, pg_temp']
    ) THEN
      RAISE EXCEPTION
        'LEGACY POLICY CLEANUP FAILED: increment_downloads search_path is mutable';
    END IF;
  END IF;
END
$$;

ROLLBACK;

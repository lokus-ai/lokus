-- Remove duplicate legacy policies left by the pre-migration production schema.

DROP POLICY IF EXISTS "Users manage own workspaces"
  ON public.user_workspaces;

DROP POLICY IF EXISTS "Users manage own vault files"
  ON storage.objects;

-- The anonymous download counter is intentionally a narrow SECURITY DEFINER
-- RPC. Pin its lookup path when the marketplace function exists.
DO $$
BEGIN
  IF to_regprocedure('public.increment_downloads(text)') IS NOT NULL THEN
    ALTER FUNCTION public.increment_downloads(text)
      SET search_path = pg_catalog, public, pg_temp;
  END IF;
END
$$;

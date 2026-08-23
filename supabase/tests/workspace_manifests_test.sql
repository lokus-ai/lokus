-- =============================================================================
-- Integration test: workspace manifest optimistic-concurrency contract
--
-- HOW TO RUN
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/tests/workspace_manifests_test.sql
--
-- Verifies that update_manifest() returns one (ok, manifest_version) row,
-- increments exactly once on success, and leaves the stored row unchanged on
-- a stale expected version.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_user     uuid := gen_random_uuid();
  v_ok       boolean;
  v_version  integer;
  v_manifest jsonb;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES (v_user, 'manifest-test@example.test', now());

  SELECT result.ok, result.manifest_version
    INTO v_ok, v_version
    FROM public.update_manifest(
      v_user,
      'workspace-1',
      '{"files":{"first.md":{"hash":"A"}}}'::jsonb,
      0
    ) result;

  IF v_ok IS NOT TRUE OR v_version <> 1 THEN
    RAISE EXCEPTION
      'INSERT CONTRACT FAILED: expected (true, 1), got (%, %)',
      v_ok,
      v_version;
  END IF;

  SELECT result.ok, result.manifest_version
    INTO v_ok, v_version
    FROM public.update_manifest(
      v_user,
      'workspace-1',
      '{"files":{"first.md":{"hash":"B"}}}'::jsonb,
      1
    ) result;

  IF v_ok IS NOT TRUE OR v_version <> 2 THEN
    RAISE EXCEPTION
      'UPDATE CONTRACT FAILED: expected (true, 2), got (%, %)',
      v_ok,
      v_version;
  END IF;

  SELECT result.ok, result.manifest_version
    INTO v_ok, v_version
    FROM public.update_manifest(
      v_user,
      'workspace-1',
      '{"files":{"first.md":{"hash":"STALE"}}}'::jsonb,
      1
    ) result;

  IF v_ok IS NOT FALSE OR v_version <> 2 THEN
    RAISE EXCEPTION
      'CONFLICT CONTRACT FAILED: expected (false, 2), got (%, %)',
      v_ok,
      v_version;
  END IF;

  SELECT manifest, manifest_version
    INTO v_manifest, v_version
    FROM public.workspace_manifests
    WHERE user_id = v_user;

  IF v_version <> 2
     OR v_manifest #>> '{files,first.md,hash}' <> 'B' THEN
    RAISE EXCEPTION
      'CONFLICT MUTATED ROW: expected version=2 hash=B, got version=% manifest=%',
      v_version,
      v_manifest;
  END IF;

  RAISE NOTICE 'WORKSPACE MANIFEST CONTRACT TESTS PASSED';
END $$;

ROLLBACK;

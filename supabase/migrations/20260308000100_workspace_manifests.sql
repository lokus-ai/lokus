-- =============================================================================
-- Migration: 20260308000100_workspace_manifests.sql
-- Description: The genuinely-missing manifest table for Sync V2.
--
-- CLAUDE.md (Sync system V2) and the sync engine
-- (src/core/sync/ManifestManager.js) reference `workspace_manifests` +
-- `update_manifest()` with optimistic concurrency, but no migration created
-- them — only the deprecated per-file `sync_files` table exists. This adds the
-- table and RPC, mirroring the 1-workspace-per-user model and the engine's
-- optimistic-concurrency pattern.
--
-- Model: 1 manifest row per user (user_id PK). The manifest is a single JSONB
-- blob of per-file metadata (path → {hash, size, modified_at, …}). Concurrency
-- is optimistic: the caller passes the manifest_version it read; the update only
-- applies if the version still matches, then bumps it. A mismatch returns
-- ok=false so the caller re-reads, merges, and retries.
-- =============================================================================


-- =============================================================================
-- 1. Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_manifests (
  user_id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id     text        NOT NULL,
  manifest         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  manifest_version integer     NOT NULL DEFAULT 1,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.workspace_manifests                  IS 'One sync manifest per user (1-workspace-per-user model). Manifest is a JSONB map of file metadata.';
COMMENT ON COLUMN public.workspace_manifests.manifest         IS 'JSONB map: file_path -> {hash, size, modified_at, ...}.';
COMMENT ON COLUMN public.workspace_manifests.manifest_version IS 'Monotonic version for optimistic concurrency; bumped on every successful update.';


-- =============================================================================
-- 2. Row Level Security
-- =============================================================================

ALTER TABLE public.workspace_manifests ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own manifest.
DROP POLICY IF EXISTS wm_sel ON public.workspace_manifests;
CREATE POLICY wm_sel ON public.workspace_manifests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Authenticated users may write their own manifest directly (the sync engine
-- runs client-side with the user's JWT; the optimistic-concurrency RPC is the
-- safe write path, but a direct upsert path is also scoped to the owner).
DROP POLICY IF EXISTS wm_ins ON public.workspace_manifests;
CREATE POLICY wm_ins ON public.workspace_manifests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS wm_upd ON public.workspace_manifests;
CREATE POLICY wm_upd ON public.workspace_manifests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS wm_del ON public.workspace_manifests;
CREATE POLICY wm_del ON public.workspace_manifests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- service_role full access for server-side repair/migration.
DROP POLICY IF EXISTS wm_all ON public.workspace_manifests;
CREATE POLICY wm_all ON public.workspace_manifests
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =============================================================================
-- 3. RPC: update_manifest — optimistic concurrency
--
-- Caller passes the manifest_version it last read. Behavior:
--   * No row yet                  → insert at version 1, return (true, 1).
--   * Stored version <> expected  → return (false, stored_version); caller must
--                                   re-read + merge + retry.
--   * Stored version  = expected  → write manifest, bump version, return
--                                   (true, new_version).
-- The row-level FOR UPDATE lock serializes concurrent writers for one user.
--
-- SECURITY INVOKER (default): runs as the calling user, so RLS still applies and
-- a user can only update their own row. Granted to authenticated + service_role.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_manifest(
  p_user_id          uuid,
  p_workspace_id     text,
  p_manifest         jsonb,
  p_expected_version integer
)
  RETURNS TABLE (ok boolean, manifest_version integer)
  LANGUAGE plpgsql
  SET search_path = public
AS $$
DECLARE
  v_ver integer;
BEGIN
  SELECT wm.manifest_version INTO v_ver
    FROM workspace_manifests wm
   WHERE wm.user_id = p_user_id
   FOR UPDATE;

  IF v_ver IS NULL THEN
    INSERT INTO workspace_manifests (user_id, workspace_id, manifest, manifest_version)
      VALUES (p_user_id, p_workspace_id, p_manifest, 1);
    RETURN QUERY SELECT true, 1;
    RETURN;
  END IF;

  IF v_ver <> p_expected_version THEN
    RETURN QUERY SELECT false, v_ver;   -- caller must re-read + merge
    RETURN;
  END IF;

  UPDATE workspace_manifests
     SET manifest         = p_manifest,
         manifest_version = v_ver + 1,
         workspace_id     = p_workspace_id,
         updated_at       = now()
   WHERE user_id = p_user_id;

  RETURN QUERY SELECT true, v_ver + 1;
END;
$$;

COMMENT ON FUNCTION public.update_manifest(uuid, text, jsonb, integer) IS
  'Optimistic-concurrency manifest update. Caller passes the version it read; write only applies if it still matches, then bumps. Returns (ok, manifest_version).';

REVOKE ALL ON FUNCTION public.update_manifest(uuid, text, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_manifest(uuid, text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_manifest(uuid, text, jsonb, integer) TO service_role;

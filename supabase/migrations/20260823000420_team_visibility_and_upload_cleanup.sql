-- Team Notes V1: archived-team visibility boundary and orphan upload cleanup.

SET search_path TO public, auth, storage;

CREATE OR REPLACE FUNCTION private.shares_active_team(
  p_other_user_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.team_memberships mine
      JOIN public.team_memberships theirs
        ON theirs.team_id = mine.team_id
       AND theirs.user_id = p_other_user_id
       AND theirs.status = 'active'
      JOIN public.teams team
        ON team.id = mine.team_id
       AND team.deleted_at IS NULL
     WHERE mine.user_id = p_user_id
       AND mine.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION private.shares_active_team(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.shares_active_team(uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_team_uploads(
  p_limit integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'cleanup limit must be between 1 and 5000'
      USING ERRCODE = '22023';
  END IF;

  WITH expired AS (
    SELECT op_id, object_key
      FROM public.pending_revision_uploads
     WHERE expires_at <= now()
     ORDER BY expires_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ),
  deleted_objects AS (
    DELETE FROM storage.objects object
     USING expired
     WHERE object.bucket_id = 'team-note-revisions'
       AND object.name = expired.object_key
     RETURNING object.name
  ),
  deleted_pending AS (
    DELETE FROM public.pending_revision_uploads pending
     USING expired
     WHERE pending.op_id = expired.op_id
     RETURNING pending.op_id
  )
  SELECT count(*) INTO v_deleted FROM deleted_pending;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_team_uploads(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_team_uploads(integer)
  TO service_role;

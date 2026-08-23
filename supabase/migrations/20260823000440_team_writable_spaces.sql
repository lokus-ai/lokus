-- Team Notes V1: explicit writable-space discovery and preflight.

SET search_path TO public, auth;

CREATE OR REPLACE FUNCTION public.list_writable_team_spaces(
  p_team_id uuid
)
RETURNS TABLE (
  space_id uuid,
  current_key_epoch integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT space.id, space.current_key_epoch
    FROM public.spaces space
   WHERE space.team_id = p_team_id
     AND space.deleted_at IS NULL
     AND private.has_space_role(space.id, 'editor')
   ORDER BY space.created_at, space.id;
$$;

CREATE OR REPLACE FUNCTION public.can_write_team_space(
  p_space_id uuid,
  p_device_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT private.owns_device(p_device_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.devices
        WHERE id = p_device_id AND status <> 'active'
     )
     AND private.has_space_role(p_space_id, 'editor');
$$;

REVOKE ALL ON FUNCTION public.list_writable_team_spaces(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_team_space(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_writable_team_spaces(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_team_space(uuid, uuid)
  TO authenticated;

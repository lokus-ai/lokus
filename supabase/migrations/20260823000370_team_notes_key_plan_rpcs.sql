-- Team Notes V1: authorized recipient plans for client-side envelope creation.

SET search_path TO public, auth, extensions;

CREATE OR REPLACE FUNCTION public.get_member_provisioning_key_plan(
  p_team_id uuid,
  p_target_user_id uuid,
  p_target_device_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_team public.teams%ROWTYPE;
  v_device public.devices%ROWTYPE;
  v_status public.membership_status;
  v_spaces jsonb;
BEGIN
  IF v_actor IS NULL OR NOT private.has_team_role(p_team_id, 'admin', v_actor) THEN
    RAISE EXCEPTION 'team admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_team
    FROM public.teams
   WHERE id = p_team_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT status INTO v_status
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = p_target_user_id;
  IF v_status IS NULL OR v_status NOT IN ('key_pending', 'active') THEN
    RAISE EXCEPTION 'target membership is not provisionable'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_device
    FROM public.devices
   WHERE id = p_target_device_id
     AND user_id = p_target_user_id
     AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target device is not active' USING ERRCODE = '42501';
  END IF;

  WITH intended_spaces AS (
    SELECT grant_row.space_id
      FROM public.space_member_grants grant_row
     WHERE grant_row.team_id = p_team_id
       AND grant_row.user_id = p_target_user_id
    UNION
    SELECT group_grant.space_id
      FROM public.space_group_grants group_grant
      JOIN public.team_groups team_group
        ON team_group.team_id = group_grant.team_id
       AND team_group.id = group_grant.group_id
       AND team_group.deleted_at IS NULL
      LEFT JOIN public.team_group_members group_member
        ON group_member.team_id = team_group.team_id
       AND group_member.group_id = team_group.id
       AND group_member.user_id = p_target_user_id
     WHERE group_grant.team_id = p_team_id
       AND (
         team_group.system_key = 'everyone'
         OR group_member.user_id IS NOT NULL
       )
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'space_id', space.id,
               'key_epoch', space.current_key_epoch
             )
             ORDER BY space.id
           ),
           '[]'::jsonb
         )
    INTO v_spaces
    FROM intended_spaces intended
    JOIN public.spaces space
      ON space.id = intended.space_id
     AND space.team_id = p_team_id
     AND space.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'team_id', p_team_id,
    'team_key_epoch', v_team.current_key_epoch,
    'target_user_id', p_target_user_id,
    'target_device_id', p_target_device_id,
    'target_public_key_hex', encode(v_device.public_key, 'hex'),
    'spaces', v_spaces
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_removal_key_plan(
  p_team_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_team public.teams%ROWTYPE;
  v_target public.team_memberships%ROWTYPE;
  v_team_recipients jsonb;
  v_spaces jsonb;
BEGIN
  IF v_actor IS NULL OR NOT private.has_team_role(p_team_id, 'admin', v_actor) THEN
    RAISE EXCEPTION 'team admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_team
    FROM public.teams
   WHERE id = p_team_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_target
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = p_target_user_id;
  IF NOT FOUND OR v_target.status = 'removed' THEN
    RAISE EXCEPTION 'active target membership not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_target_user_id = v_actor THEN
    RAISE EXCEPTION 'self-removal uses the leave-team flow'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'device_id', device.id,
               'public_key_hex', encode(device.public_key, 'hex')
             )
             ORDER BY device.id
           ),
           '[]'::jsonb
         )
    INTO v_team_recipients
    FROM public.team_memberships membership
    JOIN public.devices device
      ON device.user_id = membership.user_id
     AND device.status = 'active'
   WHERE membership.team_id = p_team_id
     AND membership.status = 'active'
     AND membership.user_id <> p_target_user_id;

  WITH affected_spaces AS (
    SELECT grant_row.space_id
      FROM public.space_member_grants grant_row
     WHERE grant_row.team_id = p_team_id
       AND grant_row.user_id = p_target_user_id
    UNION
    SELECT group_grant.space_id
      FROM public.space_group_grants group_grant
      JOIN public.team_groups team_group
        ON team_group.team_id = group_grant.team_id
       AND team_group.id = group_grant.group_id
       AND team_group.deleted_at IS NULL
      LEFT JOIN public.team_group_members group_member
        ON group_member.team_id = team_group.team_id
       AND group_member.group_id = team_group.id
       AND group_member.user_id = p_target_user_id
     WHERE group_grant.team_id = p_team_id
       AND (
         team_group.system_key = 'everyone'
         OR group_member.user_id IS NOT NULL
       )
  ),
  rotation_spaces AS (
    SELECT space.id, space.current_key_epoch
      FROM affected_spaces affected
      JOIN public.spaces space
        ON space.id = affected.space_id
       AND space.team_id = p_team_id
       AND space.deleted_at IS NULL
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'space_id', rotation.id,
               'current_key_epoch', rotation.current_key_epoch,
               'next_key_epoch', rotation.current_key_epoch + 1,
               'recipients', (
                 SELECT COALESCE(
                          jsonb_agg(
                            jsonb_build_object(
                              'device_id', device.id,
                              'public_key_hex', encode(device.public_key, 'hex')
                            )
                            ORDER BY device.id
                          ),
                          '[]'::jsonb
                        )
                   FROM public.team_memberships membership
                   JOIN public.devices device
                     ON device.user_id = membership.user_id
                    AND device.status = 'active'
                  WHERE membership.team_id = p_team_id
                    AND membership.status = 'active'
                    AND membership.user_id <> p_target_user_id
                    AND private.has_space_role(
                      rotation.id,
                      'reader',
                      membership.user_id
                    )
               )
             )
             ORDER BY rotation.id
           ),
           '[]'::jsonb
         )
    INTO v_spaces
    FROM rotation_spaces rotation;

  RETURN jsonb_build_object(
    'team_id', p_team_id,
    'current_permission_epoch', v_team.current_permission_epoch,
    'next_permission_epoch', v_team.current_permission_epoch + 1,
    'current_team_key_epoch', v_team.current_key_epoch,
    'next_team_key_epoch', v_team.current_key_epoch + 1,
    'team_recipients', v_team_recipients,
    'spaces', v_spaces
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_provisioning_key_plan(
  uuid, uuid, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_member_removal_key_plan(
  uuid, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_member_provisioning_key_plan(
  uuid, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_removal_key_plan(
  uuid, uuid
) TO authenticated;

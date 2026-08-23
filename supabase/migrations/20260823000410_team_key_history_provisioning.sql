-- Team Notes V1: provision every authorized historical key epoch.

SET search_path TO public, auth, extensions;

CREATE OR REPLACE FUNCTION public.get_member_key_history_plan(
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
  v_device public.devices%ROWTYPE;
  v_status public.membership_status;
  v_team_epochs jsonb;
  v_spaces jsonb;
BEGIN
  IF v_actor IS NULL OR NOT private.has_team_role(p_team_id, 'admin', v_actor) THEN
    RAISE EXCEPTION 'team admin role required' USING ERRCODE = '42501';
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

  SELECT COALESCE(jsonb_agg(epoch ORDER BY epoch), '[]'::jsonb)
    INTO v_team_epochs
    FROM public.team_key_epochs
   WHERE team_id = p_team_id;

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
               'key_epochs', (
                 SELECT COALESCE(
                          jsonb_agg(epoch.epoch ORDER BY epoch.epoch),
                          '[]'::jsonb
                        )
                   FROM public.space_key_epochs epoch
                  WHERE epoch.space_id = space.id
               )
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
    'target_user_id', p_target_user_id,
    'target_device_id', p_target_device_id,
    'target_public_key_hex', encode(v_device.public_key, 'hex'),
    'team_key_epochs', v_team_epochs,
    'spaces', v_spaces
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_member_key_history(
  p_team_id uuid,
  p_target_user_id uuid,
  p_target_device_id uuid,
  p_actor_device_id uuid,
  p_team_envelopes jsonb,
  p_space_envelopes jsonb
)
RETURNS public.membership_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_membership public.team_memberships%ROWTYPE;
  v_envelope jsonb;
BEGIN
  IF v_actor IS NULL
     OR NOT private.has_team_role(p_team_id, 'admin', v_actor)
     OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'team admin device required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_team_envelopes) <> 'array'
     OR jsonb_typeof(p_space_envelopes) <> 'array' THEN
    RAISE EXCEPTION 'key history envelopes must be arrays'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_membership
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = p_target_user_id
   FOR UPDATE;
  IF NOT FOUND OR v_membership.status NOT IN ('key_pending', 'active') THEN
    RAISE EXCEPTION 'target membership is not provisionable'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.devices
     WHERE id = p_target_device_id
       AND user_id = p_target_user_id
       AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'target device is not active' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    WITH expected AS (
      SELECT epoch FROM public.team_key_epochs WHERE team_id = p_team_id
    ),
    provided AS (
      SELECT (value ->> 'epoch')::integer AS epoch
        FROM jsonb_array_elements(p_team_envelopes)
    )
    (SELECT epoch FROM expected EXCEPT SELECT epoch FROM provided)
    UNION ALL
    (SELECT epoch FROM provided EXCEPT SELECT epoch FROM expected)
  ) OR (
    SELECT count(*) <> count(DISTINCT value ->> 'epoch')
      FROM jsonb_array_elements(p_team_envelopes)
  ) THEN
    RAISE EXCEPTION 'team key history coverage is incomplete'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
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
    ),
    expected AS (
      SELECT epoch.space_id, epoch.epoch
        FROM public.space_key_epochs epoch
        JOIN intended_spaces intended ON intended.space_id = epoch.space_id
    ),
    provided AS (
      SELECT (value ->> 'space_id')::uuid AS space_id,
             (value ->> 'epoch')::integer AS epoch
        FROM jsonb_array_elements(p_space_envelopes)
    )
    (SELECT space_id, epoch FROM expected EXCEPT SELECT space_id, epoch FROM provided)
    UNION ALL
    (SELECT space_id, epoch FROM provided EXCEPT SELECT space_id, epoch FROM expected)
  ) OR (
    SELECT count(*) <> count(DISTINCT (value ->> 'space_id') || ':' || (value ->> 'epoch'))
      FROM jsonb_array_elements(p_space_envelopes)
  ) THEN
    RAISE EXCEPTION 'space key history coverage is incomplete'
      USING ERRCODE = '23514';
  END IF;

  FOR v_envelope IN SELECT value FROM jsonb_array_elements(p_team_envelopes)
  LOOP
    INSERT INTO public.team_key_envelopes (
      team_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
      algorithm, created_by_device_id
    ) VALUES (
      p_team_id,
      (v_envelope ->> 'epoch')::integer,
      p_target_device_id,
      decode(v_envelope ->> 'wrapped_key_hex', 'hex'),
      decode(v_envelope ->> 'nonce_hex', 'hex'),
      v_envelope ->> 'algorithm',
      p_actor_device_id
    )
    ON CONFLICT (team_id, epoch, recipient_device_id) DO UPDATE
      SET wrapped_key = EXCLUDED.wrapped_key,
          wrapping_nonce = EXCLUDED.wrapping_nonce,
          algorithm = EXCLUDED.algorithm,
          created_by_device_id = EXCLUDED.created_by_device_id;
  END LOOP;

  FOR v_envelope IN SELECT value FROM jsonb_array_elements(p_space_envelopes)
  LOOP
    INSERT INTO public.space_key_envelopes (
      space_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
      algorithm, created_by_device_id
    ) VALUES (
      (v_envelope ->> 'space_id')::uuid,
      (v_envelope ->> 'epoch')::integer,
      p_target_device_id,
      decode(v_envelope ->> 'wrapped_key_hex', 'hex'),
      decode(v_envelope ->> 'nonce_hex', 'hex'),
      v_envelope ->> 'algorithm',
      p_actor_device_id
    )
    ON CONFLICT (space_id, epoch, recipient_device_id) DO UPDATE
      SET wrapped_key = EXCLUDED.wrapped_key,
          wrapping_nonce = EXCLUDED.wrapping_nonce,
          algorithm = EXCLUDED.algorithm,
          created_by_device_id = EXCLUDED.created_by_device_id;
  END LOOP;

  UPDATE public.team_memberships
     SET status = 'active',
         membership_version = membership_version + 1,
         suspended_at = NULL,
         removed_at = NULL
   WHERE team_id = p_team_id AND user_id = p_target_user_id;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, affected_user_id, old_status, new_status,
    permission_epoch, team_key_epoch, reason_code
  )
  SELECT p_team_id, v_actor, p_actor_device_id, 'member_key_history_provisioned',
         'membership', p_target_user_id, p_target_user_id,
         v_membership.status::text, 'active',
         team.current_permission_epoch, team.current_key_epoch,
         'member_key_history_provisioned'
    FROM public.teams team
   WHERE team.id = p_team_id;

  RETURN 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_key_history_plan(uuid, uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provision_member_key_history(
  uuid, uuid, uuid, uuid, jsonb, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_member_key_history_plan(uuid, uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_member_key_history(
  uuid, uuid, uuid, uuid, jsonb, jsonb
) TO authenticated;

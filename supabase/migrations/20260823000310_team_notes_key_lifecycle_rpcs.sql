-- Team Notes V1: key provisioning and atomic member removal/rotation.

SET search_path TO public, auth, extensions;

CREATE OR REPLACE FUNCTION public.provision_member_keys(
  p_team_id uuid,
  p_target_user_id uuid,
  p_target_device_id uuid,
  p_actor_device_id uuid,
  p_team_wrapped_key bytea,
  p_team_wrapping_nonce bytea,
  p_algorithm text,
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
  v_team_epoch integer;
  v_envelope jsonb;
  v_space_id uuid;
BEGIN
  IF v_actor IS NULL
     OR NOT private.has_team_role(p_team_id, 'admin', v_actor)
     OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'team admin device required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_space_envelopes) <> 'array'
     OR length(p_team_wrapped_key) = 0
     OR length(p_team_wrapping_nonce) = 0
     OR nullif(btrim(p_algorithm), '') IS NULL THEN
    RAISE EXCEPTION 'invalid envelope bundle' USING ERRCODE = '22023';
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

  SELECT current_key_epoch INTO v_team_epoch
    FROM public.teams
   WHERE id = p_team_id AND deleted_at IS NULL
   FOR UPDATE;

  INSERT INTO public.team_key_envelopes (
    team_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
    algorithm, created_by_device_id
  ) VALUES (
    p_team_id, v_team_epoch, p_target_device_id, p_team_wrapped_key,
    p_team_wrapping_nonce, p_algorithm, p_actor_device_id
  )
  ON CONFLICT (team_id, epoch, recipient_device_id) DO UPDATE
    SET wrapped_key = EXCLUDED.wrapped_key,
        wrapping_nonce = EXCLUDED.wrapping_nonce,
        algorithm = EXCLUDED.algorithm,
        created_by_device_id = EXCLUDED.created_by_device_id;

  -- Reject missing, duplicate, or extra space envelopes before activation.
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
    provided_spaces AS (
      SELECT (value ->> 'space_id')::uuid AS space_id
        FROM jsonb_array_elements(p_space_envelopes)
    )
    (SELECT space_id FROM intended_spaces EXCEPT SELECT space_id FROM provided_spaces)
    UNION ALL
    (SELECT space_id FROM provided_spaces EXCEPT SELECT space_id FROM intended_spaces)
  ) OR (
    SELECT count(*) <> count(DISTINCT value ->> 'space_id')
      FROM jsonb_array_elements(p_space_envelopes)
  ) THEN
    RAISE EXCEPTION 'space envelope coverage is incomplete'
      USING ERRCODE = '23514';
  END IF;

  FOR v_envelope IN SELECT value FROM jsonb_array_elements(p_space_envelopes)
  LOOP
    v_space_id := (v_envelope ->> 'space_id')::uuid;
    INSERT INTO public.space_key_envelopes (
      space_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
      algorithm, created_by_device_id
    )
    SELECT v_space_id,
           space.current_key_epoch,
           p_target_device_id,
           decode(v_envelope ->> 'wrapped_key_hex', 'hex'),
           decode(v_envelope ->> 'nonce_hex', 'hex'),
           v_envelope ->> 'algorithm',
           p_actor_device_id
      FROM public.spaces space
     WHERE space.id = v_space_id
       AND space.team_id = p_team_id
       AND space.deleted_at IS NULL
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
  SELECT p_team_id, v_actor, p_actor_device_id, 'member_keys_provisioned',
         'membership', p_target_user_id, p_target_user_id,
         v_membership.status::text, 'active',
         team.current_permission_epoch, team.current_key_epoch,
         'member_keys_provisioned'
    FROM public.teams team
   WHERE team.id = p_team_id;

  RETURN 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_member(
  p_team_id uuid,
  p_target_user_id uuid,
  p_actor_device_id uuid,
  p_team_envelopes jsonb,
  p_space_rotations jsonb
)
RETURNS public.membership_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_membership public.team_memberships%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_new_permission_epoch bigint;
  v_new_team_key_epoch integer;
  v_rotation jsonb;
  v_envelope jsonb;
  v_space public.spaces%ROWTYPE;
  v_new_space_epoch integer;
BEGIN
  IF v_actor IS NULL
     OR NOT private.has_team_role(p_team_id, 'admin', v_actor)
     OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'team admin device required' USING ERRCODE = '42501';
  END IF;
  IF p_target_user_id = v_actor THEN
    RAISE EXCEPTION 'self-removal uses the leave-team flow'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_team_envelopes) <> 'array'
     OR jsonb_typeof(p_space_rotations) <> 'array' THEN
    RAISE EXCEPTION 'rotation bundles must be arrays' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_team
    FROM public.teams
   WHERE id = p_team_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_membership
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = p_target_user_id
   FOR UPDATE;
  IF NOT FOUND OR v_membership.status = 'removed' THEN
    RAISE EXCEPTION 'active target membership not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_membership.role = 'owner' AND (
    SELECT count(*)
      FROM public.team_memberships
     WHERE team_id = p_team_id
       AND role = 'owner'
       AND status = 'active'
  ) <= 1 THEN
    RAISE EXCEPTION 'last owner cannot be removed' USING ERRCODE = '23514';
  END IF;

  -- Team metadata envelopes must exactly cover active remaining devices.
  IF EXISTS (
    WITH required_devices AS (
      SELECT device.id AS device_id
        FROM public.team_memberships membership
        JOIN public.devices device
          ON device.user_id = membership.user_id
         AND device.status = 'active'
       WHERE membership.team_id = p_team_id
         AND membership.status = 'active'
         AND membership.user_id <> p_target_user_id
    ),
    provided_devices AS (
      SELECT (value ->> 'device_id')::uuid AS device_id
        FROM jsonb_array_elements(p_team_envelopes)
    )
    (SELECT device_id FROM required_devices EXCEPT SELECT device_id FROM provided_devices)
    UNION ALL
    (SELECT device_id FROM provided_devices EXCEPT SELECT device_id FROM required_devices)
  ) OR (
    SELECT count(*) <> count(DISTINCT value ->> 'device_id')
      FROM jsonb_array_elements(p_team_envelopes)
  ) THEN
    RAISE EXCEPTION 'team envelope coverage is incomplete'
      USING ERRCODE = '23514';
  END IF;

  -- Every space the target could read must appear exactly once.
  IF EXISTS (
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
    provided_spaces AS (
      SELECT (value ->> 'space_id')::uuid AS space_id
        FROM jsonb_array_elements(p_space_rotations)
    )
    (SELECT space_id FROM affected_spaces EXCEPT SELECT space_id FROM provided_spaces)
    UNION ALL
    (SELECT space_id FROM provided_spaces EXCEPT SELECT space_id FROM affected_spaces)
  ) OR (
    SELECT count(*) <> count(DISTINCT value ->> 'space_id')
      FROM jsonb_array_elements(p_space_rotations)
  ) THEN
    RAISE EXCEPTION 'space rotation coverage is incomplete'
      USING ERRCODE = '23514';
  END IF;

  v_new_permission_epoch := v_team.current_permission_epoch + 1;
  v_new_team_key_epoch := v_team.current_key_epoch + 1;

  INSERT INTO public.team_permission_epochs (
    team_id, epoch, reason_code, changed_by
  ) VALUES (
    p_team_id, v_new_permission_epoch, 'member_removed', v_actor
  );
  INSERT INTO public.team_key_epochs (
    team_id, epoch, reason_code, created_by
  ) VALUES (
    p_team_id, v_new_team_key_epoch, 'member_removed', v_actor
  );

  FOR v_envelope IN SELECT value FROM jsonb_array_elements(p_team_envelopes)
  LOOP
    INSERT INTO public.team_key_envelopes (
      team_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
      algorithm, created_by_device_id
    ) VALUES (
      p_team_id,
      v_new_team_key_epoch,
      (v_envelope ->> 'device_id')::uuid,
      decode(v_envelope ->> 'wrapped_key_hex', 'hex'),
      decode(v_envelope ->> 'nonce_hex', 'hex'),
      v_envelope ->> 'algorithm',
      p_actor_device_id
    );
  END LOOP;

  FOR v_rotation IN SELECT value FROM jsonb_array_elements(p_space_rotations)
  LOOP
    SELECT * INTO v_space
      FROM public.spaces
     WHERE id = (v_rotation ->> 'space_id')::uuid
       AND team_id = p_team_id
       AND deleted_at IS NULL
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'rotation space not found' USING ERRCODE = '23514';
    END IF;

    v_new_space_epoch := v_space.current_key_epoch + 1;

    IF EXISTS (
      WITH required_devices AS (
        SELECT DISTINCT device.id AS device_id
          FROM public.team_memberships membership
          JOIN public.devices device
            ON device.user_id = membership.user_id
           AND device.status = 'active'
         WHERE membership.team_id = p_team_id
           AND membership.status = 'active'
           AND membership.user_id <> p_target_user_id
           AND private.has_space_role(v_space.id, 'reader', membership.user_id)
      ),
      provided_devices AS (
        SELECT (value ->> 'device_id')::uuid AS device_id
          FROM jsonb_array_elements(v_rotation -> 'envelopes')
      )
      (SELECT device_id FROM required_devices EXCEPT SELECT device_id FROM provided_devices)
      UNION ALL
      (SELECT device_id FROM provided_devices EXCEPT SELECT device_id FROM required_devices)
    ) OR (
      SELECT count(*) <> count(DISTINCT value ->> 'device_id')
        FROM jsonb_array_elements(v_rotation -> 'envelopes')
    ) THEN
      RAISE EXCEPTION 'space envelope coverage is incomplete'
        USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.space_key_epochs (
      space_id, epoch, reason, created_by
    ) VALUES (
      v_space.id, v_new_space_epoch, 'member_removed', v_actor
    );

    FOR v_envelope IN SELECT value FROM jsonb_array_elements(v_rotation -> 'envelopes')
    LOOP
      INSERT INTO public.space_key_envelopes (
        space_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
        algorithm, created_by_device_id
      ) VALUES (
        v_space.id,
        v_new_space_epoch,
        (v_envelope ->> 'device_id')::uuid,
        decode(v_envelope ->> 'wrapped_key_hex', 'hex'),
        decode(v_envelope ->> 'nonce_hex', 'hex'),
        v_envelope ->> 'algorithm',
        p_actor_device_id
      );
    END LOOP;

    UPDATE public.spaces
       SET current_key_epoch = v_new_space_epoch,
           updated_at = now()
     WHERE id = v_space.id;
  END LOOP;

  UPDATE public.team_memberships
     SET status = 'removed',
         membership_version = membership_version + 1,
         removed_at = now(),
         suspended_at = NULL
   WHERE team_id = p_team_id AND user_id = p_target_user_id;

  UPDATE public.teams
     SET current_permission_epoch = v_new_permission_epoch,
         current_key_epoch = v_new_team_key_epoch,
         updated_at = now()
   WHERE id = p_team_id;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, affected_user_id, old_status, new_status,
    permission_epoch, team_key_epoch, reason_code
  ) VALUES (
    p_team_id, v_actor, p_actor_device_id, 'member_removed',
    'membership', p_target_user_id, p_target_user_id,
    v_membership.status::text, 'removed',
    v_new_permission_epoch, v_new_team_key_epoch, 'member_removed'
  );

  RETURN 'removed';
END;
$$;

REVOKE ALL ON FUNCTION public.provision_member_keys(
  uuid, uuid, uuid, uuid, bytea, bytea, text, jsonb
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_member(
  uuid, uuid, uuid, jsonb, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.provision_member_keys(
  uuid, uuid, uuid, uuid, bytea, bytea, text, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(
  uuid, uuid, uuid, jsonb, jsonb
) TO authenticated;

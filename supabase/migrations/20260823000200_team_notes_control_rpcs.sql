-- Team Notes V1: transactional control-plane RPCs.

SET search_path TO public, auth, extensions;

CREATE OR REPLACE FUNCTION public.register_device(
  p_device_id uuid,
  p_client_instance_id uuid,
  p_public_key bytea,
  p_public_key_fingerprint bytea,
  p_key_algorithm text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_existing public.devices%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_device_id IS NULL OR p_client_instance_id IS NULL
     OR length(p_public_key) = 0 OR length(p_public_key_fingerprint) = 0
     OR nullif(btrim(p_key_algorithm), '') IS NULL THEN
    RAISE EXCEPTION 'invalid device registration' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
    FROM public.devices
   WHERE id = p_device_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id <> v_actor
       OR v_existing.client_instance_id <> p_client_instance_id
       OR v_existing.public_key_fingerprint <> p_public_key_fingerprint
       OR v_existing.public_key <> p_public_key
       OR v_existing.key_algorithm <> p_key_algorithm THEN
      RAISE EXCEPTION 'device id is already registered differently'
        USING ERRCODE = '23505';
    END IF;
    IF v_existing.status <> 'active' THEN
      RAISE EXCEPTION 'device is revoked' USING ERRCODE = '42501';
    END IF;
    UPDATE public.devices SET last_seen_at = now() WHERE id = p_device_id;
    RETURN p_device_id;
  END IF;

  INSERT INTO public.devices (
    id, user_id, client_instance_id, public_key, public_key_fingerprint,
    key_algorithm, status
  ) VALUES (
    p_device_id, v_actor, p_client_instance_id, p_public_key,
    p_public_key_fingerprint, p_key_algorithm, 'active'
  );

  RETURN p_device_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_team(
  p_team_id uuid,
  p_default_space_id uuid,
  p_everyone_group_id uuid,
  p_name text,
  p_creator_device_id uuid,
  p_everyone_name_ciphertext bytea,
  p_everyone_name_nonce bytea,
  p_space_name_ciphertext bytea,
  p_space_name_nonce bytea,
  p_team_wrapped_key bytea,
  p_team_wrapping_nonce bytea,
  p_space_wrapped_key bytea,
  p_space_wrapping_nonce bytea,
  p_algorithm text
)
RETURNS TABLE (
  team_id uuid,
  space_id uuid,
  everyone_group_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_existing public.teams%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF nullif(btrim(p_name), '') IS NULL OR length(p_name) > 120 THEN
    RAISE EXCEPTION 'invalid team name' USING ERRCODE = '22023';
  END IF;
  IF NOT private.owns_device(p_creator_device_id, v_actor) THEN
    RAISE EXCEPTION 'creator device is not owned by actor' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.devices
    WHERE id = p_creator_device_id AND status <> 'active'
  ) THEN
    RAISE EXCEPTION 'creator device is revoked' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
    FROM public.teams
   WHERE id = p_team_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.created_by <> v_actor
       OR v_existing.name <> btrim(p_name)
       OR NOT EXISTS (
         SELECT 1 FROM public.spaces existing_space
         WHERE existing_space.id = p_default_space_id
           AND existing_space.team_id = p_team_id
       )
       OR NOT EXISTS (
         SELECT 1 FROM public.team_groups existing_group
         WHERE existing_group.id = p_everyone_group_id
           AND existing_group.team_id = p_team_id
           AND existing_group.system_key = 'everyone'
       ) THEN
      RAISE EXCEPTION 'team id is already registered differently'
        USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT p_team_id, p_default_space_id, p_everyone_group_id;
    RETURN;
  END IF;

  SET CONSTRAINTS ALL DEFERRED;

  INSERT INTO public.teams (
    id, name, created_by, current_permission_epoch, current_key_epoch
  ) VALUES (p_team_id, btrim(p_name), v_actor, 1, 1);

  INSERT INTO public.team_permission_epochs (
    team_id, epoch, reason_code, changed_by
  ) VALUES (p_team_id, 1, 'team_created', v_actor);

  INSERT INTO public.team_key_epochs (
    team_id, epoch, reason_code, created_by
  ) VALUES (p_team_id, 1, 'team_created', v_actor);

  INSERT INTO public.team_memberships (
    team_id, user_id, role, status
  ) VALUES (p_team_id, v_actor, 'owner', 'active');

  INSERT INTO public.team_key_envelopes (
    team_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
    algorithm, created_by_device_id
  ) VALUES (
    p_team_id, 1, p_creator_device_id, p_team_wrapped_key,
    p_team_wrapping_nonce, p_algorithm, p_creator_device_id
  );

  INSERT INTO public.team_groups (
    id, team_id, system_key, name_ciphertext, name_nonce, key_epoch, created_by
  ) VALUES (
    p_everyone_group_id, p_team_id, 'everyone',
    p_everyone_name_ciphertext, p_everyone_name_nonce, 1, v_actor
  );

  INSERT INTO public.spaces (
    id, team_id, kind, name_ciphertext, name_nonce, current_key_epoch, created_by
  ) VALUES (
    p_default_space_id, p_team_id, 'team',
    p_space_name_ciphertext, p_space_name_nonce, 1, v_actor
  );

  INSERT INTO public.space_key_epochs (
    space_id, epoch, reason, created_by
  ) VALUES (p_default_space_id, 1, 'space_created', v_actor);

  INSERT INTO public.space_key_envelopes (
    space_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
    algorithm, created_by_device_id
  ) VALUES (
    p_default_space_id, 1, p_creator_device_id, p_space_wrapped_key,
    p_space_wrapping_nonce, p_algorithm, p_creator_device_id
  );

  INSERT INTO public.space_group_grants (
    team_id, space_id, group_id, role, granted_by
  ) VALUES (
    p_team_id, p_default_space_id, p_everyone_group_id, 'editor', v_actor
  );

  INSERT INTO public.space_member_grants (
    team_id, space_id, user_id, role, granted_by
  ) VALUES (
    p_team_id, p_default_space_id, v_actor, 'manager', v_actor
  );

  INSERT INTO public.space_sync_counters (space_id, last_sequence)
  VALUES (p_default_space_id, 0);

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, new_status, permission_epoch,
    team_key_epoch, space_key_epoch, reason_code
  ) VALUES (
    p_team_id, v_actor, p_creator_device_id, 'team_created',
    'team', p_team_id, 'active', 1, 1, 1, 'team_created'
  );

  RETURN QUERY SELECT p_team_id, p_default_space_id, p_everyone_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invite(
  p_invite_id uuid,
  p_team_id uuid,
  p_email text,
  p_token_hash bytea,
  p_role public.team_role,
  p_expires_at timestamptz,
  p_initial_grants jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_existing public.team_invites%ROWTYPE;
  v_grant jsonb;
  v_space_id uuid;
  v_space_role public.space_role;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT private.has_team_role(p_team_id, 'admin', v_actor) THEN
    RAISE EXCEPTION 'team admin role required' USING ERRCODE = '42501';
  END IF;
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'owner role requires ownership transfer' USING ERRCODE = '22023';
  END IF;
  IF v_email = '' OR p_expires_at <= now() OR length(p_token_hash) = 0 THEN
    RAISE EXCEPTION 'invalid invite' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_initial_grants) <> 'array' THEN
    RAISE EXCEPTION 'initial grants must be an array' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
    FROM public.team_invites
   WHERE id = p_invite_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.team_id <> p_team_id
       OR v_existing.email_normalized <> v_email
       OR v_existing.role <> p_role
       OR v_existing.token_hash <> p_token_hash
       OR v_existing.invited_by <> v_actor THEN
      RAISE EXCEPTION 'invite id is already registered differently'
        USING ERRCODE = '23505';
    END IF;
    RETURN p_invite_id;
  END IF;

  INSERT INTO public.team_invites (
    id, team_id, email_normalized, token_hash, role, invited_by, expires_at
  ) VALUES (
    p_invite_id, p_team_id, v_email, p_token_hash, p_role, v_actor, p_expires_at
  );

  FOR v_grant IN SELECT value FROM jsonb_array_elements(p_initial_grants)
  LOOP
    v_space_id := (v_grant ->> 'space_id')::uuid;
    v_space_role := (v_grant ->> 'role')::public.space_role;
    INSERT INTO public.invite_space_grants (
      team_id, invite_id, space_id, role
    ) VALUES (p_team_id, p_invite_id, v_space_id, v_space_role);
  END LOOP;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, event_type, target_type, target_id,
    permission_epoch, reason_code
  )
  SELECT p_team_id, v_actor, 'invite_created', 'invite', p_invite_id,
         team.current_permission_epoch, 'invite_created'
    FROM public.teams team
   WHERE team.id = p_team_id;

  RETURN p_invite_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invite(
  p_invite_id uuid,
  p_device_id uuid
)
RETURNS public.membership_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email extensions.citext;
  v_invite public.team_invites%ROWTYPE;
  v_existing_membership public.team_memberships%ROWTYPE;
  v_status public.membership_status;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT private.owns_device(p_device_id, v_actor) THEN
    RAISE EXCEPTION 'device is not owned by actor' USING ERRCODE = '42501';
  END IF;

  SELECT lower(email)::extensions.citext INTO v_actor_email
    FROM auth.users
   WHERE id = v_actor;

  SELECT * INTO v_invite
    FROM public.team_invites
   WHERE id = p_invite_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_invite.accepted_by = v_actor THEN
    SELECT status INTO v_status
      FROM public.team_memberships
     WHERE team_id = v_invite.team_id AND user_id = v_actor;
    RETURN v_status;
  END IF;
  IF v_invite.accepted_at IS NOT NULL
     OR v_invite.revoked_at IS NOT NULL
     OR v_invite.expires_at <= now()
     OR v_invite.email_normalized <> v_actor_email THEN
    RAISE EXCEPTION 'invite is not valid for this user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing_membership
    FROM public.team_memberships
   WHERE team_id = v_invite.team_id
     AND user_id = v_actor
   FOR UPDATE;

  IF FOUND AND v_existing_membership.status <> 'removed' THEN
    RAISE EXCEPTION 'user already has a non-removed membership'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.team_memberships (
    team_id, user_id, role, status, invited_by
  ) VALUES (
    v_invite.team_id, v_actor, v_invite.role, 'key_pending', v_invite.invited_by
  )
  ON CONFLICT (team_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = CASE
          WHEN public.team_memberships.status = 'removed'
            THEN 'key_pending'::public.membership_status
          ELSE public.team_memberships.status
        END,
        membership_version = public.team_memberships.membership_version + 1,
        invited_by = EXCLUDED.invited_by,
        suspended_at = NULL,
        removed_at = NULL;

  INSERT INTO public.space_member_grants (
    team_id, space_id, user_id, role, granted_by
  )
  SELECT grant_row.team_id, grant_row.space_id, v_actor,
         grant_row.role, v_invite.invited_by
    FROM public.invite_space_grants grant_row
   WHERE grant_row.invite_id = p_invite_id
  ON CONFLICT (team_id, space_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        granted_by = EXCLUDED.granted_by;

  UPDATE public.team_invites
     SET accepted_by = v_actor,
         accepted_at = now()
   WHERE id = p_invite_id;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, affected_user_id, new_status,
    permission_epoch, reason_code
  )
  SELECT v_invite.team_id, v_actor, p_device_id, 'invite_accepted',
         'membership', v_actor, v_actor, 'key_pending',
         team.current_permission_epoch, 'invite_accepted'
    FROM public.teams team
   WHERE team.id = v_invite.team_id;

  RETURN 'key_pending';
END;
$$;

REVOKE ALL ON FUNCTION public.register_device(uuid, uuid, bytea, bytea, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_team(
  uuid, uuid, uuid, text, uuid, bytea, bytea, bytea, bytea,
  bytea, bytea, bytea, bytea, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_invite(
  uuid, uuid, text, bytea, public.team_role, timestamptz, jsonb
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_invite(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.register_device(uuid, uuid, bytea, bytea, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team(
  uuid, uuid, uuid, text, uuid, bytea, bytea, bytea, bytea,
  bytea, bytea, bytea, bytea, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invite(
  uuid, uuid, text, bytea, public.team_role, timestamptz, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid, uuid)
  TO authenticated;

-- Team Notes V1: bind invitation acceptance to the bearer token hash.

SET search_path TO public, auth, extensions;

CREATE OR REPLACE FUNCTION public.accept_invite(
  p_invite_id uuid,
  p_token text,
  p_device_id uuid
)
RETURNS public.membership_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
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
  IF nullif(p_token, '') IS NULL OR length(p_token) > 512 THEN
    RAISE EXCEPTION 'invalid invite token' USING ERRCODE = '42501';
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
  IF v_invite.token_hash <> digest(p_token, 'sha256') THEN
    RAISE EXCEPTION 'invite token is invalid' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.accept_invite(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_invite(uuid, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid, text, uuid)
  TO authenticated;

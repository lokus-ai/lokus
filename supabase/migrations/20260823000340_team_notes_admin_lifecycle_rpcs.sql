-- Team Notes V1: ownership transfer and safe soft-archive operations.

SET search_path TO public, auth, extensions;

CREATE OR REPLACE FUNCTION public.transfer_ownership(
  p_team_id uuid,
  p_new_owner_user_id uuid,
  p_actor_device_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_team public.teams%ROWTYPE;
  v_actor_membership public.team_memberships%ROWTYPE;
  v_new_membership public.team_memberships%ROWTYPE;
  v_epoch bigint;
BEGIN
  IF v_actor IS NULL OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'active owner device required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.devices
    WHERE id = p_actor_device_id AND status <> 'active'
  ) THEN
    RAISE EXCEPTION 'active owner device required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_team
    FROM public.teams
   WHERE id = p_team_id
   FOR UPDATE;
  IF NOT FOUND OR v_team.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_actor_membership
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = v_actor
   FOR UPDATE;
  SELECT * INTO v_new_membership
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = p_new_owner_user_id
   FOR UPDATE;

  IF v_actor_membership.role = 'admin'
     AND v_actor_membership.status = 'active'
     AND v_new_membership.role = 'owner'
     AND v_new_membership.status = 'active' THEN
    RETURN true;
  END IF;
  IF v_actor_membership.role <> 'owner'
     OR v_actor_membership.status <> 'active'
     OR v_new_membership.status <> 'active' THEN
    RAISE EXCEPTION 'active owner and active successor required'
      USING ERRCODE = '42501';
  END IF;
  IF p_new_owner_user_id = v_actor THEN
    RETURN true;
  END IF;

  v_epoch := v_team.current_permission_epoch + 1;
  INSERT INTO public.team_permission_epochs (
    team_id, epoch, reason_code, changed_by
  ) VALUES (p_team_id, v_epoch, 'ownership_transferred', v_actor);

  UPDATE public.team_memberships
     SET role = 'admin',
         membership_version = membership_version + 1
   WHERE team_id = p_team_id AND user_id = v_actor;
  UPDATE public.team_memberships
     SET role = 'owner',
         membership_version = membership_version + 1
   WHERE team_id = p_team_id AND user_id = p_new_owner_user_id;
  UPDATE public.teams
     SET current_permission_epoch = v_epoch,
         updated_at = now()
   WHERE id = p_team_id;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, affected_user_id, old_status, new_status,
    permission_epoch, reason_code
  ) VALUES (
    p_team_id, v_actor, p_actor_device_id, 'ownership_transferred',
    'membership', p_new_owner_user_id, p_new_owner_user_id,
    v_new_membership.role::text, 'owner', v_epoch, 'ownership_transferred'
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_space(
  p_team_id uuid,
  p_space_id uuid,
  p_actor_device_id uuid,
  p_retention_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_team public.teams%ROWTYPE;
  v_space public.spaces%ROWTYPE;
  v_epoch bigint;
BEGIN
  IF v_actor IS NULL
     OR NOT private.has_team_role(p_team_id, 'admin', v_actor)
     OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'team admin device required' USING ERRCODE = '42501';
  END IF;
  IF p_retention_expires_at <= now() THEN
    RAISE EXCEPTION 'retention expiry must be in the future'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_team
    FROM public.teams
   WHERE id = p_team_id AND deleted_at IS NULL
   FOR UPDATE;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('space:' || p_space_id::text, 0)
  );
  SELECT * INTO v_space
    FROM public.spaces
   WHERE id = p_space_id AND team_id = p_team_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'space not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_space.deleted_at IS NOT NULL THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notes
    WHERE space_id = p_space_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'space contains active notes' USING ERRCODE = '23514';
  END IF;

  v_epoch := v_team.current_permission_epoch + 1;
  INSERT INTO public.team_permission_epochs (
    team_id, epoch, reason_code, changed_by
  ) VALUES (p_team_id, v_epoch, 'space_archived', v_actor);
  UPDATE public.spaces
     SET deleted_at = now(),
         archived_by = v_actor,
         retention_expires_at = p_retention_expires_at,
         archived_with_team = false,
         updated_at = now()
   WHERE id = p_space_id;
  UPDATE public.teams
     SET current_permission_epoch = v_epoch, updated_at = now()
   WHERE id = p_team_id;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, affected_space_id, new_status,
    permission_epoch, reason_code
  ) VALUES (
    p_team_id, v_actor, p_actor_device_id, 'space_archived',
    'space', p_space_id, p_space_id, 'archived',
    v_epoch, 'space_archived'
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_team(
  p_team_id uuid,
  p_actor_device_id uuid,
  p_retention_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_team public.teams%ROWTYPE;
  v_role public.team_role;
  v_status public.membership_status;
  v_epoch bigint;
BEGIN
  IF v_actor IS NULL OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'team owner device required' USING ERRCODE = '42501';
  END IF;
  IF p_retention_expires_at <= now() THEN
    RAISE EXCEPTION 'retention expiry must be in the future'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_team
    FROM public.teams
   WHERE id = p_team_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT role, status INTO v_role, v_status
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = v_actor
   FOR UPDATE;
  IF v_role <> 'owner' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'active team owner required' USING ERRCODE = '42501';
  END IF;
  IF v_team.deleted_at IS NOT NULL THEN
    RETURN true;
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('space:' || space.id::text, 0)
  )
  FROM public.spaces space
  WHERE space.team_id = p_team_id
  ORDER BY space.id;
  PERFORM 1
    FROM public.spaces
   WHERE team_id = p_team_id
   ORDER BY id
   FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.notes
    WHERE team_id = p_team_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'team contains active notes' USING ERRCODE = '23514';
  END IF;

  v_epoch := v_team.current_permission_epoch + 1;
  INSERT INTO public.team_permission_epochs (
    team_id, epoch, reason_code, changed_by
  ) VALUES (p_team_id, v_epoch, 'team_archived', v_actor);
  UPDATE public.spaces
     SET deleted_at = now(),
         archived_by = v_actor,
         retention_expires_at = p_retention_expires_at,
         archived_with_team = true,
         updated_at = now()
   WHERE team_id = p_team_id
     AND deleted_at IS NULL;
  UPDATE public.teams
     SET deleted_at = now(),
         archived_by = v_actor,
         retention_expires_at = p_retention_expires_at,
         current_permission_epoch = v_epoch,
         updated_at = now()
   WHERE id = p_team_id;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, new_status, permission_epoch, reason_code
  ) VALUES (
    p_team_id, v_actor, p_actor_device_id, 'team_archived',
    'team', p_team_id, 'archived', v_epoch, 'team_archived'
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_space(
  p_team_id uuid,
  p_space_id uuid,
  p_actor_device_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_team public.teams%ROWTYPE;
  v_space public.spaces%ROWTYPE;
  v_epoch bigint;
BEGIN
  IF v_actor IS NULL
     OR NOT private.has_team_role(p_team_id, 'admin', v_actor)
     OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'team admin device required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_team FROM public.teams
   WHERE id = p_team_id AND deleted_at IS NULL FOR UPDATE;
  SELECT * INTO v_space FROM public.spaces
   WHERE id = p_space_id AND team_id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'space not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_space.deleted_at IS NULL THEN
    RETURN true;
  END IF;
  IF v_space.archived_with_team OR v_space.retention_expires_at <= now() THEN
    RAISE EXCEPTION 'space cannot be restored independently'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('space:' || p_space_id::text, 0)
  );

  v_epoch := v_team.current_permission_epoch + 1;
  INSERT INTO public.team_permission_epochs (
    team_id, epoch, reason_code, changed_by
  ) VALUES (p_team_id, v_epoch, 'space_restored', v_actor);
  UPDATE public.spaces
     SET deleted_at = NULL,
         archived_by = NULL,
         retention_expires_at = NULL,
         archived_with_team = false,
         updated_at = now()
   WHERE id = p_space_id;
  UPDATE public.teams
     SET current_permission_epoch = v_epoch, updated_at = now()
   WHERE id = p_team_id;
  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, affected_space_id, old_status, new_status,
    permission_epoch, reason_code
  ) VALUES (
    p_team_id, v_actor, p_actor_device_id, 'space_restored',
    'space', p_space_id, p_space_id, 'archived', 'active',
    v_epoch, 'space_restored'
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_team(
  p_team_id uuid,
  p_actor_device_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_team public.teams%ROWTYPE;
  v_role public.team_role;
  v_status public.membership_status;
  v_epoch bigint;
BEGIN
  IF v_actor IS NULL OR NOT private.owns_device(p_actor_device_id, v_actor) THEN
    RAISE EXCEPTION 'team owner device required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_team FROM public.teams
   WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT role, status INTO v_role, v_status
    FROM public.team_memberships
   WHERE team_id = p_team_id AND user_id = v_actor
   FOR UPDATE;
  IF v_role <> 'owner' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'active team owner required' USING ERRCODE = '42501';
  END IF;
  IF v_team.deleted_at IS NULL THEN
    RETURN true;
  END IF;
  IF v_team.retention_expires_at <= now() THEN
    RAISE EXCEPTION 'team retention window expired' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('space:' || space.id::text, 0)
  )
  FROM public.spaces space
  WHERE space.team_id = p_team_id
  ORDER BY space.id;
  PERFORM 1 FROM public.spaces
   WHERE team_id = p_team_id ORDER BY id FOR UPDATE;
  v_epoch := v_team.current_permission_epoch + 1;
  INSERT INTO public.team_permission_epochs (
    team_id, epoch, reason_code, changed_by
  ) VALUES (p_team_id, v_epoch, 'team_restored', v_actor);
  UPDATE public.teams
     SET deleted_at = NULL,
         archived_by = NULL,
         retention_expires_at = NULL,
         current_permission_epoch = v_epoch,
         updated_at = now()
   WHERE id = p_team_id;
  UPDATE public.spaces
     SET deleted_at = NULL,
         archived_by = NULL,
         retention_expires_at = NULL,
         archived_with_team = false,
         updated_at = now()
   WHERE team_id = p_team_id
     AND archived_with_team = true;
  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, actor_device_id, event_type,
    target_type, target_id, old_status, new_status,
    permission_epoch, reason_code
  ) VALUES (
    p_team_id, v_actor, p_actor_device_id, 'team_restored',
    'team', p_team_id, 'archived', 'active',
    v_epoch, 'team_restored'
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_ownership(uuid, uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_space(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_team(uuid, uuid, timestamptz)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_space(uuid, uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_team(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid, uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_space(uuid, uuid, uuid, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_team(uuid, uuid, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_space(uuid, uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_team(uuid, uuid)
  TO authenticated;

-- Team Notes V1: close private helper exposure and authorize collaboration channels.

SET search_path TO public, auth, extensions;

-- RLS needs a caller-bound gateway because the implementation helpers accept an
-- explicit user id and must not be executable by authenticated clients.
CREATE SCHEMA IF NOT EXISTS team_notes_rls;
REVOKE ALL ON SCHEMA team_notes_rls FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA team_notes_rls TO authenticated, service_role;

CREATE OR REPLACE FUNCTION team_notes_rls.authorize(
  p_check text,
  p_resource_id uuid,
  p_required_role text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR p_resource_id IS NULL THEN
    RETURN false;
  END IF;

  CASE p_check
    WHEN 'active_team_member' THEN
      RETURN private.is_active_team_member(p_resource_id, v_actor);
    WHEN 'team_role' THEN
      CASE p_required_role
        WHEN 'member' THEN
          RETURN private.has_team_role(p_resource_id, 'member', v_actor);
        WHEN 'admin' THEN
          RETURN private.has_team_role(p_resource_id, 'admin', v_actor);
        WHEN 'owner' THEN
          RETURN private.has_team_role(p_resource_id, 'owner', v_actor);
        ELSE
          RETURN false;
      END CASE;
    WHEN 'space_role' THEN
      CASE p_required_role
        WHEN 'reader' THEN
          RETURN private.has_space_role(p_resource_id, 'reader', v_actor);
        WHEN 'editor' THEN
          RETURN private.has_space_role(p_resource_id, 'editor', v_actor);
        WHEN 'manager' THEN
          RETURN private.has_space_role(p_resource_id, 'manager', v_actor);
        ELSE
          RETURN false;
      END CASE;
    WHEN 'owns_device' THEN
      RETURN private.owns_device(p_resource_id, v_actor);
    WHEN 'read_device' THEN
      RETURN private.can_read_device(p_resource_id, v_actor);
    WHEN 'read_note' THEN
      RETURN private.can_read_note(p_resource_id, v_actor);
    WHEN 'read_profile' THEN
      RETURN private.can_read_profile(p_resource_id, v_actor);
    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION team_notes_rls.authorize(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION team_notes_rls.authorize(text, uuid, text)
  TO authenticated, service_role;

ALTER POLICY profiles_select_visible ON public.profiles
  USING (team_notes_rls.authorize('read_profile', id));
ALTER POLICY teams_select_member ON public.teams
  USING (
    deleted_at IS NULL
    AND team_notes_rls.authorize('active_team_member', id)
  );
ALTER POLICY team_permission_epochs_select_member ON public.team_permission_epochs
  USING (team_notes_rls.authorize('active_team_member', team_id));
ALTER POLICY team_memberships_select_team_or_self ON public.team_memberships
  USING (
    user_id = (SELECT auth.uid())
    OR team_notes_rls.authorize('active_team_member', team_id)
  );
ALTER POLICY team_invites_select_admin_or_recipient ON public.team_invites
  USING (
    team_notes_rls.authorize('team_role', team_id, 'admin')
    OR (
      email_normalized = lower((SELECT auth.jwt()) ->> 'email')::citext
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
    )
  );
ALTER POLICY team_groups_select_member ON public.team_groups
  USING (
    deleted_at IS NULL
    AND team_notes_rls.authorize('active_team_member', team_id)
  );
ALTER POLICY team_group_members_select_member ON public.team_group_members
  USING (team_notes_rls.authorize('active_team_member', team_id));
ALTER POLICY spaces_select_granted ON public.spaces
  USING (
    deleted_at IS NULL
    AND team_notes_rls.authorize('space_role', id, 'reader')
  );
ALTER POLICY space_member_grants_select_granted ON public.space_member_grants
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY space_group_grants_select_granted ON public.space_group_grants
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY invite_space_grants_select_invite ON public.invite_space_grants
  USING (
    EXISTS (
      SELECT 1
        FROM public.team_invites invite
       WHERE invite.id = invite_id
         AND (
           team_notes_rls.authorize('team_role', invite.team_id, 'admin')
           OR (
             invite.email_normalized = lower((SELECT auth.jwt()) ->> 'email')::citext
             AND invite.accepted_at IS NULL
             AND invite.revoked_at IS NULL
             AND invite.expires_at > now()
           )
         )
    )
  );
ALTER POLICY devices_select_related ON public.devices
  USING (team_notes_rls.authorize('read_device', id));
ALTER POLICY team_key_epochs_select_member ON public.team_key_epochs
  USING (team_notes_rls.authorize('active_team_member', team_id));
ALTER POLICY team_key_envelopes_select_recipient ON public.team_key_envelopes
  USING (
    team_notes_rls.authorize('active_team_member', team_id)
    AND team_notes_rls.authorize('owns_device', recipient_device_id)
  );
ALTER POLICY space_key_epochs_select_granted ON public.space_key_epochs
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY space_key_envelopes_select_recipient ON public.space_key_envelopes
  USING (
    team_notes_rls.authorize('space_role', space_id, 'reader')
    AND team_notes_rls.authorize('owns_device', recipient_device_id)
  );
ALTER POLICY notes_select_granted ON public.notes
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY note_revisions_select_granted ON public.note_revisions
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY note_heads_select_granted ON public.note_heads
  USING (team_notes_rls.authorize('read_note', note_id));
ALTER POLICY pending_revision_uploads_select_owner ON public.pending_revision_uploads
  USING (
    actor_user_id = (SELECT auth.uid())
    AND team_notes_rls.authorize('owns_device', actor_device_id)
  );
ALTER POLICY space_sync_counters_select_granted ON public.space_sync_counters
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY sync_actions_select_granted ON public.sync_actions
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY mutation_receipts_select_owner ON public.mutation_receipts
  USING (team_notes_rls.authorize('owns_device', actor_device_id));
ALTER POLICY replica_checkpoint_observations_select_owner
  ON public.replica_checkpoint_observations
  USING (
    team_notes_rls.authorize('owns_device', device_id)
    AND team_notes_rls.authorize('space_role', space_id, 'reader')
  );
ALTER POLICY note_tombstones_select_granted ON public.note_tombstones
  USING (team_notes_rls.authorize('space_role', space_id, 'reader'));
ALTER POLICY note_space_transitions_select_admin ON public.note_space_transitions
  USING (team_notes_rls.authorize('team_role', team_id, 'admin'));
ALTER POLICY team_audit_events_select_admin ON public.team_audit_events
  USING (team_notes_rls.authorize('team_role', team_id, 'admin'));

ALTER POLICY team_note_revisions_insert_pending ON storage.objects
  WITH CHECK (
    bucket_id = 'team-note-revisions'
    AND EXISTS (
      SELECT 1
        FROM public.pending_revision_uploads pending
       WHERE pending.object_key = name
         AND pending.actor_user_id = (SELECT auth.uid())
         AND team_notes_rls.authorize(
           'owns_device',
           pending.actor_device_id
         )
         AND pending.expires_at > now()
         AND team_notes_rls.authorize(
           'space_role',
           pending.space_id,
           'editor'
         )
    )
  );
ALTER POLICY team_note_revisions_select_authorized ON storage.objects
  USING (
    bucket_id = 'team-note-revisions'
    AND EXISTS (
      SELECT 1
        FROM public.note_revisions revision
       WHERE revision.object_key = name
         AND team_notes_rls.authorize(
           'space_role',
           revision.space_id,
           'reader'
         )
    )
  );

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Remove the legacy overload on databases that applied the original chain.
DROP FUNCTION IF EXISTS public.accept_invite(uuid, uuid);

CREATE OR REPLACE FUNCTION private.enforce_active_invite_space_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.spaces space
     WHERE space.id = NEW.space_id
       AND space.team_id = NEW.team_id
       AND space.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'initial invite grant requires an active team space'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_active_invite_space_grant()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_active_invite_space_grant
  ON public.invite_space_grants;
CREATE TRIGGER enforce_active_invite_space_grant
BEFORE INSERT OR UPDATE OF team_id, space_id
ON public.invite_space_grants
FOR EACH ROW
EXECUTE FUNCTION private.enforce_active_invite_space_grant();

CREATE OR REPLACE FUNCTION public.revoke_team_invite(
  p_invite_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_invite public.team_invites%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT invite.* INTO v_invite
    FROM public.team_invites invite
   WHERE invite.id = p_invite_id
     AND private.has_team_role(invite.team_id, 'admin', v_actor)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found or not authorized'
      USING ERRCODE = '42501';
  END IF;
  IF v_invite.accepted_at IS NOT NULL OR v_invite.accepted_by IS NOT NULL THEN
    RAISE EXCEPTION 'accepted invite cannot be revoked'
      USING ERRCODE = '23514';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN true;
  END IF;

  UPDATE public.team_invites
     SET revoked_at = now()
   WHERE id = p_invite_id;

  INSERT INTO public.team_audit_events (
    team_id, actor_user_id, event_type, target_type, target_id,
    old_status, new_status, permission_epoch, reason_code
  )
  SELECT v_invite.team_id, v_actor, 'invite_revoked', 'invite',
         p_invite_id,
         CASE WHEN v_invite.expires_at <= now() THEN 'expired' ELSE 'pending' END,
         'revoked', team.current_permission_epoch, 'invite_revoked'
    FROM public.teams team
   WHERE team.id = v_invite.team_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_team_invite(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_team_invite(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION team_notes_rls.can_access_realtime_topic(
  p_topic text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_space_id uuid;
  v_note_id uuid;
  v_uuid_pattern CONSTANT text :=
    '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}';
BEGIN
  IF v_actor IS NULL OR p_topic IS NULL OR length(p_topic) > 120 THEN
    RETURN false;
  END IF;

  IF p_topic ~ ('^team-space:' || v_uuid_pattern || '$') THEN
    v_space_id := split_part(p_topic, ':', 2)::uuid;
    RETURN private.has_space_role(v_space_id, 'reader', v_actor);
  END IF;

  IF p_topic ~ (
    '^team-note:' || v_uuid_pattern || ':' || v_uuid_pattern || '$'
  ) THEN
    v_space_id := split_part(p_topic, ':', 2)::uuid;
    v_note_id := split_part(p_topic, ':', 3)::uuid;
    RETURN private.has_space_role(v_space_id, 'reader', v_actor)
       AND EXISTS (
         SELECT 1
           FROM public.notes note
          WHERE note.id = v_note_id
            AND note.space_id = v_space_id
            AND note.status = 'active'
       );
  END IF;

  RETURN false;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION team_notes_rls.can_access_realtime_topic(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION team_notes_rls.can_access_realtime_topic(text)
  TO authenticated;

DROP POLICY IF EXISTS team_notes_collaboration_receive
  ON realtime.messages;
CREATE POLICY team_notes_collaboration_receive
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    extension IN ('broadcast', 'presence')
    AND team_notes_rls.can_access_realtime_topic(realtime.topic())
  );

DROP POLICY IF EXISTS team_notes_collaboration_send
  ON realtime.messages;
CREATE POLICY team_notes_collaboration_send
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    extension IN ('broadcast', 'presence')
    AND team_notes_rls.can_access_realtime_topic(realtime.topic())
  );

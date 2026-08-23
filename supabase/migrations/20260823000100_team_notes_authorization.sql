-- Team Notes V1: deny-by-default RLS and read authorization helpers.
-- All domain writes remain RPC-only except a user's own profile.

SET search_path TO public, auth, extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.team_role_rank(p_role public.team_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public
AS $$
  SELECT CASE p_role
    WHEN 'member' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'owner' THEN 3
  END;
$$;

CREATE OR REPLACE FUNCTION private.space_role_rank(p_role public.space_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public
AS $$
  SELECT CASE p_role
    WHEN 'reader' THEN 1
    WHEN 'editor' THEN 2
    WHEN 'manager' THEN 3
  END;
$$;

CREATE OR REPLACE FUNCTION private.is_active_team_member(
  p_team_id uuid,
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
      FROM public.team_memberships membership
      JOIN public.teams team
        ON team.id = membership.team_id
       AND team.deleted_at IS NULL
     WHERE membership.team_id = p_team_id
       AND membership.user_id = p_user_id
       AND membership.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.has_team_role(
  p_team_id uuid,
  p_required_role public.team_role,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE((
    SELECT private.team_role_rank(membership.role)
           >= private.team_role_rank(p_required_role)
      FROM public.team_memberships membership
     WHERE membership.team_id = p_team_id
       AND membership.user_id = p_user_id
       AND membership.status = 'active'
  ), false);
$$;

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
     WHERE mine.user_id = p_user_id
       AND mine.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.effective_space_role(
  p_space_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS public.space_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  WITH target_space AS (
    SELECT space.id, space.team_id
      FROM public.spaces space
      JOIN public.teams team
        ON team.id = space.team_id
       AND team.deleted_at IS NULL
     WHERE space.id = p_space_id
       AND space.deleted_at IS NULL
       AND private.is_active_team_member(space.team_id, p_user_id)
  ),
  candidate_roles AS (
    SELECT direct_grant.role
      FROM target_space
      JOIN public.space_member_grants direct_grant
        ON direct_grant.team_id = target_space.team_id
       AND direct_grant.space_id = target_space.id
       AND direct_grant.user_id = p_user_id
    UNION ALL
    SELECT group_grant.role
      FROM target_space
      JOIN public.space_group_grants group_grant
        ON group_grant.team_id = target_space.team_id
       AND group_grant.space_id = target_space.id
      JOIN public.team_groups team_group
        ON team_group.team_id = group_grant.team_id
       AND team_group.id = group_grant.group_id
       AND team_group.deleted_at IS NULL
      LEFT JOIN public.team_group_members group_member
        ON group_member.team_id = team_group.team_id
       AND group_member.group_id = team_group.id
       AND group_member.user_id = p_user_id
     WHERE team_group.system_key = 'everyone'
        OR group_member.user_id IS NOT NULL
  ),
  highest AS (
    SELECT max(private.space_role_rank(role)) AS rank
      FROM candidate_roles
  )
  SELECT CASE rank
    WHEN 1 THEN 'reader'::public.space_role
    WHEN 2 THEN 'editor'::public.space_role
    WHEN 3 THEN 'manager'::public.space_role
    ELSE NULL
  END
  FROM highest;
$$;

CREATE OR REPLACE FUNCTION private.has_space_role(
  p_space_id uuid,
  p_required_role public.space_role,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE(
    private.space_role_rank(private.effective_space_role(p_space_id, p_user_id))
      >= private.space_role_rank(p_required_role),
    false
  );
$$;

CREATE OR REPLACE FUNCTION private.owns_device(
  p_device_id uuid,
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
      FROM public.devices device
     WHERE device.id = p_device_id
       AND device.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.can_read_device(
  p_device_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.devices device
     WHERE device.id = p_device_id
       AND (
         device.user_id = p_user_id
         OR private.shares_active_team(device.user_id, p_user_id)
       )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_read_note(
  p_note_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.notes note
     WHERE note.id = p_note_id
       AND private.has_space_role(note.space_id, 'reader', p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.can_read_profile(
  p_profile_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT p_profile_id = p_user_id
      OR private.shares_active_team(p_profile_id, p_user_id);
$$;

REVOKE ALL ON FUNCTION private.team_role_rank(public.team_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.space_role_rank(public.space_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_active_team_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_team_role(uuid, public.team_role, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.shares_active_team(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.effective_space_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_space_role(uuid, public.space_role, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.owns_device(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_read_device(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_read_note(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_read_profile(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.team_role_rank(public.team_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.space_role_rank(public.space_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_active_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_team_role(uuid, public.team_role, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_active_team(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.effective_space_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_space_role(uuid, public.space_role, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_device(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_device(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_note(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_profile(uuid, uuid) TO authenticated, service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_permission_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_member_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_group_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_space_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_key_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_key_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_key_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_key_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_revision_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_sync_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replica_checkpoint_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_space_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.profiles, public.teams, public.team_permission_epochs,
  public.team_memberships, public.team_invites, public.team_groups,
  public.team_group_members, public.spaces, public.space_member_grants,
  public.space_group_grants, public.invite_space_grants, public.devices,
  public.team_key_epochs, public.team_key_envelopes,
  public.space_key_epochs, public.space_key_envelopes, public.notes,
  public.note_revisions, public.note_heads, public.pending_revision_uploads,
  public.space_sync_counters, public.sync_actions, public.mutation_receipts,
  public.replica_checkpoint_observations, public.note_tombstones,
  public.note_space_transitions, public.team_audit_events
FROM anon;

REVOKE ALL ON TABLE
  public.profiles, public.teams, public.team_permission_epochs,
  public.team_memberships, public.team_invites, public.team_groups,
  public.team_group_members, public.spaces, public.space_member_grants,
  public.space_group_grants, public.invite_space_grants, public.devices,
  public.team_key_epochs, public.team_key_envelopes,
  public.space_key_epochs, public.space_key_envelopes, public.notes,
  public.note_revisions, public.note_heads, public.pending_revision_uploads,
  public.space_sync_counters, public.sync_actions, public.mutation_receipts,
  public.replica_checkpoint_observations, public.note_tombstones,
  public.note_space_transitions, public.team_audit_events
FROM authenticated;

GRANT SELECT ON TABLE
  public.teams, public.team_permission_epochs, public.team_memberships,
  public.team_invites, public.team_groups, public.team_group_members,
  public.spaces, public.space_member_grants, public.space_group_grants,
  public.invite_space_grants, public.devices, public.team_key_epochs,
  public.team_key_envelopes, public.space_key_epochs,
  public.space_key_envelopes, public.notes, public.note_revisions,
  public.note_heads, public.pending_revision_uploads,
  public.space_sync_counters, public.sync_actions, public.mutation_receipts,
  public.replica_checkpoint_observations, public.note_tombstones,
  public.note_space_transitions, public.team_audit_events
TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON TABLE
  public.profiles, public.teams, public.team_permission_epochs,
  public.team_memberships, public.team_invites, public.team_groups,
  public.team_group_members, public.spaces, public.space_member_grants,
  public.space_group_grants, public.invite_space_grants, public.devices,
  public.team_key_epochs, public.team_key_envelopes,
  public.space_key_epochs, public.space_key_envelopes, public.notes,
  public.note_revisions, public.note_heads, public.pending_revision_uploads,
  public.space_sync_counters, public.sync_actions, public.mutation_receipts,
  public.replica_checkpoint_observations, public.note_tombstones,
  public.note_space_transitions, public.team_audit_events
TO service_role;

CREATE POLICY profiles_select_visible ON public.profiles
  FOR SELECT TO authenticated
  USING (private.can_read_profile(id));
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY teams_select_member ON public.teams
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND private.is_active_team_member(id));

CREATE POLICY team_permission_epochs_select_member ON public.team_permission_epochs
  FOR SELECT TO authenticated
  USING (private.is_active_team_member(team_id));

CREATE POLICY team_memberships_select_team_or_self ON public.team_memberships
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_active_team_member(team_id));

CREATE POLICY team_invites_select_admin_or_recipient ON public.team_invites
  FOR SELECT TO authenticated
  USING (
    private.has_team_role(team_id, 'admin')
    OR (
      email_normalized = lower((SELECT auth.jwt()) ->> 'email')::citext
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
    )
  );

CREATE POLICY team_groups_select_member ON public.team_groups
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND private.is_active_team_member(team_id));

CREATE POLICY team_group_members_select_member ON public.team_group_members
  FOR SELECT TO authenticated
  USING (private.is_active_team_member(team_id));

CREATE POLICY spaces_select_granted ON public.spaces
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND private.has_space_role(id, 'reader'));

CREATE POLICY space_member_grants_select_granted ON public.space_member_grants
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY space_group_grants_select_granted ON public.space_group_grants
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY invite_space_grants_select_invite ON public.invite_space_grants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.team_invites invite
       WHERE invite.id = invite_id
         AND (
           private.has_team_role(invite.team_id, 'admin')
           OR (
             invite.email_normalized = lower((SELECT auth.jwt()) ->> 'email')::citext
             AND invite.accepted_at IS NULL
             AND invite.revoked_at IS NULL
             AND invite.expires_at > now()
           )
         )
    )
  );

CREATE POLICY devices_select_related ON public.devices
  FOR SELECT TO authenticated
  USING (private.can_read_device(id));

CREATE POLICY team_key_epochs_select_member ON public.team_key_epochs
  FOR SELECT TO authenticated
  USING (private.is_active_team_member(team_id));

CREATE POLICY team_key_envelopes_select_recipient ON public.team_key_envelopes
  FOR SELECT TO authenticated
  USING (
    private.is_active_team_member(team_id)
    AND private.owns_device(recipient_device_id)
  );

CREATE POLICY space_key_epochs_select_granted ON public.space_key_epochs
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY space_key_envelopes_select_recipient ON public.space_key_envelopes
  FOR SELECT TO authenticated
  USING (
    private.has_space_role(space_id, 'reader')
    AND private.owns_device(recipient_device_id)
  );

CREATE POLICY notes_select_granted ON public.notes
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY note_revisions_select_granted ON public.note_revisions
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY note_heads_select_granted ON public.note_heads
  FOR SELECT TO authenticated
  USING (private.can_read_note(note_id));

CREATE POLICY pending_revision_uploads_select_owner ON public.pending_revision_uploads
  FOR SELECT TO authenticated
  USING (
    actor_user_id = (SELECT auth.uid())
    AND private.owns_device(actor_device_id)
  );

CREATE POLICY space_sync_counters_select_granted ON public.space_sync_counters
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY sync_actions_select_granted ON public.sync_actions
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY mutation_receipts_select_owner ON public.mutation_receipts
  FOR SELECT TO authenticated
  USING (private.owns_device(actor_device_id));

CREATE POLICY replica_checkpoint_observations_select_owner
  ON public.replica_checkpoint_observations
  FOR SELECT TO authenticated
  USING (
    private.owns_device(device_id)
    AND private.has_space_role(space_id, 'reader')
  );

CREATE POLICY note_tombstones_select_granted ON public.note_tombstones
  FOR SELECT TO authenticated
  USING (private.has_space_role(space_id, 'reader'));

CREATE POLICY note_space_transitions_select_admin ON public.note_space_transitions
  FOR SELECT TO authenticated
  USING (private.has_team_role(team_id, 'admin'));

CREATE POLICY team_audit_events_select_admin ON public.team_audit_events
  FOR SELECT TO authenticated
  USING (private.has_team_role(team_id, 'admin'));

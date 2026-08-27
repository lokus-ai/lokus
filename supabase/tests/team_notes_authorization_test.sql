-- =============================================================================
-- Team Notes V1 — RLS and direct-access isolation
-- =============================================================================

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles', 'teams', 'team_permission_epochs', 'team_memberships',
    'team_invites', 'team_groups', 'team_group_members', 'spaces',
    'space_member_grants', 'space_group_grants', 'invite_space_grants',
    'devices', 'team_key_epochs', 'team_key_envelopes',
    'space_key_epochs', 'space_key_envelopes', 'notes', 'note_revisions',
    'note_heads', 'pending_revision_uploads', 'space_sync_counters',
    'sync_actions', 'mutation_receipts', 'replica_checkpoint_observations',
    'note_tombstones', 'note_space_transitions', 'team_audit_events'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_table
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS DISABLED: public.%', v_table;
    END IF;
  END LOOP;
END $$;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'rls-owner@example.test', now()),
  ('00000000-0000-0000-0000-000000000102', 'rls-member@example.test', now()),
  ('00000000-0000-0000-0000-000000000103', 'rls-outsider@example.test', now());

INSERT INTO public.profiles (id, display_name)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'RLS Owner'),
  ('00000000-0000-0000-0000-000000000102', 'RLS Member'),
  ('00000000-0000-0000-0000-000000000103', 'RLS Outsider')
ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

INSERT INTO public.teams (
  id, name, created_by, current_permission_epoch, current_key_epoch
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'RLS Team',
  '00000000-0000-0000-0000-000000000101',
  1,
  1
);

INSERT INTO public.team_permission_epochs (team_id, epoch, reason_code, changed_by)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  1,
  'team_created',
  '00000000-0000-0000-0000-000000000101'
);

INSERT INTO public.team_key_epochs (team_id, epoch, reason_code, created_by)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  1,
  'team_created',
  '00000000-0000-0000-0000-000000000101'
);

INSERT INTO public.team_memberships (team_id, user_id, role, status)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'owner',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000102',
    'member',
    'active'
  );

INSERT INTO public.devices (
  id, user_id, client_instance_id, public_key, public_key_fingerprint,
  key_algorithm, status
) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    '21000000-0000-0000-0000-000000000001',
    decode('01', 'hex'), digest('rls-device-1', 'sha256'), 'x25519', 'active'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000102',
    '21000000-0000-0000-0000-000000000002',
    decode('02', 'hex'), digest('rls-device-2', 'sha256'), 'x25519', 'active'
  );

INSERT INTO public.team_key_envelopes (
  team_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
  algorithm, created_by_device_id
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    1,
    '20000000-0000-0000-0000-000000000001',
    decode('11', 'hex'), decode('12', 'hex'), 'x25519-aesgcm',
    '20000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    1,
    '20000000-0000-0000-0000-000000000002',
    decode('13', 'hex'), decode('14', 'hex'), 'x25519-aesgcm',
    '20000000-0000-0000-0000-000000000001'
  );

INSERT INTO public.spaces (
  id, team_id, kind, name_ciphertext, name_nonce, current_key_epoch, created_by
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'restricted',
  decode('21', 'hex'),
  decode('22', 'hex'),
  1,
  '00000000-0000-0000-0000-000000000101'
);

INSERT INTO public.space_key_epochs (space_id, epoch, reason, created_by)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  1,
  'space_created',
  '00000000-0000-0000-0000-000000000101'
);

INSERT INTO public.space_member_grants (
  team_id, space_id, user_id, role, granted_by
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  'manager',
  '00000000-0000-0000-0000-000000000101'
);

INSERT INTO public.space_key_envelopes (
  space_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
  algorithm, created_by_device_id
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  1,
  '20000000-0000-0000-0000-000000000001',
  decode('31', 'hex'),
  decode('32', 'hex'),
  'x25519-aesgcm',
  '20000000-0000-0000-0000-000000000001'
);

INSERT INTO public.notes (
  id, team_id, space_id, created_by, status, schema_version
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  'active',
  1
);

INSERT INTO public.note_revisions (
  id, team_id, space_id, note_id, author_user_id, author_device_id,
  key_epoch, codec_version, object_key, ciphertext_size, ciphertext_sha256
) VALUES (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000001',
  1,
  1,
  'rls/revision.bin',
  1,
  digest('rls-revision', 'sha256')
);

INSERT INTO public.note_heads (note_id, revision_id, head_version)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  1
);

SET CONSTRAINTS ALL IMMEDIATE;

-- Active member without a restricted-space grant sees the team, not the space.
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000102',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = '10000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: active member cannot see team';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.spaces
    WHERE id = '30000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: ungranted member can see restricted space';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notes
    WHERE id = '40000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: ungranted member can see note';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.space_key_envelopes
    WHERE recipient_device_id = '20000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: member can read another device envelope';
  END IF;

  BEGIN
    INSERT INTO public.teams (name, created_by)
    VALUES ('Direct bypass', '00000000-0000-0000-0000-000000000102');
    RAISE EXCEPTION 'RLS FAILED: authenticated role directly inserted a team';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

RESET ROLE;

-- Granted owner can see the restricted note and exact device envelopes.
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000101',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.spaces
    WHERE id = '30000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: granted owner cannot see space';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.note_revisions
    WHERE id = '50000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: granted owner cannot see revision';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.space_key_envelopes
    WHERE recipient_device_id = '20000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: recipient cannot read own envelope';
  END IF;
END $$;

RESET ROLE;

-- Outsider sees neither team nor profile details beyond their own profile.
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000103',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = '10000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: outsider can see team';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-0000-0000-0000-000000000101'
  ) THEN
    RAISE EXCEPTION 'RLS FAILED: outsider can see unrelated profile';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;

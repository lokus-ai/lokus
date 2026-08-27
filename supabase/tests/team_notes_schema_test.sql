-- =============================================================================
-- Team Notes V1 — structural invariants
--
-- Run against an isolated branch after all team-notes migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/team_notes_schema_test.sql
-- =============================================================================

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

DO $$
DECLARE
  v_table text;
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_team1 uuid := gen_random_uuid();
  v_team2 uuid := gen_random_uuid();
  v_device1 uuid := gen_random_uuid();
  v_device2 uuid := gen_random_uuid();
  v_group1 uuid := gen_random_uuid();
  v_group2 uuid := gen_random_uuid();
  v_space1 uuid := gen_random_uuid();
  v_space1_target uuid := gen_random_uuid();
  v_space2 uuid := gen_random_uuid();
  v_note uuid := gen_random_uuid();
  v_revision1 uuid := gen_random_uuid();
  v_revision2 uuid := gen_random_uuid();
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
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE EXCEPTION 'MISSING TABLE: public.%', v_table;
    END IF;
  END LOOP;

  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES
    (v_user1, 'team-schema-1@example.test', now()),
    (v_user2, 'team-schema-2@example.test', now());

  INSERT INTO public.profiles (id, display_name)
  VALUES (v_user1, 'Schema One'), (v_user2, 'Schema Two')
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name;

  INSERT INTO public.teams (
    id, name, created_by, current_permission_epoch, current_key_epoch
  ) VALUES
    (v_team1, 'Team One', v_user1, 1, 1),
    (v_team2, 'Team Two', v_user2, 1, 1);

  INSERT INTO public.team_permission_epochs (team_id, epoch, reason_code, changed_by)
  VALUES
    (v_team1, 1, 'team_created', v_user1),
    (v_team2, 1, 'team_created', v_user2);

  INSERT INTO public.team_key_epochs (team_id, epoch, reason_code, created_by)
  VALUES
    (v_team1, 1, 'team_created', v_user1),
    (v_team2, 1, 'team_created', v_user2);

  INSERT INTO public.team_memberships (team_id, user_id, role, status)
  VALUES
    (v_team1, v_user1, 'owner', 'active'),
    (v_team2, v_user2, 'owner', 'active');

  INSERT INTO public.devices (
    id, user_id, client_instance_id, public_key, public_key_fingerprint,
    key_algorithm, status
  ) VALUES
    (
      v_device1, v_user1, gen_random_uuid(), decode('01', 'hex'),
      digest('device-1', 'sha256'), 'x25519', 'active'
    ),
    (
      v_device2, v_user2, gen_random_uuid(), decode('02', 'hex'),
      digest('device-2', 'sha256'), 'x25519', 'active'
    );

  INSERT INTO public.team_key_envelopes (
    team_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
    algorithm, created_by_device_id
  ) VALUES
    (v_team1, 1, v_device1, decode('11', 'hex'), decode('12', 'hex'), 'x25519-aesgcm', v_device1),
    (v_team2, 1, v_device2, decode('21', 'hex'), decode('22', 'hex'), 'x25519-aesgcm', v_device2);

  INSERT INTO public.spaces (
    id, team_id, kind, name_ciphertext, name_nonce, current_key_epoch, created_by
  ) VALUES
    (v_space1, v_team1, 'team', decode('31', 'hex'), decode('32', 'hex'), 1, v_user1),
    (v_space1_target, v_team1, 'restricted', decode('33', 'hex'), decode('34', 'hex'), 1, v_user1),
    (v_space2, v_team2, 'team', decode('41', 'hex'), decode('42', 'hex'), 1, v_user2);

  INSERT INTO public.space_key_epochs (space_id, epoch, reason, created_by)
  VALUES
    (v_space1, 1, 'space_created', v_user1),
    (v_space1_target, 1, 'space_created', v_user1),
    (v_space2, 1, 'space_created', v_user2);

  INSERT INTO public.team_groups (
    id, team_id, system_key, name_ciphertext, name_nonce, key_epoch, created_by
  ) VALUES
    (v_group1, v_team1, 'everyone', decode('51', 'hex'), decode('52', 'hex'), 1, v_user1),
    (v_group2, v_team2, 'everyone', decode('61', 'hex'), decode('62', 'hex'), 1, v_user2);

  -- Multiple custom groups are legal because NULL system keys are distinct.
  INSERT INTO public.team_groups (
    id, team_id, system_key, name_ciphertext, name_nonce, key_epoch, created_by
  ) VALUES
    (gen_random_uuid(), v_team1, NULL, decode('53', 'hex'), decode('54', 'hex'), 1, v_user1),
    (gen_random_uuid(), v_team1, NULL, decode('55', 'hex'), decode('56', 'hex'), 1, v_user1);

  -- Initial team/space creation uses deferred current-epoch constraints. All
  -- referenced rows now exist, so switch back to immediate enforcement before
  -- deliberately probing isolation failures below.
  SET CONSTRAINTS ALL IMMEDIATE;

  BEGIN
    INSERT INTO public.team_groups (
      id, team_id, system_key, name_ciphertext, name_nonce, key_epoch, created_by
    ) VALUES (
      gen_random_uuid(), v_team1, 'everyone',
      decode('57', 'hex'), decode('58', 'hex'), 1, v_user1
    );
    RAISE EXCEPTION 'EVERYONE UNIQUENESS FAILED: duplicate was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Composite FKs prevent cross-team group membership and grants.
  BEGIN
    INSERT INTO public.team_group_members (team_id, group_id, user_id, added_by)
    VALUES (v_team1, v_group2, v_user1, v_user1);
    RAISE EXCEPTION 'TENANT ISOLATION FAILED: cross-team group accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.space_group_grants (
      team_id, space_id, group_id, role, granted_by
    ) VALUES (v_team1, v_space1, v_group2, 'editor', v_user1);
    RAISE EXCEPTION 'TENANT ISOLATION FAILED: cross-team group grant accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  INSERT INTO public.notes (
    id, team_id, space_id, created_by, status, schema_version
  ) VALUES (v_note, v_team1, v_space1, v_user1, 'active', 1);

  BEGIN
    INSERT INTO public.pending_revision_uploads (
      op_id, revision_id, team_id, note_id, space_id, actor_user_id, actor_device_id,
      client_sequence, key_epoch, object_key, ciphertext_size, ciphertext_sha256, expires_at
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), v_team1, v_note, v_space1, v_user1, v_device1,
      1, 999, 'invalid-epoch', 1, digest('invalid', 'sha256'), now() + interval '5 minutes'
    );
    RAISE EXCEPTION 'KEY EPOCH FAILED: nonexistent epoch accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  INSERT INTO public.note_revisions (
    id, team_id, space_id, note_id, author_user_id, author_device_id,
    key_epoch, codec_version, object_key, ciphertext_size, ciphertext_sha256
  ) VALUES (
    v_revision1, v_team1, v_space1, v_note, v_user1, v_device1,
    1, 1, 'spaces/one/revisions/one.bin', 1, digest('revision-1', 'sha256')
  );

  INSERT INTO public.note_heads (note_id, revision_id, head_version)
  VALUES (v_note, v_revision1, 1);

  -- A same-team move preserves the old revision's original space.
  UPDATE public.notes SET space_id = v_space1_target WHERE id = v_note;

  INSERT INTO public.note_revisions (
    id, team_id, space_id, note_id, base_revision_id, previous_head_id,
    author_user_id, author_device_id, key_epoch, codec_version,
    object_key, ciphertext_size, ciphertext_sha256
  ) VALUES (
    v_revision2, v_team1, v_space1_target, v_note, v_revision1, v_revision1,
    v_user1, v_device1, 1, 1,
    'spaces/target/revisions/two.bin', 1, digest('revision-2', 'sha256')
  );

  UPDATE public.note_heads
    SET revision_id = v_revision2, head_version = 2
    WHERE note_id = v_note;

  INSERT INTO public.note_space_transitions (
    team_id, note_id, from_space_id, to_space_id, target_revision_id,
    source_action_sequence, target_action_sequence,
    moved_by_user_id, moved_by_device_id, op_id
  ) VALUES (
    v_team1, v_note, v_space1, v_space1_target, v_revision2,
    1, 1,
    v_user1, v_device1, gen_random_uuid()
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.note_revisions
    WHERE id = v_revision1 AND space_id = v_space1
  ) THEN
    RAISE EXCEPTION 'MOVE HISTORY FAILED: source revision scope was lost';
  END IF;

  BEGIN
    INSERT INTO public.note_space_transitions (
      team_id, note_id, from_space_id, to_space_id, target_revision_id,
      source_action_sequence, target_action_sequence,
      moved_by_user_id, moved_by_device_id, op_id
    ) VALUES (
      v_team1, v_note, v_space1_target, v_space2, v_revision2,
      2, 2,
      v_user1, v_device1, gen_random_uuid()
    );
    RAISE EXCEPTION 'MOVE ISOLATION FAILED: cross-team target accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_audit_events'
      AND column_name = 'metadata'
  ) THEN
    RAISE EXCEPTION 'AUDIT LEAK GUARD FAILED: free-form metadata column exists';
  END IF;

  RAISE NOTICE 'TEAM NOTES SCHEMA TESTS PASSED';
END $$;

ROLLBACK;

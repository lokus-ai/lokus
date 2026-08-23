-- =============================================================================
-- Team Notes V1 — tombstone, restore, and same-team move
-- =============================================================================

BEGIN;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES ('00000000-0000-0000-0000-000000000801', 'content-owner@example.test', now());

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
SET LOCAL ROLE authenticated;

SELECT public.register_device(
  '20000000-0000-0000-0000-000000000801',
  '21000000-0000-0000-0000-000000000801',
  decode('01', 'hex'), digest('content-device', 'sha256'), 'x25519'
);
SELECT * FROM public.create_team(
  '10000000-0000-0000-0000-000000000801',
  '30000000-0000-0000-0000-000000000801',
  '31000000-0000-0000-0000-000000000801',
  'Content Team',
  '20000000-0000-0000-0000-000000000801',
  decode('11', 'hex'), decode('12', 'hex'),
  decode('13', 'hex'), decode('14', 'hex'),
  decode('15', 'hex'), decode('16', 'hex'),
  decode('17', 'hex'), decode('18', 'hex'),
  'x25519-aesgcm'
);
RESET ROLE;

-- Add a second same-team space for the move target.
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.spaces (
  id, team_id, kind, name_ciphertext, name_nonce, current_key_epoch, created_by
) VALUES (
  '30000000-0000-0000-0000-000000000802',
  '10000000-0000-0000-0000-000000000801',
  'restricted', decode('21', 'hex'), decode('22', 'hex'), 1,
  '00000000-0000-0000-0000-000000000801'
);
INSERT INTO public.space_key_epochs (space_id, epoch, reason, created_by)
VALUES (
  '30000000-0000-0000-0000-000000000802', 1, 'space_created',
  '00000000-0000-0000-0000-000000000801'
);
INSERT INTO public.space_member_grants (
  team_id, space_id, user_id, role, granted_by
) VALUES (
  '10000000-0000-0000-0000-000000000801',
  '30000000-0000-0000-0000-000000000802',
  '00000000-0000-0000-0000-000000000801',
  'manager',
  '00000000-0000-0000-0000-000000000801'
);
INSERT INTO public.space_key_envelopes (
  space_id, epoch, recipient_device_id, wrapped_key, wrapping_nonce,
  algorithm, created_by_device_id
) VALUES (
  '30000000-0000-0000-0000-000000000802',
  1,
  '20000000-0000-0000-0000-000000000801',
  decode('23', 'hex'), decode('24', 'hex'), 'x25519-aesgcm',
  '20000000-0000-0000-0000-000000000801'
);
INSERT INTO public.space_sync_counters (space_id, last_sequence)
VALUES ('30000000-0000-0000-0000-000000000802', 0);
SET CONSTRAINTS ALL IMMEDIATE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
SET LOCAL ROLE authenticated;

-- Initial note revision (device sequence 1).
SELECT public.begin_revision_upload(
  '60000000-0000-0000-0000-000000000801',
  '50000000-0000-0000-0000-000000000801',
  '10000000-0000-0000-0000-000000000801',
  '30000000-0000-0000-0000-000000000801',
  '40000000-0000-0000-0000-000000000801',
  '20000000-0000-0000-0000-000000000801',
  1, 1, 1, digest('content-1', 'sha256')
);
INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
VALUES (
  'team-note-revisions',
  'spaces/30000000-0000-0000-0000-000000000801/notes/40000000-0000-0000-0000-000000000801/revisions/50000000-0000-0000-0000-000000000801.bin',
  '00000000-0000-0000-0000-000000000801',
  '{"size":1}'::jsonb
);
SELECT * FROM public.push_note_revision(
  '60000000-0000-0000-0000-000000000801', NULL, 1
);

-- Tombstone revision (device sequence 2).
SELECT public.begin_revision_upload(
  '60000000-0000-0000-0000-000000000802',
  '50000000-0000-0000-0000-000000000802',
  '10000000-0000-0000-0000-000000000801',
  '30000000-0000-0000-0000-000000000801',
  '40000000-0000-0000-0000-000000000801',
  '20000000-0000-0000-0000-000000000801',
  2, 1, 1, digest('content-tombstone', 'sha256'), 'tombstone'
);
INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
VALUES (
  'team-note-revisions',
  'spaces/30000000-0000-0000-0000-000000000801/notes/40000000-0000-0000-0000-000000000801/revisions/50000000-0000-0000-0000-000000000802.bin',
  '00000000-0000-0000-0000-000000000801',
  '{"size":1}'::jsonb
);
SELECT * FROM public.tombstone_note(
  '60000000-0000-0000-0000-000000000802',
  '50000000-0000-0000-0000-000000000801',
  1,
  now() + interval '30 days'
);
SELECT * FROM public.tombstone_note(
  '60000000-0000-0000-0000-000000000802',
  '50000000-0000-0000-0000-000000000801',
  1,
  now() + interval '30 days'
);

-- Restore revision (device sequence 3).
SELECT public.begin_revision_upload(
  '60000000-0000-0000-0000-000000000803',
  '50000000-0000-0000-0000-000000000803',
  '10000000-0000-0000-0000-000000000801',
  '30000000-0000-0000-0000-000000000801',
  '40000000-0000-0000-0000-000000000801',
  '20000000-0000-0000-0000-000000000801',
  3, 1, 1, digest('content-restore', 'sha256'), 'restore'
);
INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
VALUES (
  'team-note-revisions',
  'spaces/30000000-0000-0000-0000-000000000801/notes/40000000-0000-0000-0000-000000000801/revisions/50000000-0000-0000-0000-000000000803.bin',
  '00000000-0000-0000-0000-000000000801',
  '{"size":1}'::jsonb
);
SELECT * FROM public.restore_tombstoned_note(
  '60000000-0000-0000-0000-000000000803',
  '50000000-0000-0000-0000-000000000802',
  1
);
SELECT * FROM public.restore_tombstoned_note(
  '60000000-0000-0000-0000-000000000803',
  '50000000-0000-0000-0000-000000000802',
  1
);

-- Same-team move to target space (device sequence 4).
SELECT public.begin_revision_upload(
  '60000000-0000-0000-0000-000000000804',
  '50000000-0000-0000-0000-000000000804',
  '10000000-0000-0000-0000-000000000801',
  '30000000-0000-0000-0000-000000000802',
  '40000000-0000-0000-0000-000000000801',
  '20000000-0000-0000-0000-000000000801',
  4, 1, 1, digest('content-move', 'sha256'), 'move'
);
INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
VALUES (
  'team-note-revisions',
  'spaces/30000000-0000-0000-0000-000000000802/notes/40000000-0000-0000-0000-000000000801/revisions/50000000-0000-0000-0000-000000000804.bin',
  '00000000-0000-0000-0000-000000000801',
  '{"size":1}'::jsonb
);
SELECT * FROM public.move_note_to_space(
  '60000000-0000-0000-0000-000000000804',
  '50000000-0000-0000-0000-000000000803',
  1
);
SELECT * FROM public.move_note_to_space(
  '60000000-0000-0000-0000-000000000804',
  '50000000-0000-0000-0000-000000000803',
  1
);

RESET ROLE;

DO $$
BEGIN
  IF (
    SELECT status FROM public.notes
    WHERE id = '40000000-0000-0000-0000-000000000801'
  ) <> 'active' OR (
    SELECT space_id FROM public.notes
    WHERE id = '40000000-0000-0000-0000-000000000801'
  ) <> '30000000-0000-0000-0000-000000000802' THEN
    RAISE EXCEPTION 'CONTENT LIFECYCLE FAILED: final note state is wrong';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.note_tombstones
    WHERE note_id = '40000000-0000-0000-0000-000000000801'
      AND revision_id = '50000000-0000-0000-0000-000000000802'
      AND restored_by_revision_id = '50000000-0000-0000-0000-000000000803'
  ) THEN
    RAISE EXCEPTION 'TOMBSTONE/RESTORE HISTORY FAILED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.note_revisions
    WHERE id = '50000000-0000-0000-0000-000000000801'
      AND space_id = '30000000-0000-0000-0000-000000000801'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.note_revisions
    WHERE id = '50000000-0000-0000-0000-000000000804'
      AND space_id = '30000000-0000-0000-0000-000000000802'
  ) THEN
    RAISE EXCEPTION 'MOVE REVISION SCOPE FAILED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.note_space_transitions
    WHERE note_id = '40000000-0000-0000-0000-000000000801'
      AND source_action_sequence = 4
      AND target_action_sequence = 1
  ) THEN
    RAISE EXCEPTION 'MOVE ACTION SEQUENCES FAILED';
  END IF;

  IF (
    SELECT count(*) FROM public.sync_actions
    WHERE note_id = '40000000-0000-0000-0000-000000000801'
  ) <> 5 THEN
    RAISE EXCEPTION 'CONTENT ACTION COUNT FAILED';
  END IF;

  RAISE NOTICE 'TEAM NOTES CONTENT LIFECYCLE TESTS PASSED';
END $$;

ROLLBACK;

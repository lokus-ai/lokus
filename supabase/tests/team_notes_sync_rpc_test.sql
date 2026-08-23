-- =============================================================================
-- Team Notes V1 — upload, push, pull, conflict, and idempotency contracts
-- =============================================================================

BEGIN;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000401', 'sync-owner@example.test', now()),
  ('00000000-0000-0000-0000-000000000402', 'sync-outsider@example.test', now());

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000401',
  true
);
SET LOCAL ROLE authenticated;

SELECT public.register_device(
  '20000000-0000-0000-0000-000000000401',
  '21000000-0000-0000-0000-000000000401',
  decode('01', 'hex'),
  digest('sync-device-owner', 'sha256'),
  'x25519'
);

SELECT * FROM public.create_team(
  '10000000-0000-0000-0000-000000000401',
  '30000000-0000-0000-0000-000000000401',
  '31000000-0000-0000-0000-000000000401',
  'Sync Team',
  '20000000-0000-0000-0000-000000000401',
  decode('11', 'hex'), decode('12', 'hex'),
  decode('13', 'hex'), decode('14', 'hex'),
  decode('15', 'hex'), decode('16', 'hex'),
  decode('17', 'hex'), decode('18', 'hex'),
  'x25519-aesgcm'
);

DO $$
DECLARE
  v_object_key text;
BEGIN
  SELECT public.begin_revision_upload(
    '60000000-0000-0000-0000-000000000401',
    '50000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000401',
    '30000000-0000-0000-0000-000000000401',
    '40000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000401',
    1,
    1,
    1,
    digest('sync-ciphertext-1', 'sha256')
  ) INTO v_object_key;

  IF v_object_key <>
    'spaces/30000000-0000-0000-0000-000000000401/notes/40000000-0000-0000-0000-000000000401/revisions/50000000-0000-0000-0000-000000000401.bin' THEN
    RAISE EXCEPTION 'BEGIN UPLOAD KEY FAILED: %', v_object_key;
  END IF;
END $$;

INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
VALUES (
  'team-note-revisions',
  'spaces/30000000-0000-0000-0000-000000000401/notes/40000000-0000-0000-0000-000000000401/revisions/50000000-0000-0000-0000-000000000401.bin',
  '00000000-0000-0000-0000-000000000401',
  '{"size": 1}'::jsonb
);

DO $$
DECLARE
  v_result public.mutation_result;
  v_revision uuid;
  v_sequence bigint;
  v_head uuid;
BEGIN
  SELECT result.result, result.revision_id, result.action_sequence, result.current_head_id
    INTO v_result, v_revision, v_sequence, v_head
    FROM public.push_note_revision(
      '60000000-0000-0000-0000-000000000401',
      NULL,
      1
    ) result;

  IF v_result <> 'accepted'
     OR v_revision <> '50000000-0000-0000-0000-000000000401'
     OR v_sequence <> 1
     OR v_head <> v_revision THEN
    RAISE EXCEPTION 'PUSH ACCEPT FAILED: %, %, %, %',
      v_result, v_revision, v_sequence, v_head;
  END IF;

  -- Replay after pending-upload deletion returns the durable receipt.
  SELECT result.result, result.revision_id, result.action_sequence, result.current_head_id
    INTO v_result, v_revision, v_sequence, v_head
    FROM public.push_note_revision(
      '60000000-0000-0000-0000-000000000401',
      NULL,
      1
    ) result;

  IF v_result <> 'accepted' OR v_sequence <> 1 THEN
    RAISE EXCEPTION 'PUSH REPLAY FAILED: %, %', v_result, v_sequence;
  END IF;

  SELECT receipt.result, receipt.revision_id,
         receipt.action_sequence, receipt.current_head_id
    INTO v_result, v_revision, v_sequence, v_head
    FROM public.get_mutation_receipt(
      '20000000-0000-0000-0000-000000000401',
      '60000000-0000-0000-0000-000000000401'
    ) receipt;
  IF v_result <> 'accepted'
     OR v_revision <> '50000000-0000-0000-0000-000000000401'
     OR v_sequence <> 1 THEN
    RAISE EXCEPTION 'RECEIPT LOOKUP FAILED: %, %, %',
      v_result, v_revision, v_sequence;
  END IF;

  IF (
    SELECT count(*) FROM public.note_revisions
    WHERE note_id = '40000000-0000-0000-0000-000000000401'
  ) <> 1 THEN
    RAISE EXCEPTION 'PUSH IDEMPOTENCY FAILED: duplicate revision';
  END IF;
END $$;

DO $$
BEGIN
  IF public.get_device_sequence_high_water(
    '20000000-0000-0000-0000-000000000401'
  ) <> 1 THEN
    RAISE EXCEPTION 'DEVICE SEQUENCE HIGH-WATER FAILED';
  END IF;
END $$;

-- Cloud checkpoint reports are non-authoritative: pull still obeys since=0.
SELECT public.report_replica_checkpoint(
  '20000000-0000-0000-0000-000000000401',
  '30000000-0000-0000-0000-000000000401',
  1
);

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.pull_sync_actions(
      '20000000-0000-0000-0000-000000000401',
      '30000000-0000-0000-0000-000000000401',
      0,
      100
    )
  ) <> 1 THEN
    RAISE EXCEPTION 'PULL CURSOR FAILED: expected first action from since=0';
  END IF;
END $$;

RESET ROLE;
UPDATE public.devices
   SET status = 'revoked', revoked_at = now()
 WHERE id = '20000000-0000-0000-0000-000000000401';

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000401',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM public.pull_sync_actions(
      '20000000-0000-0000-0000-000000000401',
      '30000000-0000-0000-0000-000000000401',
      0,
      100
    );
    RAISE EXCEPTION 'DEVICE REVOCATION FAILED: revoked device pulled actions';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

RESET ROLE;
UPDATE public.devices
   SET status = 'active', revoked_at = NULL
 WHERE id = '20000000-0000-0000-0000-000000000401';

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000401',
  true
);
SET LOCAL ROLE authenticated;

-- Upload a second revision but push it against a stale/nonexistent head.
SELECT public.begin_revision_upload(
  '60000000-0000-0000-0000-000000000402',
  '50000000-0000-0000-0000-000000000402',
  '10000000-0000-0000-0000-000000000401',
  '30000000-0000-0000-0000-000000000401',
  '40000000-0000-0000-0000-000000000401',
  '20000000-0000-0000-0000-000000000401',
  2,
  1,
  1,
  digest('sync-ciphertext-2', 'sha256')
);

INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
VALUES (
  'team-note-revisions',
  'spaces/30000000-0000-0000-0000-000000000401/notes/40000000-0000-0000-0000-000000000401/revisions/50000000-0000-0000-0000-000000000402.bin',
  '00000000-0000-0000-0000-000000000401',
  '{"size": 1}'::jsonb
);

DO $$
DECLARE
  v_result public.mutation_result;
  v_revision uuid;
  v_sequence bigint;
  v_head uuid;
BEGIN
  SELECT result.result, result.revision_id, result.action_sequence, result.current_head_id
    INTO v_result, v_revision, v_sequence, v_head
    FROM public.push_note_revision(
      '60000000-0000-0000-0000-000000000402',
      '50000000-0000-0000-0000-000000000499',
      1
    ) result;

  IF v_result <> 'conflict'
     OR v_revision <> '50000000-0000-0000-0000-000000000401'
     OR v_sequence IS NOT NULL
     OR v_head <> '50000000-0000-0000-0000-000000000401' THEN
    RAISE EXCEPTION 'STALE HEAD CONFLICT FAILED: %, %, %, %',
      v_result, v_revision, v_sequence, v_head;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.note_revisions
    WHERE id = '50000000-0000-0000-0000-000000000402'
  ) THEN
    RAISE EXCEPTION 'CONFLICT FAILED: stale revision was committed';
  END IF;
END $$;

RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000402',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM public.pull_sync_actions(
      '20000000-0000-0000-0000-000000000401',
      '30000000-0000-0000-0000-000000000401',
      0,
      100
    );
    RAISE EXCEPTION 'PULL AUTH FAILED: outsider pull succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

RESET ROLE;
ROLLBACK;

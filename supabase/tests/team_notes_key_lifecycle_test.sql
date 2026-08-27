-- =============================================================================
-- Team Notes V1 — key provisioning and atomic member removal
-- =============================================================================

BEGIN;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000501', 'keys-owner@example.test', now()),
  ('00000000-0000-0000-0000-000000000502', 'keys-member@example.test', now());

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);
SET LOCAL ROLE authenticated;

SELECT public.register_device(
  '20000000-0000-0000-0000-000000000501',
  '21000000-0000-0000-0000-000000000501',
  decode('01', 'hex'), digest('keys-owner-device', 'sha256'), 'x25519'
);

SELECT * FROM public.create_team(
  '10000000-0000-0000-0000-000000000501',
  '30000000-0000-0000-0000-000000000501',
  '31000000-0000-0000-0000-000000000501',
  'Keys Team',
  '20000000-0000-0000-0000-000000000501',
  decode('11', 'hex'), decode('12', 'hex'),
  decode('13', 'hex'), decode('14', 'hex'),
  decode('15', 'hex'), decode('16', 'hex'),
  decode('17', 'hex'), decode('18', 'hex'),
  'x25519-aesgcm'
);

SELECT public.create_invite(
  '60000000-0000-0000-0000-000000000501',
  '10000000-0000-0000-0000-000000000501',
  'keys-member@example.test',
  digest('keys-invite', 'sha256'),
  'member',
  now() + interval '1 day',
  jsonb_build_array(
    jsonb_build_object(
      'space_id', '30000000-0000-0000-0000-000000000501',
      'role', 'editor'
    )
  )
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', true);
SET LOCAL ROLE authenticated;

SELECT public.register_device(
  '20000000-0000-0000-0000-000000000502',
  '21000000-0000-0000-0000-000000000502',
  decode('02', 'hex'), digest('keys-member-device', 'sha256'), 'x25519'
);

SELECT public.accept_invite(
  '60000000-0000-0000-0000-000000000501',
  'keys-invite',
  '20000000-0000-0000-0000-000000000502'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_status public.membership_status;
  v_plan jsonb;
BEGIN
  IF (
    SELECT count(*) FROM public.list_key_provisioning_targets(
      '10000000-0000-0000-0000-000000000501'
    )
  ) <> 1 THEN
    RAISE EXCEPTION 'PROVISIONING TARGET LIST FAILED';
  END IF;

  SELECT public.get_member_provisioning_key_plan(
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000502'
  ) INTO v_plan;
  IF v_plan ->> 'target_public_key_hex' <> '02'
     OR jsonb_array_length(v_plan -> 'spaces') <> 1 THEN
    RAISE EXCEPTION 'PROVISIONING PLAN FAILED: %', v_plan;
  END IF;

  SELECT public.provision_member_keys(
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000501',
    decode('21', 'hex'),
    decode('22', 'hex'),
    'x25519-aesgcm',
    jsonb_build_array(
      jsonb_build_object(
        'space_id', '30000000-0000-0000-0000-000000000501',
        'wrapped_key_hex', '23',
        'nonce_hex', '24',
        'algorithm', 'x25519-aesgcm'
      )
    )
  ) INTO v_status;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'PROVISION FAILED: expected active, got %', v_status;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.list_key_provisioning_targets(
      '10000000-0000-0000-0000-000000000501'
    )
  ) THEN
    RAISE EXCEPTION 'PROVISIONING TARGET WAS NOT CLEARED';
  END IF;

  BEGIN
    PERFORM public.remove_member(
      '10000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      '20000000-0000-0000-0000-000000000501',
      '[]'::jsonb,
      '[]'::jsonb
    );
    RAISE EXCEPTION 'ATOMIC REMOVAL FAILED: incomplete envelope bundle accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF (
    SELECT status FROM public.team_memberships
    WHERE team_id = '10000000-0000-0000-0000-000000000501'
      AND user_id = '00000000-0000-0000-0000-000000000502'
  ) <> 'active' THEN
    RAISE EXCEPTION 'ATOMIC REMOVAL FAILED: membership changed after rejected bundle';
  END IF;

  SELECT public.get_member_removal_key_plan(
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502'
  ) INTO v_plan;
  IF jsonb_array_length(v_plan -> 'team_recipients') <> 1
     OR jsonb_array_length(v_plan -> 'spaces') <> 1
     OR jsonb_array_length(v_plan -> 'spaces' -> 0 -> 'recipients') <> 1 THEN
    RAISE EXCEPTION 'REMOVAL PLAN FAILED: %', v_plan;
  END IF;

  SELECT public.remove_member(
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000501',
    jsonb_build_array(
      jsonb_build_object(
        'device_id', '20000000-0000-0000-0000-000000000501',
        'wrapped_key_hex', '31',
        'nonce_hex', '32',
        'algorithm', 'x25519-aesgcm'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'space_id', '30000000-0000-0000-0000-000000000501',
        'envelopes', jsonb_build_array(
          jsonb_build_object(
            'device_id', '20000000-0000-0000-0000-000000000501',
            'wrapped_key_hex', '33',
            'nonce_hex', '34',
            'algorithm', 'x25519-aesgcm'
          )
        )
      )
    )
  ) INTO v_status;

  IF v_status <> 'removed' THEN
    RAISE EXCEPTION 'REMOVE FAILED: expected removed, got %', v_status;
  END IF;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF (
    SELECT current_permission_epoch FROM public.teams
    WHERE id = '10000000-0000-0000-0000-000000000501'
  ) <> 2 OR (
    SELECT current_key_epoch FROM public.teams
    WHERE id = '10000000-0000-0000-0000-000000000501'
  ) <> 2 OR (
    SELECT current_key_epoch FROM public.spaces
    WHERE id = '30000000-0000-0000-0000-000000000501'
  ) <> 2 THEN
    RAISE EXCEPTION 'REMOVE EPOCH ADVANCE FAILED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_key_envelopes
    WHERE team_id = '10000000-0000-0000-0000-000000000501'
      AND epoch = 2
      AND recipient_device_id = '20000000-0000-0000-0000-000000000502'
  ) OR EXISTS (
    SELECT 1 FROM public.space_key_envelopes
    WHERE space_id = '30000000-0000-0000-0000-000000000501'
      AND epoch = 2
      AND recipient_device_id = '20000000-0000-0000-0000-000000000502'
  ) THEN
    RAISE EXCEPTION 'REMOVE FAILED: removed device received future keys';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.team_membership_realtime_hints
     WHERE team_id = '10000000-0000-0000-0000-000000000501'
       AND user_id = '00000000-0000-0000-0000-000000000502'
       AND membership_status = 'removed'
       AND permission_epoch = 2
       AND team_key_epoch = 2
  ) THEN
    RAISE EXCEPTION 'REVOCATION HINT FAILED: removed member did not receive final epochs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'team_membership_realtime_hints'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'space_sync_counters'
  ) THEN
    RAISE EXCEPTION 'REALTIME PUBLICATION FAILED';
  END IF;

  RAISE NOTICE 'TEAM NOTES KEY LIFECYCLE TESTS PASSED';
END $$;

SAVEPOINT key_history_provisioning;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);
SET LOCAL ROLE authenticated;
SELECT public.create_invite(
  '60000000-0000-0000-0000-000000000502',
  '10000000-0000-0000-0000-000000000501',
  'keys-member@example.test',
  digest('keys-history-invite', 'sha256'),
  'member',
  now() + interval '1 day',
  jsonb_build_array(
    jsonb_build_object(
      'space_id', '30000000-0000-0000-0000-000000000501',
      'role', 'editor'
    )
  )
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', true);
SET LOCAL ROLE authenticated;
SELECT public.accept_invite(
  '60000000-0000-0000-0000-000000000502',
  'keys-history-invite',
  '20000000-0000-0000-0000-000000000502'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_plan jsonb;
  v_status public.membership_status;
BEGIN
  SELECT public.get_member_key_history_plan(
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000502'
  ) INTO v_plan;
  IF jsonb_array_length(v_plan -> 'team_key_epochs') <> 2
     OR jsonb_array_length(v_plan -> 'spaces' -> 0 -> 'key_epochs') <> 2 THEN
    RAISE EXCEPTION 'KEY HISTORY PLAN FAILED: %', v_plan;
  END IF;

  SELECT public.provision_member_key_history(
    '10000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000501',
    jsonb_build_array(
      jsonb_build_object(
        'epoch', 1, 'wrapped_key_hex', '41', 'nonce_hex', '42',
        'algorithm', 'x25519-aesgcm'
      ),
      jsonb_build_object(
        'epoch', 2, 'wrapped_key_hex', '43', 'nonce_hex', '44',
        'algorithm', 'x25519-aesgcm'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'space_id', '30000000-0000-0000-0000-000000000501',
        'epoch', 1, 'wrapped_key_hex', '45', 'nonce_hex', '46',
        'algorithm', 'x25519-aesgcm'
      ),
      jsonb_build_object(
        'space_id', '30000000-0000-0000-0000-000000000501',
        'epoch', 2, 'wrapped_key_hex', '47', 'nonce_hex', '48',
        'algorithm', 'x25519-aesgcm'
      )
    )
  ) INTO v_status;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'KEY HISTORY PROVISION FAILED: %', v_status;
  END IF;
END $$;
RESET ROLE;

ROLLBACK TO SAVEPOINT key_history_provisioning;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF (
    SELECT count(*) FROM public.team_membership_realtime_hints
  ) <> 1 OR NOT EXISTS (
    SELECT 1
      FROM public.team_membership_realtime_hints
     WHERE user_id = '00000000-0000-0000-0000-000000000502'
       AND membership_status = 'removed'
  ) THEN
    RAISE EXCEPTION 'REVOCATION HINT RLS FAILED';
  END IF;
END $$;

RESET ROLE;

ROLLBACK;

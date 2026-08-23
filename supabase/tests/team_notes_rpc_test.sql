-- =============================================================================
-- Team Notes V1 — control-plane RPC contracts
-- =============================================================================

BEGIN;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000201', 'rpc-owner@example.test', now()),
  ('00000000-0000-0000-0000-000000000202', 'rpc-member@example.test', now()),
  ('00000000-0000-0000-0000-000000000203', 'rpc-outsider@example.test', now());

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000201',
  true
);
SELECT set_config('request.jwt.claim.email', 'rpc-owner@example.test', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_device uuid;
  v_team uuid;
  v_space uuid;
  v_group uuid;
  v_invite uuid;
BEGIN
  SELECT public.register_device(
    '20000000-0000-0000-0000-000000000201',
    '21000000-0000-0000-0000-000000000201',
    decode('01', 'hex'),
    digest('rpc-device-owner', 'sha256'),
    'x25519'
  ) INTO v_device;

  IF v_device <> '20000000-0000-0000-0000-000000000201' THEN
    RAISE EXCEPTION 'REGISTER DEVICE FAILED: got %', v_device;
  END IF;

  -- Exact replay is idempotent.
  PERFORM public.register_device(
    '20000000-0000-0000-0000-000000000201',
    '21000000-0000-0000-0000-000000000201',
    decode('01', 'hex'),
    digest('rpc-device-owner', 'sha256'),
    'x25519'
  );

  SELECT result.team_id, result.space_id, result.everyone_group_id
    INTO v_team, v_space, v_group
    FROM public.create_team(
      '10000000-0000-0000-0000-000000000201',
      '30000000-0000-0000-0000-000000000201',
      '31000000-0000-0000-0000-000000000201',
      'RPC Team',
      '20000000-0000-0000-0000-000000000201',
      decode('11', 'hex'),
      decode('12', 'hex'),
      decode('13', 'hex'),
      decode('14', 'hex'),
      decode('15', 'hex'),
      decode('16', 'hex'),
      decode('17', 'hex'),
      decode('18', 'hex'),
      'x25519-aesgcm'
    ) result;

  IF v_team <> '10000000-0000-0000-0000-000000000201'
     OR v_space <> '30000000-0000-0000-0000-000000000201'
     OR v_group <> '31000000-0000-0000-0000-000000000201' THEN
    RAISE EXCEPTION 'CREATE TEAM FAILED: %, %, %', v_team, v_space, v_group;
  END IF;

  -- Exact replay returns the same entities and cannot duplicate child rows.
  PERFORM public.create_team(
    '10000000-0000-0000-0000-000000000201',
    '30000000-0000-0000-0000-000000000201',
    '31000000-0000-0000-0000-000000000201',
    'RPC Team',
    '20000000-0000-0000-0000-000000000201',
    decode('11', 'hex'),
    decode('12', 'hex'),
    decode('13', 'hex'),
    decode('14', 'hex'),
    decode('15', 'hex'),
    decode('16', 'hex'),
    decode('17', 'hex'),
    decode('18', 'hex'),
    'x25519-aesgcm'
  );

  SELECT public.create_invite(
    '60000000-0000-0000-0000-000000000201',
    '10000000-0000-0000-0000-000000000201',
    'rpc-member@example.test',
    digest('invite-token', 'sha256'),
    'member',
    now() + interval '1 day',
    jsonb_build_array(
      jsonb_build_object(
        'space_id', '30000000-0000-0000-0000-000000000201',
        'role', 'editor'
      )
    )
  ) INTO v_invite;

  IF v_invite <> '60000000-0000-0000-0000-000000000201' THEN
    RAISE EXCEPTION 'CREATE INVITE FAILED: got %', v_invite;
  END IF;
END $$;

RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000202',
  true
);
SELECT set_config('request.jwt.claim.email', 'rpc-member@example.test', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_status public.membership_status;
BEGIN
  PERFORM public.register_device(
    '20000000-0000-0000-0000-000000000202',
    '21000000-0000-0000-0000-000000000202',
    decode('02', 'hex'),
    digest('rpc-device-member', 'sha256'),
    'x25519'
  );

  BEGIN
    PERFORM public.accept_invite(
      '60000000-0000-0000-0000-000000000201',
      'wrong-token',
      '20000000-0000-0000-0000-000000000202'
    );
    RAISE EXCEPTION 'ACCEPT INVITE FAILED: wrong bearer token accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT public.accept_invite(
    '60000000-0000-0000-0000-000000000201',
    'invite-token',
    '20000000-0000-0000-0000-000000000202'
  ) INTO v_status;

  IF v_status <> 'key_pending' THEN
    RAISE EXCEPTION 'ACCEPT INVITE FAILED: expected key_pending, got %', v_status;
  END IF;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF (
    SELECT count(*) FROM public.teams
    WHERE id = '10000000-0000-0000-0000-000000000201'
  ) <> 1 THEN
    RAISE EXCEPTION 'CREATE TEAM IDEMPOTENCY FAILED';
  END IF;

  IF (
    SELECT count(*) FROM public.team_groups
    WHERE team_id = '10000000-0000-0000-0000-000000000201'
      AND system_key = 'everyone'
  ) <> 1 THEN
    RAISE EXCEPTION 'EVERYONE GROUP IDEMPOTENCY FAILED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_memberships
    WHERE team_id = '10000000-0000-0000-0000-000000000201'
      AND user_id = '00000000-0000-0000-0000-000000000202'
      AND status = 'key_pending'
  ) THEN
    RAISE EXCEPTION 'ACCEPT INVITE MEMBERSHIP FAILED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.space_member_grants
    WHERE team_id = '10000000-0000-0000-0000-000000000201'
      AND space_id = '30000000-0000-0000-0000-000000000201'
      AND user_id = '00000000-0000-0000-0000-000000000202'
      AND role = 'editor'
  ) THEN
    RAISE EXCEPTION 'ACCEPT INVITE INITIAL GRANT FAILED';
  END IF;

  RAISE NOTICE 'TEAM NOTES CONTROL RPC TESTS PASSED';
END $$;

ROLLBACK;

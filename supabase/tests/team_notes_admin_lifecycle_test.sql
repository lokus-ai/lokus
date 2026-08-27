-- Ownership transfer and safe team/space archival.

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000701', 'admin-owner@example.test', now()),
  ('00000000-0000-0000-0000-000000000702', 'admin-successor@example.test', now());

INSERT INTO public.teams (
  id, name, created_by, current_permission_epoch, current_key_epoch
) VALUES (
  '10000000-0000-0000-0000-000000000701',
  'Admin Team',
  '00000000-0000-0000-0000-000000000701',
  1,
  1
);
INSERT INTO public.team_permission_epochs (team_id, epoch, reason_code, changed_by)
VALUES (
  '10000000-0000-0000-0000-000000000701', 1, 'team_created',
  '00000000-0000-0000-0000-000000000701'
);
INSERT INTO public.team_key_epochs (team_id, epoch, reason_code, created_by)
VALUES (
  '10000000-0000-0000-0000-000000000701', 1, 'team_created',
  '00000000-0000-0000-0000-000000000701'
);
INSERT INTO public.team_memberships (team_id, user_id, role, status)
VALUES
  (
    '10000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000701',
    'owner', 'active'
  ),
  (
    '10000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000702',
    'member', 'active'
  );
INSERT INTO public.devices (
  id, user_id, client_instance_id, public_key, public_key_fingerprint,
  key_algorithm, status
) VALUES
  (
    '20000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000701',
    '21000000-0000-0000-0000-000000000701',
    decode('01', 'hex'), digest('admin-device-1', 'sha256'), 'x25519', 'active'
  ),
  (
    '20000000-0000-0000-0000-000000000702',
    '00000000-0000-0000-0000-000000000702',
    '21000000-0000-0000-0000-000000000702',
    decode('02', 'hex'), digest('admin-device-2', 'sha256'), 'x25519', 'active'
  );
INSERT INTO public.spaces (
  id, team_id, kind, name_ciphertext, name_nonce, current_key_epoch, created_by
) VALUES (
  '30000000-0000-0000-0000-000000000701',
  '10000000-0000-0000-0000-000000000701',
  'team', decode('11', 'hex'), decode('12', 'hex'), 1,
  '00000000-0000-0000-0000-000000000701'
);
INSERT INTO public.space_key_epochs (space_id, epoch, reason, created_by)
VALUES (
  '30000000-0000-0000-0000-000000000701', 1, 'space_created',
  '00000000-0000-0000-0000-000000000701'
);
SET CONSTRAINTS ALL IMMEDIATE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
SET LOCAL ROLE authenticated;

SELECT public.transfer_ownership(
  '10000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000702',
  '20000000-0000-0000-0000-000000000701'
);

RESET ROLE;

DO $$
BEGIN
  IF (
    SELECT role FROM public.team_memberships
    WHERE team_id = '10000000-0000-0000-0000-000000000701'
      AND user_id = '00000000-0000-0000-0000-000000000701'
  ) <> 'admin' OR (
    SELECT role FROM public.team_memberships
    WHERE team_id = '10000000-0000-0000-0000-000000000701'
      AND user_id = '00000000-0000-0000-0000-000000000702'
  ) <> 'owner' THEN
    RAISE EXCEPTION 'OWNERSHIP TRANSFER FAILED';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);
SET LOCAL ROLE authenticated;

SELECT public.archive_space(
  '10000000-0000-0000-0000-000000000701',
  '30000000-0000-0000-0000-000000000701',
  '20000000-0000-0000-0000-000000000702',
  now() + interval '30 days'
);

SELECT public.restore_space(
  '10000000-0000-0000-0000-000000000701',
  '30000000-0000-0000-0000-000000000701',
  '20000000-0000-0000-0000-000000000702'
);

SELECT public.archive_team(
  '10000000-0000-0000-0000-000000000701',
  '20000000-0000-0000-0000-000000000702',
  now() + interval '30 days'
);

SELECT public.restore_team(
  '10000000-0000-0000-0000-000000000701',
  '20000000-0000-0000-0000-000000000702'
);

RESET ROLE;

DO $$
BEGIN
  IF NOT (
    SELECT deleted_at IS NULL FROM public.teams
    WHERE id = '10000000-0000-0000-0000-000000000701'
  ) OR NOT (
    SELECT deleted_at IS NULL FROM public.spaces
    WHERE id = '30000000-0000-0000-0000-000000000701'
  ) THEN
    RAISE EXCEPTION 'ARCHIVE/RESTORE FAILED';
  END IF;
  RAISE NOTICE 'TEAM NOTES ADMIN LIFECYCLE TESTS PASSED';
END $$;

ROLLBACK;

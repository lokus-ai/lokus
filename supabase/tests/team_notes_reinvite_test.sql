-- Active memberships cannot be modified by accepting a second invite.

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000601', 'reinvite-owner@example.test', now()),
  ('00000000-0000-0000-0000-000000000602', 'reinvite-member@example.test', now());

INSERT INTO public.teams (
  id, name, created_by, current_permission_epoch, current_key_epoch
) VALUES (
  '10000000-0000-0000-0000-000000000601',
  'Reinvite Team',
  '00000000-0000-0000-0000-000000000601',
  1,
  1
);
INSERT INTO public.team_permission_epochs (team_id, epoch, reason_code, changed_by)
VALUES (
  '10000000-0000-0000-0000-000000000601',
  1,
  'team_created',
  '00000000-0000-0000-0000-000000000601'
);
INSERT INTO public.team_key_epochs (team_id, epoch, reason_code, created_by)
VALUES (
  '10000000-0000-0000-0000-000000000601',
  1,
  'team_created',
  '00000000-0000-0000-0000-000000000601'
);
INSERT INTO public.team_memberships (team_id, user_id, role, status)
VALUES
  (
    '10000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000601',
    'owner',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000602',
    'admin',
    'active'
  );
INSERT INTO public.devices (
  id, user_id, client_instance_id, public_key, public_key_fingerprint,
  key_algorithm, status
) VALUES (
  '20000000-0000-0000-0000-000000000602',
  '00000000-0000-0000-0000-000000000602',
  '21000000-0000-0000-0000-000000000602',
  decode('01', 'hex'),
  digest('reinvite-device', 'sha256'),
  'x25519',
  'active'
);
SET CONSTRAINTS ALL IMMEDIATE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
SET LOCAL ROLE authenticated;
SELECT public.create_invite(
  '60000000-0000-0000-0000-000000000601',
  '10000000-0000-0000-0000-000000000601',
  'reinvite-member@example.test',
  digest('reinvite-token', 'sha256'),
  'member',
  now() + interval '1 day',
  '[]'::jsonb
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM public.accept_invite(
      '60000000-0000-0000-0000-000000000601',
      'reinvite-token',
      '20000000-0000-0000-0000-000000000602'
    );
    RAISE EXCEPTION 'REINVITE FAILED: active membership accepted a second invite';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF (
    SELECT role FROM public.team_memberships
    WHERE team_id = '10000000-0000-0000-0000-000000000601'
      AND user_id = '00000000-0000-0000-0000-000000000602'
  ) <> 'admin' THEN
    RAISE EXCEPTION 'REINVITE FAILED: active role changed';
  END IF;
END $$;

ROLLBACK;

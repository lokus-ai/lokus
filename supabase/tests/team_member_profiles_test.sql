BEGIN;

INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000961',
  'profile-fallback@example.test',
  now(),
  '{"full_name":"Profile Person","avatar_url":"https://example.test/avatar.png"}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id = '00000000-0000-0000-0000-000000000961'
       AND display_name = 'Profile Person'
       AND avatar_url = 'https://example.test/avatar.png'
  ) THEN
    RAISE EXCEPTION 'TEAM PROFILE FAILED: Auth insert did not create profile';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'private.ensure_auth_user_profile()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'TEAM PROFILE FAILED: private trigger is client-callable';
  END IF;
END
$$;

ROLLBACK;

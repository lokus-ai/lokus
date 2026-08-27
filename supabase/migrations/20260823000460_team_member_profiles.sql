-- Team Notes V1: ensure every Auth identity has a displayable collaboration profile.

SET search_path TO public, auth, pg_temp;

CREATE OR REPLACE FUNCTION private.ensure_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'Member'
    ),
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'picture'), '')
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_auth_user_profile()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ensure_auth_user_profile ON auth.users;
CREATE TRIGGER ensure_auth_user_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.ensure_auth_user_profile();

INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  auth_user.id,
  COALESCE(
    NULLIF(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
    NULLIF(split_part(auth_user.email, '@', 1), ''),
    'Member'
  ),
  COALESCE(
    NULLIF(btrim(auth_user.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(btrim(auth_user.raw_user_meta_data ->> 'picture'), '')
  )
FROM auth.users auth_user
ON CONFLICT (id) DO NOTHING;

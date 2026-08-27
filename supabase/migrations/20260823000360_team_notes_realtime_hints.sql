-- Team Notes V1: content-free sync and individualized revocation hints.

SET search_path TO public, auth, extensions;

CREATE TABLE public.team_membership_realtime_hints (
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  membership_status public.membership_status NOT NULL,
  membership_version bigint NOT NULL,
  permission_epoch bigint NOT NULL,
  team_key_epoch integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id, user_id)
    REFERENCES public.team_memberships(team_id, user_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.team_membership_realtime_hints IS
  'Content-free per-user membership/epoch poke. Local durable pull checkpoints remain authoritative.';

ALTER TABLE public.team_membership_realtime_hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_membership_realtime_hints FORCE ROW LEVEL SECURITY;
ALTER TABLE public.team_membership_realtime_hints REPLICA IDENTITY FULL;
ALTER TABLE public.space_sync_counters REPLICA IDENTITY FULL;

REVOKE ALL ON TABLE public.team_membership_realtime_hints FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.team_membership_realtime_hints TO authenticated;
GRANT ALL ON TABLE public.team_membership_realtime_hints TO service_role;

CREATE POLICY team_membership_realtime_hints_select_self
  ON public.team_membership_realtime_hints
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.refresh_membership_realtime_hint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.team_membership_realtime_hints (
    team_id, user_id, membership_status, membership_version,
    permission_epoch, team_key_epoch, updated_at
  )
  SELECT NEW.team_id, NEW.user_id, NEW.status, NEW.membership_version,
         team.current_permission_epoch, team.current_key_epoch, now()
    FROM public.teams team
   WHERE team.id = NEW.team_id
  ON CONFLICT (team_id, user_id) DO UPDATE
    SET membership_status = EXCLUDED.membership_status,
        membership_version = EXCLUDED.membership_version,
        permission_epoch = EXCLUDED.permission_epoch,
        team_key_epoch = EXCLUDED.team_key_epoch,
        updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_team_realtime_hints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.team_membership_realtime_hints
     SET permission_epoch = NEW.current_permission_epoch,
         team_key_epoch = NEW.current_key_epoch,
         updated_at = now()
   WHERE team_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_membership_realtime_hint() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.refresh_team_realtime_hints() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER refresh_membership_realtime_hint
AFTER INSERT OR UPDATE OF status, membership_version
ON public.team_memberships
FOR EACH ROW
EXECUTE FUNCTION private.refresh_membership_realtime_hint();

CREATE TRIGGER refresh_team_realtime_hints
AFTER UPDATE OF current_permission_epoch, current_key_epoch
ON public.teams
FOR EACH ROW
WHEN (
  OLD.current_permission_epoch IS DISTINCT FROM NEW.current_permission_epoch
  OR OLD.current_key_epoch IS DISTINCT FROM NEW.current_key_epoch
)
EXECUTE FUNCTION private.refresh_team_realtime_hints();

INSERT INTO public.team_membership_realtime_hints (
  team_id, user_id, membership_status, membership_version,
  permission_epoch, team_key_epoch, updated_at
)
SELECT membership.team_id, membership.user_id, membership.status,
       membership.membership_version, team.current_permission_epoch,
       team.current_key_epoch, now()
  FROM public.team_memberships membership
  JOIN public.teams team ON team.id = membership.team_id
ON CONFLICT (team_id, user_id) DO UPDATE
  SET membership_status = EXCLUDED.membership_status,
      membership_version = EXCLUDED.membership_version,
      permission_epoch = EXCLUDED.permission_epoch,
      team_key_epoch = EXCLUDED.team_key_epoch,
      updated_at = EXCLUDED.updated_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'team_membership_realtime_hints'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.team_membership_realtime_hints;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'space_sync_counters'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.space_sync_counters;
  END IF;
END
$$;

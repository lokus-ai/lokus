-- Ensure hosted cron permissions and cleanup secrets are complete on upgrades
-- that already recorded the earlier scheduler migrations.

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cron TO postgres;

DO $$
BEGIN
  IF (
    SELECT count(*)
      FROM vault.decrypted_secrets
     WHERE (
       name = 'lokus_project_url'
       AND decrypted_secret ~ '^https://[a-z0-9]+[.]supabase[.]co$'
     ) OR (
       name = 'lokus_team_cleanup_token'
       AND length(decrypted_secret) >= 32
     )
  ) <> 2 THEN
    RAISE EXCEPTION
      'team upload cleanup requires lokus_project_url and lokus_team_cleanup_token in Vault'
      USING ERRCODE = '55000';
  END IF;

  IF (
    SELECT count(*)
      FROM cron.job
     WHERE jobname = 'lokus-team-upload-cleanup'
       AND active
       AND command LIKE '%/functions/v1/team-upload-cleanup%'
       AND command LIKE '%lokus_team_cleanup_token%'
  ) <> 1 THEN
    RAISE EXCEPTION 'team upload cleanup schedule is not configured'
      USING ERRCODE = '55000';
  END IF;
END
$$;

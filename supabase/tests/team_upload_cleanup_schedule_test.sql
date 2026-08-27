BEGIN;

DO $$
BEGIN
  IF (
    SELECT count(*)
      FROM cron.job
     WHERE jobname = 'lokus-team-upload-cleanup'
       AND schedule = '*/15 * * * *'
       AND command LIKE '%/functions/v1/team-upload-cleanup%'
       AND command LIKE '%lokus_team_cleanup_token%'
       AND command NOT LIKE '%cleanup_expired_team_uploads%'
       AND command NOT LIKE '%authorization%'
       AND active
  ) <> 1 THEN
    RAISE EXCEPTION 'TEAM UPLOAD CLEANUP FAILED: scheduled job is missing';
  END IF;

  IF NOT has_schema_privilege('postgres', 'cron', 'USAGE')
     OR NOT has_table_privilege('postgres', 'cron.job', 'SELECT') THEN
    RAISE EXCEPTION
      'TEAM UPLOAD CLEANUP FAILED: postgres lacks cron schema privileges';
  END IF;

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
    RAISE EXCEPTION 'TEAM UPLOAD CLEANUP FAILED: Vault setup is incomplete';
  END IF;

  IF to_regprocedure(
    'public.cleanup_expired_team_uploads(integer)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION
      'TEAM UPLOAD CLEANUP FAILED: unsafe direct Storage cleanup remains';
  END IF;

  IF to_regclass('public.team_revision_deletion_queue') IS NULL
     OR to_regprocedure(
       'public.claim_team_revision_deletions(integer,integer)'
     ) IS NULL
     OR to_regprocedure(
       'public.complete_team_revision_deletions(uuid,uuid[])'
     ) IS NULL THEN
    RAISE EXCEPTION 'TEAM UPLOAD CLEANUP FAILED: durable queue RPCs are missing';
  END IF;

  IF has_table_privilege(
       'authenticated',
       'public.team_revision_deletion_queue',
       'SELECT'
     )
     OR has_function_privilege(
       'authenticated',
       'public.claim_team_revision_deletions(integer,integer)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.complete_team_revision_deletions(uuid,uuid[])',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'TEAM UPLOAD CLEANUP FAILED: client can access cleanup queue';
  END IF;
END
$$;

ROLLBACK;

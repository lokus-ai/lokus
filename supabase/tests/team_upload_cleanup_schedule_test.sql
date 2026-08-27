BEGIN;

DO $$
BEGIN
  IF (
    SELECT count(*)
      FROM cron.job
     WHERE jobname = 'lokus-team-upload-cleanup'
       AND schedule = '*/15 * * * *'
       AND command = 'SELECT public.cleanup_expired_team_uploads(500)'
       AND active
  ) <> 1 THEN
    RAISE EXCEPTION 'TEAM UPLOAD CLEANUP FAILED: scheduled job is missing';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.cleanup_expired_team_uploads(integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'TEAM UPLOAD CLEANUP FAILED: client can execute cleanup';
  END IF;
END
$$;

ROLLBACK;

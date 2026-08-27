-- Run the service-only orphan upload cleanup on a durable schedule.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  PERFORM cron.schedule(
    'lokus-team-upload-cleanup',
    '*/15 * * * *',
    'SELECT public.cleanup_expired_team_uploads(500)'
  );
END
$$;

-- Run the service-only orphan upload cleanup on a durable schedule.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cron TO postgres;

DO $$
BEGIN
  PERFORM cron.schedule(
    'lokus-team-upload-cleanup',
    '*/15 * * * *',
    'SELECT public.cleanup_expired_team_uploads(500)'
  );
END
$$;

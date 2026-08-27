-- Hosted Supabase forbids direct SQL deletion from storage.objects. Queue
-- deletion candidates atomically, then let an Edge Function use the Storage API.

CREATE TABLE IF NOT EXISTS public.team_revision_deletion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL,
  revision_id uuid NOT NULL,
  team_id uuid NOT NULL,
  space_id uuid NOT NULL,
  note_id uuid NOT NULL,
  object_key text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('expired', 'discarded')),
  claim_token uuid,
  claim_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  delete_passes integer NOT NULL DEFAULT 0 CHECK (delete_passes >= 0),
  next_attempt_at timestamptz NOT NULL
    DEFAULT (clock_timestamp() + interval '15 minutes'),
  retain_until timestamptz NOT NULL
    DEFAULT (clock_timestamp() + interval '30 days'),
  queued_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_revision_deletion_queue
  ADD COLUMN IF NOT EXISTS delete_passes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS retain_until timestamptz;
UPDATE public.team_revision_deletion_queue
   SET delete_passes = COALESCE(delete_passes, 0),
       next_attempt_at = COALESCE(
         next_attempt_at,
         clock_timestamp() + interval '15 minutes'
       ),
       retain_until = COALESCE(
         retain_until,
         clock_timestamp() + interval '30 days'
       );
ALTER TABLE public.team_revision_deletion_queue
  DROP CONSTRAINT IF EXISTS team_revision_deletion_queue_op_id_key,
  DROP CONSTRAINT IF EXISTS team_revision_deletion_queue_revision_id_key,
  DROP CONSTRAINT IF EXISTS team_revision_deletion_queue_delete_passes_check;
ALTER TABLE public.team_revision_deletion_queue
  ALTER COLUMN delete_passes SET DEFAULT 0,
  ALTER COLUMN delete_passes SET NOT NULL,
  ALTER COLUMN next_attempt_at
    SET DEFAULT (clock_timestamp() + interval '15 minutes'),
  ALTER COLUMN next_attempt_at SET NOT NULL,
  ALTER COLUMN retain_until
    SET DEFAULT (clock_timestamp() + interval '30 days'),
  ALTER COLUMN retain_until SET NOT NULL,
  ADD CONSTRAINT team_revision_deletion_queue_delete_passes_check
    CHECK (delete_passes >= 0);

ALTER TABLE public.team_revision_deletion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_revision_deletion_queue FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_revision_deletion_queue
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.team_revision_deletion_queue TO service_role;

CREATE INDEX IF NOT EXISTS team_revision_deletion_queue_claim_idx
  ON public.team_revision_deletion_queue (
    next_attempt_at,
    claim_expires_at,
    queued_at,
    id
  );
CREATE INDEX IF NOT EXISTS pending_revision_uploads_cleanup_idx
  ON public.pending_revision_uploads (expires_at, op_id);
CREATE INDEX IF NOT EXISTS team_revision_deletion_queue_op_idx
  ON public.team_revision_deletion_queue (op_id);
CREATE INDEX IF NOT EXISTS team_revision_deletion_queue_revision_idx
  ON public.team_revision_deletion_queue (revision_id);

CREATE OR REPLACE FUNCTION private.queue_uncommitted_revision_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Accepted revisions insert note_revisions before deleting their pending row.
  -- Never queue an object that durable history references.
  IF EXISTS (
    SELECT 1
      FROM public.note_revisions revision
     WHERE revision.object_key = OLD.object_key
  ) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.team_revision_deletion_queue (
    op_id, revision_id, team_id, space_id, note_id, object_key, reason,
    next_attempt_at
  ) VALUES (
    OLD.op_id,
    OLD.revision_id,
    OLD.team_id,
    OLD.space_id,
    OLD.note_id,
    OLD.object_key,
    CASE
      WHEN OLD.expires_at <= clock_timestamp() THEN 'expired'
      ELSE 'discarded'
    END,
    clock_timestamp() + interval '15 minutes'
  )
  ON CONFLICT (object_key) DO NOTHING;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.queue_uncommitted_revision_object()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS queue_uncommitted_revision_object
  ON public.pending_revision_uploads;
CREATE TRIGGER queue_uncommitted_revision_object
BEFORE DELETE ON public.pending_revision_uploads
FOR EACH ROW
EXECUTE FUNCTION private.queue_uncommitted_revision_object();

CREATE OR REPLACE FUNCTION private.guard_revision_upload_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.note_revisions revision
     WHERE revision.id = NEW.revision_id
        OR revision.object_key = NEW.object_key
  ) THEN
    RAISE EXCEPTION 'revision id or object key is already finalized'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.team_revision_deletion_queue queue
     WHERE queue.revision_id = NEW.revision_id
        OR queue.object_key = NEW.object_key
  ) THEN
    RAISE EXCEPTION 'revision object deletion is still pending'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_revision_commit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.team_revision_deletion_queue queue
     WHERE queue.revision_id = NEW.id
        OR queue.object_key = NEW.object_key
  ) THEN
    RAISE EXCEPTION 'revision object deletion is still pending'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_revision_upload_reservation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_revision_commit()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_revision_upload_reservation
  ON public.pending_revision_uploads;
CREATE TRIGGER guard_revision_upload_reservation
BEFORE INSERT ON public.pending_revision_uploads
FOR EACH ROW
EXECUTE FUNCTION private.guard_revision_upload_reservation();

DROP TRIGGER IF EXISTS guard_revision_commit
  ON public.note_revisions;
CREATE TRIGGER guard_revision_commit
BEFORE INSERT ON public.note_revisions
FOR EACH ROW
EXECUTE FUNCTION private.guard_revision_commit();

CREATE OR REPLACE FUNCTION public.begin_revision_upload(
  p_op_id uuid,
  p_revision_id uuid,
  p_team_id uuid,
  p_space_id uuid,
  p_note_id uuid,
  p_device_id uuid,
  p_client_sequence bigint,
  p_key_epoch integer,
  p_ciphertext_size bigint,
  p_ciphertext_sha256 bytea,
  p_operation_kind public.revision_operation DEFAULT 'write'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_revision_id uuid := p_revision_id;
  v_object_key text;
  v_pending public.pending_revision_uploads%ROWTYPE;
  v_note public.notes%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_operation_kind IS NULL
     OR p_client_sequence <= 0
     OR p_ciphertext_size < 0
     OR length(p_ciphertext_sha256) = 0 THEN
    RAISE EXCEPTION 'invalid ciphertext metadata' USING ERRCODE = '22023';
  END IF;
  IF NOT private.owns_device(p_device_id, v_actor)
     OR EXISTS (
       SELECT 1 FROM public.devices
        WHERE id = p_device_id AND status <> 'active'
     ) THEN
    RAISE EXCEPTION 'active owned device required' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_space_role(p_space_id, 'editor', v_actor) THEN
    RAISE EXCEPTION 'space editor role required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.spaces space
     WHERE space.id = p_space_id
       AND space.team_id = p_team_id
       AND space.current_key_epoch = p_key_epoch
       AND space.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid team, space, or key epoch' USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_note FROM public.notes WHERE id = p_note_id;
  IF FOUND THEN
    IF v_note.team_id <> p_team_id THEN
      RAISE EXCEPTION 'note belongs to another team' USING ERRCODE = '42501';
    END IF;
    IF p_operation_kind IN ('write', 'tombstone')
       AND (v_note.space_id <> p_space_id OR v_note.status <> 'active') THEN
      RAISE EXCEPTION 'note is not active in target space' USING ERRCODE = '42501';
    ELSIF p_operation_kind = 'restore'
       AND (v_note.space_id <> p_space_id OR v_note.status <> 'tombstoned') THEN
      RAISE EXCEPTION 'note is not tombstoned in target space' USING ERRCODE = '42501';
    ELSIF p_operation_kind = 'move'
       AND (
         v_note.space_id = p_space_id
         OR v_note.status <> 'active'
         OR NOT private.has_space_role(v_note.space_id, 'manager', v_actor)
       ) THEN
      RAISE EXCEPTION 'note move is not authorized' USING ERRCODE = '42501';
    END IF;
  ELSIF p_operation_kind <> 'write' THEN
    RAISE EXCEPTION 'only write may reserve a new note id' USING ERRCODE = '22023';
  END IF;

  -- The operation id remains stable across an expired upload. If a prior
  -- object is still under deletion retention, allocate a fresh revision/object
  -- identity while preserving the operation receipt and client sequence.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('pending-operation:' || p_op_id::text, 0)
  );
  SELECT * INTO v_pending
    FROM public.pending_revision_uploads
   WHERE op_id = p_op_id
   FOR UPDATE;
  IF FOUND THEN
    IF v_pending.team_id <> p_team_id
       OR v_pending.space_id <> p_space_id
       OR v_pending.note_id <> p_note_id
       OR v_pending.actor_user_id <> v_actor
       OR v_pending.actor_device_id <> p_device_id
       OR v_pending.client_sequence <> p_client_sequence
       OR v_pending.operation_kind <> p_operation_kind
       OR v_pending.key_epoch <> p_key_epoch
       OR v_pending.ciphertext_size <> p_ciphertext_size
       OR v_pending.ciphertext_sha256 <> p_ciphertext_sha256 THEN
      RAISE EXCEPTION 'operation id is already reserved differently'
        USING ERRCODE = '23505';
    END IF;
    IF v_pending.expires_at > clock_timestamp() THEN
      RETURN v_pending.object_key;
    END IF;
    DELETE FROM public.pending_revision_uploads
     WHERE op_id = p_op_id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.mutation_receipts receipt
      JOIN public.devices device ON device.id = receipt.actor_device_id
     WHERE receipt.op_id = p_op_id
       AND device.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'operation is already finalized' USING ERRCODE = '23505';
  END IF;

  LOOP
    v_object_key := format(
      'spaces/%s/notes/%s/revisions/%s.bin',
      p_space_id,
      p_note_id,
      v_revision_id
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1
        FROM public.pending_revision_uploads pending
       WHERE pending.revision_id = v_revision_id
          OR pending.object_key = v_object_key
    ) AND NOT EXISTS (
      SELECT 1
        FROM public.note_revisions revision
       WHERE revision.id = v_revision_id
          OR revision.object_key = v_object_key
    ) AND NOT EXISTS (
      SELECT 1
        FROM public.team_revision_deletion_queue queue
       WHERE queue.revision_id = v_revision_id
          OR queue.object_key = v_object_key
    );
    v_revision_id := gen_random_uuid();
  END LOOP;

  INSERT INTO public.pending_revision_uploads (
    op_id, revision_id, team_id, note_id, space_id,
    actor_user_id, actor_device_id, client_sequence, operation_kind,
    key_epoch, object_key,
    ciphertext_size, ciphertext_sha256, expires_at
  ) VALUES (
    p_op_id, v_revision_id, p_team_id, p_note_id, p_space_id,
    v_actor, p_device_id, p_client_sequence, p_operation_kind,
    p_key_epoch, v_object_key,
    p_ciphertext_size, p_ciphertext_sha256,
    clock_timestamp() + interval '15 minutes'
  );

  RETURN v_object_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_team_revision_deletions(
  p_limit integer DEFAULT 100,
  p_lease_seconds integer DEFAULT 120
)
RETURNS TABLE (
  queue_id uuid,
  object_key text,
  claim_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claim_token uuid := gen_random_uuid();
BEGIN
  IF p_limit < 1 OR p_limit > 500
     OR p_lease_seconds < 30 OR p_lease_seconds > 900 THEN
    RAISE EXCEPTION 'invalid deletion claim limits'
      USING ERRCODE = '22023';
  END IF;

  -- Locking the pending row makes expiry cleanup mutually exclusive with every
  -- finalizer, which also takes FOR UPDATE on this row.
  WITH expired AS (
    SELECT pending.op_id
      FROM public.pending_revision_uploads pending
     WHERE pending.expires_at <= clock_timestamp()
     ORDER BY pending.expires_at, pending.op_id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.pending_revision_uploads pending
   USING expired
   WHERE pending.op_id = expired.op_id;

  RETURN QUERY
  WITH candidates AS (
    SELECT queue.id
      FROM public.team_revision_deletion_queue queue
     WHERE queue.next_attempt_at <= clock_timestamp()
       AND (
         queue.claim_token IS NULL
         OR queue.claim_expires_at <= clock_timestamp()
       )
     ORDER BY queue.queued_at, queue.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.team_revision_deletion_queue queue
       SET claim_token = v_claim_token,
           claim_expires_at =
             clock_timestamp() + make_interval(secs => p_lease_seconds),
           attempts = queue.attempts + 1
      FROM candidates
     WHERE queue.id = candidates.id
     RETURNING queue.id, queue.object_key
  )
  SELECT claimed.id, claimed.object_key, v_claim_token
    FROM claimed
   ORDER BY claimed.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_team_revision_deletions(
  p_claim_token uuid,
  p_queue_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_processed integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_claim_token IS NULL
     OR p_queue_ids IS NULL
     OR cardinality(p_queue_ids) < 1
     OR cardinality(p_queue_ids) > 500 THEN
    RAISE EXCEPTION 'invalid deletion acknowledgement'
      USING ERRCODE = '22023';
  END IF;

  WITH matching AS MATERIALIZED (
    SELECT queue.id, queue.delete_passes, queue.retain_until
      FROM public.team_revision_deletion_queue queue
     WHERE queue.id = ANY(p_queue_ids)
       AND queue.claim_token = p_claim_token
     FOR UPDATE
  ),
  deferred AS (
    UPDATE public.team_revision_deletion_queue queue
       SET delete_passes = queue.delete_passes + 1,
           claim_token = NULL,
           claim_expires_at = NULL,
           next_attempt_at = CASE
             WHEN matching.delete_passes = 0
               THEN v_now + interval '15 minutes'
             ELSE LEAST(
               matching.retain_until,
               v_now + interval '1 day'
             )
           END
      FROM matching
     WHERE queue.id = matching.id
       AND (
         matching.delete_passes = 0
         OR v_now < matching.retain_until
       )
     RETURNING queue.id
  ),
  deleted AS (
    DELETE FROM public.team_revision_deletion_queue queue
     USING matching
     WHERE queue.id = matching.id
       AND matching.delete_passes > 0
       AND v_now >= matching.retain_until
     RETURNING queue.id
  )
  SELECT (
    (SELECT count(*) FROM deferred)
    + (SELECT count(*) FROM deleted)
  )::integer INTO v_processed;
  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_team_revision_deletions(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_team_revision_deletions(uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_team_revision_deletions(integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_team_revision_deletions(uuid, uuid[])
  TO service_role;

DROP FUNCTION IF EXISTS public.cleanup_expired_team_uploads(integer);

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $migration$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
    FROM cron.job
   WHERE jobname = 'lokus-team-upload-cleanup';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'lokus-team-upload-cleanup',
    '*/15 * * * *',
    $request$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret
            FROM vault.decrypted_secrets
           WHERE name = 'lokus_project_url'
        ) || '/functions/v1/team-upload-cleanup',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-lokus-cleanup-token', (
            SELECT decrypted_secret
              FROM vault.decrypted_secrets
             WHERE name = 'lokus_team_cleanup_token'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      )
    $request$
  );
END
$migration$;

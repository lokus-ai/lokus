-- Team Notes V1: immutable revision upload, idempotent push, and ordered pull.

SET search_path TO public, auth, storage, extensions;

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

  v_object_key := format(
    'spaces/%s/notes/%s/revisions/%s.bin',
    p_space_id,
    p_note_id,
    p_revision_id
  );

  SELECT * INTO v_pending
    FROM public.pending_revision_uploads
   WHERE op_id = p_op_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_pending.revision_id <> p_revision_id
       OR v_pending.team_id <> p_team_id
       OR v_pending.space_id <> p_space_id
       OR v_pending.note_id <> p_note_id
       OR v_pending.actor_user_id <> v_actor
       OR v_pending.actor_device_id <> p_device_id
       OR v_pending.client_sequence <> p_client_sequence
       OR v_pending.operation_kind <> p_operation_kind
       OR v_pending.key_epoch <> p_key_epoch
       OR v_pending.object_key <> v_object_key
       OR v_pending.ciphertext_size <> p_ciphertext_size
       OR v_pending.ciphertext_sha256 <> p_ciphertext_sha256 THEN
      RAISE EXCEPTION 'operation id is already reserved differently'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_object_key;
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

  INSERT INTO public.pending_revision_uploads (
    op_id, revision_id, team_id, note_id, space_id,
    actor_user_id, actor_device_id, client_sequence, operation_kind,
    key_epoch, object_key,
    ciphertext_size, ciphertext_sha256, expires_at
  ) VALUES (
    p_op_id, p_revision_id, p_team_id, p_note_id, p_space_id,
    v_actor, p_device_id, p_client_sequence, p_operation_kind,
    p_key_epoch, v_object_key,
    p_ciphertext_size, p_ciphertext_sha256, now() + interval '15 minutes'
  );

  RETURN v_object_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_note_revision(
  p_op_id uuid,
  p_expected_head_id uuid,
  p_codec_version integer
)
RETURNS TABLE (
  result public.mutation_result,
  revision_id uuid,
  action_sequence bigint,
  current_head_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_pending public.pending_revision_uploads%ROWTYPE;
  v_receipt public.mutation_receipts%ROWTYPE;
  v_note public.notes%ROWTYPE;
  v_current_head uuid;
  v_head_version bigint := 0;
  v_sequence bigint;
  v_permission_epoch bigint;
  v_action_type public.sync_action_type;
  v_object_size bigint;
  v_is_new boolean := false;
  v_last_client_sequence bigint;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_codec_version <= 0 THEN
    RAISE EXCEPTION 'invalid codec version' USING ERRCODE = '22023';
  END IF;

  SELECT receipt.* INTO v_receipt
    FROM public.mutation_receipts receipt
    JOIN public.devices device ON device.id = receipt.actor_device_id
   WHERE receipt.op_id = p_op_id
     AND device.user_id = v_actor
   FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY
    SELECT v_receipt.result,
           v_receipt.result_revision_id,
           v_receipt.result_action_sequence,
           v_receipt.result_revision_id;
    RETURN;
  END IF;

  SELECT * INTO v_pending
    FROM public.pending_revision_uploads pending
   WHERE pending.op_id = p_op_id
   FOR UPDATE;

  IF NOT FOUND THEN
    -- A concurrent retry can pass the first receipt lookup, block on the
    -- pending row, then wake after the winner committed and deleted it.
    SELECT receipt.* INTO v_receipt
      FROM public.mutation_receipts receipt
      JOIN public.devices device ON device.id = receipt.actor_device_id
     WHERE receipt.op_id = p_op_id
       AND device.user_id = v_actor;
    IF FOUND THEN
      RETURN QUERY
      SELECT v_receipt.result,
             v_receipt.result_revision_id,
             v_receipt.result_action_sequence,
             v_receipt.result_revision_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'pending upload not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_pending.actor_user_id <> v_actor
     OR NOT private.owns_device(v_pending.actor_device_id, v_actor)
     OR EXISTS (
       SELECT 1 FROM public.devices
       WHERE id = v_pending.actor_device_id AND status <> 'active'
     )
     OR v_pending.expires_at <= now()
     OR NOT private.has_space_role(v_pending.space_id, 'editor', v_actor) THEN
    RAISE EXCEPTION 'pending upload is no longer authorized'
      USING ERRCODE = '42501';
  END IF;
  IF v_pending.operation_kind <> 'write' THEN
    RAISE EXCEPTION 'pending operation requires its lifecycle RPC'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('space:' || v_pending.space_id::text, 0)
  );

  SELECT team.current_permission_epoch INTO v_permission_epoch
    FROM public.teams team
    JOIN public.spaces space
      ON space.team_id = team.id
     AND space.id = v_pending.space_id
   WHERE team.id = v_pending.team_id
     AND team.deleted_at IS NULL
     AND space.deleted_at IS NULL
     AND space.current_key_epoch = v_pending.key_epoch;

  IF v_permission_epoch IS NULL THEN
    RAISE EXCEPTION 'team, space, or key epoch is stale'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(max(receipt.client_sequence), 0)
    INTO v_last_client_sequence
    FROM public.mutation_receipts receipt
   WHERE receipt.actor_device_id = v_pending.actor_device_id;

  IF v_pending.client_sequence > v_last_client_sequence + 1 THEN
    RETURN QUERY SELECT
      'retry_predecessor'::public.mutation_result,
      NULL::uuid,
      NULL::bigint,
      NULL::uuid;
    RETURN;
  ELSIF v_pending.client_sequence <= v_last_client_sequence THEN
    RAISE EXCEPTION 'client sequence is already finalized'
      USING ERRCODE = '23505';
  END IF;

  SELECT NULLIF(object.metadata ->> 'size', '')::bigint INTO v_object_size
    FROM storage.objects object
   WHERE object.bucket_id = 'team-note-revisions'
     AND object.name = v_pending.object_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ciphertext object not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_object_size IS NOT NULL AND v_object_size <> v_pending.ciphertext_size THEN
    RAISE EXCEPTION 'ciphertext size mismatch' USING ERRCODE = '22000';
  END IF;

  -- Serializes both first creation and later revisions for one stable note ID.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pending.note_id::text, 0));

  SELECT * INTO v_note
    FROM public.notes note
   WHERE note.id = v_pending.note_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_note.team_id <> v_pending.team_id
       OR v_note.space_id <> v_pending.space_id
       OR v_note.status <> 'active' THEN
      RAISE EXCEPTION 'note is not writable in pending space'
        USING ERRCODE = '42501';
    END IF;
    SELECT head.revision_id, head.head_version
      INTO v_current_head, v_head_version
      FROM public.note_heads head
     WHERE head.note_id = v_pending.note_id
     FOR UPDATE;
  ELSE
    v_is_new := true;
    v_current_head := NULL;
  END IF;

  IF v_current_head IS DISTINCT FROM p_expected_head_id THEN
    INSERT INTO public.mutation_receipts (
      actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
      result, result_revision_id, error_code
    ) VALUES (
      v_pending.actor_device_id, p_op_id, v_pending.client_sequence, v_pending.team_id,
      v_pending.space_id, v_pending.note_id, 'conflict',
      v_current_head, 'stale_head'
    );
    DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;
    RETURN QUERY SELECT
      'conflict'::public.mutation_result,
      v_current_head,
      NULL::bigint,
      v_current_head;
    RETURN;
  END IF;

  IF v_is_new THEN
    INSERT INTO public.notes (
      id, team_id, space_id, created_by, status, schema_version
    ) VALUES (
      v_pending.note_id, v_pending.team_id, v_pending.space_id,
      v_actor, 'active', 1
    );
    v_action_type := 'note_created';
  ELSE
    v_action_type := 'revision_accepted';
  END IF;

  INSERT INTO public.note_revisions (
    id, team_id, space_id, note_id, base_revision_id, previous_head_id,
    author_user_id, author_device_id, key_epoch, codec_version,
    object_key, ciphertext_size, ciphertext_sha256
  ) VALUES (
    v_pending.revision_id, v_pending.team_id, v_pending.space_id,
    v_pending.note_id, p_expected_head_id, v_current_head,
    v_actor, v_pending.actor_device_id, v_pending.key_epoch, p_codec_version,
    v_pending.object_key, v_pending.ciphertext_size, v_pending.ciphertext_sha256
  );

  INSERT INTO public.note_heads (note_id, revision_id, head_version)
  VALUES (v_pending.note_id, v_pending.revision_id, v_head_version + 1)
  ON CONFLICT (note_id) DO UPDATE
    SET revision_id = EXCLUDED.revision_id,
        head_version = EXCLUDED.head_version,
        updated_at = now();

  UPDATE public.space_sync_counters
     SET last_sequence = last_sequence + 1
   WHERE space_id = v_pending.space_id
  RETURNING last_sequence INTO v_sequence;

  IF v_sequence IS NULL THEN
    RAISE EXCEPTION 'space sync counter missing' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.sync_actions (
    space_id, team_id, sequence, action_type, note_id, revision_id,
    actor_user_id, actor_device_id, op_id, permission_epoch
  ) VALUES (
    v_pending.space_id, v_pending.team_id, v_sequence, v_action_type,
    v_pending.note_id, v_pending.revision_id, v_actor,
    v_pending.actor_device_id, p_op_id, v_permission_epoch
  );

  INSERT INTO public.mutation_receipts (
    actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
    result, result_revision_id, result_action_sequence
  ) VALUES (
    v_pending.actor_device_id, p_op_id, v_pending.client_sequence, v_pending.team_id,
    v_pending.space_id, v_pending.note_id, 'accepted',
    v_pending.revision_id, v_sequence
  );

  DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;

  RETURN QUERY SELECT
    'accepted'::public.mutation_result,
    v_pending.revision_id,
    v_sequence,
    v_pending.revision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pull_sync_actions(
  p_device_id uuid,
  p_space_id uuid,
  p_since_sequence bigint,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  action_id uuid,
  action_sequence bigint,
  action_type public.sync_action_type,
  note_id uuid,
  revision_id uuid,
  actor_user_id uuid,
  permission_epoch bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT private.owns_device(p_device_id)
     OR EXISTS (
       SELECT 1 FROM public.devices
       WHERE id = p_device_id AND status <> 'active'
     ) THEN
    RAISE EXCEPTION 'active owned device required' USING ERRCODE = '42501';
  END IF;
  IF p_since_sequence < 0 OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid pull cursor or limit' USING ERRCODE = '22023';
  END IF;
  IF NOT private.has_space_role(p_space_id, 'reader') THEN
    RAISE EXCEPTION 'space reader role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT action.id,
         action.sequence,
         action.action_type,
         action.note_id,
         action.revision_id,
         action.actor_user_id,
         action.permission_epoch,
         action.created_at
    FROM public.sync_actions action
   WHERE action.space_id = p_space_id
     AND action.sequence > p_since_sequence
   ORDER BY action.sequence
   LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_replica_checkpoint(
  p_device_id uuid,
  p_space_id uuid,
  p_last_applied_sequence bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_max_sequence bigint;
  v_reported bigint;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.owns_device(p_device_id)
     OR EXISTS (
       SELECT 1 FROM public.devices
       WHERE id = p_device_id AND status <> 'active'
     )
     OR NOT private.has_space_role(p_space_id, 'reader') THEN
    RAISE EXCEPTION 'checkpoint report is not authorized'
      USING ERRCODE = '42501';
  END IF;
  IF p_last_applied_sequence < 0 THEN
    RAISE EXCEPTION 'invalid checkpoint' USING ERRCODE = '22023';
  END IF;

  SELECT last_sequence INTO v_max_sequence
    FROM public.space_sync_counters
   WHERE space_id = p_space_id;

  IF v_max_sequence IS NULL OR p_last_applied_sequence > v_max_sequence THEN
    RAISE EXCEPTION 'checkpoint exceeds committed sequence'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.replica_checkpoint_observations (
    device_id, space_id, reported_applied_sequence, reported_at, updated_at
  ) VALUES (
    p_device_id, p_space_id, p_last_applied_sequence, now(), now()
  )
  ON CONFLICT (device_id, space_id) DO UPDATE
    SET reported_applied_sequence = GREATEST(
          public.replica_checkpoint_observations.reported_applied_sequence,
          EXCLUDED.reported_applied_sequence
        ),
        reported_at = now(),
        updated_at = now()
  RETURNING reported_applied_sequence INTO v_reported;

  RETURN v_reported;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_revision_upload(
  uuid, uuid, uuid, uuid, uuid, uuid, bigint, integer, bigint, bytea,
  public.revision_operation
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_note_revision(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pull_sync_actions(uuid, uuid, bigint, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_replica_checkpoint(uuid, uuid, bigint) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.begin_revision_upload(
  uuid, uuid, uuid, uuid, uuid, uuid, bigint, integer, bigint, bytea,
  public.revision_operation
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_note_revision(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pull_sync_actions(uuid, uuid, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_replica_checkpoint(uuid, uuid, bigint) TO authenticated;

-- Team Notes V1: explicit tombstone/restore and same-team move operations.

SET search_path TO public, auth, storage, extensions;

CREATE OR REPLACE FUNCTION private.claim_pending_revision(
  p_op_id uuid,
  p_operation_kind public.revision_operation
)
RETURNS public.pending_revision_uploads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_pending public.pending_revision_uploads%ROWTYPE;
  v_object_size bigint;
BEGIN
  SELECT * INTO v_pending
    FROM public.pending_revision_uploads pending
   WHERE pending.op_id = p_op_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_actor IS NULL
     OR v_pending.actor_user_id <> v_actor
     OR v_pending.operation_kind <> p_operation_kind
     OR NOT private.owns_device(v_pending.actor_device_id, v_actor)
     OR EXISTS (
       SELECT 1 FROM public.devices
       WHERE id = v_pending.actor_device_id AND status <> 'active'
     )
     OR v_pending.expires_at <= now()
     OR NOT private.has_space_role(v_pending.space_id, 'editor', v_actor)
     OR NOT EXISTS (
       SELECT 1
         FROM public.spaces space
         JOIN public.teams team ON team.id = space.team_id
        WHERE space.id = v_pending.space_id
          AND space.team_id = v_pending.team_id
          AND space.current_key_epoch = v_pending.key_epoch
          AND space.deleted_at IS NULL
          AND team.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'pending lifecycle upload is not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_operation_kind <> 'move' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('space:' || v_pending.space_id::text, 0)
    );
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

  RETURN v_pending;
END;
$$;

CREATE OR REPLACE FUNCTION public.tombstone_note(
  p_op_id uuid,
  p_expected_head_id uuid,
  p_codec_version integer,
  p_retention_expires_at timestamptz
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
  v_head public.note_heads%ROWTYPE;
  v_sequence bigint;
  v_permission_epoch bigint;
  v_last_client_sequence bigint;
BEGIN
  SELECT receipt.* INTO v_receipt
    FROM public.mutation_receipts receipt
    JOIN public.devices device ON device.id = receipt.actor_device_id
   WHERE receipt.op_id = p_op_id AND device.user_id = v_actor;
  IF FOUND THEN
    RETURN QUERY SELECT v_receipt.result, v_receipt.result_revision_id,
      v_receipt.result_action_sequence, v_receipt.result_revision_id;
    RETURN;
  END IF;
  IF p_codec_version <= 0 OR p_retention_expires_at <= now() THEN
    RAISE EXCEPTION 'invalid tombstone metadata' USING ERRCODE = '22023';
  END IF;

  v_pending := private.claim_pending_revision(p_op_id, 'tombstone');
  IF v_pending.op_id IS NULL THEN
    SELECT receipt.* INTO v_receipt
      FROM public.mutation_receipts receipt
      JOIN public.devices device ON device.id = receipt.actor_device_id
     WHERE receipt.op_id = p_op_id AND device.user_id = v_actor;
    IF FOUND THEN
      RETURN QUERY SELECT v_receipt.result, v_receipt.result_revision_id,
        v_receipt.result_action_sequence, v_receipt.result_revision_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'pending upload not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pending.note_id::text, 0));

  SELECT * INTO v_note FROM public.notes
   WHERE id = v_pending.note_id FOR UPDATE;
  SELECT * INTO v_head FROM public.note_heads
   WHERE note_id = v_pending.note_id FOR UPDATE;
  IF NOT FOUND OR v_note.status <> 'active'
     OR v_note.space_id <> v_pending.space_id THEN
    RAISE EXCEPTION 'active note not found' USING ERRCODE = '42501';
  END IF;

  IF v_head.revision_id IS DISTINCT FROM p_expected_head_id THEN
    INSERT INTO public.mutation_receipts (
      actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
      result, result_revision_id, error_code
    ) VALUES (
      v_pending.actor_device_id, p_op_id, v_pending.client_sequence,
      v_pending.team_id, v_pending.space_id, v_pending.note_id,
      'conflict', v_head.revision_id, 'stale_head'
    );
    DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;
    RETURN QUERY SELECT 'conflict'::public.mutation_result,
      v_head.revision_id, NULL::bigint, v_head.revision_id;
    RETURN;
  END IF;

  SELECT COALESCE(max(client_sequence), 0) INTO v_last_client_sequence
    FROM public.mutation_receipts
   WHERE actor_device_id = v_pending.actor_device_id;
  IF v_pending.client_sequence <> v_last_client_sequence + 1 THEN
    RETURN QUERY SELECT 'retry_predecessor'::public.mutation_result,
      NULL::uuid, NULL::bigint, v_head.revision_id;
    RETURN;
  END IF;

  SELECT current_permission_epoch INTO v_permission_epoch
    FROM public.teams WHERE id = v_pending.team_id;

  INSERT INTO public.note_revisions (
    id, team_id, space_id, note_id, base_revision_id, previous_head_id,
    author_user_id, author_device_id, key_epoch, codec_version,
    object_key, ciphertext_size, ciphertext_sha256
  ) VALUES (
    v_pending.revision_id, v_pending.team_id, v_pending.space_id,
    v_pending.note_id, p_expected_head_id, v_head.revision_id,
    v_actor, v_pending.actor_device_id, v_pending.key_epoch, p_codec_version,
    v_pending.object_key, v_pending.ciphertext_size, v_pending.ciphertext_sha256
  );
  UPDATE public.note_heads
     SET revision_id = v_pending.revision_id,
         head_version = head_version + 1,
         updated_at = now()
   WHERE note_id = v_pending.note_id;
  UPDATE public.notes
     SET status = 'tombstoned', updated_at = now()
   WHERE id = v_pending.note_id;
  INSERT INTO public.note_tombstones (
    team_id, note_id, space_id, revision_id, deleted_by_user_id,
    deleted_by_device_id, retention_expires_at
  ) VALUES (
    v_pending.team_id, v_pending.note_id, v_pending.space_id,
    v_pending.revision_id, v_actor, v_pending.actor_device_id,
    p_retention_expires_at
  )
  ON CONFLICT (note_id) DO UPDATE
    SET team_id = EXCLUDED.team_id,
        space_id = EXCLUDED.space_id,
        revision_id = EXCLUDED.revision_id,
        deleted_by_user_id = EXCLUDED.deleted_by_user_id,
        deleted_by_device_id = EXCLUDED.deleted_by_device_id,
        deleted_at = now(),
        retention_expires_at = EXCLUDED.retention_expires_at,
        restored_by_revision_id = NULL,
        restored_at = NULL;

  UPDATE public.space_sync_counters
     SET last_sequence = last_sequence + 1
   WHERE space_id = v_pending.space_id
  RETURNING last_sequence INTO v_sequence;
  INSERT INTO public.sync_actions (
    team_id, space_id, sequence, action_type, note_id, revision_id,
    actor_user_id, actor_device_id, op_id, permission_epoch
  ) VALUES (
    v_pending.team_id, v_pending.space_id, v_sequence, 'note_tombstoned',
    v_pending.note_id, v_pending.revision_id, v_actor,
    v_pending.actor_device_id, p_op_id, v_permission_epoch
  );
  INSERT INTO public.mutation_receipts (
    actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
    result, result_revision_id, result_action_sequence
  ) VALUES (
    v_pending.actor_device_id, p_op_id, v_pending.client_sequence,
    v_pending.team_id, v_pending.space_id, v_pending.note_id,
    'accepted', v_pending.revision_id, v_sequence
  );
  DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;

  RETURN QUERY SELECT 'accepted'::public.mutation_result,
    v_pending.revision_id, v_sequence, v_pending.revision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_tombstoned_note(
  p_op_id uuid,
  p_expected_tombstone_revision_id uuid,
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
  v_head public.note_heads%ROWTYPE;
  v_tombstone public.note_tombstones%ROWTYPE;
  v_sequence bigint;
  v_permission_epoch bigint;
  v_last_client_sequence bigint;
BEGIN
  SELECT receipt.* INTO v_receipt
    FROM public.mutation_receipts receipt
    JOIN public.devices device ON device.id = receipt.actor_device_id
   WHERE receipt.op_id = p_op_id AND device.user_id = v_actor;
  IF FOUND THEN
    RETURN QUERY SELECT v_receipt.result, v_receipt.result_revision_id,
      v_receipt.result_action_sequence, v_receipt.result_revision_id;
    RETURN;
  END IF;
  IF p_codec_version <= 0 THEN
    RAISE EXCEPTION 'invalid codec version' USING ERRCODE = '22023';
  END IF;

  v_pending := private.claim_pending_revision(p_op_id, 'restore');
  IF v_pending.op_id IS NULL THEN
    SELECT receipt.* INTO v_receipt
      FROM public.mutation_receipts receipt
      JOIN public.devices device ON device.id = receipt.actor_device_id
     WHERE receipt.op_id = p_op_id AND device.user_id = v_actor;
    IF FOUND THEN
      RETURN QUERY SELECT v_receipt.result, v_receipt.result_revision_id,
        v_receipt.result_action_sequence, v_receipt.result_revision_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'pending upload not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pending.note_id::text, 0));
  SELECT * INTO v_note FROM public.notes
   WHERE id = v_pending.note_id FOR UPDATE;
  SELECT * INTO v_head FROM public.note_heads
   WHERE note_id = v_pending.note_id FOR UPDATE;
  SELECT * INTO v_tombstone FROM public.note_tombstones
   WHERE note_id = v_pending.note_id FOR UPDATE;

  IF v_note.status <> 'tombstoned'
     OR v_tombstone.revision_id IS DISTINCT FROM p_expected_tombstone_revision_id
     OR v_head.revision_id IS DISTINCT FROM p_expected_tombstone_revision_id THEN
    INSERT INTO public.mutation_receipts (
      actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
      result, result_revision_id, error_code
    ) VALUES (
      v_pending.actor_device_id, p_op_id, v_pending.client_sequence,
      v_pending.team_id, v_pending.space_id, v_pending.note_id,
      'conflict', v_head.revision_id, 'stale_tombstone'
    );
    DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;
    RETURN QUERY SELECT 'conflict'::public.mutation_result,
      v_head.revision_id, NULL::bigint, v_head.revision_id;
    RETURN;
  END IF;

  SELECT COALESCE(max(client_sequence), 0) INTO v_last_client_sequence
    FROM public.mutation_receipts
   WHERE actor_device_id = v_pending.actor_device_id;
  IF v_pending.client_sequence <> v_last_client_sequence + 1 THEN
    RETURN QUERY SELECT 'retry_predecessor'::public.mutation_result,
      NULL::uuid, NULL::bigint, v_head.revision_id;
    RETURN;
  END IF;

  SELECT current_permission_epoch INTO v_permission_epoch
    FROM public.teams WHERE id = v_pending.team_id;

  INSERT INTO public.note_revisions (
    id, team_id, space_id, note_id, base_revision_id, previous_head_id,
    author_user_id, author_device_id, key_epoch, codec_version,
    object_key, ciphertext_size, ciphertext_sha256
  ) VALUES (
    v_pending.revision_id, v_pending.team_id, v_pending.space_id,
    v_pending.note_id, p_expected_tombstone_revision_id, v_head.revision_id,
    v_actor, v_pending.actor_device_id, v_pending.key_epoch, p_codec_version,
    v_pending.object_key, v_pending.ciphertext_size, v_pending.ciphertext_sha256
  );
  UPDATE public.note_heads
     SET revision_id = v_pending.revision_id,
         head_version = head_version + 1,
         updated_at = now()
   WHERE note_id = v_pending.note_id;
  UPDATE public.notes SET status = 'active', updated_at = now()
   WHERE id = v_pending.note_id;
  UPDATE public.note_tombstones
     SET restored_by_revision_id = v_pending.revision_id,
         restored_at = now()
   WHERE note_id = v_pending.note_id;

  UPDATE public.space_sync_counters
     SET last_sequence = last_sequence + 1
   WHERE space_id = v_pending.space_id
  RETURNING last_sequence INTO v_sequence;
  INSERT INTO public.sync_actions (
    team_id, space_id, sequence, action_type, note_id, revision_id,
    actor_user_id, actor_device_id, op_id, permission_epoch
  ) VALUES (
    v_pending.team_id, v_pending.space_id, v_sequence, 'note_restored',
    v_pending.note_id, v_pending.revision_id, v_actor,
    v_pending.actor_device_id, p_op_id, v_permission_epoch
  );
  INSERT INTO public.mutation_receipts (
    actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
    result, result_revision_id, result_action_sequence
  ) VALUES (
    v_pending.actor_device_id, p_op_id, v_pending.client_sequence,
    v_pending.team_id, v_pending.space_id, v_pending.note_id,
    'accepted', v_pending.revision_id, v_sequence
  );
  DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;

  RETURN QUERY SELECT 'accepted'::public.mutation_result,
    v_pending.revision_id, v_sequence, v_pending.revision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_note_to_space(
  p_op_id uuid,
  p_expected_head_id uuid,
  p_codec_version integer
)
RETURNS TABLE (
  result public.mutation_result,
  revision_id uuid,
  source_action_sequence bigint,
  target_action_sequence bigint,
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
  v_head public.note_heads%ROWTYPE;
  v_source_space_id uuid;
  v_source_sequence bigint;
  v_target_sequence bigint;
  v_permission_epoch bigint;
  v_last_client_sequence bigint;
  v_transition public.note_space_transitions%ROWTYPE;
BEGIN
  SELECT receipt.* INTO v_receipt
    FROM public.mutation_receipts receipt
    JOIN public.devices device ON device.id = receipt.actor_device_id
   WHERE receipt.op_id = p_op_id AND device.user_id = v_actor;
  IF FOUND THEN
    SELECT * INTO v_transition
      FROM public.note_space_transitions
     WHERE moved_by_device_id = v_receipt.actor_device_id
       AND op_id = p_op_id;
    RETURN QUERY SELECT v_receipt.result, v_receipt.result_revision_id,
      v_transition.source_action_sequence, v_transition.target_action_sequence,
      v_receipt.result_revision_id;
    RETURN;
  END IF;
  IF p_codec_version <= 0 THEN
    RAISE EXCEPTION 'invalid codec version' USING ERRCODE = '22023';
  END IF;

  v_pending := private.claim_pending_revision(p_op_id, 'move');
  IF v_pending.op_id IS NULL THEN
    SELECT receipt.* INTO v_receipt
      FROM public.mutation_receipts receipt
      JOIN public.devices device ON device.id = receipt.actor_device_id
     WHERE receipt.op_id = p_op_id AND device.user_id = v_actor;
    IF FOUND THEN
      SELECT * INTO v_transition
        FROM public.note_space_transitions
       WHERE moved_by_device_id = v_receipt.actor_device_id
         AND op_id = p_op_id;
      RETURN QUERY SELECT v_receipt.result, v_receipt.result_revision_id,
        v_transition.source_action_sequence, v_transition.target_action_sequence,
        v_receipt.result_revision_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'pending upload not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pending.note_id::text, 0));
  SELECT * INTO v_note FROM public.notes
   WHERE id = v_pending.note_id FOR UPDATE;
  SELECT * INTO v_head FROM public.note_heads
   WHERE note_id = v_pending.note_id FOR UPDATE;

  v_source_space_id := v_note.space_id;
  IF v_note.status <> 'active'
     OR v_note.team_id <> v_pending.team_id
     OR v_source_space_id = v_pending.space_id
     OR NOT private.has_space_role(v_source_space_id, 'manager', v_actor) THEN
    RAISE EXCEPTION 'note move is not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_source_space_id::text < v_pending.space_id::text THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('space:' || v_source_space_id::text, 0)
    );
    PERFORM pg_advisory_xact_lock(
      hashtextextended('space:' || v_pending.space_id::text, 0)
    );
  ELSE
    PERFORM pg_advisory_xact_lock(
      hashtextextended('space:' || v_pending.space_id::text, 0)
    );
    PERFORM pg_advisory_xact_lock(
      hashtextextended('space:' || v_source_space_id::text, 0)
    );
  END IF;

  IF v_head.revision_id IS DISTINCT FROM p_expected_head_id THEN
    INSERT INTO public.mutation_receipts (
      actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
      result, result_revision_id, error_code
    ) VALUES (
      v_pending.actor_device_id, p_op_id, v_pending.client_sequence,
      v_pending.team_id, v_pending.space_id, v_pending.note_id,
      'conflict', v_head.revision_id, 'stale_head'
    );
    DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;
    RETURN QUERY SELECT 'conflict'::public.mutation_result,
      v_head.revision_id, NULL::bigint, NULL::bigint, v_head.revision_id;
    RETURN;
  END IF;

  SELECT COALESCE(max(client_sequence), 0) INTO v_last_client_sequence
    FROM public.mutation_receipts
   WHERE actor_device_id = v_pending.actor_device_id;
  IF v_pending.client_sequence <> v_last_client_sequence + 1 THEN
    RETURN QUERY SELECT 'retry_predecessor'::public.mutation_result,
      NULL::uuid, NULL::bigint, NULL::bigint, v_head.revision_id;
    RETURN;
  END IF;

  SELECT current_permission_epoch INTO v_permission_epoch
    FROM public.teams WHERE id = v_pending.team_id;

  -- Lock counters in deterministic UUID order to avoid opposite-direction
  -- move deadlocks.
  IF v_source_space_id::text < v_pending.space_id::text THEN
    PERFORM 1 FROM public.space_sync_counters
      WHERE space_id = v_source_space_id FOR UPDATE;
    PERFORM 1 FROM public.space_sync_counters
      WHERE space_id = v_pending.space_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.space_sync_counters
      WHERE space_id = v_pending.space_id FOR UPDATE;
    PERFORM 1 FROM public.space_sync_counters
      WHERE space_id = v_source_space_id FOR UPDATE;
  END IF;

  INSERT INTO public.note_revisions (
    id, team_id, space_id, note_id, base_revision_id, previous_head_id,
    author_user_id, author_device_id, key_epoch, codec_version,
    object_key, ciphertext_size, ciphertext_sha256
  ) VALUES (
    v_pending.revision_id, v_pending.team_id, v_pending.space_id,
    v_pending.note_id, p_expected_head_id, v_head.revision_id,
    v_actor, v_pending.actor_device_id, v_pending.key_epoch, p_codec_version,
    v_pending.object_key, v_pending.ciphertext_size, v_pending.ciphertext_sha256
  );
  UPDATE public.notes
     SET space_id = v_pending.space_id, updated_at = now()
   WHERE id = v_pending.note_id;
  UPDATE public.note_heads
     SET revision_id = v_pending.revision_id,
         head_version = head_version + 1,
         updated_at = now()
   WHERE note_id = v_pending.note_id;

  UPDATE public.space_sync_counters
     SET last_sequence = last_sequence + 1
   WHERE space_id = v_source_space_id
  RETURNING last_sequence INTO v_source_sequence;
  UPDATE public.space_sync_counters
     SET last_sequence = last_sequence + 1
   WHERE space_id = v_pending.space_id
  RETURNING last_sequence INTO v_target_sequence;

  INSERT INTO public.sync_actions (
    team_id, space_id, sequence, action_type, note_id, revision_id,
    actor_user_id, actor_device_id, op_id, permission_epoch
  ) VALUES
    (
      v_pending.team_id, v_source_space_id, v_source_sequence,
      'note_moved_out', v_pending.note_id, NULL, v_actor,
      v_pending.actor_device_id, p_op_id, v_permission_epoch
    ),
    (
      v_pending.team_id, v_pending.space_id, v_target_sequence,
      'note_moved_in', v_pending.note_id, v_pending.revision_id, v_actor,
      v_pending.actor_device_id, p_op_id, v_permission_epoch
    );

  INSERT INTO public.note_space_transitions (
    team_id, note_id, from_space_id, to_space_id, target_revision_id,
    source_action_sequence, target_action_sequence,
    moved_by_user_id, moved_by_device_id, op_id
  ) VALUES (
    v_pending.team_id, v_pending.note_id, v_source_space_id,
    v_pending.space_id, v_pending.revision_id,
    v_source_sequence, v_target_sequence,
    v_actor, v_pending.actor_device_id, p_op_id
  );
  INSERT INTO public.mutation_receipts (
    actor_device_id, op_id, client_sequence, team_id, space_id, note_id,
    result, result_revision_id, result_action_sequence
  ) VALUES (
    v_pending.actor_device_id, p_op_id, v_pending.client_sequence,
    v_pending.team_id, v_pending.space_id, v_pending.note_id,
    'accepted', v_pending.revision_id, v_target_sequence
  );
  DELETE FROM public.pending_revision_uploads WHERE op_id = p_op_id;

  RETURN QUERY SELECT 'accepted'::public.mutation_result,
    v_pending.revision_id, v_source_sequence, v_target_sequence,
    v_pending.revision_id;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_pending_revision(
  uuid, public.revision_operation
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tombstone_note(
  uuid, uuid, integer, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_tombstoned_note(
  uuid, uuid, integer
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_note_to_space(
  uuid, uuid, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.claim_pending_revision(
  uuid, public.revision_operation
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tombstone_note(
  uuid, uuid, integer, timestamptz
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_tombstoned_note(
  uuid, uuid, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_note_to_space(
  uuid, uuid, integer
) TO authenticated;

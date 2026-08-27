-- =============================================================================
-- Team Notes V1 — private immutable revision Storage policies
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'team-note-revisions' AND public IS FALSE
  ) THEN
    RAISE EXCEPTION 'MISSING PRIVATE BUCKET: team-note-revisions';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'team_note_revisions_insert_pending',
        'team_note_revisions_select_authorized'
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'MISSING STORAGE POLICIES';
  END IF;
END $$;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000301', 'storage-owner@example.test', now()),
  ('00000000-0000-0000-0000-000000000302', 'storage-outsider@example.test', now());

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000301',
  true
);
SET LOCAL ROLE authenticated;

SELECT public.register_device(
  '20000000-0000-0000-0000-000000000301',
  '21000000-0000-0000-0000-000000000301',
  decode('01', 'hex'),
  digest('storage-owner-device', 'sha256'),
  'x25519'
);

SELECT * FROM public.create_team(
  '10000000-0000-0000-0000-000000000301',
  '30000000-0000-0000-0000-000000000301',
  '31000000-0000-0000-0000-000000000301',
  'Storage Team',
  '20000000-0000-0000-0000-000000000301',
  decode('11', 'hex'), decode('12', 'hex'),
  decode('13', 'hex'), decode('14', 'hex'),
  decode('15', 'hex'), decode('16', 'hex'),
  decode('17', 'hex'), decode('18', 'hex'),
  'x25519-aesgcm'
);

RESET ROLE;

INSERT INTO public.notes (
  id, team_id, space_id, created_by, status, schema_version
) VALUES (
  '40000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000301',
  '30000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000301',
  'active',
  1
);

INSERT INTO public.pending_revision_uploads (
  op_id, revision_id, team_id, note_id, space_id, actor_user_id, actor_device_id,
  client_sequence, key_epoch, object_key, ciphertext_size, ciphertext_sha256, expires_at
) VALUES (
  '60000000-0000-0000-0000-000000000301',
  '50000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000301',
  '40000000-0000-0000-0000-000000000301',
  '30000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000301',
  '20000000-0000-0000-0000-000000000301',
  1,
  1,
  'spaces/30000000-0000-0000-0000-000000000301/notes/40000000-0000-0000-0000-000000000301/revisions/50000000-0000-0000-0000-000000000301.bin',
  1,
  digest('storage-ciphertext', 'sha256'),
  now() + interval '5 minutes'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000301',
  true
);
SET LOCAL ROLE authenticated;

INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES (
  'team-note-revisions',
  'spaces/30000000-0000-0000-0000-000000000301/notes/40000000-0000-0000-0000-000000000301/revisions/50000000-0000-0000-0000-000000000301.bin',
  '00000000-0000-0000-0000-000000000301'
);

RESET ROLE;

INSERT INTO public.note_revisions (
  id, team_id, space_id, note_id, author_user_id, author_device_id,
  key_epoch, codec_version, object_key, ciphertext_size, ciphertext_sha256
) VALUES (
  '50000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000301',
  '30000000-0000-0000-0000-000000000301',
  '40000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000301',
  '20000000-0000-0000-0000-000000000301',
  1,
  1,
  'spaces/30000000-0000-0000-0000-000000000301/notes/40000000-0000-0000-0000-000000000301/revisions/50000000-0000-0000-0000-000000000301.bin',
  1,
  digest('storage-ciphertext', 'sha256')
);

INSERT INTO public.note_heads (note_id, revision_id, head_version)
VALUES (
  '40000000-0000-0000-0000-000000000301',
  '50000000-0000-0000-0000-000000000301',
  1
);

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000301',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'team-note-revisions'
      AND name LIKE '%50000000-0000-0000-0000-000000000301.bin'
  ) THEN
    RAISE EXCEPTION 'STORAGE READ FAILED: authorized recipient cannot read object';
  END IF;

  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'team-note-revisions'
      AND name LIKE '%50000000-0000-0000-0000-000000000301.bin';
    RAISE EXCEPTION 'STORAGE IMMUTABILITY FAILED: client delete succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000302',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'team-note-revisions'
  ) THEN
    RAISE EXCEPTION 'STORAGE ISOLATION FAILED: outsider can read object';
  END IF;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES (
      'team-note-revisions',
      'spaces/fake/notes/fake/revisions/fake.bin',
      '00000000-0000-0000-0000-000000000302'
    );
    RAISE EXCEPTION 'STORAGE ISOLATION FAILED: outsider upload succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END $$;

RESET ROLE;
ROLLBACK;

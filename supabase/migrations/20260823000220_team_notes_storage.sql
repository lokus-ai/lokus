-- Team Notes V1: private immutable encrypted revision bucket.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'team-note-revisions',
  'team-note-revisions',
  false,
  52428800,
  ARRAY['application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS team_note_revisions_insert_pending ON storage.objects;
CREATE POLICY team_note_revisions_insert_pending
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-note-revisions'
    AND EXISTS (
      SELECT 1
        FROM public.pending_revision_uploads pending
       WHERE pending.object_key = name
         AND pending.actor_user_id = (SELECT auth.uid())
         AND team_notes_rls.authorize(
           'owns_device',
           pending.actor_device_id
         )
         AND pending.expires_at > now()
         AND team_notes_rls.authorize(
           'space_role',
           pending.space_id,
           'editor'
         )
    )
  );

DROP POLICY IF EXISTS team_note_revisions_select_authorized ON storage.objects;
CREATE POLICY team_note_revisions_select_authorized
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'team-note-revisions'
    AND EXISTS (
      SELECT 1
        FROM public.note_revisions revision
       WHERE revision.object_key = name
         AND team_notes_rls.authorize(
           'space_role',
           revision.space_id,
           'reader'
         )
    )
  );

-- Deliberately no authenticated UPDATE or DELETE policy. Ciphertext objects are
-- immutable; service-only garbage collection removes expired orphans.

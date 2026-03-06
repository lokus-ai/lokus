-- =============================================================================
-- Fix #3: Column type mismatch in user_encryption_keys
-- =============================================================================
-- The table was created with BYTEA columns, but the JS KeyManager sends
-- base64-encoded TEXT strings. Alter all three key columns to TEXT so that
-- round-trips through the JS layer do not require binary coercion.

ALTER TABLE user_encryption_keys ALTER COLUMN wrapped_key      TYPE TEXT;
ALTER TABLE user_encryption_keys ALTER COLUMN wrapping_nonce   TYPE TEXT;
ALTER TABLE user_encryption_keys ALTER COLUMN wrapping_salt    TYPE TEXT;


-- =============================================================================
-- Fix #4: Storage bucket policies for the vaults bucket
-- =============================================================================
-- The vaults bucket had no RLS policies, meaning authenticated users could
-- read or write any file. Files are stored at {userId}/{workspaceId}/{filePath}.
-- Each policy restricts access to the subtree rooted at the caller's own uid,
-- which is the first folder component returned by storage.foldername(name).

CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- =============================================================================
-- Fix #5: user_workspaces UNIQUE constraint (1 workspace per user)
-- =============================================================================
-- The previous constraint UNIQUE(user_id, workspace_id) allowed one user to
-- register multiple workspaces. The sync model is strictly 1 workspace per user.
-- Drop the compound constraint and replace it with a single-column constraint
-- on user_id so that any INSERT/UPSERT for an existing user always conflicts.

ALTER TABLE user_workspaces
  DROP CONSTRAINT IF EXISTS user_workspaces_user_id_workspace_id_key;

ALTER TABLE user_workspaces
  ADD CONSTRAINT user_workspaces_one_per_user UNIQUE (user_id);


-- =============================================================================
-- Fix #17: Add updated_at column to user_workspaces
-- =============================================================================
-- Needed so the sync engine and UI can detect when the workspace registration
-- was last modified (e.g. name change or workspace switch).

ALTER TABLE user_workspaces
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

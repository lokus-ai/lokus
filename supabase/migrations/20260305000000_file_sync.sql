-- File sync metadata — tracks which files are synced and their hashes
CREATE TABLE IF NOT EXISTS sync_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  encrypted_size BIGINT NOT NULL,
  is_binary BOOLEAN DEFAULT false,
  modified_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  encryption_version INTEGER DEFAULT 1,
  UNIQUE(user_id, workspace_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_sync_files_user_workspace
  ON sync_files(user_id, workspace_id);

-- User encryption keys — stores wrapped (encrypted) Master Encryption Key
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_key BYTEA NOT NULL,
  wrapping_nonce BYTEA NOT NULL,
  wrapping_salt BYTEA NOT NULL,
  key_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE sync_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own files" ON sync_files
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own key" ON user_encryption_keys
  FOR ALL USING (auth.uid() = user_id);

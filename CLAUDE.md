# Lokus — Claude Context

## Sync system (March 2026)

### Model: 1 workspace per user
- User can sync exactly 1 workspace at a time
- `user_workspaces` table has at most 1 row per user
- Enabling sync on a new workspace replaces (deletes) the old one

### Key files
- `src/core/sync/SyncEngine.js` — core sync logic, offline queue, conflict resolution
- `src/core/sync/SyncScheduler.js` — auto-sync on save (3s debounce) + every 5min
- `src/core/sync/FileScanner.js` — scans workspace files, mtime+size caching
- `src/core/sync/OfflineQueue.js` — persists queued edits to `.lokus/offline-queue.json`
- `src/core/sync/KeyManager.js` — MEK management (AES-256-GCM)
- `src/core/sync/encryption.js` — encrypt/decrypt/hash helpers
- `src/views/Launcher.jsx` — pull from cloud button
- `src/views/preferences/SyncPreferences.jsx` — 3-state UI

### SyncEngine methods
- `init(path, userId)` — reads `.lokus/sync-id`, loads cache + offline queue
- `enableSync(userId)` — deletes old sync data, generates new workspace ID, registers
- `disableSync(userId)` — full cleanup (storage files + sync_files rows + registry)
- `pullWorkspace(targetPath, userId)` — downloads all files to a folder
- `getSyncedWorkspace(userId)` — returns `{ workspace_id, name }` or null
- `sync()` — full reconciliation (upload/download/merge)
- `syncFiles(absolutePaths)` — targeted sync for saved files

### SyncPreferences — 3 states
1. **No sync**: "Enable Sync for [workspace]" button
2. **Synced here**: status, stats, Sync Now, Stop Syncing
3. **Synced elsewhere**: warning + "Switch to this workspace" button

### Launcher
- If logged in + has synced workspace: shows "Pull [name] from Cloud" button
- Clicking pull → pick folder → download files → open workspace

### Database
- `user_workspaces`: `user_id, workspace_id, name` (1 row per user)
- `sync_files`: per-file metadata (hash, size, timestamps)
- `vaults` storage bucket: encrypted file blobs

### Conflict resolution
- Hash match → skip (no timestamp dependency)
- Text files with different hashes → merge via diff-match-patch
- Binary conflicts → newer timestamp wins, ties → remote wins
- Failed merge → both versions concatenated with separator

### Offline handling
- `navigator.onLine` + Supabase ping for connectivity
- Edits while offline → queued to `.lokus/offline-queue.json`
- On reconnect → drain queue + full sync

## Project structure
- Tauri app: `src-tauri/` (Rust backend), `src/` (React frontend)
- Supabase migrations: `supabase/migrations/`
- Build: `npx tauri dev` for dev, `NODE_OPTIONS="--max-old-space-size=4096" npx vite build` for frontend only

# Lokus — Claude Context

## Sync system V2 (March 2026)

### Model: 1 workspace per user
- User can sync exactly 1 workspace at a time
- `user_workspaces` table has at most 1 row per user
- 6-hour cooldown on workspace switches (client-enforced)
- Manifest-based sync: single JSONB column per workspace instead of per-file DB rows

### Key files
- `src/core/sync/SyncEngine.js` — orchestrator: init, enable/disable, sync, pullWorkspace
- `src/core/sync/SyncScheduler.js` — auto-sync on save (3s debounce) + every 5min
- `src/core/sync/ManifestManager.js` — manifest CRUD, diff algorithm, optimistic concurrency via RPC
- `src/core/sync/StorageManager.js` — Supabase Storage upload/download/delete with retry + batching
- `src/core/sync/WorkspaceRegistry.js` — workspace registration + 6h cooldown
- `src/core/sync/TrashManager.js` — soft delete to `.lokus/trash/`, 30-day cleanup
- `src/core/sync/SyncLock.js` — cross-window mutex via localStorage + heartbeat
- `src/core/sync/constants.js` — shared config (concurrency, timeouts, limits)
- `src/core/sync/OfflineQueue.js` — persists queued edits to `.lokus/offline-queue.json`
- `src/core/sync/FileScanner.js` — scans workspace files, mtime+size caching (unchanged)
- `src/core/sync/KeyManager.js` — MEK management AES-256-GCM (unchanged)
- `src/core/sync/encryption.js` — encrypt/decrypt/hash helpers (unchanged)
- `src/views/Launcher.jsx` — pull from cloud button
- `src/views/preferences/SyncPreferences.jsx` — 3-state UI with cooldown

### SyncEngine methods
- `init(path, userId)` — reads `.lokus/sync-id`, loads cache + offline queue
- `enableSync(userId)` — cleanup old data, generate workspace ID, register, create manifest
- `disableSync(userId)` — full cleanup (storage blobs + manifest + registry)
- `pullWorkspace(targetPath, userId, onProgress)` — downloads all files from manifest
- `getSyncedWorkspace(userId)` — delegates to WorkspaceRegistry
- `sync()` — full reconciliation via manifest diff (upload/download/delete)
- `syncFiles(absolutePaths)` — incremental on-save sync

### Diff algorithm (ManifestManager.diff)
- Local file not in remote → UPLOAD
- Same hash → SKIP
- Different hash → last-write-wins (compare modified_at timestamps)
- Remote file not in local + in syncCache → DELETE (locally deleted)
- Remote file not in local + not in syncCache → DOWNLOAD (new remote file)

### SyncPreferences — 3 states
1. **No sync**: "Enable Sync for [workspace]" button
2. **Synced here**: status, stats, Sync Now, Stop Syncing
3. **Synced elsewhere**: read-only — "Open [name] to manage sync settings" (no switch button)

### Database
- `user_workspaces`: `user_id, workspace_id, name, last_switched_at` (1 row per user)
- `workspace_manifests`: `user_id, workspace_id, manifest (JSONB), manifest_version` (1 row per user)
- `sync_files`: DEPRECATED — replaced by workspace_manifests
- `vaults` storage bucket: encrypted file blobs
- `update_manifest()` RPC: atomic manifest update with optimistic concurrency

### Deletions
- File deleted locally → detected by diff (in remote + syncCache, missing locally)
- Soft-deleted to `.lokus/trash/{date}/` before remote removal
- Trash cleaned up after 30 days

### Offline handling
- `navigator.onLine` + Supabase ping for connectivity
- Edits while offline → queued to `.lokus/offline-queue.json`
- On reconnect → drain queue + full sync

## Project structure
- Tauri app: `src-tauri/` (Rust backend), `src/` (React frontend)
- Supabase migrations: `supabase/migrations/`
- Build: `npx tauri dev` for dev, `NODE_OPTIONS="--max-old-space-size=4096" npx vite build` for frontend only

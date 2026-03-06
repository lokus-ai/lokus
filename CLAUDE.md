# Lokus — Claude Context

## What was done: Workspace Registry (March 2026)

### Problem
Users have multiple workspace folders synced via Lokus. Previously workspaces were identified only by a local `.lokus/sync-id` file — no central registry. On a new device, users couldn't see "which workspaces do I have?" or link a folder to an existing cloud workspace.

### Solution: `user_workspaces` registry table + multi-workspace UI

#### Files changed
1. **NEW** `supabase/migrations/20260306000000_workspace_registry.sql` — `user_workspaces` table
2. `src/core/sync/SyncEngine.js` — registry methods
3. `src/views/Launcher.jsx` — named pull list, link prompt modal
4. `src/views/preferences/SyncPreferences.jsx` — cloud names, cloud-only workspaces, link button

#### Database: `user_workspaces` table
```sql
CREATE TABLE user_workspaces (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  workspace_id TEXT NOT NULL,        -- matches sync_files.workspace_id
  name TEXT NOT NULL,                -- folder basename at registration
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, workspace_id)
);
```
- RLS enabled: users can only access their own rows
- Populated via lazy registration (see below)

#### SyncEngine.js — new/modified methods
- `_registerWorkspace(userId, workspaceId, name)` — upserts into `user_workspaces`, silent on failure (offline tolerance)
- `getRegisteredWorkspaces(userId)` — queries `user_workspaces`, returns `{ workspace_id, name, created_at }[]`. NO fallback (we tried fallback from sync_files but it produced confusing generic "Workspace" entries)
- `removeRegisteredWorkspace(userId, workspaceId)` — deletes a registry entry (for cleanup)
- `enableSyncForWorkspace(path, userId, { workspaceId?, workspaceName? })` — now accepts optional `workspaceId` (to link to existing workspace instead of generating new) and `workspaceName`. Calls `_registerWorkspace` after writing sync-id.
- `disableSyncForWorkspace` — now also deletes from `user_workspaces`
- `init()` — after finding valid `.lokus/sync-id`, calls `_registerWorkspace` in background (**lazy registration** — auto-populates registry for existing users on first open after update)

#### Launcher.jsx changes
- State: `registeredWorkspaces` replaces old `remoteWorkspaceIds`
- "Pull from Cloud" section: compact card with workspace names, not big individual buttons
- **Link prompt modal**: when opening a folder without `.lokus/sync-id` and user has registered workspaces, shows "Link to existing workspace?" with list + "Skip" option
- Both `handleSelectWorkspace` and `onRecent` check for link prompt via `checkLinkPrompt()`

#### SyncPreferences.jsx changes
- Loads `registeredWorkspaces` alongside `syncMap`
- Workspace list enriched with cloud-registered names (matched by workspace_id)
- Unsynced workspaces show two buttons: "New" (create fresh sync) and "Link" (connect to existing cloud workspace)
- Link picker: inline panel listing registered workspaces to link to
- "Cloud Only" section: workspaces registered but not on this device, with "Pull" and "Remove" buttons
- `handlePullCloudWorkspace` — picks folder, enables sync with existing ID, pulls files
- `handleRemoveCloudWorkspace` — removes stale entries from registry
- `handleLinkToCloud(path, workspaceId)` — links local folder to existing cloud workspace + pulls

#### Key design decisions
1. **Lazy registration over migration script**: `init()` auto-registers workspaces on first open. No need to backfill the registry table.
2. **No fallback from sync_files**: We tried deriving workspace names from `sync_files` table but it showed useless "Workspace" or "Synced (abc123)" entries. Registry-only is cleaner — users just need to open each workspace once to populate it.
3. **Upsert for idempotency**: `_registerWorkspace` uses upsert so calling it multiple times (from init, enable, etc.) is safe.
4. **Silent failure on registration**: If offline, registration silently fails. Next time the user opens the workspace online, it'll register.

#### How it works end-to-end
```
Device A: open "Notes" → enable sync → generates UUID, writes sync-id, registers in user_workspaces
Device B: open launcher → getRegisteredWorkspaces → sees "Notes" → pull → picks folder → links sync-id → downloads files → both devices mesh-synced
```

### Unchanged files
SyncScheduler.js, Workspace.jsx, App.jsx, recents.js, FileScanner, OfflineQueue, KeyManager, encryption — all untouched.

## Project structure notes
- Tauri app: `src-tauri/` (Rust backend), `src/` (React frontend)
- Supabase migrations: `supabase/migrations/`
- Sync system: `src/core/sync/` (SyncEngine, SyncScheduler, FileScanner, OfflineQueue, KeyManager, encryption)
- Views: `src/views/` (Launcher, Workspace, preferences/)
- Build: `npx tauri dev` for dev, `npx vite build` for frontend only

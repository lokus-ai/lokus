# Learnings

<!-- Auto-maintained by Clean Agent. New entries are appended under the current date. -->

## 2026-04-20

- (engineer) hey

## 2026-05-09

- (synthesizer) [sync-architecture] Lokus uses a manifest-based sync architecture (single JSONB column per workspace) with 1-workspace-per-user model, requiring careful coordination of offline queue, soft-delete trash, and AES-256-GCM encryption in SyncEngine.
- (synthesizer) [editor-choice] ProseMirror was chosen over TipTap as the raw editor integration, indicating a preference for lower-level control over higher-level abstractions for markdown editing.
- (synthesizer) [state-management] State management uses Zustand stores rather than Redux or Context, suggesting preference for lightweight, decentralized store patterns in this Tauri+React desktop app.
- (synthesizer) [architecture] Lokus uses store-driven view switching via Zustand (no React Router), with view state managed in `useViewStore.switchView()` rather than URL routing.
- (synthesizer) [editor-gotcha] ProseMirror replaced TipTap specifically to fix tab-switching content loss, indicating ProseMirror's state management handles editor persistence better across view transitions.
- (synthesizer) [sync-pattern] Sync uses manifest-based diffs with last-write-wins conflict resolution and offline queue drainage on reconnect; multi-window safety enforced via localStorage heartbeat mutex, not server-side locks.
- (synthesizer) [security] Plugin sandbox restricts globals and injects `lokusAPI`; permissions enforced at API level, not sandbox escape-proof—rely on API boundary validation.
- (synthesizer) [feature-pattern] Meeting notes run a 6-state machine (idle→detecting→recording→processing→complete) with Deepgram transcription and LLM streaming; quota enforced at tier level (free: 5/mo, pro: 30/mo, power: unlimited).
- (synthesizer) [frontend-architecture] Navigation is entirely store-driven via useViewStore.switchView() with no React Router; view state is the single source of truth for routing.
- (synthesizer) [sync-strategy] Sync uses last-write-wins conflict resolution by modified_at timestamp in ManifestManager.diff(), with optimistic concurrency control on workspace_manifests RPC updates.
- (synthesizer) [performance-pattern] File save workflow batches with 3-second debounce through SyncScheduler before hashing, diffing, and encrypting, preventing write storms to Supabase.
- (synthesizer) [offline-resilience] OfflineQueue (.lokus/offline-queue.json) persists failed syncs across app restarts and drains on reconnect, enabling offline-first resilience.
- (synthesizer) [editor-architecture] Raw ProseMirror (not TipTap abstraction) with 24 custom node types and 8 marks allows fine-grained control over editor serialization for sync.
- (synthesizer) [frontend-architecture] Navigation in Lokus is pure Zustand-based (`useViewStore.switchView()`) with no React Router; root screens (Launcher, Workspace, Preferences) are swapped at top level, not nested routes.
- (synthesizer) [editor-constraints] Editor uses raw ProseMirror (not TipTap wrapper) with 24 node types, 8 marks, and 30 extension plugins; docs are cached per-tab in LRU with max 20 to bound memory.
- (synthesizer) [sync-system] Sync engine uses JSONB manifest with last-write-wins conflict resolution; local state tracked by mtime+size cache, manifest diffs sent to Supabase, encrypted blobs stored at `{userId}/{workspaceId}/{filePath}`.
- (synthesizer) [sync-system] Multi-window safety relies on localStorage heartbeat mutex (SyncLock.js); offline edits persisted in OfflineQueue until reconnect, with 5-min full sync + 3s debounce on save.
- (synthesizer) [security] Encryption uses AES-256-GCM for file blobs with MEK wrapped via PBKDF2 and stored in `user_encryption_keys` table; KeyManager handles key derivation and crypto operations.

## 2026-05-10

- (synthesizer) [sync-architecture] Lokus uses manifest-based sync (single JSONB row per user) with optimistic concurrency control via version numbers, not per-file rows; diff algorithm is last-write-wins on modified_at with soft deletes to .lokus/trash.
- (synthesizer) [editor-performance] Editor content is cached in Zustand (editorGroupStore.contentByTab) as serialized ProseMirror JSON with LRU eviction beyond 20 tabs; tabs must round-trip losslessly through markdown via markdown-it + prosemirror-markdown.
- (synthesizer) [plugin-safety] Plugin sandbox uses Web Workers with resource quotas (50MB, 1s CPU, 30s network) but falls back to lightweight monitoring if Workers unavailable in Tauri webview; plugins expose API surface with permission enforcement and can declare MCP tools.
- (synthesizer) [concurrency] Cross-window sync mutex is implemented via localStorage heartbeat (5s heartbeat, 15s stale threshold) for local-first concurrent access; offline queue persists to .lokus/offline-queue.json and drains on reconnect.
- (synthesizer) [app-structure] App shell has three top-level views (Launcher, Workspace, Preferences) with no React Router—pure state switching via useViewStore.currentView; feature flags from RemoteConfigContext conditionally mount providers (Calendar, Meeting).
- (synthesizer) [editor-architecture] Lokus uses raw ProseMirror (not TipTap) with 24 node types and Zustand LRU caching (20 tabs max) because TipTap caused content loss on tab switches; tab content stored as serialized ProseMirror JSON.
- (synthesizer) [sync-semantics] Sync system uses last-write-wins conflict resolution on `modified_at` timestamp; diff logic routes files to UPLOAD/SKIP/DELETE/DOWNLOAD based on hash match and cache presence.
- (synthesizer) [plugin-constraints] Plugin sandbox enforces 50MB RAM and 1s CPU quotas via Web Workers, with fallback to lightweight monitoring if Workers unavailable in Tauri webview.
- (synthesizer) [routing-pattern] App state routing uses pure Zustand `useViewStore.switchView()` instead of React Router; three top-level views (Launcher, Workspace, Preferences) with AuthGate wrapping entire app.
- (synthesizer) [workspace-constraints] WorkspaceRegistry enforces 6-hour cooldown on workspace switches; MCP server resolves workspace via running app API → last used (config) → default ~/Lokus.

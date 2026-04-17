# Block Identity Foundation — Phase 1 Implementation Plan

**Design doc:** [2026-04-16-block-identity-foundation-design.md](./2026-04-16-block-identity-foundation-design.md)
**Scope:** Phase 1 only — SQLite backend + auto-assign plugin + schema + on-save + caching. No UI.
**Engine:** ProseMirror (stays). Branch `clean/iron-ridge` == main. Clean slate.

## Known locations (verified)

- Save hook: `src/features/editor/hooks/useSave.js` — taps `invoke('write_file_content', …)` at L63, L172
- PM plugins list: `src/editor/hooks/useProseMirror.js:79` (prop `plugins = []`)
- Schema: `src/editor/schema/lokus-schema.js`
- Feature flags: `src/contexts/RemoteConfigContext.jsx`
- Cargo: `src-tauri/Cargo.toml`
- Commands reg: `src-tauri/src/lib.rs`

## Tasks (sequenced, commit after each)

### 1a — Rust SQLite backend
1. Add `rusqlite = { version = "0.31", features = ["bundled"] }` + `nanoid = "0.4"` to `src-tauri/Cargo.toml`
2. Create `src-tauri/src/block_index.rs` — schema constants, `open_db()`, migrations, `BlockRecord` + `LinkRecord` types, helper `emit_updated_event()`
3. Implement + unit test `upsert_file` (diff old vs new inside Rust, refresh `block_refs` from content scan, commit in one tx, emit event)
4. Implement + test `delete_file` (cascade to block_refs)
5. Implement + test `rename_file` (UPDATE file_path)
6. Implement + test `resolve`, `get_file_blocks`, `get_backlinks`
7. Implement + test `search` using FTS5 `porter unicode61`
8. Implement + test `rebuild` with progress emit `lokus:block-index-progress`, `stats`
9. Register 9 commands in `src-tauri/src/lib.rs` invoke_handler

### 1b — Schema + PM plugin
10. Add `blockId` attr to `taskItem`, `callout`, `mermaid`, `tableCell`, `tableHeader` in `lokus-schema.js` (parseDOM.getAttrs + toDOM data-block-id, matching pattern from paragraph/heading)
11. Create `src/editor/extensions/BlockIdAutoAssign.js` — `appendTransaction` assigns nanoid(10) base36 to any block with `node.type.spec.attrs?.blockId` and `node.attrs.blockId == null`. Idempotent.
12. Import + add to plugin list in `useProseMirror.js` (just after `createBlockIdPlugin()`)
13. Vitest: `BlockIdAutoAssign.test.js` — assigns IDs on creation, skips nodes that already have IDs, skips nodes without the attr (paragraph should get one, horizontalRule should not)

### 1c — JS integration + caching
14. Create `src/core/blocks/BlockIndexer.js` — `extractBlocks(doc)` walks PM doc, returns `[{ id, node_type, level, text_preview, position, checksum, parent_id }]`. SHA-1 checksum truncated 12 hex chars.
15. Create `src/core/blocks/BlockIndexClient.js` — wraps Tauri invoke, has 500-entry Map-based LRU (native insertion-order eviction), listens to `block-index-updated` event for surgical invalidation
16. Modify `src/features/editor/hooks/useSave.js:63` — after successful `write_file_content`, call `BlockIndexClient.upsertFile(path, extractBlocks(editor.state.doc))`. Wrap in try/catch so index failure never blocks save.
17. Refactor `src/core/blocks/block-id-manager.js` — convert to read-through cache in front of BlockIndexClient, keep public API stable
18. Remove virtual-ID path from `src/core/blocks/block-parser.js` (L103-142, L264-276). Add test that two identical paragraphs in different files get different IDs via new backend.

### 1d — Rebuild + rollout
19. Background first-run indexer: Rust `block_index_rebuild` walks workspace, emits progress events. JS subscribes on app boot, shows status-bar progress.
20. Add compact "Indexing N/M" indicator to existing bottom panel/status-bar area
21. Add `feature_flags.block_index_v1: false` to `RemoteConfigContext.jsx` DEFAULT_CONFIG; gate Tasks 15-19 behind it
22. Local dev: override flag to true via `.env.local` or dev flag in RemoteConfigContext

### 1e — Verify
23. `cd src-tauri && cargo test block_index::tests -- --nocapture`
24. `npm run test -- src/core/blocks src/editor/extensions/BlockIdAutoAssign`
25. Manual: `npm run tauri dev`, create/edit 10 blocks, restart, confirm IDs persist. Check `.lokus/index.db` via `sqlite3`.
26. Playwright integration test (deferred to end)

## Done criteria

- All unit + integration tests pass
- Manual smoke test on a real vault (~500 files) with flag ON — no perf regression, no crashes
- Tab switching stays snappy (verify with BacklinksPanel open on all 4 tabs)
- Feature flag ships OFF; enabled for dev

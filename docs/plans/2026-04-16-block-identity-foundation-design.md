# Block Identity Foundation — Phase 1 Design

**Date:** 2026-04-16
**Branch:** `clean/iron-ridge` (even with `main`)
**Author:** pratham
**Status:** Draft, awaiting approval

---

## Context

The editor currently treats block identity as an afterthought. `BlockIdManager` (`src/core/blocks/block-id-manager.js`) is an in-memory Map with a 100-file LRU cap. Block IDs are only generated when a user explicitly creates a reference via `copyBlockReference` (`Editor.jsx:1207` → `block-writer.js:143`). The `block-parser.js` virtual-ID path uses a 32-bit content hash that collides on duplicate text. The schema is also incomplete: `taskItem`, `callout`, `mermaid`, `tableCell`, `tableHeader` have no `blockId` attr at all, so those block types cannot be referenced.

This does not scale. A user with 10,000 notes averaging 50 blocks per note has ~500k blocks. The 100-file LRU thrashes. Block-reference lookups (`[[note^id]]`) require re-parsing files from disk. Backlink panels scan the entire workspace on each query. App restarts wipe the index.

Before building UI (drag handles, block menus, turn-into commands), we need a durable identity layer that scales.

## Goals

1. Every block gets a stable, unique ID the moment it is created, regardless of whether it's ever referenced.
2. Block metadata (id, file, type, text preview, position) persists on disk across app restarts.
3. Queries (`resolveBlock`, `getBacklinks`, `searchBlocks`, `getFileBlocks`) are O(log n) at 500k+ blocks.
4. Works with existing Sync V2 without synchronizing the index database itself.
5. Markdown files stay clean — `^id` only appears in `.md` when a reference exists (existing behavior preserved).
6. Zero data loss on migration from the current in-memory system.
7. Invisible to end users — no UI change in Phase 1.

## Non-goals

- Drag handles, block menus, turn-into commands (Phase 2–3).
- Cross-device DB sync (unnecessary — see §5).
- Rewriting the editor engine (ProseMirror stays).
- Changing the markdown on-disk format for regular edits.

---

## 1. Architecture

```
┌─ ProseMirror editor (JS) ────────────────────────────────┐
│                                                          │
│  BlockIdAutoAssign plugin (new)                          │
│   • appendTransaction: for every block missing blockId,  │
│     generate nanoid(10), setNodeMarkup with new attr     │
│   • Runs on every doc change, idempotent                 │
│                                                          │
│  Existing BlockId plugin (kept, simplified)              │
│   • Continues to detect user-typed `^id` markers         │
│   • No longer the only path to blockId assignment        │
│                                                          │
└──────────────────┬───────────────────────────────────────┘
                   │ on save (debounced 500 ms)
                   ▼
┌─ src/core/blocks/BlockIndexer.js (new) ──────────────────┐
│                                                          │
│  diff(oldBlocks, newDoc) → {added, updated, removed}     │
│  serialize PM doc → [{id, type, text, pos, checksum}]    │
│                                                          │
└──────────────────┬───────────────────────────────────────┘
                   │ invoke("block_index_upsert_file", …)
                   ▼
┌─ src-tauri/src/block_index.rs (new) ─────────────────────┐
│                                                          │
│  Commands:                                               │
│   • block_index_upsert_file(path, blocks[])              │
│   • block_index_delete_file(path)                        │
│   • block_index_resolve(id) → BlockRecord                │
│   • block_index_get_file_blocks(path) → BlockRecord[]    │
│   • block_index_get_backlinks(target_id) → Link[]        │
│   • block_index_search(query, limit) → BlockRecord[]     │
│   • block_index_rebuild(workspace) → ProgressStream      │
│   • block_index_stats() → { blocks, files, size }        │
│                                                          │
│  sqlx::sqlite pool, single writer, WAL mode              │
│                                                          │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌─ .lokus/index.db (SQLite) ───────────────────────────────┐
│                                                          │
│  PRAGMA journal_mode=WAL                                 │
│  PRAGMA synchronous=NORMAL                               │
│                                                          │
│  TABLE blocks (                                          │
│    id           TEXT PRIMARY KEY,                        │
│    file_path    TEXT NOT NULL,                           │
│    node_type    TEXT NOT NULL,   -- paragraph, heading…  │
│    level        INTEGER,         -- heading level        │
│    text_preview TEXT NOT NULL,   -- first 200 chars      │
│    position     INTEGER NOT NULL,-- order within file    │
│    checksum     TEXT NOT NULL,   -- sha1 of text content │
│    parent_id    TEXT,            -- nested block parent  │
│    created_at   INTEGER NOT NULL,                        │
│    updated_at   INTEGER NOT NULL                         │
│  )                                                       │
│  INDEX blocks_file_path ON blocks(file_path)             │
│  INDEX blocks_parent    ON blocks(parent_id)             │
│                                                          │
│  TABLE block_refs (                                      │
│    source_block_id TEXT NOT NULL,                        │
│    target_block_id TEXT NOT NULL,                        │
│    source_file     TEXT NOT NULL,                        │
│    kind            TEXT NOT NULL,  -- link | embed       │
│    PRIMARY KEY (source_block_id, target_block_id)        │
│  )                                                       │
│  INDEX block_refs_target ON block_refs(target_block_id)  │
│                                                          │
│  VIRTUAL TABLE blocks_fts USING fts5(                    │
│    id UNINDEXED, text_preview,                           │
│    tokenize='porter unicode61'                           │
│  )                                                       │
│  Triggers keep blocks_fts synced with blocks             │
│                                                          │
│  TABLE schema_version (version INTEGER)                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 2. ID format

- `nanoid` with custom alphabet `0123456789abcdefghijklmnopqrstuvwxyz` (base36), length 10.
- Collision probability at 500k blocks: `36^10 ≈ 3.7 × 10^15` → 0.0000000007%. Effectively zero.
- Plus `UNIQUE(id)` constraint in SQLite — insert collision returns error, Rust retries with fresh id (max 3 tries).
- Format matches the Obsidian `^id` regex `[a-zA-Z0-9_-]+` already used in `block-parser.js:190` and `BlockId.js:54` — zero parser changes needed.
- Reject JavaScript's `Math.random().toString(36).substring(2,10)` — ~36^8 ≈ 2.8T, birthday collisions at ~2.4M blocks. Not safe for 500k+ scale.

## 3. Schema changes to `lokus-schema.js`

Add `blockId: { default: null }` and corresponding `parseDOM.getAttrs` + `toDOM` serialization to:

| Node | Current line | Change |
|---|---|---|
| `taskItem` | L267–301 | Add `blockId` attr alongside `checked`, `taskState` |
| `callout` | L572–605 | Add `blockId` attr alongside `type`, `title`, `collapsed` |
| `mermaid` | L608–661 | Add `blockId` attr alongside `code`, `theme` |
| `tableCell` | L371–394 | Add `blockId` attr; preserve colspan/rowspan/colwidth |
| `tableHeader` | L346–369 | Add `blockId` attr; preserve colspan/rowspan/colwidth |

Nodes already with `blockId`: paragraph, heading, blockquote, codeBlock, listItem, table, tableRow, wikiLinkEmbed. No change.

Nodes deliberately without `blockId`: horizontalRule (no content to reference), bulletList/orderedList/taskList (wrappers — reference the items inside), inline atoms (wikiLink, canvasLink, image, inlineMath, hardBreak).

## 4. `BlockIdAutoAssign` plugin

File: `src/editor/extensions/BlockIdAutoAssign.js` (new)

```
appendTransaction(transactions, oldState, newState):
  if not any(tr.docChanged): return null
  tr = newState.tr
  modified = false
  newState.doc.descendants (node, pos):
    if not node.type.spec.attrs?.blockId: return  # skip unsupported
    if node.attrs.blockId: return                 # already has one
    id = nanoid(10)
    tr.setNodeMarkup(pos, null, { ...node.attrs, blockId: id })
    modified = true
  return modified ? tr : null
```

- Runs inside the same plugin pipeline as the existing `BlockId.js` detector.
- Idempotent: nodes that already have an id are skipped.
- Does NOT write to the markdown file. The ID lives in PM doc state during the session and in SQLite after save. Markdown gets `^id` only via the existing `copyBlockReference` path.

## 5. Cross-device sync — why no DB sync is needed

The system has two kinds of block IDs:

| Kind | Where it lives | Needs to match across devices? |
|---|---|---|
| **Unreferenced block ID** | SQLite only | No — nothing points at it |
| **Referenced block ID** | SQLite + `^id` in the `.md` file | Yes — but the `^id` anchor is inside the md, which Sync V2 already syncs |

When a user creates a reference (`copyBlockReference`), the existing `block-writer.js:143` writes `^id` into the `.md` file at that line. Sync V2 uploads the file. On device B, the md is pulled, the indexer reads the file, sees `^id`, and registers that exact id in its own SQLite. References work across devices with zero DB synchronization.

Consequence: we never sync `.lokus/index.db`. It's treated as a rebuildable derived artifact, like a build cache.

## 6. On-save pipeline

Triggered by the existing save flow in `src/features/editor/` (useSave hook):

1. Extract blocks from current PM doc → `newBlocks: [{ id, type, text, position, checksum, parentId }]`
2. Call `block_index_upsert_file(filePath, newBlocks)`.
3. Rust side does the diff internally:
   - Fetch existing blocks for `filePath` ordered by position
   - Upsert all new blocks by id
   - Delete any previously-indexed id for this file that's not in newBlocks
   - Update `block_refs` by re-scanning new blocks' content for `[[…^id]]` patterns
   - All in a single transaction

Debounced to 500 ms to coalesce rapid edits.

## 7. Startup / first-run indexer

On app launch, after workspace is opened:

1. Check `schema_version` in `.lokus/index.db`. Create/migrate if needed.
2. Query `SELECT COUNT(*) FROM blocks WHERE file_path IS NOT NULL`.
3. If 0 → **full rebuild**:
   - Walk workspace via existing `read_workspace_files` command (skip ignored paths)
   - For each `.md` file: read, parse via shared markdown→PM pipeline, assign IDs to blocks that don't have `^id` already, insert into DB
   - Emit `lokus:block-index-progress` events with `{ processed, total, currentFile }`
   - Status bar shows progress
4. If count > 0 → **incremental check**: spawn background task comparing file mtimes against DB `updated_at`; re-index only stale files. Runs off the critical path, non-blocking.

Rebuild cost estimate: 10k files × ~2 ms parse = ~20 s, batched inserts. Acceptable one-time cost. Progress bar masks it.

## 8. File rename / delete / external edit

- **Rename inside Lokus**: file rename command fires an event → Rust calls `block_index_rename_file(old, new)` → `UPDATE blocks SET file_path = ? WHERE file_path = ?`. Single transaction, fast.
- **Delete inside Lokus**: `block_index_delete_file(path)` → `DELETE FROM blocks WHERE file_path = ?`. Cascades to `block_refs` via trigger.
- **External edit / git pull / Sync V2 pull**: file mtime changes → next save-or-open of that file triggers re-parse → diff resolves IDs. For untouched files, stale entries are harmless; they get fixed when the file is eventually opened. Optional Tauri fs watcher can catch these sooner; deferred to Phase 1.5.

## 9. Migration from current system

The current in-memory `blockIdManager` (`src/core/blocks/block-id-manager.js`) stays in place as a **read-through cache** in front of the new SQLite-backed API. Public API surface preserved:

- `blockIdManager.resolveBlockRef(id)` → now queries SQLite via Tauri, caches result
- `blockIdManager.registerBlock(path, id, meta)` → now a no-op (IDs flow through the indexer)
- `blockIdManager.getFileBlocks(path)` → now queries SQLite
- `blockIdManager.searchBlocks(query, opts)` → now uses FTS5

Consumers of `blockIdManager` don't change. Internal implementation swaps from Map to SQLite reads.

User files with existing `^id` markers are preserved: the indexer honors them during first rebuild. No `.md` files are rewritten.

## 10. `block-parser.js` fixes

- Delete the "virtual IDs" path (`block-parser.js:103-142` and `generateContentHash` L264-276). Replaced by SQLite lookup.
- Keep `parseBlocks`, `parseHTMLBlocks` for the rebuild-from-disk code path only.
- Add unit test asserting two identical paragraphs in different files get different IDs.

## 11. Error handling

| Failure | Response |
|---|---|
| `.lokus/index.db` corrupt | Delete file, trigger full rebuild, log to Sentry |
| Insert collision after 3 retries | Hard error surfaced to editor — indicates bug |
| Rust side can't open DB | Editor disables block-index-backed features, falls back to in-memory-only; banner "Block index unavailable" |
| Workspace on read-only fs | Same fallback |
| Migration fails partway | Transaction rollback; schema_version not advanced; retry on next launch |

## 12. Testing strategy

- **Unit tests** (Vitest):
  - `BlockIdAutoAssign.test.js` — idempotent, assigns ids to supported nodes only, preserves existing ids
  - `BlockIndexer.test.js` — doc→block list extraction, diff correctness
  - `block-parser.test.js` — collision case that currently fails
- **Rust tests** (`#[cfg(test)]` in `block_index.rs`):
  - upsert_file_inserts_new / updates_existing / deletes_stale
  - get_backlinks_respects_direction
  - search returns ranked
  - schema migration up+down
- **Integration** (Playwright):
  - Create 100 blocks → restart app → verify all ids stable
  - Reference block from file A in file B → verify `get_backlinks` returns file B
  - Delete file A → verify `get_backlinks` on that id returns empty

## 13. Rollout

- Behind feature flag `feature_flags.block_index_v1` in `RemoteConfigContext` — default ON for dev, gated for release until we've run on a large personal vault for a week.
- Keep the in-memory `blockIdManager` path behind the same flag's `false` branch. Can disable in prod without a rebuild.
- Telemetry: index size, rebuild time, query P50/P95 latency via existing PostHog client (opt-in).

## 14. Decisions (locked 2026-04-16)

| # | Decision | Rationale |
|---|---|---|
| 1 | Defer Tauri fs watcher to Phase 1.5 | On-open re-parse covers 99% of cases. Watcher adds complexity for diminishing return |
| 2 | **rusqlite**, not sqlx | Compact, sync, smaller binary. Heavy save+fetch traffic benefits from thin wrapper. Call from async via `tokio::task::spawn_blocking` |
| 3 | FTS5 tokenizer: `porter unicode61` | Standard choice (Obsidian/Notion equivalent). Trigram deferred until needed |
| 4 | Nanoid: base36, length 10 | `^abc123def0` style. Matches existing regex `[a-zA-Z0-9_-]+` — zero parser changes |
| 5 | Progress UI: status bar only | Lokus stays usable during index rebuild. Modal too disruptive for a one-time event |

## 17. Caching & invalidation

Critical for UX: user has 4 tabs open, each with 100s of wiki links, ctrl+tab-spams between them. Without caching this falls over. With the layered strategy below, tab switching is essentially free after warmup.

### What actually gets hit on tab switch

1. **PM doc** — already in memory via `editorGroupStore` LRU (20 tabs max). Block IDs live in PM attrs. Zero cost.
2. **Inline wiki link rendering** (`[[...]]` targets) — resolved via in-memory `__LOKUS_FILE_INDEX__` (`src/core/wiki/resolve.js`). Zero SQLite hits regardless of link count.
3. **BacklinksPanel** — this is the only consumer that queries SQLite on tab switch.

### Four-tier cache stack

| Tier | Layer | Purpose |
|---|---|---|
| 1 | `editorGroupStore` PM doc LRU | Existing. 20 tabs, block IDs in PM attrs |
| 2 | SQLite page cache (WAL + 8 MB page cache) | Built-in. `target_block_id` index for 500k blocks fits in memory → backlink queries skip disk after warmup |
| 3 | `BlockIndexClient` JS LRU | New. Keyed by query signature, max 500 entries, LRU evict |
| 4 | Prefetch on tab activate | When tab X becomes active, async-prefetch its backlinks. Data warm by the time BacklinksPanel renders |

Tier-3 cache keys:
- `resolve:<blockId>`
- `file-blocks:<filePath>`
- `backlinks:<blockId>`
- `backlinks-for-file:<filePath>`
- `search:<query>:<limit>`

### Invalidation protocol

Rust `block_index_upsert_file` and `block_index_delete_file` emit a Tauri event after every commit:

```json
{
  "file": "notes/foo.md",
  "affected_block_ids": ["abc123def0", "xyz789ghi1"],
  "added_refs": ["pqr456stu2"],
  "removed_refs": []
}
```

JS cache drops surgically:
- `resolve:<id>` for each `affected_block_ids`
- `file-blocks:<file>`
- `backlinks:<id>` for each `added_refs` + `removed_refs` (their target set changed)
- `backlinks-for-file:<otherFiles>` — any file that had a ref to/from the changed file
- `search:*` — full wipe (conservative; search results may drift)

Tabs untouched by the write keep all their cache.

### Expected behavior under rapid tab switching

| Action | Cost |
|---|---|
| First switch to tab (cold) | ~5 ms (SQLite query) |
| Subsequent switches (warm) | <1 ms (Tier 3 hit) |
| Editing + save on tab A | Invalidates only A's keys. B/C/D stay warm |
| Ctrl+tab spam | ≤ 1 SQLite query per distinct tab per save |

### Write path

- Save is already debounced 500 ms — typing 100 chars = 1 upsert, not 100
- Rust batches in a single transaction: `BEGIN; UPSERT blocks; REFRESH block_refs; COMMIT`
- WAL mode: readers never block writers, writers never block readers
- 200-block file, 1-block change: ~2 ms on SATA SSD, user does not notice

### What this means for the PM plugin

`BlockIdAutoAssign` runs every transaction, but its cost is O(new blocks only) because existing blocks are skipped. Typing inside an existing paragraph = zero new blocks = zero work. Creating a new paragraph = 1 nanoid call + 1 `setNodeMarkup`. Negligible.

## 15. Phase 1 deliverables

1. `src-tauri/src/block_index.rs` — full implementation + tests + schema migrations
2. `src-tauri/Cargo.toml` — add `sqlx` (or `rusqlite`) + `nanoid`
3. `src-tauri/src/lib.rs` — register 8 new commands
4. `src/editor/extensions/BlockIdAutoAssign.js` — new PM plugin
5. `src/editor/hooks/useProseMirror.js` — wire new plugin
6. `src/editor/schema/lokus-schema.js` — add `blockId` to 5 nodes
7. `src/core/blocks/BlockIndexer.js` — diff + serialize
8. `src/core/blocks/BlockIndexClient.js` — JS wrapper over Tauri commands
9. `src/core/blocks/block-id-manager.js` — refactor to read-through cache
10. `src/core/blocks/block-parser.js` — remove virtual-ID path
11. Tests (vitest + rust + one playwright)
12. Feature flag entry in `RemoteConfigContext` default config

## 16. Out of scope (→ future phases)

- Phase 2: floating `⋮⋮` + `+` handle, drag-to-reorder, hover highlight
- Phase 3: block menu (turn into, duplicate, delete, move), keyboard shortcuts, block-level selection
- Phase 4: block-level backlinks panel using DB, global "goto block" quickswitcher, `[[note^`-autocomplete via FTS5
- Phase 1.5: Tauri fs watcher for external file changes (if not included here)

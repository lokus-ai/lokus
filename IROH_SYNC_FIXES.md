# Iroh Sync Cross-Platform Fixes - Testing Guide

## What Was Fixed

We just implemented critical fixes to resolve the infinite sync loop and cross-platform sync issues between Windows/macOS/Linux.

## The Problems That Were Fixed

### 1. **Cross-Platform Path Bug (CRITICAL)**
- **Problem**: `to_string_lossy()` preserved platform-specific path separators
  - Windows: `file:documents\notes.md`
  - macOS/Linux: `file:documents/notes.md`
- **Result**: HashMap lookups failed → files constantly re-uploaded/downloaded
- **Symptom**: Sync loop (278 up → 276 down → 2 up → 277 down)

### 2. **Weak Validation**
- **Problem**: Only hash was checked for sync decisions
- **Result**: Timing issues caused false positives
- **Symptom**: Files re-syncing even when unchanged

### 3. **Auto-Sync Not Persisted**
- **Problem**: `autoSyncEnabled` state lost on restart
- **Result**: Had to manually re-enable auto-sync every time
- **Symptom**: Auto-sync always OFF after restart

### 4. **No Sync Debouncing**
- **Problem**: No detection of stable state
- **Result**: Kept syncing even when nothing changed
- **Symptom**: Continuous sync activity

## What Was Changed

### Backend (`src-tauri/src/sync/iroh.rs`)

**Line ~348-350** - Upload path normalization:
```rust
// OLD:
let key = format!("file:{}", file_path.to_string_lossy());

// NEW:
let normalized_path = file_path.to_string_lossy().replace('\\', "/");
let key = format!("file:{}", normalized_path);
```

**Line ~652-654** - Download path normalization:
```rust
// OLD:
remote_files.insert(PathBuf::from(path_str), metadata);

// NEW:
let normalized_path = path_str.replace('\\', "/");
remote_files.insert(PathBuf::from(normalized_path), metadata);
```

**Line ~689-722** - Triple validation & normalized comparison:
```rust
// Normalize path before HashMap lookup
let normalized_rel_path = PathBuf::from(
    rel_path.to_string_lossy().replace('\\', "/")
);

// Triple check: hash, size, AND timestamp
if local_meta.hash != remote_meta.hash {
    true  // Hash mismatch
} else if local_meta.size != remote_meta.size {
    eprintln!("WARNING: Hash match but size differs...");
    true  // Size mismatch
} else if local_meta.modified > remote_meta.modified + 2 {
    true  // Local is newer (>2 sec clock skew tolerance)
} else {
    false  // All checks pass - up to date
}
```

**Line ~750-782** - New `compute_workspace_hash()` method:
```rust
async fn compute_workspace_hash(&self) -> SyncResult<Vec<String>> {
    // Computes normalized hash signature of all files
    // Used for detecting changes between sync cycles
}
```

**Line ~559-616** - Periodic sync with debouncing:
```rust
tokio::spawn(async move {
    let mut last_sync_hashes: Option<Vec<String>> = None;

    while sync_running.load(Ordering::SeqCst) {
        // Compute current workspace hash
        let current_hashes = provider.compute_workspace_hash().await?;

        // Skip sync if nothing changed
        if last_sync_hashes == Some(current_hashes) {
            eprintln!("[Periodic sync] No changes detected, skipping");
            continue;
        }

        // Perform sync...
        if uploaded == 0 && downloaded == 0 {
            last_sync_hashes = Some(current_hashes);  // Cache stable state
        }
    }
});
```

### Frontend (`src/views/Preferences.jsx`)

**Line ~394-395** - Persist auto-sync to config:
```jsx
iroh: {
  documentId: irohDocumentId,
  ticket: irohTicket,
  autoSyncEnabled: autoSyncEnabled  // ← Added
}
```

**Line ~301-304** - Restore auto-sync from config:
```jsx
// Restore auto-sync state
if (typeof cfg.sync.iroh.autoSyncEnabled === 'boolean') {
  setAutoSyncEnabled(cfg.sync.iroh.autoSyncEnabled);
}
```

**Line ~473-481** - Auto-start sync if enabled:
```jsx
// Auto-start auto-sync if it was enabled before
if (autoSyncEnabled) {
  await invoke('iroh_start_auto_sync', { workspacePath });
  console.log('Auto-sync resumed from saved state');
}
```

## How to Test (Windows ↔ macOS)

### Setup Phase

**On macOS (where fixes were applied):**
1. Restart the app to load new code
2. Go to Preferences → Workspace Sync → Iroh
3. Either create a new document or use existing one
4. Copy the ticket (the long string)
5. Enable Auto-Sync toggle
6. Add some test files to the workspace:
   ```
   workspace/
   ├── test.md
   ├── subfolder/
   │   └── nested.md
   └── another.md
   ```

**On Windows:**
1. Pull the `iroh-implementation` branch
2. Restart app
3. Go to Preferences → Workspace Sync → Iroh
4. Click "Join Document" and paste the ticket from macOS
5. Enable Auto-Sync toggle

### Test 1: Initial Sync
**Expected:**
- Files from macOS should appear on Windows
- Console should show download messages like:
  ```
  [sync_file_from_iroh] Downloading 'test.md' to '...'
  [sync_file_from_iroh] Successfully downloaded 'test.md' (XXX bytes)
  ```
- **Check file list in sidebar** - files should appear

**Red Flag:**
- If you see continuous upload/download cycles (278 up, 276 down, 2 up, ...)
- If files download but don't appear in UI

### Test 2: Edit on Windows
1. On Windows, create a new file `windows-test.md`
2. Edit an existing file
3. Wait ~5 seconds

**Expected:**
- Changes sync to macOS automatically
- Console shows upload messages
- Files appear on macOS side
- **Only 1 sync cycle**, then stable

**Red Flag:**
- Continuous re-uploading of same files
- File appears on macOS but then keeps re-syncing

### Test 3: Edit on macOS
1. On macOS, create `macos-test.md`
2. Edit an existing file
3. Wait ~5 seconds

**Expected:**
- Changes sync to Windows automatically
- **Only 1 sync cycle**, then stable
- Both machines show same file list

**Red Flag:**
- Sync loop continues
- Files don't appear on Windows

### Test 4: Restart Test (Auto-Sync Persistence)
1. With auto-sync ON, close app on Windows
2. Reopen app on Windows
3. Go to Preferences

**Expected:**
- Auto-sync toggle is still ON (not reset to OFF)
- Console shows: `Auto-sync resumed from saved state`
- Syncing starts automatically without manual toggle

**Red Flag:**
- Auto-sync is OFF after restart
- Have to manually toggle it back on

### Test 5: Stable State Detection
1. With both machines synced and no changes
2. Watch console for 2-3 minutes

**Expected:**
- Every 30 seconds, console shows:
  ```
  [Periodic sync] No changes detected, skipping sync cycle
  ```
- NO upload/download activity when nothing changed

**Red Flag:**
- Keeps showing "X files uploaded, Y files downloaded" even when idle
- Continuous sync activity when no files changed

### Test 6: Large Workspace
1. Add 50-100 small files to workspace
2. Let both machines sync

**Expected:**
- Initial sync: All files upload/download ONCE
- After stable: No more sync activity
- Console shows debouncing: "No changes detected, skipping"

**Red Flag:**
- Files keep re-syncing in loops
- Never reaches stable state

## Debug Console Messages to Look For

### Good Signs ✅
```
[Periodic sync] No changes detected, skipping sync cycle
[sync_file_from_iroh] File 'test.md' already up to date (hash match)
Auto-sync resumed from saved state
Sync complete: 0 files uploaded, 0 files downloaded
```

### Bad Signs ❌
```
WARNING: Hash match but size differs for 'file.md' - re-uploading
Failed to sync file 'xyz': ...
Sync complete: 278 files uploaded, 276 files downloaded
(Repeated upload/download cycles)
```

## Expected Behavior Summary

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Windows → macOS sync | Infinite loop | Single sync cycle |
| Auto-sync after restart | Always OFF | Persisted state |
| Stable workspace | Keeps syncing | Skips sync cycles |
| Path handling | Separator mismatch | Normalized paths |
| File validation | Hash only | Hash + size + timestamp |

## Files to Check

**Config Location (Windows):**
- `C:\Users\[username]\AppData\Roaming\com.lokus.app\config\config.json`
- Should contain: `"autoSyncEnabled": true` when enabled

**Workspace Ticket (per-workspace):**
- `[workspace]/.lokus/iroh-ticket.txt`
- Each workspace has its own ticket file

## If Issues Occur

**Infinite Sync Loop:**
- Check console for path format in upload/download messages
- Should see normalized paths: `documents/test.md` (NOT `documents\test.md`)

**Files Not Appearing in UI:**
- Issue is likely frontend file list refresh
- Check if files exist on disk in workspace folder
- Try closing/reopening the file sidebar

**Auto-Sync Resets to OFF:**
- Check config.json has `autoSyncEnabled` field
- Try toggling auto-sync OFF then ON again
- Check console for "Auto-sync resumed" message on restart

**Hash Mismatch Warnings:**
- If you see "Hash match but size differs" warnings
- This is the new validation catching edge cases
- Should only happen once per file, not repeatedly

## Commit Message (When Ready)

After testing confirms everything works, commit with:
```bash
git add src-tauri/src/sync/iroh.rs src/views/Preferences.jsx
git commit -m "Fix Iroh sync loop and cross-platform path issues

- Normalize all file paths to Unix format for cross-platform compatibility
- Add triple validation (hash + size + timestamp) to prevent false positives
- Persist auto-sync state to config.json
- Add sync debouncing to detect stable state and skip unnecessary syncs

Fixes infinite sync loop between Windows/macOS/Linux.
Enables reliable cross-platform P2P synchronization."
```

## Next Steps After Testing

1. Test all scenarios above on Windows ↔ macOS
2. Verify no sync loop occurs
3. Verify auto-sync persists across restarts
4. Verify stable state detection works
5. If all tests pass → commit changes
6. If issues found → report specific console errors

---

**Current Status:** Code is written and compiles successfully. Ready for cross-platform testing.

//! AI write-action handlers — the local, append-only audit trail.
//!
//! Every AI write (diff-preview accept/reject, agent action, etc.) appends one
//! NDJSON line to `.lokus/ai-audit.jsonl` so the user owns a local, tamper-
//! evident record of what the assistant did — mirroring the cloud `ai_audit_log`
//! row, correlated by `reserve_id` (PRD §9.2, IMPLEMENTATION §6.6).
//!
//! The file is NEVER synced (FileScanner excludes it). The frontend
//! (`DiffPreview.appendAuditLine`) serializes the JSON object and passes the
//! finished line; this command only appends + rotates, so it stays schema-
//! agnostic and the audit format can evolve without a Rust change.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri_plugin_store::StoreBuilder;

/// Rotate the audit log once it grows past this size (PRD §9.2: 5MB).
const MAX_AUDIT_BYTES: u64 = 5 * 1024 * 1024;

/// Resolve the active workspace root: prefer the explicit arg, else the
/// persisted `last_workspace_path` from the `.settings.dat` store.
fn resolve_workspace(app: &tauri::AppHandle, workspace_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(p) = workspace_path.filter(|s| !s.is_empty()) {
        return Ok(PathBuf::from(p));
    }

    let store = StoreBuilder::new(app, PathBuf::from(".settings.dat"))
        .build()
        .map_err(|e| format!("Store error: {}", e))?;
    let _ = store.reload();

    store
        .get("last_workspace_path")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| "No active workspace to write the AI audit log to".to_string())
}

/// Rotate `ai-audit.jsonl` → `ai-audit-{YYYY-MM}.jsonl` when it exceeds 5MB so
/// a single file never grows unbounded. Cleanup of rotated logs > 90 days is a
/// separate concern (reuses TrashManager on the JS side).
fn rotate_if_needed(path: &Path) {
    let too_big = std::fs::metadata(path).map(|m| m.len() >= MAX_AUDIT_BYTES).unwrap_or(false);
    if !too_big {
        return;
    }
    let stamp = chrono::Utc::now().format("%Y-%m").to_string();
    if let Some(parent) = path.parent() {
        let rotated = parent.join(format!("ai-audit-{}.jsonl", stamp));
        // Append into the monthly file if a prior rotation already created it,
        // otherwise a plain rename suffices.
        if rotated.exists() {
            if let (Ok(mut dst), Ok(src)) = (
                OpenOptions::new().create(true).append(true).open(&rotated),
                std::fs::read(path),
            ) {
                let _ = dst.write_all(&src);
                let _ = std::fs::write(path, b"");
            }
        } else {
            let _ = std::fs::rename(path, &rotated);
        }
    }
}

/// Append one pre-serialized NDJSON line to `.lokus/ai-audit.jsonl`.
///
/// Best-effort by design on the caller side (the JS swallows failures so a write
/// surface never breaks on audit failure), but we still return a `Result` so the
/// rare hard failure (no workspace, permission denied) is observable.
#[tauri::command]
pub fn append_audit_log(
    app: tauri::AppHandle,
    line: String,
    workspace_path: Option<String>,
) -> Result<(), String> {
    let workspace = resolve_workspace(&app, workspace_path)?;
    let lokus_dir = workspace.join(".lokus");
    std::fs::create_dir_all(&lokus_dir)
        .map_err(|e| format!("Failed to create .lokus dir: {}", e))?;

    let audit_path = lokus_dir.join("ai-audit.jsonl");
    rotate_if_needed(&audit_path);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&audit_path)
        .map_err(|e| format!("Failed to open ai-audit.jsonl: {}", e))?;

    // Normalize to exactly one line: strip any embedded newlines, append one.
    let mut entry = line.replace('\n', " ");
    entry.push('\n');
    file.write_all(entry.as_bytes())
        .map_err(|e| format!("Failed to append audit line: {}", e))?;

    Ok(())
}

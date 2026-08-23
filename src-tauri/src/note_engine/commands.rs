use std::collections::HashSet;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use tauri::State;

use super::backfill::BackfillReport;
use super::engine::NoteEngineRegistry;
use super::engine::NoteIdentity;
use super::identity::normalized_path_key;
use super::mutation::WriteCommit;
use super::reconcile::{ExternalChange, NormalizedChange};
use super::team_sync::{
    TeamApplyOutcome, TeamConflictSnapshot, TeamOutboxEntry, TeamOutboxStatus, TeamRemoteAction,
    TeamScopeKey,
};

#[tauri::command]
pub fn initialize_note_engine(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
) -> Result<BackfillReport, String> {
    registry.initialize(std::path::Path::new(&workspace_path))
}

#[tauri::command]
pub fn write_note_content(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
    content: String,
    expected_local_generation: i64,
    source: String,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let target = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.write_note(
        &workspace,
        &relative,
        content.as_bytes(),
        expected_local_generation,
        &source,
    )
}

#[tauri::command]
pub fn create_note_content(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
    content: String,
    source: String,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let target = std::path::PathBuf::from(path);
    let target = if target.is_absolute() {
        target
    } else {
        workspace.join(target)
    };
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.create_note(&workspace, &relative, content.as_bytes(), &source)
}

#[tauri::command]
pub fn apply_remote_note_content(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
    content: String,
    personal_scope_id: String,
    remote_revision_id: String,
    remote_sequence: Option<i64>,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let requested = std::path::PathBuf::from(path);
    let target = if requested.exists() {
        std::fs::canonicalize(requested).map_err(|error| error.to_string())?
    } else if requested.is_absolute() {
        requested
    } else {
        workspace.join(requested)
    };
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.apply_remote_note(
        &workspace,
        &relative,
        content.as_bytes(),
        &personal_scope_id,
        &remote_revision_id,
        remote_sequence,
    )
}

#[tauri::command]
pub fn acknowledge_personal_note_sync(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
    personal_scope_id: String,
    remote_revision_id: String,
) -> Result<usize, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let target = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.acknowledge_personal_sync(
        &workspace,
        &relative,
        &personal_scope_id,
        &remote_revision_id,
    )
}

#[tauri::command]
pub fn tombstone_note_content(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
    source: String,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let target = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.tombstone_note(&workspace, &relative, &source)
}

#[tauri::command]
pub fn relocate_note_content(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    source_path: String,
    target_path: String,
    mutation_kind: String,
    source: String,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let source_target = std::fs::canonicalize(&source_path).map_err(|error| error.to_string())?;
    let source_relative = source_target
        .strip_prefix(&workspace)
        .map_err(|_| "source note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    let requested_target = std::path::PathBuf::from(target_path);
    let target = if requested_target.is_absolute() {
        requested_target
    } else {
        workspace.join(requested_target)
    };
    let target_relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "target note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.relocate_note(
        &workspace,
        &source_relative,
        &target_relative,
        &mutation_kind,
        &source,
    )
}

#[tauri::command]
pub fn restore_note_content(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    note_id: String,
    source: String,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.restore_note(&workspace, &note_id, &source)
}

#[tauri::command]
pub fn get_note_identity(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
) -> Result<NoteIdentity, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let target = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.identity_for_path(&workspace, &relative)
}

#[tauri::command]
pub fn get_team_note_paths(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
) -> Result<Vec<String>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.team_note_paths(&workspace)
}

#[tauri::command]
pub fn get_note_path_by_id(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    note_id: String,
) -> Result<Option<String>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.note_path_by_id(&workspace, &note_id)
}

#[tauri::command]
pub fn reconcile_note_changes(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    changes: Vec<ExternalChange>,
    dirty_paths: Vec<String>,
) -> Result<Vec<NormalizedChange>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let dirty_path_keys: HashSet<String> = dirty_paths
        .into_iter()
        .filter_map(|path| {
            let path = std::path::PathBuf::from(path);
            let relative = if path.is_absolute() {
                path.strip_prefix(&workspace).ok()?.to_path_buf()
            } else {
                path
            };
            Some(normalized_path_key(&relative))
        })
        .collect();
    registry.reconcile_external(&workspace, &changes, &dirty_path_keys)
}

#[tauri::command]
pub fn configure_note_team_scope(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
    team_id: String,
    space_id: String,
    permission_epoch: i64,
    key_epoch: i64,
) -> Result<String, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let target = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.configure_team_scope(
        &workspace,
        &relative,
        &team_id,
        &space_id,
        permission_epoch,
        key_epoch,
    )
}

#[tauri::command]
pub fn claim_team_note_outbox(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    space_id: String,
    limit: usize,
) -> Result<Vec<TeamOutboxEntry>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.claim_team_outbox(&workspace, &space_id, limit)
}

#[tauri::command]
pub fn claim_next_team_note_outbox(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    limit: usize,
) -> Result<Vec<TeamOutboxEntry>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.claim_next_team_outbox(&workspace, limit)
}

#[tauri::command]
pub fn cache_team_note_ciphertext(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    op_id: String,
    key_epoch: i64,
    claim_token: String,
    ciphertext_base64: String,
) -> Result<String, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let ciphertext = BASE64
        .decode(ciphertext_base64)
        .map_err(|_| "team ciphertext is not valid base64".to_string())?;
    registry.stage_team_ciphertext(&workspace, &op_id, key_epoch, &claim_token, &ciphertext)
}

#[tauri::command]
pub fn queue_team_note_space_move(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    path: String,
    team_id: String,
    target_space_id: String,
    permission_epoch: i64,
    key_epoch: i64,
) -> Result<String, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    let target = std::fs::canonicalize(&path).map_err(|error| error.to_string())?;
    let relative = target
        .strip_prefix(&workspace)
        .map_err(|_| "note path is outside workspace".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    registry.queue_team_move(
        &workspace,
        &relative,
        &team_id,
        &target_space_id,
        permission_epoch,
        key_epoch,
    )
}

#[tauri::command]
pub fn complete_team_note_push(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    op_id: String,
    claim_token: String,
    result: String,
    revision_id: Option<String>,
    action_sequence: Option<i64>,
) -> Result<(), String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.complete_team_push(
        &workspace,
        &op_id,
        &claim_token,
        &result,
        revision_id.as_deref(),
        action_sequence,
    )
}

#[tauri::command]
pub fn finalize_team_note_conflict(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    op_id: String,
    claim_token: String,
) -> Result<(), String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.finalize_team_conflict(&workspace, &op_id, &claim_token)
}

#[tauri::command]
pub fn rollback_rejected_team_share(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    op_id: String,
) -> Result<(), String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.rollback_rejected_team_share(&workspace, &op_id)
}

#[tauri::command]
pub fn get_team_note_outbox_status(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    op_id: String,
) -> Result<TeamOutboxStatus, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.team_outbox_status(&workspace, &op_id)
}

#[tauri::command]
pub fn get_team_note_checkpoint(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    space_id: String,
) -> Result<i64, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.team_checkpoint(&workspace, &space_id)
}

#[tauri::command]
pub fn apply_team_note_remote_action(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    action: TeamRemoteAction,
) -> Result<TeamApplyOutcome, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.apply_team_action(&workspace, &action)
}

#[tauri::command]
pub fn apply_team_membership_hint(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    team_id: String,
    membership_status: String,
    permission_epoch: i64,
) -> Result<Vec<TeamScopeKey>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.apply_team_membership(&workspace, &team_id, &membership_status, permission_epoch)
}

#[tauri::command]
pub fn refresh_team_note_scope(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    team_id: String,
    space_id: String,
    permission_epoch: i64,
    key_epoch: i64,
) -> Result<(), String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.refresh_team_scope(&workspace, &team_id, &space_id, permission_epoch, key_epoch)
}

#[tauri::command]
pub fn set_team_note_sequence_floor(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    finalized_sequence: i64,
) -> Result<i64, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.set_team_sequence_floor(&workspace, finalized_sequence)
}

#[tauri::command]
pub fn stage_team_note_conflict(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    note_id: String,
    base_revision_id: Option<String>,
    base_content: String,
    remote_revision_id: String,
    remote_content: String,
) -> Result<(), String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.stage_team_conflict(
        &workspace,
        &note_id,
        base_revision_id.as_deref(),
        base_content.as_bytes(),
        &remote_revision_id,
        remote_content.as_bytes(),
    )
}

#[tauri::command]
pub fn get_team_note_conflict(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    note_id: String,
) -> Result<Vec<TeamConflictSnapshot>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.team_conflict_snapshots(&workspace, &note_id)
}

#[tauri::command]
pub fn resolve_team_note_conflict(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    note_id: String,
    resolution_content: String,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.resolve_team_conflict(&workspace, &note_id, resolution_content.as_bytes())
}

#[tauri::command]
pub fn resolve_local_note_recovery(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
    note_id: String,
    kind: String,
    resolution_content: String,
) -> Result<WriteCommit, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.resolve_local_recovery(&workspace, &note_id, &kind, resolution_content.as_bytes())
}

#[tauri::command]
pub fn list_team_note_conflicts(
    registry: State<'_, NoteEngineRegistry>,
    workspace_path: String,
) -> Result<Vec<String>, String> {
    let workspace = std::fs::canonicalize(&workspace_path).map_err(|error| error.to_string())?;
    registry.unresolved_team_conflicts(&workspace)
}

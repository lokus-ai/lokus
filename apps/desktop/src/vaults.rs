//! @part-of desktop
//! The workspaces this person has: every folder they have opened in Lokus, kept as a list so
//! they can move between them. A workspace is a folder; whether it is shared with a team is
//! the folder's own business.

use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

fn file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("vaults.json"))
}

fn read(app: &AppHandle) -> Vec<String> {
    file(app)
        .and_then(|f| std::fs::read_to_string(f).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write(app: &AppHandle, roots: &[String]) {
    let Some(f) = file(app) else { return };
    if let Some(dir) = f.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(f, json!(roots).to_string());
}

/// Keep a folder in the list. Called whenever one is opened.
pub fn remember(app: &AppHandle, root: &Path) {
    let root = root.to_string_lossy().to_string();
    let mut roots = read(app);
    if !roots.contains(&root) {
        roots.push(root);
        write(app, &roots);
    }
}

/// Every workspace still on this computer, in the order they were first opened. A folder that
/// was deleted or moved drops out of the list by itself.
#[tauri::command(async)]
pub fn vault_list(app: AppHandle) -> Vec<Value> {
    let known = read(&app);
    let here: Vec<String> = known
        .iter()
        .filter(|root| Path::new(root).is_dir())
        .cloned()
        .collect();
    if here.len() != known.len() {
        write(&app, &here);
    }
    here.iter()
        .map(|root| {
            let name = Path::new(root)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| root.clone());
            json!({ "name": name, "root": root })
        })
        .collect()
}

/// Take a workspace off the list. Its folder and everything in it stay where they are.
#[tauri::command(async)]
pub fn vault_forget(app: AppHandle, root: String) {
    let roots: Vec<String> = read(&app).into_iter().filter(|r| *r != root).collect();
    write(&app, &roots);
}

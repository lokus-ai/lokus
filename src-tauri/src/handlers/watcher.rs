// Workspace filesystem watcher.
//
// The file tree and open tabs are pull-only: nothing in the app notices when
// Finder (or git, or another editor) adds, renames, or edits files. This
// module watches the workspace root with the platform's native mechanism
// (FSEvents on macOS via the `notify` crate) and emits a debounced
// `workspace:fs-change` event with the affected paths; the frontend refreshes
// the tree and reloads clean open tabs.

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

static WATCHERS: OnceLock<Mutex<HashMap<String, RecommendedWatcher>>> = OnceLock::new();

fn watchers() -> &'static Mutex<HashMap<String, RecommendedWatcher>> {
    WATCHERS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Matches the exclusions of walk_directory in files.rs — changes inside
/// these never affect what the tree shows.
const EXCLUDED: &[&str] = &[".lokus", ".git", "node_modules", ".DS_Store"];

fn is_excluded(path: &Path) -> bool {
    path.components().any(|c| {
        let s = c.as_os_str().to_string_lossy();
        EXCLUDED.iter().any(|e| s == *e)
    })
}

#[derive(Serialize, Clone)]
pub struct FsChangePayload {
    workspace: String,
    paths: Vec<String>,
}

#[tauri::command]
pub fn start_workspace_watch(app: AppHandle, workspace_path: String) -> Result<(), String> {
    let root = PathBuf::from(&workspace_path);
    if !root.is_dir() {
        return Err(format!("not a directory: {workspace_path}"));
    }

    let mut map = watchers().lock().map_err(|e| e.to_string())?;
    if map.contains_key(&workspace_path) {
        return Ok(()); // already watching (e.g. React strict-mode double effect)
    }

    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    map.insert(workspace_path.clone(), watcher);
    drop(map);

    // Debounce thread: batch event bursts (a single save produces several
    // events; a git checkout produces hundreds) into one emit per quiet
    // window. Exits when the watcher is dropped (channel disconnects).
    std::thread::spawn(move || {
        let debounce = Duration::from_millis(400);
        loop {
            let first = match rx.recv() {
                Ok(ev) => ev,
                Err(_) => break,
            };
            let mut paths: Vec<String> = Vec::new();
            let mut collect = |ev: notify::Result<Event>| {
                if let Ok(ev) = ev {
                    for p in ev.paths {
                        if is_excluded(&p) {
                            continue;
                        }
                        let s = p.to_string_lossy().to_string();
                        if !paths.contains(&s) {
                            paths.push(s);
                        }
                    }
                }
            };
            collect(first);
            while let Ok(ev) = rx.recv_timeout(debounce) {
                collect(ev);
            }
            if paths.is_empty() {
                continue;
            }
            let _ = app.emit(
                "workspace:fs-change",
                FsChangePayload {
                    workspace: workspace_path.clone(),
                    paths,
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_workspace_watch(workspace_path: String) -> Result<(), String> {
    let mut map = watchers().lock().map_err(|e| e.to_string())?;
    // Dropping the watcher stops it; its thread exits on channel disconnect.
    map.remove(&workspace_path);
    Ok(())
}

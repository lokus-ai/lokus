//! @part-of desktop
//! Sync inside the app: start and stop the connection, and pass edits
//! between the editor and the sync engine. The logic lives in `lokus-sync`.

use std::sync::Mutex;

use base64::Engine as _;
use lokus_sync::client::{link, serve, Config, Link, Nudge, Token};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::Shell;

const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

#[derive(Default)]
pub struct Sync {
    running: Mutex<Option<Running>>,
    /// Connections told to stop that may not have finished yet. A vault has one sync engine
    /// at a time, so the next connection waits for these before it opens its own.
    ending: Mutex<Vec<tauri::async_runtime::JoinHandle<()>>>,
}

struct Running {
    link: Link,
    task: tauri::async_runtime::JoinHandle<()>,
    server: String,
    workspace: String,
    token: Token,
}

/// Add a line to the sync log (Lokus's own log folder, `sync.log`). It is started again when
/// it passes a megabyte, so it never grows without end.
pub fn note(app: &AppHandle, line: &str) {
    use std::io::Write;
    let Ok(dir) = app.path().app_log_dir() else {
        return;
    };
    let _ = std::fs::create_dir_all(&dir);
    let file = dir.join("sync.log");
    if std::fs::metadata(&file).is_ok_and(|m| m.len() > 1_000_000) {
        let _ = std::fs::rename(&file, dir.join("sync.old.log"));
    }
    let at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut out) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(file)
    {
        let _ = writeln!(out, "{at} {line}");
    }
}

fn fail(code: &str, message: impl ToString) -> Value {
    json!({ "code": code, "message": message.to_string() })
}

impl Sync {
    fn link(&self) -> Option<Link> {
        self.running.lock().ok()?.as_ref().map(|r| r.link.clone())
    }

    /// Files changed: let a running connection pick the change up.
    pub fn changed(&self) {
        if let Some(link) = self.link() {
            link.nudge(Nudge::Changed);
        }
    }

    /// Tell the running connection to stop. It ends at its next pause; whoever connects next
    /// waits for that.
    pub fn stop(&self) {
        let old = self
            .running
            .lock()
            .ok()
            .and_then(|mut running| running.take());
        if let Some(old) = old {
            old.task.abort();
            if let Ok(mut ending) = self.ending.lock() {
                ending.push(old.task);
            }
        }
    }
}

#[tauri::command]
pub async fn sync_connect(
    app: AppHandle,
    server: String,
    workspace: String,
    token: String,
    root: String,
) -> Result<Value, Value> {
    // The folder this was asked for, not whichever is open by now: another may have been opened
    // while the asking waited, and its notes are not this team's.
    let core = app
        .state::<Shell>()
        .core()
        .filter(|core| core.vault.root() == std::path::Path::new(&root))
        .ok_or_else(|| fail("no_vault", "that folder is not the one open"))?;
    // Stop whatever is running and wait until it has really ended before opening the engine.
    let ending = {
        let sync = app.state::<Sync>();
        sync.stop();
        let mut ending = sync
            .ending
            .lock()
            .map_err(|_| fail("sync", "sync stopped"))?;
        std::mem::take(&mut *ending)
    };
    for task in ending {
        // It was told to stop and ends at its next pause. Should it be somewhere that never
        // pauses, connecting again must not wait on it for ever.
        let _ = tokio::time::timeout(std::time::Duration::from_secs(3), task).await;
    }
    note(
        &app,
        &format!(
            "connect asked for: {server}, workspace {}",
            workspace.chars().take(8).collect::<String>()
        ),
    );
    let sync = app.state::<Sync>();
    // Looked at again, and held until this connection is the running one: another folder may
    // have been opened while the last connection ended.
    let shell = app.state::<Shell>();
    let open = shell
        .open
        .lock()
        .map_err(|_| fail("sync", "sync stopped"))?;
    if !open
        .as_ref()
        .is_some_and(|o| o.core.vault.root() == core.vault.root())
    {
        return Err(fail("no_vault", "that folder is not the one open"));
    }
    let (link, nudges) = link(&core.vault).map_err(|e| fail("sync", e))?;
    let token = Token::new(token);
    let config = Config {
        server: server.clone(),
        workspace: workspace.clone(),
        token: token.clone(),
    };
    let (reporter, done) = (app.clone(), app.clone());
    let serving = link.clone();
    let root = core.vault.root().to_string_lossy().into_owned();
    let task = tauri::async_runtime::spawn(async move {
        let logging = reporter.clone();
        let event_root = root.clone();
        // Run where a panic can be seen. One inside the connection used to end it without a
        // word, and the app went on saying "Connecting".
        let working =
            std::panic::AssertUnwindSafe(serve(serving, nudges, config, move |mut event| {
                event["root"] = json!(event_root);
                // What the connection goes through is kept: when sync misbehaves on someone's
                // computer, this file is the only account of it there is.
                match event["event"].as_str() {
                    Some("online") => note(&logging, &format!("online as {}", event["role"])),
                    Some("offline") => note(&logging, &format!("offline: {}", event["reason"])),
                    Some("pulled") => note(&logging, &format!("pulled {} edits", event["edits"])),
                    Some(kind @ ("renamed" | "kept_both" | "skipped" | "rebound")) => {
                        note(&logging, &format!("{kind}: {event}"))
                    }
                    _ => {}
                }
                let _ = reporter.emit("sync:event", event);
            }));
        // Caught in this same task, so stopping the task still stops the connection.
        let outcome = match futures_util::FutureExt::catch_unwind(working).await {
            Ok(outcome) => outcome,
            Err(_) => {
                note(&done, "the connection crashed");
                let _ = done.emit(
                    "sync:event",
                    json!({ "event": "offline", "root": root, "reason": "sync stopped unexpectedly; it will be tried again" }),
                );
                return;
            }
        };
        note(&done, &format!("connection ended: {outcome:?}"));
        if let Err(e) = outcome {
            let _ = done.emit(
                "sync:event",
                json!({ "event": "refused", "root": root, "reason": e.to_string() }),
            );
        }
    });
    if let Ok(mut running) = sync.running.lock() {
        *running = Some(Running {
            link,
            task,
            server,
            workspace,
            token,
        });
    }
    Ok(json!({ "connecting": true }))
}

/// A fresh sign-in for the running connection. Account sign-ins last about an hour; the window
/// hands each new one over so sync carries on without reconnecting.
#[tauri::command(async)]
pub fn sync_token(sync: State<'_, Sync>, token: String) {
    if let Ok(running) = sync.running.lock() {
        if let Some(running) = running.as_ref() {
            running.token.set(token);
        }
    }
}

#[tauri::command(async)]
pub fn sync_disconnect(sync: State<'_, Sync>) {
    sync.stop();
}

#[tauri::command(async)]
pub fn sync_status(sync: State<'_, Sync>) -> Value {
    match sync.running.lock().ok().as_ref().and_then(|r| r.as_ref()) {
        Some(r) => json!({ "running": true, "server": r.server, "workspace": r.workspace }),
        None => json!({ "running": false }),
    }
}

/// The team workspace a folder last synced with, whether or not it is syncing now. A member who
/// opens such a folder is connected without being asked.
#[tauri::command(async)]
pub fn sync_bound(sync: State<'_, Sync>, root: String) -> Option<String> {
    let root = std::path::Path::new(&root);
    if let Some(link) = sync.link() {
        if let Ok(engine) = link.engine.lock() {
            if engine.root() == root {
                return engine.meta("workspace").ok().flatten();
            }
        }
    }
    lokus_sync::engine::bound(root)
}

/// The shared document behind a note, for an editor that is opening it.
#[tauri::command(async)]
pub fn sync_doc(sync: State<'_, Sync>, path: String) -> Result<Option<Value>, Value> {
    let Some(link) = sync.link() else {
        return Ok(None);
    };
    let engine = link
        .engine
        .lock()
        .map_err(|_| fail("sync", "sync engine stopped"))?;
    let Some(id) = engine.doc_id(&path).map_err(|e| fail("sync", e))? else {
        return Ok(None);
    };
    let state = engine
        .state(&id)
        .map_err(|e| fail("sync", e))?
        .unwrap_or_default();
    Ok(Some(
        json!({ "id": id, "state": B64.encode(state), "root": engine.root() }),
    ))
}

/// Rename a note or a folder in a shared vault. `false` when the vault is not shared, and the
/// caller renames it the ordinary way.
#[tauri::command(async)]
pub fn sync_rename(
    sync: State<'_, Sync>,
    from: String,
    to: String,
    root: String,
) -> Result<bool, Value> {
    let Some(link) = sync.link() else {
        return Ok(false);
    };
    let mut engine = link
        .engine
        .lock()
        .map_err(|_| fail("sync", "sync engine stopped"))?;
    if engine.root() != std::path::Path::new(&root) {
        return Err(fail(
            "vault_changed",
            "The workspace changed. Try again in the original workspace.",
        ));
    }
    engine.rename(&from, &to).map_err(|e| fail("sync", e))?;
    drop(engine);
    link.nudge(Nudge::Changed);
    Ok(true)
}

/// An edit typed in the editor.
#[tauri::command(async)]
pub fn sync_local(
    sync: State<'_, Sync>,
    id: String,
    update: String,
    root: String,
) -> Result<(), Value> {
    let link = sync
        .link()
        .ok_or_else(|| fail("sync", "sync is not running"))?;
    let bytes = B64.decode(update).map_err(|e| fail("sync", e))?;
    let mut engine = link
        .engine
        .lock()
        .map_err(|_| fail("sync", "sync engine stopped"))?;
    if engine.root() != std::path::Path::new(&root) {
        return Err(fail(
            "vault_changed",
            "The workspace changed. Try again in the original workspace.",
        ));
    }
    engine
        .local_update(&id, &bytes)
        .map_err(|e| fail("sync", e))?;
    drop(engine);
    link.nudge(Nudge::Changed);
    Ok(())
}

#[tauri::command(async)]
pub fn sync_awareness(sync: State<'_, Sync>, id: String, data: Value, root: String) {
    let Some(link) = sync.link() else {
        return;
    };
    let Ok(engine) = link.engine.lock() else {
        return;
    };
    if engine.root() != std::path::Path::new(&root) {
        return;
    }
    drop(engine);
    link.nudge(Nudge::Awareness { doc: id, data });
}

/// Workspaces, members and invites on the relay.
#[tauri::command]
pub async fn relay_call(
    server: String,
    token: String,
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<Value, Value> {
    lokus_sync::api::call(&server, &token, &method, &path, body)
        .await
        .map_err(|e| fail("relay", e))
}

pub fn stop_for(app: &AppHandle) {
    app.state::<Sync>().stop();
}

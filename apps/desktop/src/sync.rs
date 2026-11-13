//! @part-of desktop
//! Sync inside the app: start and stop the connection, and pass edits
//! between the editor and the sync engine. The logic lives in `lokus-sync`.

use std::sync::Mutex;

use base64::Engine as _;
use lokus_sync::client::{link, serve, Config, Link, Nudge};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::Shell;

const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

#[derive(Default)]
pub struct Sync {
    running: Mutex<Option<Running>>,
}

struct Running {
    link: Link,
    task: tauri::async_runtime::JoinHandle<()>,
    server: String,
    workspace: String,
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

    pub fn stop(&self) {
        if let Ok(mut running) = self.running.lock() {
            if let Some(old) = running.take() {
                old.task.abort();
            }
        }
    }
}

#[tauri::command(async)]
pub fn sync_connect(
    app: AppHandle,
    shell: State<'_, Shell>,
    sync: State<'_, Sync>,
    server: String,
    workspace: String,
    token: String,
) -> Result<Value, Value> {
    let core = shell
        .core()
        .ok_or_else(|| fail("no_vault", "no vault is open"))?;
    sync.stop();
    let (link, nudges) = link(&core.vault).map_err(|e| fail("sync", e))?;
    let config = Config {
        server: server.clone(),
        workspace: workspace.clone(),
        token,
    };
    let (reporter, done) = (app.clone(), app.clone());
    let serving = link.clone();
    let task = tauri::async_runtime::spawn(async move {
        let outcome = serve(serving, nudges, config, move |event| {
            let _ = reporter.emit("sync:event", event);
        })
        .await;
        if let Err(e) = outcome {
            let _ = done.emit(
                "sync:event",
                json!({ "event": "refused", "reason": e.to_string() }),
            );
        }
    });
    if let Ok(mut running) = sync.running.lock() {
        *running = Some(Running {
            link,
            task,
            server,
            workspace,
        });
    }
    Ok(json!({ "connecting": true }))
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
    Ok(Some(json!({ "id": id, "state": B64.encode(state) })))
}

/// An edit typed in the editor.
#[tauri::command(async)]
pub fn sync_local(sync: State<'_, Sync>, id: String, update: String) -> Result<(), Value> {
    let link = sync
        .link()
        .ok_or_else(|| fail("sync", "sync is not running"))?;
    let bytes = B64.decode(update).map_err(|e| fail("sync", e))?;
    link.engine
        .lock()
        .map_err(|_| fail("sync", "sync engine stopped"))?
        .local_update(&id, &bytes)
        .map_err(|e| fail("sync", e))?;
    link.nudge(Nudge::Changed);
    Ok(())
}

#[tauri::command(async)]
pub fn sync_awareness(sync: State<'_, Sync>, id: String, data: Value) {
    if let Some(link) = sync.link() {
        link.nudge(Nudge::Awareness { doc: id, data });
    }
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

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
) -> Result<Value, Value> {
    let core = app
        .state::<Shell>()
        .core()
        .ok_or_else(|| fail("no_vault", "no vault is open"))?;
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
        let _ = task.await;
    }
    let sync = app.state::<Sync>();
    let (link, nudges) = link(&core.vault).map_err(|e| fail("sync", e))?;
    let token = Token::new(token);
    let config = Config {
        server: server.clone(),
        workspace: workspace.clone(),
        token: token.clone(),
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

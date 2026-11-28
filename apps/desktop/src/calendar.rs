//! @part-of desktop
//! The calendar inside the app: its commands, and the look at the providers once a minute.
//! The calendar itself is `lokus-calendar`; this only says where its local copy is kept, opens
//! the browser for a sign-in, and tells the window when something changed.

use std::path::PathBuf;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::Shell;

pub fn dir(app: &AppHandle) -> Option<PathBuf> {
    // The scripted flow and development point this elsewhere, as the command line does.
    if let Some(dir) = std::env::var_os("LOKUS_CALENDAR_DIR").filter(|d| !d.is_empty()) {
        return Some(dir.into());
    }
    app.path().app_config_dir().ok()
}

fn open(url: &str) {
    let _ = open::that(url);
}

fn root(app: &AppHandle) -> Option<PathBuf> {
    Some(app.state::<Shell>().core()?.vault.root().to_path_buf())
}

/// The calendar's tools for the assistant; none until an account is connected.
pub fn tools(app: &AppHandle) -> Option<lokus_ai::Local> {
    let dir = dir(app)?;
    lokus_calendar::Store::exists(&dir).then(|| lokus_calendar::assistant(dir, root(app), open))
}

#[tauri::command]
pub async fn calendar_run(
    app: AppHandle,
    name: String,
    args: Option<Value>,
    root: Option<String>,
) -> Result<Value, Value> {
    // The window names the folder it shows, as for a core command: a meeting note or busy times
    // never go into a folder another window opened since.
    let folder = self::root(&app);
    if root.is_some_and(|root| folder.as_deref() != Some(std::path::Path::new(&root))) {
        return Err(
            json!({ "code": "vault_changed", "message": "The workspace changed. Try again in the original workspace." }),
        );
    }
    let dir =
        dir(&app).ok_or_else(|| json!({ "code": "config", "message": "no settings folder" }))?;
    let done = lokus_calendar::run(
        &dir,
        folder.as_deref(),
        &name,
        &args.unwrap_or(Value::Null),
        &open,
    )
    .await;
    // Every window shows the same events and the same count of what waits.
    if done.is_ok()
        && lokus_calendar::COMMANDS
            .iter()
            .any(|c| c.name == name && c.writes)
    {
        let _ = app.emit("calendar:synced", json!({ "changed": true }));
    }
    done.map_err(|e| e.body())
}

/// One round: send what waits, read what changed, and write this person's busy times into the
/// open folder when it is a team's. Tells the window only when something moved.
async fn round(app: &AppHandle, dir: &std::path::Path) {
    let Ok(done) = lokus_calendar::sync::run(dir).await else {
        return;
    };
    let team = root(app).filter(|root| root.join(".lokus/team.json").is_file());
    let wrote = team
        .and_then(|root| lokus_calendar::team::publish(dir, &root).ok())
        .is_some_and(|w| w["written"] == true);
    let moved = wrote
        || ["sent", "refused", "read"]
            .iter()
            .any(|k| done[k].as_u64().unwrap_or(0) > 0);
    let _ = app.emit("calendar:synced", json!({ "changed": moved, "sync": done }));
}

/// While the app is open, look once a minute. With no account connected a round is one look
/// for a file that is not there: nothing is opened and nothing is asked of anyone.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            if let Some(dir) = dir(&app).filter(|dir| lokus_calendar::Store::exists(dir)) {
                round(&app, &dir).await;
            }
        }
    });
}

/// The same round, asked for by the window (after a change, or "Sync now").
#[tauri::command]
pub async fn calendar_sync(app: AppHandle) -> Result<(), Value> {
    if let Some(dir) = dir(&app).filter(|dir| lokus_calendar::Store::exists(dir)) {
        round(&app, &dir).await;
    }
    Ok(())
}

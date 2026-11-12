//! @part-of desktop
//! Dev builds only: a unix socket that runs any command inside the live app.
//!
//! `lokus app editor.toggleBold` sends one JSON line `{name, args}` and gets
//! one back: `{ok: true, value}` or `{ok: false, error}`. Core commands run
//! here; anything else is handed to the UI's command registry. This is how
//! features are verified in the real app without a browser-driving test rig.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;

use lokus_core::commands::COMMANDS;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::{open_vault, run_core, Shell};

const UI_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Default)]
pub struct Pending {
    next_id: AtomicU64,
    waiting: Mutex<HashMap<u64, mpsc::Sender<Value>>>,
}

pub fn start(app: AppHandle) {
    let path = std::env::temp_dir().join("lokus-dev.sock");
    let _ = std::fs::remove_file(&path);
    let listener = match UnixListener::bind(&path) {
        Ok(listener) => listener,
        Err(e) => {
            eprintln!("dev channel disabled: {e}");
            return;
        }
    };
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            std::thread::spawn(move || serve(app, stream));
        }
    });
}

fn serve(app: AppHandle, stream: UnixStream) {
    let mut line = String::new();
    let Ok(read_half) = stream.try_clone() else {
        return;
    };
    if BufReader::new(read_half).read_line(&mut line).is_err() {
        return;
    }
    let reply = match serde_json::from_str::<Value>(&line) {
        Ok(request) => {
            let name = request["name"].as_str().unwrap_or_default().to_string();
            match dispatch(&app, &name, request["args"].clone()) {
                Ok(value) => json!({ "ok": true, "value": value }),
                Err(error) => json!({ "ok": false, "error": error }),
            }
        }
        Err(e) => {
            json!({ "ok": false, "error": { "code": "bad_request", "message": e.to_string() } })
        }
    };
    let mut stream = stream;
    let _ = writeln!(stream, "{reply}");
}

fn dispatch(app: &AppHandle, name: &str, args: Value) -> Result<Value, Value> {
    if name == "vault.open" {
        let path = args["path"].as_str().unwrap_or_default();
        return open_vault(app, path);
    }
    if COMMANDS.iter().any(|c| c.name == name) {
        return run_core(&app.state::<Shell>(), name, args);
    }
    ask_ui(app, name, args)
}

fn ask_ui(app: &AppHandle, name: &str, args: Value) -> Result<Value, Value> {
    let pending = app.state::<Pending>();
    let id = pending.next_id.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::channel();
    if let Ok(mut waiting) = pending.waiting.lock() {
        waiting.insert(id, tx);
    }
    let sent = app.emit("dev:run", json!({ "id": id, "name": name, "args": args }));
    let reply = match sent {
        Ok(()) => rx.recv_timeout(UI_TIMEOUT).ok(),
        Err(_) => None,
    };
    if let Ok(mut waiting) = pending.waiting.lock() {
        waiting.remove(&id);
    }
    let reply =
        reply.ok_or_else(|| json!({ "code": "ui_timeout", "message": "the UI did not answer" }))?;
    if reply["ok"] == true {
        Ok(reply["value"].clone())
    } else {
        Err(reply["error"].clone())
    }
}

/// The UI calls this with the result of a `dev:run` request.
#[tauri::command]
pub fn dev_reply(pending: State<'_, Pending>, id: u64, reply: Value) {
    if let Ok(mut waiting) = pending.waiting.lock() {
        if let Some(tx) = waiting.remove(&id) {
            let _ = tx.send(reply);
        }
    }
}

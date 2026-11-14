//! @part-of desktop
//! Dev builds only: a local socket that runs any command inside the live app. A unix socket
//! on macOS and Linux; on Windows, which has none worth the name, a port on this computer.
//!
//! `lokus app editor.toggleBold` sends one JSON line `{name, args}` and gets
//! one back: `{ok: true, value}` or `{ok: false, error}`. Core commands run
//! here; anything else is handed to the UI's command registry. This is how
//! features are verified in the real app without a browser-driving test rig.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
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

#[cfg(unix)]
type Stream = std::os::unix::net::UnixStream;
#[cfg(not(unix))]
type Stream = std::net::TcpStream;

#[cfg(unix)]
fn listen() -> std::io::Result<std::os::unix::net::UnixListener> {
    // A second instance (for two-device tests) gets its own socket.
    let path = std::env::var("LOKUS_DEV_SOCK")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join("lokus-dev.sock"));
    let _ = std::fs::remove_file(&path);
    std::os::unix::net::UnixListener::bind(&path)
}

/// The port `lokus app` finds the dev app on where there are no unix sockets.
#[cfg(not(unix))]
fn listen() -> std::io::Result<std::net::TcpListener> {
    let port = std::env::var("LOKUS_DEV_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(47615u16);
    std::net::TcpListener::bind(("127.0.0.1", port))
}

pub fn start(app: AppHandle) {
    let listener = match listen() {
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

fn serve(app: AppHandle, stream: Stream) {
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
    if name == "window.resize" || name == "window.size" {
        return window_size(app, name == "window.resize", &args);
    }
    #[cfg(target_os = "macos")]
    if name == "window.snapshot" {
        return snapshot(
            app,
            args["path"].as_str().unwrap_or("/tmp/lokus-window.png"),
        );
    }
    if COMMANDS.iter().any(|c| c.name == name) {
        return run_core(&app.state::<Shell>(), name, args);
    }
    ask_ui(app, name, args)
}

/// Resize the real window (logical pixels) or just report its size.
fn window_size(app: &AppHandle, resize: bool, args: &Value) -> Result<Value, Value> {
    let fail = |m: String| json!({ "code": "window", "message": m });
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| fail("no main window".into()))?;
    if resize {
        let width = args["width"].as_f64().unwrap_or(1280.0);
        let height = args["height"].as_f64().unwrap_or(820.0);
        window
            .set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| fail(e.to_string()))?;
        std::thread::sleep(Duration::from_millis(350));
    }
    let scale = window.scale_factor().map_err(|e| fail(e.to_string()))?;
    let size = window
        .inner_size()
        .map_err(|e| fail(e.to_string()))?
        .to_logical::<f64>(scale);
    Ok(json!({ "width": size.width, "height": size.height, "scale": scale }))
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

/// Save a picture of what the real web view is showing, as a PNG. The view
/// renders itself, so this needs no screen-recording permission.
#[cfg(target_os = "macos")]
fn snapshot(app: &AppHandle, path: &str) -> Result<Value, Value> {
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use objc2_foundation::NSString;

    let fail = |m: &str| json!({ "code": "window", "message": m });
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| fail("no main window"))?;
    let (tx, rx) = mpsc::channel::<bool>();
    let target = path.to_string();
    window
        .with_webview(move |webview| unsafe {
            let view: *mut AnyObject = webview.inner().cast();
            let done =
                block2::RcBlock::new(move |image: *mut AnyObject, _error: *mut AnyObject| {
                    if image.is_null() {
                        let _ = tx.send(false);
                        return;
                    }
                    let tiff: *mut AnyObject = msg_send![image, TIFFRepresentation];
                    let bitmap: *mut AnyObject =
                        msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff];
                    let none: *mut AnyObject = msg_send![class!(NSDictionary), dictionary];
                    // 4 is the PNG file type.
                    let png: *mut AnyObject =
                        msg_send![bitmap, representationUsingType: 4usize, properties: none];
                    let file = NSString::from_str(&target);
                    let written: bool = msg_send![png, writeToFile: &*file, atomically: true];
                    let _ = tx.send(written);
                });
            let config: *mut AnyObject = std::ptr::null_mut();
            let _: () =
                msg_send![view, takeSnapshotWithConfiguration: config, completionHandler: &*done];
        })
        .map_err(|e| fail(&e.to_string()))?;
    match rx.recv_timeout(Duration::from_secs(8)) {
        Ok(true) => Ok(json!({ "path": path })),
        _ => Err(fail("the window could not be pictured")),
    }
}

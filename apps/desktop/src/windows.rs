//! @part-of desktop
//! More than one window on the same workspace, the way other apps do it.
//!
//! Every window shows the same folder of notes; what each has open (tabs, the page, panels) is
//! its own. What belongs to the person rather than to a window (the theme, who is signed in,
//! sync) is shared, because it lives in the app, not in a window.

use std::sync::atomic::{AtomicU32, Ordering};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

static NEXT: AtomicU32 = AtomicU32::new(1);

/// The window the person is looking at.
fn focused(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.webview_windows()
        .into_values()
        .find(|w| w.is_focused().unwrap_or(false))
}

/// Open another window, a little down and to the right of the one in front.
pub fn open(app: &AppHandle) -> Result<String, Value> {
    let label = format!("w-{}", NEXT.fetch_add(1, Ordering::Relaxed));
    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title("Lokus")
        .inner_size(1280.0, 820.0)
        .min_inner_size(720.0, 480.0)
        .disable_drag_drop_handler();
    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
    }
    if let Some(front) = focused(app) {
        let scale = front.scale_factor().unwrap_or(1.0);
        if let (Ok(at), Ok(size)) = (front.outer_position(), front.inner_size()) {
            builder = builder
                .position(at.x as f64 / scale + 28.0, at.y as f64 / scale + 28.0)
                .inner_size(size.width as f64 / scale, size.height as f64 / scale);
        }
    }
    builder
        .build()
        .map_err(|e| json!({ "code": "window", "message": format!("Could not open another window: {e}") }))?;
    Ok(label)
}

#[tauri::command]
pub async fn window_new(app: AppHandle) -> Result<String, Value> {
    open(&app)
}

/// A menu command meant for one window goes to the one in front, not to all of them.
pub fn tell_front(app: &AppHandle, event: &str) {
    match focused(app) {
        Some(front) => {
            let _ = app.emit_to(front.label(), event, ());
        }
        None => {
            let _ = app.emit(event, ());
        }
    }
}

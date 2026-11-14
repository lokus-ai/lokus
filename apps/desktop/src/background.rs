//! @part-of desktop
//! Lokus in the menu bar, still running after its window is closed.
//!
//! The assistant looks at a workspace on a timer, and that timer lives in the app. An app that
//! quits when its window closes stops looking. So closing the window, or Command-Q, puts Lokus
//! away instead: the window hides, the Dock icon goes, and a mark stays in the menu bar. Its
//! menu opens Lokus again, asks for a look now, or quits it for good.
//!
//! A person who does not want that turns it off in Settings; then closing and quitting mean
//! what they always meant. The choice is a file beside the other settings of this computer.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent};

const TRAY: &str = "lokus";

pub struct Background {
    /// Whether Lokus stays running with no window. Read from disk at start.
    stays: AtomicBool,
    /// Set by a real quit (or a restart to update), so the exit it causes is let through.
    leaving: AtomicBool,
}

impl Default for Background {
    fn default() -> Self {
        Self {
            stays: AtomicBool::new(true),
            leaving: AtomicBool::new(false),
        }
    }
}

fn choice(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("background"))
}

fn stays(app: &AppHandle) -> bool {
    app.state::<Background>().stays.load(Ordering::Relaxed)
}

fn leaving(app: &AppHandle) -> bool {
    app.state::<Background>().leaving.load(Ordering::Relaxed)
}

/// Bring Lokus back: the Dock icon, and its window in front.
pub fn show(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Put Lokus away without stopping it: extra windows close, the first one hides.
pub fn put_away(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if label == "main" {
            let _ = window.hide();
        } else {
            let _ = window.close();
        }
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

/// Stop for good. This is the only thing that ends Lokus while it stays in the menu bar.
pub fn quit(app: &AppHandle) {
    app.state::<Background>()
        .leaving
        .store(true, Ordering::Relaxed);
    crate::sync::stop_for(app);
    app.exit(0);
}

/// An exit that is meant: a restart to finish an update goes through this first.
pub fn allow_exit(app: &AppHandle) {
    app.state::<Background>()
        .leaving
        .store(true, Ordering::Relaxed);
}

/// What Command-Q does: put Lokus away if it stays in the menu bar, otherwise quit.
pub fn quit_or_put_away(app: &AppHandle) {
    if stays(app) {
        put_away(app);
    } else {
        quit(app);
    }
}

fn tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItemBuilder::with_id("tray-open", "Open Lokus").build(app)?;
    let look = MenuItemBuilder::with_id("tray-look", "Look Now").build(app)?;
    let quit_item = MenuItemBuilder::with_id("tray-quit", "Quit Lokus Completely").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&open)
        .item(&look)
        .separator()
        .item(&quit_item)
        .build()?;
    let mut builder = TrayIconBuilder::with_id(TRAY)
        .tooltip("Lokus")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-open" => show(app),
            "tray-look" => {
                // The look happens in the window, shown or not; what it finds is counted here.
                let _ = app.emit_to("main", "background:look", ());
            }
            "tray-quit" => quit(app),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        // A template: the menu bar draws it in its own black or white.
        builder = builder.icon(icon.clone()).icon_as_template(true);
    }
    builder.build(app)?;
    Ok(())
}

/// Read the choice, and put the mark in the menu bar if Lokus is to stay there.
pub fn start(app: &AppHandle) {
    let on = choice(app)
        .and_then(|file| std::fs::read_to_string(file).ok())
        .map(|text| text.trim() != "off")
        .unwrap_or(true);
    app.state::<Background>().stays.store(on, Ordering::Relaxed);
    if on {
        if let Err(e) = tray(app) {
            eprintln!("no menu bar icon: {e}");
            app.state::<Background>()
                .stays
                .store(false, Ordering::Relaxed);
        }
    }
    // A hidden window's own timers may be slowed or stopped by the system. This tick is not:
    // once a minute it reaches the window, which decides whether a look is due.
    let ticking = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(60));
        let _ = ticking.emit_to("main", "background:tick", ());
    });
}

/// What the app as a whole is told: a window closing, an exit asked for, the Dock icon clicked.
pub fn on_event(app: &AppHandle, event: &RunEvent) {
    match event {
        RunEvent::ExitRequested { api, .. } if stays(app) && !leaving(app) => {
            api.prevent_exit();
            put_away(app);
        }
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" && stays(app) && !leaving(app) => {
            api.prevent_close();
            // With another window still open only this one hides; Lokus stays in the Dock.
            if app.webview_windows().len() > 1 {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            } else {
                put_away(app);
            }
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => show(app),
        _ => {}
    }
}

#[tauri::command]
pub fn background_get(state: State<'_, Background>) -> bool {
    state.stays.load(Ordering::Relaxed)
}

/// Turn staying in the menu bar on or off. It takes effect at once.
#[tauri::command]
pub fn background_set(app: AppHandle, on: bool) -> Result<(), String> {
    if let Some(file) = choice(&app) {
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        std::fs::write(file, if on { "on" } else { "off" }).map_err(|e| e.to_string())?;
    }
    let had = app.state::<Background>().stays.swap(on, Ordering::Relaxed);
    if on && !had {
        tray(&app).map_err(|e| e.to_string())?;
    } else if !on && had {
        let _ = app.remove_tray_by_id(TRAY);
    }
    Ok(())
}

/// How many things need the person: shown beside the mark in the menu bar, or nothing for none.
#[tauri::command]
pub fn background_count(app: AppHandle, count: u32) {
    if let Some(tray) = app.tray_by_id(TRAY) {
        let _ = tray.set_title(if count == 0 {
            None
        } else {
            Some(count.to_string())
        });
    }
}

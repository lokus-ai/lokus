//! @part-of desktop
//! Keeping the app up to date without the person having to understand anything.
//!
//! The window asks three things, in order: is there a newer version (`update_check`), fetch and
//! install it (`update_install`), and start again as the new version (`update_restart`). A
//! download is installed only if it carries our signature; where it came from is not trusted.
//! Every way this can go wrong is answered in words a person can act on.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::{Error, Update, UpdaterExt};

#[derive(Default)]
pub struct Updates {
    /// The newer version the last check found, kept so installing does not have to ask again.
    found: Mutex<Option<Update>>,
    /// A version that is installed and waiting for the app to be started again.
    installed: Mutex<Option<String>>,
    busy: AtomicBool,
}

fn fail(code: &str, message: impl Into<String>) -> Value {
    json!({ "code": code, "message": message.into() })
}

/// What went wrong, for someone who has never heard of a signature or a mount point.
fn plain(error: &Error) -> Value {
    match error {
        Error::Reqwest(_) | Error::Network(_) | Error::ReleaseNotFound => fail(
            "offline",
            "Lokus could not reach the update server. Check your internet connection, then try again.",
        ),
        Error::Minisign(_) | Error::Base64(_) | Error::SignatureUtf8(_) | Error::SignedVersionMismatch { .. } | Error::MissingSignedVersion => fail(
            "unsafe",
            "The download did not pass our safety check, so nothing was installed. Try again. If it keeps happening, download Lokus again from our site.",
        ),
        Error::Io(_) | Error::TempDirNotOnSameMountPoint | Error::TempDirNotFound | Error::PreviousAppNotRestored(_) => fail(
            "cannot_replace",
            format!("Lokus could not replace itself with the new version ({error}). Quit Lokus, move it into your Applications folder, open it from there and try again."),
        ),
        Error::AuthenticationFailed => fail(
            "refused",
            "Your computer asked for permission to install the update and did not get it. Try again and allow it.",
        ),
        other => fail("failed", format!("The update did not work ({other}). Try again, or download Lokus again from our site.")),
    }
}

/// The `.app` this copy is running from, on a Mac.
fn bundle() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    exe.ancestors()
        .find(|p| p.extension().is_some_and(|e| e == "app"))
        .map(Path::to_path_buf)
}

/// A reason this copy cannot be replaced where it is, in words that say what to do about it.
fn stuck() -> Option<&'static str> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let app = bundle()?;
    let place = app.to_string_lossy();
    if place.starts_with("/Volumes/") {
        return Some("Lokus is running from the file you downloaded, not from your computer. Quit Lokus, drag it into your Applications folder, open it from there, then update.");
    }
    if place.contains("/AppTranslocation/") {
        return Some("Lokus has not been moved into your Applications folder yet. Quit Lokus, drag it into Applications, open it from there, then update.");
    }
    let folder = app.parent()?;
    let probe = folder.join(format!(".lokus-update-{}", std::process::id()));
    match std::fs::write(&probe, b"") {
        Ok(()) => {
            let _ = std::fs::remove_file(probe);
            None
        }
        Err(_) => Some("Lokus is in a folder it is not allowed to change. Quit Lokus, drag it into your Applications folder, open it from there, then update."),
    }
}

/// Is there a newer version for this computer? `server` is where releases are published.
#[tauri::command]
pub async fn update_check(
    app: AppHandle,
    state: State<'_, Updates>,
    server: String,
) -> Result<Value, Value> {
    let current = app.package_info().version.to_string();
    if let Some(version) = state.installed.lock().ok().and_then(|v| v.clone()) {
        return Ok(json!({ "current": current, "version": version, "installed": true }));
    }
    let server = server.trim_end_matches('/');
    let local = server.starts_with("http://127.0.0.1:") || server.starts_with("http://localhost:");
    if !server.starts_with("https://") && !local {
        return Err(fail(
            "no_server",
            "This copy of Lokus was not told where updates come from.",
        ));
    }
    let endpoint =
        format!("{server}/v1/app/update/{{{{target}}}}/{{{{arch}}}}/{{{{current_version}}}}")
            .parse()
            .map_err(|_| {
                fail(
                    "no_server",
                    "The address updates come from is not a web address.",
                )
            })?;
    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .and_then(|b| b.timeout(Duration::from_secs(20)).build())
        .map_err(|e| plain(&e))?;
    let found = updater.check().await.map_err(|e| plain(&e))?;
    let answer = match &found {
        Some(update) => json!({
            "current": current,
            "version": update.version,
            "notes": update.body.clone().unwrap_or_default(),
            "blocked": stuck(),
        }),
        None => json!({ "current": current, "version": null }),
    };
    if let Ok(mut slot) = state.found.lock() {
        *slot = found;
    }
    Ok(answer)
}

/// Fetch the version the last check found and put it in place of this one. Reports how far
/// along the download is as `update:progress`. The new version runs after a restart.
#[tauri::command]
pub async fn update_install(app: AppHandle, state: State<'_, Updates>) -> Result<Value, Value> {
    let update = state
        .found
        .lock()
        .ok()
        .and_then(|found| found.clone())
        .ok_or_else(|| {
            fail(
                "nothing",
                "There is no update waiting. Check for updates first.",
            )
        })?;
    if let Some(reason) = stuck() {
        return Err(fail("cannot_replace", reason));
    }
    if state.busy.swap(true, Ordering::SeqCst) {
        return Err(fail("busy", "The update is already downloading."));
    }
    let mut received = 0u64;
    let mut shown = u64::MAX;
    let progress = app.clone();
    let outcome = update
        .download_and_install(
            |chunk, total| {
                received += chunk as u64;
                // One message per percent, not one per packet.
                let step = total
                    .filter(|t| *t > 0)
                    .map_or(received / 262_144, |t| received * 100 / t);
                if step != shown {
                    shown = step;
                    let _ = progress.emit(
                        "update:progress",
                        json!({ "received": received, "total": total }),
                    );
                }
            },
            || {
                let _ = progress.emit("update:progress", json!({ "installing": true }));
            },
        )
        .await;
    state.busy.store(false, Ordering::SeqCst);
    outcome.map_err(|e| plain(&e))?;
    if let Ok(mut installed) = state.installed.lock() {
        *installed = Some(update.version.clone());
    }
    Ok(json!({ "version": update.version }))
}

/// Close and open again as the version just installed.
#[tauri::command]
pub fn update_restart(app: AppHandle) {
    crate::sync::stop_for(&app);
    // On a Mac, ask the system to open the app a few seconds from now as well. If the restart
    // below worked this does nothing (the app is already open); if it did not, this opens it.
    #[cfg(target_os = "macos")]
    if let Some(bundle) = bundle() {
        let _ = std::process::Command::new("/bin/sh")
            .args(["-c", "sleep 4; exec /usr/bin/open \"$0\""])
            .arg(bundle)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }
    app.restart();
}

/// Which version this is and what it runs on.
#[tauri::command]
pub fn app_about(app: AppHandle) -> Value {
    json!({
        "version": app.package_info().version.to_string(),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

/// Open a web page in the person's own browser. Only real web addresses.
#[tauri::command]
pub fn open_web(url: String) -> Result<(), Value> {
    if !url.starts_with("https://") {
        return Err(fail("not_web", "That is not a secure web address."));
    }
    open::that(&url).map_err(|e| fail("no_browser", format!("Could not open your browser: {e}")))
}

/// Where this copy is running from, when that is somewhere it should not stay: the disk image
/// it was downloaded in, for one. The window says so as soon as it opens, because from there
/// it cannot update itself and vanishes when the disk is ejected.
#[tauri::command]
pub fn app_place() -> Value {
    json!({ "misplaced": stuck() })
}

#[tauri::command]
pub fn app_quit(app: AppHandle) {
    crate::sync::stop_for(&app);
    app.exit(0);
}

//! @part-of core.watch
//! Tell the shell when files change outside the app (git, another editor).

use std::collections::BTreeSet;
use std::sync::mpsc;
use std::time::Duration;

use notify::{RecursiveMode, Watcher};

use crate::error::{CoreError, Result};
use crate::vault::{is_temp_file, Vault, META_DIR};

/// Changes are collected for this long so a burst arrives as one batch.
const QUIET: Duration = Duration::from_millis(150);

/// Keeps the watcher alive; drop it to stop watching.
pub struct WatchHandle {
    _watcher: notify::RecommendedWatcher,
}

/// Calls `on_change` with vault-relative paths that were created, changed or
/// removed. `.lokus/`, dotfiles and Lokus's own temp files are ignored.
pub fn watch(
    vault: &Vault,
    on_change: impl Fn(Vec<String>) + Send + 'static,
) -> Result<WatchHandle> {
    let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();
    let mut watcher =
        notify::recommended_watcher(tx).map_err(|e| CoreError::Watch(e.to_string()))?;
    watcher
        .watch(vault.root(), RecursiveMode::Recursive)
        .map_err(|e| CoreError::Watch(e.to_string()))?;

    let vault = vault.clone();
    std::thread::spawn(move || {
        // Ends when the watcher (and with it the sender) is dropped.
        while let Ok(first) = rx.recv() {
            let mut batch = BTreeSet::new();
            let mut collect = |event: notify::Result<notify::Event>| {
                let Ok(event) = event else { return };
                if matches!(event.kind, notify::EventKind::Access(_)) {
                    return;
                }
                for path in event.paths {
                    if is_temp_file(&path) {
                        continue;
                    }
                    let Some(rel) = vault.relative(&path) else {
                        continue;
                    };
                    if rel
                        .split('/')
                        .any(|part| part == META_DIR || part.starts_with('.'))
                    {
                        continue;
                    }
                    batch.insert(rel);
                }
            };
            collect(first);
            while let Ok(next) = rx.recv_timeout(QUIET) {
                collect(next);
            }
            if !batch.is_empty() {
                on_change(batch.into_iter().collect());
            }
        }
    });

    Ok(WatchHandle { _watcher: watcher })
}

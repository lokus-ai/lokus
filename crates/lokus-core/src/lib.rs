//! @part-of core
//! The Lokus engine: everything that touches a vault lives here.
//!
//! This crate knows nothing about Tauri, windows or the network. Shells
//! (desktop app, CLI, later the sync client) call [`commands::run`].

pub mod chats;
pub mod commands;
pub mod error;
pub mod frontmatter;
pub mod history;
pub mod index;
pub mod ingest;
pub mod noticed;
pub mod plugins;
pub mod starter;
pub mod tasks;
pub mod things;
pub mod vault;
pub mod watch;

pub use error::{CoreError, Result};
pub use vault::Vault;

use std::sync::Mutex;

/// An open vault together with its index. This is what commands run against.
pub struct Core {
    pub vault: Vault,
    index: Mutex<index::Index>,
}

impl Core {
    pub fn open(root: impl AsRef<std::path::Path>) -> Result<Self> {
        let vault = Vault::open(root)?;
        let index = Mutex::new(index::Index::open(&vault)?);
        Ok(Self { vault, index })
    }

    pub fn index(&self) -> Result<std::sync::MutexGuard<'_, index::Index>> {
        self.index.lock().map_err(|_| {
            CoreError::Index("the index is unavailable after an earlier failure".into())
        })
    }
}

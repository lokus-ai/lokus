//! @part-of core
//! The Lokus engine: everything that touches a vault lives here.
//!
//! This crate knows nothing about Tauri, windows or the network. Shells
//! (desktop app, CLI, later the sync client) call [`commands::run`].

pub mod commands;
pub mod error;
pub mod vault;
pub mod watch;

pub use error::{CoreError, Result};
pub use vault::Vault;

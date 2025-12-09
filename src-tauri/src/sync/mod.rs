// Sync module - Multiple synchronization providers
// Provides commands for Git and Iroh operations to enable cross-device sync
// Includes file watcher and sync manager for automatic synchronization

pub mod git;
pub mod iroh;
pub mod provider;
pub mod file_watcher;
pub mod manager;

pub use git::*;
pub use iroh::*;
// Re-exports are available but not currently used
// pub use provider::*;
// pub use file_watcher::*;
// pub use manager::*;

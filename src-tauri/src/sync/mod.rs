// Sync module - Multiple synchronization providers
// Provides commands for Git and Iroh operations to enable cross-device sync
// Includes file watcher and sync manager for automatic synchronization
// V2 implementation with enterprise-grade architecture

pub mod git;
pub mod iroh;
pub mod iroh_v2_minimal;
#[allow(dead_code, unused_variables)]
pub mod iroh_v2_enterprise;
#[allow(dead_code, unused_variables)]
pub mod provider;
#[allow(dead_code, unused_variables)]
pub mod file_watcher;
#[allow(dead_code, unused_variables)]
pub mod manager;
pub mod wrapper;
pub mod commands_simple;
#[allow(dead_code, unused_variables)]
pub mod network_monitor;
#[allow(dead_code, unused_variables)]
pub mod retry_utils;

// Export Git commands
pub use git::*;

// Export Iroh commands from the new commands module
pub use commands_simple::*;

// Re-exports are available but not currently used
// pub use provider::*;
// pub use file_watcher::*;
// pub use manager::*;

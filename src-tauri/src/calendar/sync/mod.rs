//! Calendar Sync Module
//!
//! Provides intelligent bidirectional sync between calendar providers with:
//! - Event fingerprinting for duplicate detection
//! - Conflict resolution (last-modified wins)
//! - Deduplication in display
//! - Read-only handling for iCal subscriptions

pub mod fingerprint;
pub mod storage;
pub mod dedup;
pub mod engine;

pub use fingerprint::*;
pub use storage::SyncStorage;
pub use dedup::*;
pub use engine::SyncEngine;

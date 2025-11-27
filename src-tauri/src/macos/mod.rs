//! macOS-specific functionality module
//!
//! This module contains macOS-specific implementations including
//! security-scoped bookmarks for persistent file system access.

#[cfg(target_os = "macos")]
pub mod bookmarks;

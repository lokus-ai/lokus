//! Calendar V2 — local-first, multi-account calendar backend.
//!
//! Architecture (see CALENDAR_BACKEND_V2.md at repo root): a SQLite database
//! is the single source of truth; the UI only ever reads locally; per-account
//! sync engines are the only writers of remote data; local edits flow through
//! an outbox. This module tree is the V2 side; `crate::calendar` (V1) keeps
//! working until the frontend swap, then dies.

pub mod commands;
pub mod expand;
pub mod models;
pub mod schema;
pub mod store;

pub use store::CalendarStore;

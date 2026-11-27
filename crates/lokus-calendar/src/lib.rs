//! @part-of calendar
//! The calendar. Lokus owns no calendar: it is a client of Google Calendar and Microsoft 365,
//! which keep the events and send the invitation emails. This crate signs in to them, keeps a
//! local copy so the calendar opens at once and works offline, queues what is changed offline,
//! and offers every feature as a command (`commands::run`). Nothing here goes through the Lokus
//! server. Networking is why this is not in `lokus-core`.

pub mod auth;
pub mod commands;
mod google;
mod microsoft;
pub mod model;
pub mod notes;
mod provider;
pub mod store;
pub mod sync;
pub mod team;

pub use commands::{assistant, command_of, run, tools, Spec, COMMANDS};
pub use model::{CalError, Event, Provider, Result};
pub use store::Store;

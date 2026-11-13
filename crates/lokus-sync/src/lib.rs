//! @part-of sync
//! Sync for a vault: [`engine`] merges files and documents, [`client`] talks
//! to the relay. The engine works without a network; the client only moves
//! what the engine has queued.

pub mod client;
pub mod engine;
pub mod error;

pub use engine::{Engine, Event};
pub use error::{Error, Result};

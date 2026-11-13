//! @part-of ai
//! The assistant. Every call to a model provider or a tool server is made
//! here, in Rust, with the person's own key from the OS keychain, so the UI
//! and plugins never hold a key.

pub mod chat;
pub mod config;
pub mod error;
pub mod mcp;
pub mod provider;
pub mod tools;

pub use chat::{send, Approver, Event, Outcome, Request};
pub use config::{Config, McpServer, Provider};
pub use error::{AiError, Result};

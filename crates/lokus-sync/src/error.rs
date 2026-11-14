//! @part-of sync
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Core(#[from] lokus_core::CoreError),
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("sync state: {0}")]
    Store(#[from] rusqlite::Error),
    #[error("could not read an edit: {0}")]
    Crdt(String),
    #[error("this note is not synced: {0}")]
    UnknownDoc(String),
    #[error("connection: {0}")]
    Net(String),
    #[error("this vault is already syncing in another window or program")]
    InUse,
    #[error("the relay refused: {0}")]
    Refused(String),
}

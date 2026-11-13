//! @part-of server
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("sign in first")]
    Unauthorized,
    #[error("you do not have access to this")]
    Forbidden,
    #[error("{0} not found")]
    NotFound(&'static str),
    #[error("{0}")]
    BadRequest(String),
    #[error("storage: {0}")]
    Store(#[from] rusqlite::Error),
    #[error("internal: {0}")]
    Internal(String),
}

impl Error {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Unauthorized => "unauthorized",
            Self::Forbidden => "forbidden",
            Self::NotFound(_) => "not_found",
            Self::BadRequest(_) => "bad_request",
            Self::Store(_) | Self::Internal(_) => "internal",
        }
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let status = match self {
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Store(_) | Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        // Internal detail goes to the log, never to the client.
        let message = if status == StatusCode::INTERNAL_SERVER_ERROR {
            eprintln!("error: {self}");
            "something went wrong".to_string()
        } else {
            self.to_string()
        };
        (status, Json(json!({ "code": self.code(), "message": message }))).into_response()
    }
}

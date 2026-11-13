//! @part-of server
//! The Lokus relay. It knows who may read or write a workspace, keeps every
//! edit in order, and passes edits between the devices that are online.
//! It never interprets a note; edits are opaque CRDT updates.

pub mod auth;
pub mod error;
pub mod store;
mod ws;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::broadcast;

use auth::{Auth, Identity};
use error::{Error, Result};
use store::{Role, Store};

/// A message for everyone in a workspace except the connection it came from.
#[derive(Clone)]
pub(crate) struct Fanout {
    pub from: u64,
    pub json: Arc<str>,
}

pub struct App {
    pub store: Store,
    pub auth: Auth,
    rooms: Mutex<HashMap<String, broadcast::Sender<Fanout>>>,
    next_conn: std::sync::atomic::AtomicU64,
}

impl App {
    pub fn new(store: Store, auth: Auth) -> Arc<Self> {
        Arc::new(Self {
            store,
            auth,
            rooms: Mutex::new(HashMap::new()),
            next_conn: 1.into(),
        })
    }

    pub(crate) fn room(&self, workspace: &str) -> broadcast::Sender<Fanout> {
        let mut rooms = self.rooms.lock().unwrap_or_else(|e| e.into_inner());
        rooms
            .entry(workspace.to_string())
            .or_insert_with(|| broadcast::channel(1024).0)
            .clone()
    }

    pub(crate) fn conn_id(&self) -> u64 {
        self.next_conn
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }

    async fn caller(&self, headers: &HeaderMap) -> Result<Identity> {
        let token = headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(Error::Unauthorized)?;
        self.auth.identify(token).await
    }

    fn require(&self, workspace: &str, user: &str) -> Result<Role> {
        self.store.role(workspace, user)?.ok_or(Error::Forbidden)
    }
}

pub fn router(app: Arc<App>) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route(
            "/v1/workspaces",
            get(list_workspaces).post(create_workspace),
        )
        .route("/v1/workspaces/{id}/members", get(list_members))
        .route("/v1/workspaces/{id}/invites", post(create_invite))
        .route("/v1/invites/{code}/accept", post(accept_invite))
        .route("/v1/ws", get(ws::upgrade))
        .with_state(app)
}

#[derive(Deserialize)]
struct NewWorkspace {
    name: String,
}

async fn create_workspace(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Json(body): Json<NewWorkspace>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    let name = body.name.trim();
    if name.is_empty() || name.len() > 120 {
        return Err(Error::BadRequest(
            "a workspace needs a name of up to 120 characters".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    app.store
        .create_workspace(&id, name, &me.user, me.email.as_deref())?;
    Ok(Json(json!({ "id": id, "name": name, "role": "owner" })))
}

async fn list_workspaces(State(app): State<Arc<App>>, headers: HeaderMap) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    Ok(Json(json!(app.store.workspaces_of(&me.user)?)))
}

async fn list_members(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require(&id, &me.user)?;
    Ok(Json(json!(app.store.members(&id)?)))
}

#[derive(Deserialize)]
struct NewInvite {
    role: String,
}

async fn create_invite(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<NewInvite>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    if app.require(&id, &me.user)? != Role::Owner {
        return Err(Error::Forbidden);
    }
    let role = match Role::parse(&body.role) {
        Some(Role::Editor) => Role::Editor,
        Some(Role::Viewer) => Role::Viewer,
        _ => {
            return Err(Error::BadRequest(
                "an invite is for an editor or a viewer".into(),
            ))
        }
    };
    let code = uuid::Uuid::new_v4().simple().to_string();
    app.store.create_invite(&code, &id, role, &me.user)?;
    Ok(Json(json!({ "code": code, "role": role.name() })))
}

async fn accept_invite(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    let workspace = app
        .store
        .accept_invite(&code, &me.user, me.email.as_deref())?;
    Ok(Json(json!({ "workspace": workspace })))
}

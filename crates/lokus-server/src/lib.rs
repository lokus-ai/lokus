//! @part-of server
//! The Lokus relay. It knows who may read or write a workspace, keeps every
//! edit in order, and passes edits between the devices that are online.
//! It never interprets a note; edits are opaque CRDT updates.

pub mod auth;
pub mod error;
mod inbox;
mod releases;
pub mod store;
mod ws;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::HeaderMap;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::broadcast;

use auth::{Auth, Identity};
use error::{Error, Result};
use store::{now, Role, Store};

/// The largest attachment the relay stores.
pub const MAX_BLOB: usize = 25 * 1024 * 1024;

/// How long an invite can be used for.
const INVITE_LIFE: i64 = 7 * 24 * 60 * 60;

/// The relay's adjustable limits.
#[derive(Debug, Clone, Copy)]
pub struct Limits {
    /// The most attachment bytes one workspace may hold. `LOKUS_WORKSPACE_BYTES`.
    pub workspace_bytes: u64,
    /// Seconds an open socket is left alone after its sign-in runs out, so a device that is
    /// about to send a fresh one is not cut off. `LOKUS_SIGN_IN_GRACE`.
    pub sign_in_grace: i64,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            workspace_bytes: 5 * 1024 * 1024 * 1024,
            sign_in_grace: 60,
        }
    }
}

impl Limits {
    pub fn from_env() -> Self {
        let read = |name: &str| std::env::var(name).ok().and_then(|v| v.parse().ok());
        let default = Self::default();
        Self {
            workspace_bytes: read("LOKUS_WORKSPACE_BYTES").unwrap_or(default.workspace_bytes),
            sign_in_grace: read("LOKUS_SIGN_IN_GRACE")
                .map(|v: u64| v as i64)
                .unwrap_or(default.sign_in_grace),
        }
    }
}

/// Someone's place in a workspace changed. Open sockets look their own up again.
#[derive(Clone)]
pub(crate) struct Changed {
    pub workspace: String,
    /// Whose; `None` when it is everyone's (the workspace was deleted).
    pub user: Option<String>,
}

/// A message for everyone in a workspace except the connection it came from.
#[derive(Clone)]
pub(crate) struct Fanout {
    pub from: u64,
    pub json: Arc<str>,
}

pub struct App {
    pub store: Store,
    pub auth: Auth,
    pub limits: Limits,
    /// What a publisher of releases and news must present. `None`: nothing can be published.
    pub(crate) publish_key: Option<String>,
    pub(crate) changes: broadcast::Sender<Changed>,
    rooms: Mutex<HashMap<String, broadcast::Sender<Fanout>>>,
    next_conn: std::sync::atomic::AtomicU64,
}

impl App {
    pub fn new(store: Store, auth: Auth, limits: Limits) -> Arc<Self> {
        Self::with_publisher(store, auth, limits, None)
    }

    /// A relay that also hands out the app's own releases and news, published with this key.
    pub fn with_publisher(store: Store, auth: Auth, limits: Limits, publish_key: Option<String>) -> Arc<Self> {
        Arc::new(Self {
            store,
            auth,
            limits,
            publish_key: publish_key.filter(|k| k.len() >= 24),
            changes: broadcast::channel(256).0,
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

    fn require_owner(&self, workspace: &str, user: &str) -> Result<()> {
        match self.require(workspace, user)? {
            Role::Owner => Ok(()),
            _ => Err(Error::Forbidden),
        }
    }

    /// Tell open sockets that `user`'s place in `workspace` changed (everyone's, if `None`).
    fn changed(&self, workspace: &str, user: Option<&str>) {
        let _ = self.changes.send(Changed {
            workspace: workspace.to_string(),
            user: user.map(str::to_string),
        });
    }
}

pub fn router(app: Arc<App>) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route(
            "/v1/workspaces",
            get(list_workspaces).post(create_workspace),
        )
        .route("/v1/workspaces/{id}", delete(delete_workspace))
        .route("/v1/workspaces/{id}/members", get(list_members))
        .route(
            "/v1/workspaces/{id}/members/{user}",
            delete(remove_member).patch(change_role),
        )
        .route(
            "/v1/workspaces/{id}/invites",
            get(list_invites).post(create_invite),
        )
        .route("/v1/workspaces/{id}/invites/{code}", delete(revoke_invite))
        .route("/v1/workspaces/{id}/audit", get(list_audit))
        .route("/v1/invites/{code}/accept", post(accept_invite))
        .route(
            "/v1/workspaces/{id}/blobs/{hash}",
            get(get_blob)
                .put(put_blob)
                .layer(DefaultBodyLimit::max(MAX_BLOB + 1024)),
        )
        .route(
            "/v1/workspaces/{id}/keys",
            get(inbox::list_keys).post(inbox::create_key),
        )
        .route("/v1/workspaces/{id}/keys/{key}", delete(inbox::revoke_key))
        .route("/v1/workspaces/{id}/inbox/claim", post(inbox::claim))
        .route("/v1/workspaces/{id}/inbox/ack", post(inbox::ack))
        .route(
            "/v1/ingest",
            post(inbox::ingest).layer(DefaultBodyLimit::max(inbox::MAX_BODY)),
        )
        .route("/v1/app/update/{target}/{arch}/{current}", get(releases::update))
        .route("/v1/app/releases", get(releases::list))
        .route(
            "/v1/app/releases/{version}",
            post(releases::publish)
                .delete(releases::pull)
                .layer(DefaultBodyLimit::max(releases::MAX_BODY)),
        )
        .route("/v1/app/news", get(releases::news))
        .route(
            "/v1/app/news/{id}",
            post(releases::post)
                .delete(releases::unpost)
                .layer(DefaultBodyLimit::max(releases::MAX_BODY)),
        )
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
    if name.is_empty() || name.chars().count() > 120 || name.chars().any(char::is_control) {
        return Err(Error::BadRequest(
            "a workspace needs a name of up to 120 characters, on one line".into(),
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
    app.require_owner(&id, &me.user)?;
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
    let expires_at = now() + INVITE_LIFE;
    app.store
        .create_invite(&code, &id, role, &me.user, expires_at)?;
    Ok(Json(
        json!({ "code": code, "role": role.name(), "expires_at": expires_at }),
    ))
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

async fn list_invites(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    Ok(Json(json!(app.store.invites(&id)?)))
}

async fn revoke_invite(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, code)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    app.store.revoke_invite(&id, &code, &me.user)?;
    Ok(Json(json!({ "cancelled": true })))
}

#[derive(Deserialize)]
struct NewRole {
    role: String,
}

/// An owner gives a member another role. It takes effect on their open connections at once.
async fn change_role(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, user)): Path<(String, String)>,
    Json(body): Json<NewRole>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    let role = Role::parse(&body.role)
        .ok_or_else(|| Error::BadRequest("a role is owner, editor or viewer".into()))?;
    app.store.set_role(&id, &user, role, &me.user)?;
    app.changed(&id, Some(&user));
    Ok(Json(json!({ "user": user, "role": role.name() })))
}

/// An owner removes a member, or a member leaves. Their open connections are cut off at once.
async fn remove_member(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, user)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    let mine = app.require(&id, &me.user)?;
    if user != me.user && mine != Role::Owner {
        return Err(Error::Forbidden);
    }
    app.store.remove_member(&id, &user, &me.user)?;
    app.changed(&id, Some(&user));
    Ok(Json(json!({ "removed": user })))
}

/// An owner deletes a workspace: its notes' history, attachments, members and invites.
async fn delete_workspace(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    app.store.delete_workspace(&id, &me.user)?;
    app.changed(&id, None);
    Ok(Json(json!({ "deleted": id })))
}

/// Who changed who may do what, newest first. Owners only.
async fn list_audit(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    Ok(Json(json!(app.store.audit(&id, 200)?)))
}

/// Store an attachment (an image, a PDF) under the hash of its bytes.
async fn put_blob(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, hash)): Path<(String, String)>,
    body: Bytes,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    if !app.require(&id, &me.user)?.can_edit() {
        return Err(Error::Forbidden);
    }
    if body.len() > MAX_BLOB {
        return Err(Error::BadRequest("attachments are limited to 25 MB".into()));
    }
    if blake3::hash(&body).to_hex().as_str() != hash {
        return Err(Error::BadRequest(
            "the bytes do not match their hash".into(),
        ));
    }
    app.store
        .put_blob(&id, &hash, &body, &me.user, app.limits.workspace_bytes)?;
    Ok(Json(json!({ "hash": hash, "size": body.len() })))
}

async fn get_blob(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, hash)): Path<(String, String)>,
) -> Result<Vec<u8>> {
    let me = app.caller(&headers).await?;
    app.require(&id, &me.user)?;
    app.store
        .blob(&id, &hash)?
        .ok_or(Error::NotFound("attachment"))
}

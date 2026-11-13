//! @part-of server
//! One websocket per device per workspace.
//!
//! The role is checked once, when the socket opens. After that each edit is
//! a cheap append; viewers are simply never allowed to send one.

use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::Response;
use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use yrs::updates::decoder::Decode;

use crate::error::{Error, Result};
use crate::store::Role;
use crate::{App, Fanout};

#[derive(Deserialize)]
pub struct Params {
    workspace: String,
    token: String,
}

pub async fn upgrade(
    State(app): State<Arc<App>>,
    Query(params): Query<Params>,
    socket: WebSocketUpgrade,
) -> Result<Response> {
    let me = app.auth.identify(&params.token).await?;
    let role = app.require(&params.workspace, &me.user)?;
    Ok(socket
        .max_message_size(8 * 1024 * 1024)
        .on_upgrade(move |socket| serve(app, socket, params.workspace, me.user, me.email, role)))
}

#[derive(Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
enum Incoming {
    /// Everything stored after `since`.
    Pull { since: i64 },
    /// One edit to a note (or to the workspace's list of notes).
    Up { id: u64, doc: String, data: String },
    /// Cursor and presence; passed on, never stored.
    Aw { doc: String, data: Value },
}

async fn serve(
    app: Arc<App>,
    socket: WebSocket,
    workspace: String,
    user: String,
    email: Option<String>,
    role: Role,
) {
    let conn = app.conn_id();
    let room = app.room(&workspace);
    let mut feed = room.subscribe();
    let (mut out, mut inbox) = socket.split();
    let hello = json!({ "t": "hello", "conn": conn, "user": user, "role": role.name() });
    if out
        .send(Message::Text(hello.to_string().into()))
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            fanned = feed.recv() => match fanned {
                Ok(msg) if msg.from != conn => {
                    if out.send(Message::Text(msg.json.to_string().into())).await.is_err() { break; }
                }
                Ok(_) => {}
                // Too far behind the live feed: the client pulls again from its last position.
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    if out.send(Message::Text(json!({ "t": "resync" }).to_string().into())).await.is_err() { break; }
                }
                Err(_) => break,
            },
            received = inbox.next() => {
                let Some(Ok(message)) = received else { break };
                let Message::Text(text) = message else { continue };
                let reply = match serde_json::from_str::<Incoming>(&text) {
                    Ok(incoming) => handle(&app, &room, conn, &workspace, &user, email.as_deref(), role, incoming),
                    Err(e) => Err(Error::BadRequest(e.to_string())),
                };
                let reply = reply.unwrap_or_else(|e| {
                    if matches!(e, Error::Store(_) | Error::Internal(_)) { eprintln!("ws error: {e}"); }
                    Some(json!({ "t": "error", "code": e.code(), "message": e.to_string() }))
                });
                if let Some(reply) = reply {
                    if out.send(Message::Text(reply.to_string().into())).await.is_err() { break; }
                }
            }
        }
    }
    let _ = room.send(Fanout {
        from: conn,
        json: json!({ "t": "bye", "conn": conn }).to_string().into(),
    });
}

#[allow(clippy::too_many_arguments)]
fn handle(
    app: &App,
    room: &tokio::sync::broadcast::Sender<Fanout>,
    conn: u64,
    workspace: &str,
    user: &str,
    email: Option<&str>,
    role: Role,
    incoming: Incoming,
) -> Result<Option<Value>> {
    match incoming {
        Incoming::Pull { since } => {
            let (items, head) = app.store.since(workspace, since)?;
            Ok(Some(
                json!({ "t": "updates", "items": items, "head": head }),
            ))
        }
        Incoming::Up { id, doc, data } => {
            if !role.can_edit() {
                return Err(Error::Forbidden);
            }
            if doc.is_empty() || doc.len() > 200 {
                return Err(Error::BadRequest("bad document id".into()));
            }
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&data)
                .map_err(|_| Error::BadRequest("update is not base64".into()))?;
            // Refuse anything that is not a well-formed update before it reaches the log.
            yrs::Update::decode_v1(&bytes)
                .map_err(|_| Error::BadRequest("update is malformed".into()))?;
            let seq = app.store.append(workspace, &doc, &bytes)?;
            let fan = json!({ "t": "up", "doc": doc, "seq": seq, "data": data, "user": user });
            let _ = room.send(Fanout {
                from: conn,
                json: fan.to_string().into(),
            });
            Ok(Some(json!({ "t": "ack", "id": id, "seq": seq })))
        }
        Incoming::Aw { doc, data } => {
            let fan = json!({ "t": "aw", "doc": doc, "conn": conn, "user": user, "email": email, "data": data });
            let _ = room.send(Fanout {
                from: conn,
                json: fan.to_string().into(),
            });
            Ok(None)
        }
    }
}

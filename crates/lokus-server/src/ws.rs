//! @part-of server
//! One websocket per device per workspace.
//!
//! A socket says who it is in its first message, never in its address, where proxies and logs
//! would keep the sign-in. After that each edit is a cheap append, but the socket keeps
//! listening for the three things that end or change what it may do: its sign-in running out,
//! its role changing, and being removed from the workspace.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::Response;
use base64::Engine;
use futures_util::stream::SplitSink;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::broadcast::error::RecvError;
use yrs::updates::decoder::Decode;

use crate::error::{Error, Result};
use crate::store::{now, Role};
use crate::{App, Fanout};

/// How long a new socket has to say who it is.
const HELLO_WAIT: Duration = Duration::from_secs(10);
/// Edits and cursor moves one socket may send: this many at once, then this many a second.
/// A socket that sends faster is slowed down, never cut off, so nothing it sent is lost.
const BURST: f64 = 500.0;
const PER_SECOND: f64 = 200.0;

pub async fn upgrade(State(app): State<Arc<App>>, socket: WebSocketUpgrade) -> Response {
    socket
        .max_message_size(8 * 1024 * 1024)
        .on_upgrade(move |socket| serve(app, socket))
}

#[derive(Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
enum Incoming {
    /// Who this is. The first message names the workspace too; later ones renew the sign-in.
    Auth {
        token: String,
        workspace: Option<String>,
    },
    /// Everything stored after `since`.
    Pull { since: i64 },
    /// One edit to a note (or to the workspace's list of notes).
    Up { id: u64, doc: String, data: String },
    /// Cursor and presence; passed on, never stored.
    Aw { doc: String, data: Value },
}

/// The most a cursor-and-presence message may carry; it is passed to everyone, so it stays small.
const PRESENCE_BYTES: usize = 64 * 1024;

/// A note's id is a UUID, or the word "manifest": letters, digits, `-` and `_` only.
fn doc_id(doc: &str) -> Result<()> {
    let ok = !doc.is_empty()
        && doc.len() <= 64
        && doc
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    if ok {
        Ok(())
    } else {
        Err(Error::BadRequest("bad document id".into()))
    }
}

/// What a socket is allowed to do right now.
struct Session {
    workspace: String,
    user: String,
    email: Option<String>,
    role: Role,
    /// When the sign-in runs out, in seconds since 1970. Development tokens never do.
    expires: Option<i64>,
}

/// A leaky bucket: sending drains it, time refills it, and an empty one makes the sender wait.
struct Pace {
    tokens: f64,
    at: Instant,
}

impl Pace {
    fn new() -> Self {
        Self {
            tokens: BURST,
            at: Instant::now(),
        }
    }

    async fn take(&mut self) {
        let fill = |pace: &mut Self| {
            let passed = pace.at.elapsed().as_secs_f64();
            pace.at = Instant::now();
            pace.tokens = (pace.tokens + passed * PER_SECOND).min(BURST);
        };
        fill(self);
        if self.tokens < 1.0 {
            tokio::time::sleep(Duration::from_secs_f64((1.0 - self.tokens) / PER_SECOND)).await;
            fill(self);
        }
        self.tokens -= 1.0;
    }
}

type Out = SplitSink<WebSocket, Message>;

async fn tell(out: &mut Out, value: Value) -> bool {
    out.send(Message::Text(value.to_string().into()))
        .await
        .is_ok()
}

fn refusal(e: &Error) -> Value {
    if matches!(e, Error::Store(_) | Error::Internal(_)) {
        eprintln!("ws error: {e}");
        return json!({ "t": "error", "code": e.code(), "message": "something went wrong" });
    }
    json!({ "t": "error", "code": e.code(), "message": e.to_string() })
}

/// Read a socket's first message: it must be a sign-in for a workspace the person is in.
async fn open(app: &App, text: &str) -> Result<Session> {
    let Ok(Incoming::Auth {
        token,
        workspace: Some(workspace),
    }) = serde_json::from_str::<Incoming>(text)
    else {
        return Err(Error::Unauthorized);
    };
    let me = app.auth.identify(&token).await?;
    let role = app.require(&workspace, &me.user)?;
    Ok(Session {
        workspace,
        user: me.user,
        email: me.email,
        role,
        expires: me.expires,
    })
}

/// Resolves when the sign-in has run out (plus the relay's grace), or never if it cannot.
async fn run_out(expires: Option<i64>, grace: i64) {
    match expires {
        Some(at) => {
            let left = (at + grace - now()).max(0) as u64;
            tokio::time::sleep(Duration::from_secs(left)).await;
        }
        None => std::future::pending().await,
    }
}

async fn serve(app: Arc<App>, socket: WebSocket) {
    let (mut out, mut inbox) = socket.split();
    let first = tokio::time::timeout(HELLO_WAIT, inbox.next()).await;
    let opened = match first {
        Ok(Some(Ok(Message::Text(text)))) => open(&app, &text).await,
        _ => Err(Error::Unauthorized),
    };
    let mut me = match opened {
        Ok(session) => session,
        Err(e) => {
            let _ = tell(&mut out, refusal(&e)).await;
            let _ = out.close().await;
            return;
        }
    };

    let conn = app.conn_id();
    let room = app.room(&me.workspace);
    let mut feed = room.subscribe();
    let mut changes = app.changes.subscribe();
    let mut pace = Pace::new();
    let hello = json!({ "t": "hello", "conn": conn, "user": me.user, "role": me.role.name() });
    if !tell(&mut out, hello).await {
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
                Err(RecvError::Lagged(_)) => {
                    if !tell(&mut out, json!({ "t": "resync" })).await { break; }
                }
                Err(_) => break,
            },
            changed = changes.recv() => {
                // Someone's place in a workspace changed. If it may be ours, look ours up again:
                // a removed person is cut off now, not whenever they next reconnect.
                let ours = match &changed {
                    Ok(c) => c.workspace == me.workspace && c.user.as_deref().is_none_or(|u| u == me.user),
                    Err(RecvError::Lagged(_)) => true,
                    Err(_) => break,
                };
                if !ours { continue; }
                match app.store.role(&me.workspace, &me.user) {
                    Ok(Some(role)) if role == me.role => {}
                    Ok(Some(role)) => {
                        me.role = role;
                        if !tell(&mut out, json!({ "t": "role", "role": role.name() })).await { break; }
                    }
                    Ok(None) => {
                        let gone = json!({ "t": "error", "code": "forbidden", "message": "you no longer have access to this workspace" });
                        let _ = tell(&mut out, gone).await;
                        break;
                    }
                    Err(e) => {
                        let _ = tell(&mut out, refusal(&e)).await;
                        break;
                    }
                }
            },
            () = run_out(me.expires, app.limits.sign_in_grace) => {
                let over = json!({ "t": "error", "code": "unauthorized", "message": "your sign-in ran out; sign in again" });
                let _ = tell(&mut out, over).await;
                break;
            },
            received = inbox.next() => {
                let Some(Ok(message)) = received else { break };
                let Message::Text(text) = message else { continue };
                let reply = match serde_json::from_str::<Incoming>(&text) {
                    Ok(Incoming::Auth { token, .. }) => renew(&app, &mut me, &token).await,
                    Ok(incoming) => {
                        if matches!(incoming, Incoming::Up { .. } | Incoming::Aw { .. }) {
                            pace.take().await;
                        }
                        handle(&app, &room, conn, &me, incoming)
                    }
                    Err(e) => Err(Error::BadRequest(e.to_string())),
                };
                let reply = reply.unwrap_or_else(|e| Some(refusal(&e)));
                if let Some(reply) = reply {
                    if !tell(&mut out, reply).await { break; }
                }
            }
        }
    }
    // Say goodbye properly, so whatever was just sent (a refusal, say) is read before the close.
    let _ = out.close().await;
    let _ = room.send(Fanout {
        from: conn,
        json: json!({ "t": "bye", "conn": conn }).to_string().into(),
    });
}

/// A fresh sign-in for a socket that is already open. It must be the same person.
async fn renew(app: &App, me: &mut Session, token: &str) -> Result<Option<Value>> {
    let again = app.auth.identify(token).await?;
    if again.user != me.user {
        return Err(Error::Forbidden);
    }
    me.expires = again.expires;
    Ok(Some(json!({ "t": "authed" })))
}

fn handle(
    app: &App,
    room: &tokio::sync::broadcast::Sender<Fanout>,
    conn: u64,
    me: &Session,
    incoming: Incoming,
) -> Result<Option<Value>> {
    match incoming {
        Incoming::Auth { .. } => Ok(None),
        Incoming::Pull { since } => {
            let (items, head) = app.store.since(&me.workspace, since)?;
            Ok(Some(
                json!({ "t": "updates", "items": items, "head": head }),
            ))
        }
        Incoming::Up { id, doc, data } => {
            if !me.role.can_edit() {
                return Err(Error::Forbidden);
            }
            doc_id(&doc)?;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&data)
                .map_err(|_| Error::BadRequest("update is not base64".into()))?;
            // Refuse anything that is not a well-formed update before it reaches the log.
            yrs::Update::decode_v1(&bytes)
                .map_err(|_| Error::BadRequest("update is malformed".into()))?;
            let seq = app.store.append(&me.workspace, &doc, &bytes, &me.user)?;
            let fan = json!({ "t": "up", "doc": doc, "seq": seq, "data": data, "user": me.user });
            let _ = room.send(Fanout {
                from: conn,
                json: fan.to_string().into(),
            });
            Ok(Some(json!({ "t": "ack", "id": id, "seq": seq })))
        }
        Incoming::Aw { doc, data } => {
            doc_id(&doc)?;
            // Presence is a short packed string; anything else is not passed on.
            if !data.as_str().is_some_and(|s| s.len() <= PRESENCE_BYTES) {
                return Err(Error::BadRequest("bad presence message".into()));
            }
            let fan = json!({ "t": "aw", "doc": doc, "conn": conn, "user": me.user, "email": me.email, "data": data });
            let _ = room.send(Fanout {
                from: conn,
                json: fan.to_string().into(),
            });
            Ok(None)
        }
    }
}

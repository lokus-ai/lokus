//! @part-of sync
//! The connection to the relay. It moves what the engine has queued, hands
//! the engine what arrives, and reconnects for as long as it runs. Being
//! offline is normal: edits wait in the engine's outbox.

use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::sync::{mpsc, Notify};
use tokio_tungstenite::tungstenite::Message;

use lokus_core::watch::watch;
use lokus_core::Vault;

use crate::engine::Engine;
use crate::error::{Error, Result};

/// The sign-in a connection presents. It can be replaced while the connection runs: account
/// sign-ins last about an hour, and a fresh one is handed over before the old one runs out.
#[derive(Clone)]
pub struct Token(Arc<std::sync::RwLock<String>>);

impl Token {
    pub fn new(token: impl Into<String>) -> Self {
        Self(Arc::new(std::sync::RwLock::new(token.into())))
    }
    pub fn get(&self) -> String {
        self.0.read().map(|t| t.clone()).unwrap_or_default()
    }
    pub fn set(&self, token: impl Into<String>) {
        if let Ok(mut held) = self.0.write() {
            *held = token.into();
        }
    }
}

// Never printed: a sign-in must not end up in a log.
impl std::fmt::Debug for Token {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Token(..)")
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    /// `http://host:port` or `https://host`.
    pub server: String,
    pub workspace: String,
    pub token: Token,
}

const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;
const RETRY: Duration = Duration::from_secs(3);
/// How often an open connection checks whether it has been handed a newer sign-in.
const RENEW_CHECK: Duration = Duration::from_secs(20);

/// What the app can ask a running connection to do.
pub enum Nudge {
    /// Something was queued or a file changed: scan and send.
    Changed,
    /// Cursor and presence for one note; passed on, never stored.
    Awareness { doc: String, data: Value },
}

/// A way to reach a running sync from the rest of the app.
#[derive(Clone)]
pub struct Link {
    pub engine: Arc<Mutex<Engine>>,
    nudge: mpsc::UnboundedSender<Nudge>,
}

impl Link {
    pub fn nudge(&self, nudge: Nudge) {
        let _ = self.nudge.send(nudge);
    }
}

/// Open the engine for a vault and the channel a connection will listen on.
pub fn link(vault: &Vault) -> Result<(Link, mpsc::UnboundedReceiver<Nudge>)> {
    let engine = Arc::new(Mutex::new(Engine::open(vault)?));
    let (nudge, nudges) = mpsc::unbounded_channel();
    Ok((Link { engine, nudge }, nudges))
}

/// Run sync for a vault until the relay refuses us (bad token, no access).
/// `report` receives one JSON object per thing worth telling a person.
pub async fn run(
    vault: Vault,
    config: Config,
    report: impl Fn(Value) + Send + Sync + 'static,
) -> Result<()> {
    let (link, nudges) = link(&vault)?;
    let changed = link.clone();
    let _watching = watch(&vault, move |_| changed.nudge(Nudge::Changed))?;
    serve(link, nudges, config, report).await
}

/// Like [`run`], for a caller that already owns the link (and the file watcher).
pub async fn serve(
    link: Link,
    mut changes: mpsc::UnboundedReceiver<Nudge>,
    config: Config,
    report: impl Fn(Value) + Send + Sync + 'static,
) -> Result<()> {
    let engine = link.engine.clone();
    // What this vault remembers about syncing belongs to one workspace only.
    if with(&engine, |e| e.bind(&config.workspace))? {
        report(json!({ "event": "rebound", "workspace": config.workspace }));
    }
    let moved = Notify::new();
    let arrived = Notify::new();
    let connection = async {
        loop {
            let presented = config.token.get();
            match session(&engine, &config, &mut changes, &report, &moved, &arrived).await {
                // Refused with a sign-in that has since been replaced: try the new one.
                Err(Error::Refused(_)) if config.token.get() != presented => continue,
                Err(Error::Refused(reason)) => return Err(Error::Refused(reason)),
                Err(e) => report(json!({ "event": "offline", "reason": e.to_string() })),
                Ok(()) => report(json!({ "event": "offline", "reason": "connection closed" })),
            }
            // Keep folding local edits into the outbox while offline.
            let _ = with(&engine, |e| e.scan());
            tokio::time::sleep(RETRY).await;
        }
    };
    tokio::select! {
        outcome = connection => outcome,
        () = attachments(&engine, &config, &moved) => Ok(()),
        () = facts(&link, &config, &arrived, &report) => Ok(()),
    }
}

/// How long to wait before asking again when nothing said there was anything to take.
const FACTS_EVERY: Duration = Duration::from_secs(60);

/// Take the facts a team's own systems pushed to the relay and write them into the customer
/// notes, beside the live connection. The relay hands each fact to one device at a time; this
/// device says so once the notes are written, and the edits then sync like any other.
async fn facts(link: &Link, config: &Config, arrived: &Notify, report: &(impl Fn(Value) + Send + Sync)) {
    let device = uuid::Uuid::new_v4().simple().to_string();
    let base = format!("/v1/workspaces/{}/inbox", config.workspace);
    loop {
        let _ = tokio::time::timeout(FACTS_EVERY, arrived.notified()).await;
        loop {
            let claim = crate::api::call(
                &config.server,
                &config.token.get(),
                "POST",
                &format!("{base}/claim"),
                Some(json!({ "device": device })),
            )
            .await;
            // A viewer may not take facts, and an older relay has no inbox: both just wait.
            let Ok(taken) = claim else { break };
            let items = taken["items"].as_array().cloned().unwrap_or_default();
            if items.is_empty() {
                break;
            }
            let Ok(vault) = with(&link.engine, |e| Ok(e.vault.clone())) else { break };
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let mut done = Vec::new();
            for item in &items {
                let seq = item["seq"].as_i64().unwrap_or(0);
                match lokus_core::ingest::apply(&vault, &item["fact"], now) {
                    Ok(paths) => {
                        for path in paths {
                            report(json!({ "event": "fact", "path": path }));
                        }
                        done.push(seq);
                    }
                    // A fact that makes no sense will never make sense: say so and let it go.
                    Err(lokus_core::CoreError::BadArgs { message, .. }) => {
                        report(json!({ "event": "fact_refused", "reason": message }));
                        done.push(seq);
                    }
                    // Anything else (a note changed underneath us, a full disk) is tried again.
                    Err(e) => report(json!({ "event": "fact_waiting", "reason": e.to_string() })),
                }
            }
            link.nudge(Nudge::Changed);
            let acked = crate::api::call(
                &config.server,
                &config.token.get(),
                "POST",
                &format!("{base}/ack"),
                Some(json!({ "device": device, "seqs": done })),
            )
            .await;
            if acked.is_err() || done.len() < items.len() {
                break;
            }
        }
    }
}

/// Move attachment bytes to and from the relay, beside the live connection.
/// It wakes when the engine may have queued something, and looks again after
/// a while for files another device has announced but not finished sending.
async fn attachments(engine: &Arc<Mutex<Engine>>, config: &Config, moved: &Notify) {
    let http = reqwest::Client::new();
    let base = format!(
        "{}/v1/workspaces/{}/blobs",
        config.server.trim_end_matches('/'),
        config.workspace
    );
    let mut misses = 0u32;
    loop {
        let pending = with(engine, |e| match e.meta("pulled")? {
            Some(_) => e.transfers(),
            None => Ok(Vec::new()),
        })
        .unwrap_or_default();
        let mut left = 0;
        for transfer in pending {
            let url = format!("{base}/{}", transfer.hash);
            let settled = if transfer.up {
                match with(engine, |e| e.read_upload(&transfer)) {
                    Ok(Some(bytes)) => {
                        let sent = http
                            .put(&url)
                            .bearer_auth(config.token.get())
                            .body(bytes)
                            .send()
                            .await;
                        // A viewer's or an oversized file is not retried; it simply stays local.
                        sent.is_ok_and(|r| r.status().is_success() || r.status().is_client_error())
                    }
                    Ok(None) => true,
                    Err(_) => false,
                }
            } else {
                match http.get(&url).bearer_auth(config.token.get()).send().await {
                    Ok(response) if response.status().is_success() => {
                        match response.bytes().await {
                            Ok(bytes) => {
                                with(engine, |e| e.store_download(&transfer, &bytes)).is_ok()
                            }
                            Err(_) => false,
                        }
                    }
                    _ => false,
                }
            };
            if settled {
                let _ = with(engine, |e| e.transfer_done(&transfer));
            } else {
                left += 1;
            }
        }
        if left == 0 {
            misses = 0;
            moved.notified().await;
        } else {
            // Usually the other device is still sending: look again soon, then less often.
            let wait = Duration::from_millis(400) * 2u32.pow(misses.min(6));
            misses += 1;
            let _ = tokio::time::timeout(wait, moved.notified()).await;
        }
    }
}

fn with<T>(engine: &Arc<Mutex<Engine>>, f: impl FnOnce(&mut Engine) -> Result<T>) -> Result<T> {
    let mut guard = engine
        .lock()
        .map_err(|_| Error::Net("sync engine stopped after an earlier failure".into()))?;
    f(&mut guard)
}

fn socket_url(config: &Config) -> String {
    let base = config.server.trim_end_matches('/');
    let base = base
        .strip_prefix("http")
        .map(|rest| format!("ws{rest}"))
        .unwrap_or_else(|| base.to_string());
    // The sign-in is never part of the address; it goes in the first message.
    format!("{base}/v1/ws")
}

async fn session(
    engine: &Arc<Mutex<Engine>>,
    config: &Config,
    changes: &mut mpsc::UnboundedReceiver<Nudge>,
    report: &(impl Fn(Value) + Send + Sync),
    moved: &Notify,
    arrived: &Notify,
) -> Result<()> {
    let (socket, _) = tokio_tungstenite::connect_async(socket_url(config))
        .await
        .map_err(|e| Error::Net(e.to_string()))?;
    let (mut out, mut inbox) = socket.split();
    // Say who we are before anything else; the relay answers `hello` or refuses.
    let mut presented = config.token.get();
    let hello = json!({ "t": "auth", "token": presented, "workspace": config.workspace });
    out.send(Message::Text(hello.to_string().into()))
        .await
        .map_err(|e| Error::Net(e.to_string()))?;
    // Nothing else is sent until the relay has answered: a refusal closes the connection, and
    // writing to a closed connection would look like being offline, to be retried for ever.
    let answer = match inbox.next().await {
        Some(Ok(Message::Text(text))) => {
            serde_json::from_str::<Value>(&text).map_err(|e| Error::Net(e.to_string()))?
        }
        Some(Err(e)) => return Err(Error::Net(e.to_string())),
        _ => return Err(Error::Net("the relay closed the connection".into())),
    };
    if answer["t"] != "hello" {
        let text = answer["message"]
            .as_str()
            .unwrap_or("the relay refused the connection")
            .to_string();
        return Err(match answer["code"].as_str() {
            Some("forbidden") | Some("unauthorized") => Error::Refused(text),
            _ => Error::Net(text),
        });
    }
    report(json!({ "event": "online", "role": answer["role"], "user": answer["user"], "conn": answer["conn"] }));
    let mut renew = tokio::time::interval(RENEW_CHECK);
    renew.tick().await;
    let mut in_flight: HashSet<i64> = HashSet::new();
    // Viewers receive everything and send nothing.
    let mut can_edit = answer["role"] != "viewer";
    // Facts may have been pushed while this device was away.
    arrived.notify_one();
    // Where to pull from again if the relay says we fell behind its live feed.
    let mut safe = with(engine, |e| e.cursor())?;
    out.send(Message::Text(
        json!({ "t": "pull", "since": safe }).to_string().into(),
    ))
    .await
    .map_err(|e| Error::Net(e.to_string()))?;

    loop {
        // Everything queued goes out; acks remove it from the outbox.
        let pending = with(engine, |e| {
            let events = std::mem::take(&mut e.events);
            Ok((e.outbox()?, events))
        })?;
        for event in pending.1 {
            report(serde_json::to_value(event).unwrap_or(Value::Null));
        }
        // Whatever just happened may have queued attachment bytes to move.
        moved.notify_one();
        // Publish only after the first pull of this connection has been applied.
        if in_flight.is_empty() || !pending.0.is_empty() {
            for item in pending.0.into_iter().filter(|_| can_edit).filter(|i| {
                with(engine, |e| e.meta("pulled")).ok().flatten().is_some() && in_flight.insert(i.n)
            }) {
                let message = json!({ "t": "up", "id": item.n, "doc": item.doc, "data": B64.encode(&item.data) });
                out.send(Message::Text(message.to_string().into()))
                    .await
                    .map_err(|e| Error::Net(e.to_string()))?;
            }
        }

        tokio::select! {
            received = inbox.next() => {
                let message = match received {
                    Some(Ok(Message::Text(text))) => text,
                    Some(Ok(Message::Close(_))) | None => return Ok(()),
                    Some(Ok(_)) => continue,
                    Some(Err(e)) => return Err(Error::Net(e.to_string())),
                };
                let value: Value = serde_json::from_str(&message).map_err(|e| Error::Net(e.to_string()))?;
                match value["t"].as_str().unwrap_or_default() {
                    // An owner changed what we may do while we were connected.
                    "role" => {
                        can_edit = value["role"] != "viewer";
                        report(json!({ "event": "role", "role": value["role"] }));
                    }
                    "updates" => {
                        let items = value["items"].as_array().cloned().unwrap_or_default();
                        let head = value["head"].as_i64().unwrap_or(0);
                        with(engine, |e| {
                            for item in &items {
                                let data = B64.decode(item["data"].as_str().unwrap_or_default()).map_err(|x| Error::Crdt(x.to_string()))?;
                                e.apply_remote(item["doc"].as_str().unwrap_or_default(), &data)?;
                            }
                            e.set_cursor(head)?;
                            e.mark_pulled()?;
                            e.scan()
                        })?;
                        safe = safe.max(head);
                        // An open editor needs what was missed while offline, not just the files.
                        for item in &items {
                            report(json!({ "event": "remote", "doc": item["doc"], "data": item["data"] }));
                        }
                        report(json!({ "event": "pulled", "edits": items.len() }));
                    }
                    "up" => {
                        let data = B64.decode(value["data"].as_str().unwrap_or_default()).map_err(|x| Error::Crdt(x.to_string()))?;
                        with(engine, |e| {
                            e.apply_remote(value["doc"].as_str().unwrap_or_default(), &data)?;
                            e.set_cursor(value["seq"].as_i64().unwrap_or(0))
                        })?;
                        // An editor that has this note open applies the same edit to its own copy.
                        report(json!({ "event": "remote", "doc": value["doc"], "data": value["data"] }));
                    }
                    "aw" | "bye" => report(json!({ "event": "presence", "message": value })),
                    // A team's own systems pushed something about a customer.
                    "inbox" => arrived.notify_one(),
                    "ack" => {
                        let n = value["id"].as_i64().unwrap_or(0);
                        in_flight.remove(&n);
                        with(engine, |e| {
                            e.sent(n)?;
                            e.set_cursor(value["seq"].as_i64().unwrap_or(0))
                        })?;
                    }
                    "resync" => {
                        out.send(Message::Text(json!({ "t": "pull", "since": safe }).to_string().into()))
                            .await
                            .map_err(|e| Error::Net(e.to_string()))?;
                    }
                    "error" => {
                        let text = value["message"].as_str().unwrap_or("refused").to_string();
                        if matches!(value["code"].as_str(), Some("forbidden") | Some("unauthorized")) {
                            return Err(Error::Refused(text));
                        }
                        report(json!({ "event": "relay_error", "message": text }));
                    }
                    _ => {}
                }
            }
            _ = renew.tick() => {
                // A newer sign-in arrived: hand it to the relay so this connection outlives the old one.
                let latest = config.token.get();
                if latest != presented {
                    let message = json!({ "t": "auth", "token": latest });
                    out.send(Message::Text(message.to_string().into())).await.map_err(|e| Error::Net(e.to_string()))?;
                    presented = latest;
                }
            }
            Some(nudge) = changes.recv() => match nudge {
                Nudge::Awareness { doc, data } => {
                    let message = json!({ "t": "aw", "doc": doc, "data": data });
                    out.send(Message::Text(message.to_string().into())).await.map_err(|e| Error::Net(e.to_string()))?;
                }
                Nudge::Changed => {
                    // A burst of file events, or of keystrokes, is one scan: wait a moment, then
                    // take everything that queued up meanwhile. Handling them one at a time made
                    // fast typing fall many seconds behind on the other person's screen.
                    tokio::time::sleep(Duration::from_millis(60)).await;
                    let mut cursors: Vec<(String, Value)> = Vec::new();
                    while let Ok(more) = changes.try_recv() {
                        if let Nudge::Awareness { doc, data } = more {
                            // Only the newest cursor position for a note is worth sending.
                            cursors.retain(|(d, _)| *d != doc);
                            cursors.push((doc, data));
                        }
                    }
                    for (doc, data) in cursors {
                        let message = json!({ "t": "aw", "doc": doc, "data": data });
                        out.send(Message::Text(message.to_string().into())).await.map_err(|e| Error::Net(e.to_string()))?;
                    }
                    with(engine, |e| e.scan())?;
                }
            }
        }
    }
}

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
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use lokus_core::watch::watch;
use lokus_core::Vault;

use crate::engine::Engine;
use crate::error::{Error, Result};

#[derive(Debug, Clone)]
pub struct Config {
    /// `http://host:port` or `https://host`.
    pub server: String,
    pub workspace: String,
    pub token: String,
}

const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;
const RETRY: Duration = Duration::from_secs(3);

/// Run sync for a vault until the relay refuses us (bad token, no access).
/// `report` receives one JSON object per thing worth telling a person.
pub async fn run(vault: Vault, config: Config, report: impl Fn(Value) + Send + Sync + 'static) -> Result<()> {
    let engine = Arc::new(Mutex::new(Engine::open(&vault)?));
    let (changed, mut changes) = mpsc::unbounded_channel::<()>();
    let _watching = watch(&vault, move |_| {
        let _ = changed.send(());
    })?;

    loop {
        match session(&engine, &config, &mut changes, &report).await {
            Err(Error::Refused(reason)) => return Err(Error::Refused(reason)),
            Err(e) => report(json!({ "event": "offline", "reason": e.to_string() })),
            Ok(()) => report(json!({ "event": "offline", "reason": "connection closed" })),
        }
        // Keep folding local edits into the outbox while offline.
        let _ = with(&engine, |e| e.scan());
        tokio::time::sleep(RETRY).await;
    }
}

fn with<T>(engine: &Arc<Mutex<Engine>>, f: impl FnOnce(&mut Engine) -> Result<T>) -> Result<T> {
    let mut guard = engine.lock().map_err(|_| Error::Net("sync engine stopped after an earlier failure".into()))?;
    f(&mut guard)
}

fn socket_url(config: &Config) -> String {
    let base = config.server.trim_end_matches('/');
    let base = base.strip_prefix("http").map(|rest| format!("ws{rest}")).unwrap_or_else(|| base.to_string());
    format!("{base}/v1/ws?workspace={}&token={}", config.workspace, config.token)
}

async fn session(
    engine: &Arc<Mutex<Engine>>,
    config: &Config,
    changes: &mut mpsc::UnboundedReceiver<()>,
    report: &(impl Fn(Value) + Send + Sync),
) -> Result<()> {
    let (socket, _) = tokio_tungstenite::connect_async(socket_url(config)).await.map_err(|e| match &e {
        tokio_tungstenite::tungstenite::Error::Http(response) if matches!(response.status().as_u16(), 401 | 403) => {
            Error::Refused(format!("the relay answered {}", response.status()))
        }
        _ => Error::Net(e.to_string()),
    })?;
    let (mut out, mut inbox) = socket.split();
    let mut in_flight: HashSet<i64> = HashSet::new();
    // Where to pull from again if the relay says we fell behind its live feed.
    let mut safe = with(engine, |e| e.cursor())?;
    out.send(Message::Text(json!({ "t": "pull", "since": safe }).to_string().into()))
        .await
        .map_err(|e| Error::Net(e.to_string()))?;

    loop {
        // Everything queued goes out; acks remove it from the outbox.
        let pending = with(engine, |e| {
            let events: Vec<_> = e.events.drain(..).collect();
            Ok((e.outbox()?, events))
        })?;
        for event in pending.1 {
            report(serde_json::to_value(event).unwrap_or(Value::Null));
        }
        // Publish only after the first pull of this connection has been applied.
        if in_flight.is_empty() || !pending.0.is_empty() {
            for item in pending.0.into_iter().filter(|i| with(engine, |e| e.meta("pulled")).ok().flatten().is_some() && in_flight.insert(i.n)) {
                let message = json!({ "t": "up", "id": item.n, "doc": item.doc, "data": B64.encode(&item.data) });
                out.send(Message::Text(message.to_string().into())).await.map_err(|e| Error::Net(e.to_string()))?;
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
                    "hello" => report(json!({ "event": "online", "role": value["role"], "user": value["user"] })),
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
                        report(json!({ "event": "pulled", "edits": items.len() }));
                    }
                    "up" => {
                        let data = B64.decode(value["data"].as_str().unwrap_or_default()).map_err(|x| Error::Crdt(x.to_string()))?;
                        with(engine, |e| {
                            e.apply_remote(value["doc"].as_str().unwrap_or_default(), &data)?;
                            e.set_cursor(value["seq"].as_i64().unwrap_or(0))
                        })?;
                    }
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
            Some(()) = changes.recv() => {
                // A burst of file events is one scan.
                tokio::time::sleep(Duration::from_millis(120)).await;
                while changes.try_recv().is_ok() {}
                with(engine, |e| e.scan())?;
            }
        }
    }
}

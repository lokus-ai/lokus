//! @part-of server
//! The door a team's own systems push customer facts through.
//!
//! A workspace owner makes a key; a backend posts facts with it; the relay keeps each fact in
//! an inbox until one signed-in device of that workspace takes it, writes it into the notes
//! and says so. The relay checks only the envelope (who is sending, how much, that it names a
//! customer): it never reads or writes a note, so what a fact means is decided on the device.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{Error, Result};
use crate::{App, Fanout};

/// The most facts in one request, and the most one fact may weigh.
const MAX_FACTS: usize = 100;
const MAX_FACT_BYTES: usize = 32 * 1024;
/// The most a whole request may weigh.
pub const MAX_BODY: usize = 512 * 1024;
/// How many facts one device takes at a time.
const TAKE: i64 = 50;

/// A key is shown once, when it is made. The relay keeps only its hash.
fn hash(key: &str) -> String {
    blake3::hash(key.as_bytes()).to_hex().to_string()
}

#[derive(Deserialize)]
pub struct NewKey {
    #[serde(default)]
    label: String,
}

pub async fn create_key(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<NewKey>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    let label = body.label.trim();
    if label.chars().count() > 80 || label.chars().any(char::is_control) {
        return Err(Error::BadRequest(
            "a key's name is up to 80 characters, on one line".into(),
        ));
    }
    let key_id = uuid::Uuid::new_v4().simple().to_string();
    let key = format!(
        "lk_{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    app.store
        .create_key(&id, &key_id, &hash(&key), label, &me.user)?;
    Ok(Json(json!({ "id": key_id, "key": key, "label": label })))
}

pub async fn list_keys(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    Ok(Json(json!(app.store.keys(&id)?)))
}

pub async fn revoke_key(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, key_id)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    app.store.revoke_key(&id, &key_id, &me.user)?;
    Ok(Json(json!({ "revoked": true })))
}

/// Facts from a team's backend. One fact, or `{"items": [...]}` for several.
pub async fn ingest(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>> {
    let key = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|k| k.starts_with("lk_"))
        .ok_or(Error::Unauthorized)?;
    let workspace = app.store.key_workspace(&hash(key))?.ok_or(Error::Unauthorized)?;

    let facts: Vec<&Value> = match body.get("items") {
        Some(Value::Array(items)) => items.iter().collect(),
        Some(_) => return Err(Error::BadRequest("items is a list of facts".into())),
        None => vec![&body],
    };
    if facts.is_empty() || facts.len() > MAX_FACTS {
        return Err(Error::BadRequest(format!(
            "send between 1 and {MAX_FACTS} facts at a time"
        )));
    }
    let mut bodies = Vec::with_capacity(facts.len());
    for fact in facts {
        // The relay checks only that a fact says what it is about: a customer, a thing of
        // some kind with an id, or a log line. What it means is decided on the device.
        let short = |key: &str| {
            fact.get(key)
                .and_then(Value::as_str)
                .is_some_and(|c| !c.trim().is_empty() && c.chars().count() <= 120)
        };
        let about = short("customer") || (short("kind") && short("id")) || fact.get("log").is_some_and(Value::is_object);
        if !fact.is_object() || !about {
            return Err(Error::BadRequest(
                "each fact says what it is about: {\"customer\": \"acme.com\", ...}, {\"kind\": \"order\", \"id\": \"A-1\", ...} or {\"log\": {\"message\": \"...\"}}".into(),
            ));
        }
        let text = fact.to_string();
        if text.len() > MAX_FACT_BYTES {
            return Err(Error::BadRequest("one fact is at most 32 KB".into()));
        }
        bodies.push(text);
    }
    let accepted = app.store.push_inbox(&workspace, &bodies)?;
    // Wake any device of this workspace that is connected; others pick it up when they connect.
    let _ = app.room(&workspace).send(Fanout {
        from: 0,
        json: json!({ "t": "inbox" }).to_string().into(),
    });
    Ok(Json(json!({ "accepted": accepted })))
}

#[derive(Deserialize)]
pub struct Take {
    /// Which device is taking them, so a fact one device is writing is not handed to another.
    device: String,
}

pub async fn claim(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Take>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    if !app.require(&id, &me.user)?.can_edit() {
        return Err(Error::Forbidden);
    }
    let device = device(&body.device)?;
    let items: Vec<Value> = app
        .store
        .claim_inbox(&id, device, TAKE)?
        .into_iter()
        .map(|(seq, body)| json!({ "seq": seq, "fact": serde_json::from_str::<Value>(&body).unwrap_or(Value::Null) }))
        .collect();
    Ok(Json(json!({ "items": items })))
}

#[derive(Deserialize)]
pub struct Done {
    device: String,
    seqs: Vec<i64>,
}

pub async fn ack(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Done>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    if !app.require(&id, &me.user)?.can_edit() {
        return Err(Error::Forbidden);
    }
    if body.seqs.len() > 500 {
        return Err(Error::BadRequest("too many at once".into()));
    }
    let done = app.store.ack_inbox(&id, device(&body.device)?, &body.seqs)?;
    Ok(Json(json!({ "done": done })))
}

fn device(raw: &str) -> Result<&str> {
    let ok = !raw.is_empty()
        && raw.len() <= 64
        && raw.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    if ok {
        Ok(raw)
    } else {
        Err(Error::BadRequest("bad device id".into()))
    }
}

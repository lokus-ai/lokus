//! Tauri commands for Calendar V2 — the frontend's only door to the store.
//! Reads are always local; mutations write the store optimistically and (from
//! Phase 2) enqueue outbox ops for the sync engine to push.

use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use super::engine::{enqueue_outbox, SyncEngine};
use super::models::{now_ms, Account, CalendarRow, EventRow, OccurrenceView};
use super::store::{self, CalendarStore};
use super::{auth, creds};

/// Debounced change signal — every mutation path funnels through this.
pub fn emit_changed(app: &AppHandle) {
    let _ = app.emit("calendar://changed", ());
}

#[tauri::command]
pub async fn cal2_accounts_list(store: State<'_, CalendarStore>) -> Result<Vec<Account>, String> {
    store.with(store::list_accounts).await
}

#[tauri::command]
pub async fn cal2_calendars_list(store: State<'_, CalendarStore>) -> Result<Vec<CalendarRow>, String> {
    store.with(store::list_calendars).await
}

#[tauri::command]
pub async fn cal2_set_calendar_visible(
    app: AppHandle,
    store: State<'_, CalendarStore>,
    calendar_id: String,
    visible: bool,
) -> Result<(), String> {
    store
        .with(move |c| store::set_calendar_visible(c, &calendar_id, visible))
        .await?;
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub async fn cal2_events_in_range(
    store: State<'_, CalendarStore>,
    start: i64,
    end: i64,
) -> Result<Vec<OccurrenceView>, String> {
    store.with(move |c| store::events_in_range(c, start, end)).await
}

#[tauri::command]
pub async fn cal2_event_get(
    store: State<'_, CalendarStore>,
    id: String,
) -> Result<Option<EventRow>, String> {
    store.with(move |c| store::get_event(c, &id)).await
}

/// Local optimistic create. Phase 2 wires the outbox push; until then the row
/// is marked pending so the UI can badge it.
#[tauri::command]
pub async fn cal2_event_create(
    app: AppHandle,
    store: State<'_, CalendarStore>,
    mut event: EventRow,
) -> Result<String, String> {
    if event.id.is_empty() {
        event.id = Uuid::new_v4().to_string();
    }
    event.pending = true;
    event.created_at = now_ms();
    event.updated_at = event.created_at;
    let id = store
        .with(move |c| {
            let id = store::upsert_event(c, &event)?;
            let mut ev = event.clone();
            ev.id = id.clone();
            enqueue_outbox(c, &ev, "create")?;
            Ok(id)
        })
        .await?;
    if let Some(engine) = app.try_state::<SyncEngine>() {
        engine.sync_now();
    }
    emit_changed(&app);
    Ok(id)
}

#[tauri::command]
pub async fn cal2_event_update(
    app: AppHandle,
    store: State<'_, CalendarStore>,
    mut event: EventRow,
) -> Result<(), String> {
    event.pending = true;
    event.updated_at = now_ms();
    store
        .with(move |c| {
            store::upsert_event(c, &event)?;
            enqueue_outbox(c, &event, "update")
        })
        .await?;
    if let Some(engine) = app.try_state::<SyncEngine>() {
        engine.sync_now();
    }
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub async fn cal2_event_delete(
    app: AppHandle,
    store: State<'_, CalendarStore>,
    id: String,
) -> Result<(), String> {
    store
        .with(move |c| {
            let Some(mut ev) = store::get_event(c, &id)? else {
                return Ok(());
            };
            ev.deleted = true;
            ev.pending = true;
            ev.updated_at = now_ms();
            store::upsert_event(c, &ev)?;
            if ev.provider_event_id.is_some() {
                enqueue_outbox(c, &ev, "delete")?;
            } else {
                // Never left the device: hard-delete, nothing to push.
                c.execute("DELETE FROM events WHERE id=?1", rusqlite::params![ev.id])
                    .map_err(|e| e.to_string())?;
            }
            Ok(())
        })
        .await?;
    if let Some(engine) = app.try_state::<SyncEngine>() {
        engine.sync_now();
    }
    emit_changed(&app);
    Ok(())
}

/// Begin linking a Google account: returns the URL to open in the browser.
/// Completion runs in the background — when the loopback callback delivers
/// the code, the account row + credentials are created and a sync kicks off.
/// Multiple flows can run concurrently (per-flow state + PKCE).
#[tauri::command]
pub async fn cal2_account_add_google(
    app: AppHandle,
    store: State<'_, CalendarStore>,
) -> Result<String, String> {
    let client_id =
        std::env::var("GOOGLE_CLIENT_ID").map_err(|_| "GOOGLE_CLIENT_ID not set".to_string())?;

    let flow_id = Uuid::new_v4().to_string();
    let pkce = auth::pkce_pair();
    let redirect = auth::redirect_uri();

    let scopes = [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
    ]
    .join(" ");
    let url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent%20select_account",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect),
        urlencoding::encode(&scopes),
        urlencoding::encode(&flow_id),
        urlencoding::encode(&pkce.challenge),
    );

    let rx = auth::register_flow(&flow_id);
    let store = store.inner().clone();
    let flow_for_task = flow_id.clone();
    tauri::async_runtime::spawn(async move {
        let code = match tokio::time::timeout(std::time::Duration::from_secs(300), rx).await {
            Ok(Ok(code)) => code,
            _ => {
                auth::cancel_flow(&flow_for_task);
                return;
            }
        };
        match finish_google_link(&code, &pkce.verifier, &redirect, &store).await {
            Ok(email) => {
                tracing::info!("calendar_v2: linked google account {email}");
                if let Some(engine) = app.try_state::<super::SyncEngine>() {
                    engine.sync_now();
                }
                let _ = app.emit("calendar://account-linked", email);
                emit_changed(&app);
            }
            Err(e) => {
                tracing::error!("calendar_v2: google link failed: {e}");
                let _ = app.emit("calendar://account-link-failed", e);
            }
        }
    });

    Ok(url)
}

async fn finish_google_link(
    code: &str,
    verifier: &str,
    redirect: &str,
    store: &CalendarStore,
) -> Result<String, String> {
    let client_id = std::env::var("GOOGLE_CLIENT_ID").map_err(|_| "GOOGLE_CLIENT_ID not set")?;
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
    let http = reqwest::Client::new();

    let mut form = vec![
        ("client_id", client_id),
        ("code", code.to_string()),
        ("code_verifier", verifier.to_string()),
        ("grant_type", "authorization_code".to_string()),
        ("redirect_uri", redirect.to_string()),
    ];
    if !client_secret.is_empty() {
        form.push(("client_secret", client_secret));
    }
    let body: serde_json::Value = http
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let access = body["access_token"].as_str().ok_or_else(|| format!("token exchange failed: {body}"))?;
    let refresh = body["refresh_token"].as_str().map(String::from);
    let ttl = body["expires_in"].as_u64().unwrap_or(3600);

    let userinfo: serde_json::Value = http
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let email = userinfo["email"].as_str().unwrap_or("google account").to_string();

    let now = now_ms();
    let account = Account {
        id: Uuid::new_v4().to_string(),
        provider: "google".into(),
        label: email.clone(),
        identity: email.clone(),
        status: "connected".into(),
        color: None,
        config: serde_json::json!({}),
        created_at: now,
        updated_at: now,
    };
    let acc_for_store = account.clone();
    store.with(move |c| store::upsert_account(c, &acc_for_store)).await?;

    // Re-link of an existing identity reuses its row id — look it up so the
    // credentials land on the right account.
    let identity = account.identity.clone();
    let real_id: String = store
        .with(move |c| {
            c.query_row(
                "SELECT id FROM accounts WHERE provider='google' AND identity=?1",
                rusqlite::params![identity],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())
        })
        .await?;

    let now_s = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    creds::store(
        &real_id,
        &creds::StoredCreds {
            access: access.to_string(),
            refresh,
            expires_at: Some(now_s + ttl),
        },
    )?;
    Ok(email)
}

/// Connect a CalDAV / iCloud account: verifies credentials + discovers the
/// calendar home via the V1 client, then registers the account.
#[tauri::command]
pub async fn cal2_account_add_caldav(
    app: AppHandle,
    store: State<'_, CalendarStore>,
    server_url: String,
    username: String,
    password: String,
    label: Option<String>,
) -> Result<String, String> {
    let verified = crate::calendar::caldav::test_connection(&server_url, &username, &password)
        .await
        .map_err(|e| e.to_string())?;

    let provider = if server_url.contains("icloud.com") { "icloud" } else { "caldav" };
    let now = now_ms();
    let account = Account {
        id: Uuid::new_v4().to_string(),
        provider: provider.into(),
        label: label.unwrap_or_else(|| username.clone()),
        identity: format!("{username}@{server_url}"),
        status: "connected".into(),
        color: None,
        config: serde_json::json!({
            "server_url": server_url,
            "username": username,
            "principal_url": verified.principal_url,
            "calendar_home_url": verified.calendar_home_url,
        }),
        created_at: now,
        updated_at: now,
    };
    let acc = account.clone();
    store.with(move |c| store::upsert_account(c, &acc)).await?;
    let (prov, identity) = (account.provider.clone(), account.identity.clone());
    let real_id: String = store
        .with(move |c| {
            c.query_row(
                "SELECT id FROM accounts WHERE provider=?1 AND identity=?2",
                rusqlite::params![prov, identity],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())
        })
        .await?;
    creds::store(&real_id, &creds::StoredCreds { access: password, refresh: None, expires_at: None })?;

    if let Some(engine) = app.try_state::<SyncEngine>() {
        engine.sync_now();
    }
    emit_changed(&app);
    Ok(real_id)
}

/// Follow an iCal feed (or import a local .ics via a file:// identity).
#[tauri::command]
pub async fn cal2_account_add_ical(
    app: AppHandle,
    store: State<'_, CalendarStore>,
    url: String,
    name: Option<String>,
) -> Result<String, String> {
    let url = url.trim().replace("webcal://", "https://");
    let label = name.unwrap_or_else(|| {
        url.rsplit('/').next().unwrap_or("Subscription").trim_end_matches(".ics").to_string()
    });
    let now = now_ms();
    let account = Account {
        id: Uuid::new_v4().to_string(),
        provider: "ical".into(),
        label,
        identity: url,
        status: "connected".into(),
        color: None,
        config: serde_json::json!({}),
        created_at: now,
        updated_at: now,
    };
    let id = account.id.clone();
    store.with(move |c| store::upsert_account(c, &account)).await?;
    if let Some(engine) = app.try_state::<SyncEngine>() {
        engine.sync_now();
    }
    emit_changed(&app);
    Ok(id)
}

#[tauri::command]
pub async fn cal2_account_remove(
    app: AppHandle,
    store: State<'_, CalendarStore>,
    account_id: String,
) -> Result<(), String> {
    let _ = creds::delete(&account_id);
    store.with(move |c| store::delete_account(c, &account_id)).await?;
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub async fn cal2_sync_now(app: AppHandle) -> Result<(), String> {
    if let Some(engine) = app.try_state::<SyncEngine>() {
        engine.sync_now();
        Ok(())
    } else {
        Err("sync engine not running".into())
    }
}

/// Startup hook: re-expand occurrences when the timezone changed or the
/// horizon drifted. Cheap no-op otherwise.
pub async fn maybe_reexpand(app: AppHandle, store: CalendarStore) {
    let needs = store.with(store::needs_reexpansion).await.unwrap_or(false);
    if needs {
        if let Ok(n) = store
            .with(|c| {
                let n = store::reexpand_all(c)?;
                store::mark_horizon_anchored(c)?;
                // Cursors are pinned to the old window (Google syncToken
                // remembers its timeMin/timeMax) — clear them so the next
                // sync refetches the new window.
                c.execute("UPDATE sync_state SET cursor = NULL", [])
                    .map_err(|e| e.to_string())?;
                Ok(n)
            })
            .await
        {
            tracing::info!("calendar_v2: re-expanded {n} events");
            emit_changed(&app);
        }
    }
}

//! One-shot V1 → V2 migration, run at startup behind a meta guard.
//!
//! Phase 3 scope: the Google singleton account (keyring in release, files in
//! dev — V1's CalendarStorage handles both). CalDAV/iCloud and iCal
//! subscriptions migrate in Phase 4 when their connectors exist. V1 data is
//! left in place untouched — V1 code paths keep working during the overlap.

use rusqlite::params;

use crate::calendar::storage::CalendarStorage;
use super::creds::{self, StoredCreds};
use super::models::{now_ms, Account};
use super::store::{self, CalendarStore};

const GUARD_KEY: &str = "migrated_v1_google";

pub async fn run(store: &CalendarStore) {
    let done: bool = store
        .with(|c| {
            let v: Option<String> = c
                .query_row("SELECT value FROM meta WHERE key=?1", params![GUARD_KEY], |r| r.get(0))
                .ok();
            Ok(v.is_some())
        })
        .await
        .unwrap_or(true);
    if done {
        return;
    }

    let migrated = migrate_google(store).await;
    let migrated_caldav = migrate_caldav(store).await;
    let migrated_ical = migrate_ical(store).await;
    tracing::info!(
        "calendar_v2 migration: google={migrated} caldav={migrated_caldav} ical={migrated_ical}"
    );
    let _ = store
        .with(move |c| {
            c.execute(
                "INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)",
                params![GUARD_KEY, if migrated { "1" } else { "0-nothing" }],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        })
        .await;
}

async fn migrate_caldav(store: &CalendarStore) -> bool {
    let Ok(Some(account)) = CalendarStorage::get_caldav_account() else {
        return false;
    };
    let provider = if account.server_url.contains("icloud.com") { "icloud" } else { "caldav" };
    let now = now_ms();
    let v2 = Account {
        id: uuid::Uuid::new_v4().to_string(),
        provider: provider.into(),
        label: account.display_name.clone().unwrap_or_else(|| account.username.clone()),
        identity: format!("{}@{}", account.username, account.server_url),
        status: "connected".into(),
        color: None,
        config: serde_json::json!({
            "server_url": account.server_url,
            "username": account.username,
            "principal_url": account.principal_url,
            "calendar_home_url": account.calendar_home_url,
            "migrated_from_v1": true,
        }),
        created_at: now,
        updated_at: now,
    };
    let password = account.password.clone();
    let acc = v2.clone();
    if store.with(move |c| store::upsert_account(c, &acc)).await.is_err() {
        return false;
    }
    let (prov, identity) = (v2.provider.clone(), v2.identity.clone());
    let Ok(real_id) = store
        .with(move |c| {
            c.query_row(
                "SELECT id FROM accounts WHERE provider=?1 AND identity=?2",
                params![prov, identity],
                |r| r.get::<_, String>(0),
            )
            .map_err(|e| e.to_string())
        })
        .await
    else {
        return false;
    };
    creds::store(&real_id, &StoredCreds { access: password, refresh: None, expires_at: None }).is_ok()
}

async fn migrate_ical(store: &CalendarStore) -> bool {
    let Ok(subs) = CalendarStorage::get_ical_subscriptions() else {
        return false;
    };
    let mut any = false;
    for sub in subs {
        if !sub.enabled {
            continue;
        }
        let now = now_ms();
        let acc = Account {
            id: uuid::Uuid::new_v4().to_string(),
            provider: "ical".into(),
            label: sub.name.clone(),
            identity: sub.url.clone(),
            status: "connected".into(),
            color: sub.color.clone(),
            config: serde_json::json!({ "migrated_from_v1": true }),
            created_at: now,
            updated_at: now,
        };
        any |= store.with(move |c| store::upsert_account(c, &acc)).await.is_ok();
    }
    any
}

async fn migrate_google(store: &CalendarStore) -> bool {
    let (Ok(Some(account)), Ok(Some(token))) =
        (CalendarStorage::get_google_account(), CalendarStorage::get_google_token())
    else {
        return false;
    };

    let now = now_ms();
    let v2_account = Account {
        id: uuid::Uuid::new_v4().to_string(),
        provider: "google".into(),
        label: account.email.clone(),
        identity: account.email.clone(),
        status: "connected".into(),
        color: None,
        config: serde_json::json!({ "migrated_from_v1": true }),
        created_at: now,
        updated_at: now,
    };

    let acc = v2_account.clone();
    if store.with(move |c| store::upsert_account(c, &acc)).await.is_err() {
        return false;
    }
    let identity = v2_account.identity.clone();
    let Ok(real_id) = store
        .with(move |c| {
            c.query_row(
                "SELECT id FROM accounts WHERE provider='google' AND identity=?1",
                params![identity],
                |r| r.get::<_, String>(0),
            )
            .map_err(|e| e.to_string())
        })
        .await
    else {
        return false;
    };

    let stored = StoredCreds {
        access: token.access_token,
        refresh: token.refresh_token,
        expires_at: token.expires_at,
    };
    if let Err(e) = creds::store(&real_id, &stored) {
        tracing::error!("calendar_v2 migration: cred store failed: {e}");
        return false;
    }
    tracing::info!("calendar_v2: migrated V1 google account {}", v2_account.identity);
    true
}

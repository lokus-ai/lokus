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

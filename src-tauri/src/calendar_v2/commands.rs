//! Tauri commands for Calendar V2 — the frontend's only door to the store.
//! Reads are always local; mutations write the store optimistically and (from
//! Phase 2) enqueue outbox ops for the sync engine to push.

use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use super::models::{now_ms, Account, CalendarRow, EventRow, OccurrenceView};
use super::store::{self, CalendarStore};

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
    let id = store.with(move |c| store::upsert_event(c, &event)).await?;
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
    store.with(move |c| store::upsert_event(c, &event).map(|_| ())).await?;
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
            store::upsert_event(c, &ev).map(|_| ())
        })
        .await?;
    emit_changed(&app);
    Ok(())
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
                Ok(n)
            })
            .await
        {
            tracing::info!("calendar_v2: re-expanded {n} events");
            emit_changed(&app);
        }
    }
}

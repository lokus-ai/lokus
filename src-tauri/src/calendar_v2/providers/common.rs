//! Shared mapping: V1 `CalendarEvent` (produced by the reused V1 parsers /
//! CalDAV client) → V2 `EventRow`.

use crate::calendar::models::CalendarEvent as V1Event;
use crate::calendar_v2::models::{now_ms, EventRow};

pub fn v1_event_to_row(ev: &V1Event, local_calendar_id: &str) -> EventRow {
    let now = now_ms();
    let all_day = ev.all_day;
    let mut row = EventRow {
        id: uuid::Uuid::new_v4().to_string(),
        calendar_id: local_calendar_id.to_string(),
        provider_event_id: Some(ev.id.clone()),
        // For CalDAV/iCal the event id IS the iCal UID.
        ical_uid: Some(ev.id.clone()),
        title: ev.title.clone(),
        description: ev.description.clone(),
        location: ev.location.clone(),
        all_day,
        status: match ev.status {
            crate::calendar::models::EventStatus::Tentative => "tentative".into(),
            crate::calendar::models::EventStatus::Cancelled => "cancelled".into(),
            _ => "confirmed".into(),
        },
        transparency: "opaque".into(),
        rrule: ev.recurrence_rule.clone().filter(|r| !r.trim().is_empty()),
        html_link: ev.html_link.clone(),
        etag: ev.etag.clone(),
        provider_updated_at: ev.updated_at.map(|d| d.timestamp_millis()),
        deleted: matches!(ev.status, crate::calendar::models::EventStatus::Cancelled),
        created_at: now,
        updated_at: now,
        attendees: if ev.attendees.is_empty() {
            None
        } else {
            serde_json::to_string(&ev.attendees).ok()
        },
        ..Default::default()
    };
    if all_day {
        row.start_date = Some(ev.start.date_naive().format("%Y-%m-%d").to_string());
        row.end_date = Some(ev.end.date_naive().format("%Y-%m-%d").to_string());
    } else {
        row.start_ts = Some(ev.start.timestamp_millis());
        row.end_ts = Some(ev.end.timestamp_millis());
    }
    row
}

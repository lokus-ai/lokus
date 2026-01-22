//! Event Deduplication
//!
//! Groups events by fingerprint and returns deduplicated results with
//! information about where duplicates exist.

use std::collections::HashMap;
use crate::calendar::models::{
    CalendarEvent, CalendarProvider, Calendar, DeduplicatedEvent, CalendarProviderInfo,
};
use super::fingerprint::compute_fingerprint;

/// Groups events by their fingerprint
pub fn group_events_by_fingerprint(events: &[CalendarEvent]) -> HashMap<String, Vec<&CalendarEvent>> {
    let mut groups: HashMap<String, Vec<&CalendarEvent>> = HashMap::new();

    for event in events {
        let fingerprint = compute_fingerprint(event);
        groups.entry(fingerprint).or_default().push(event);
    }

    groups
}

/// Deduplicates events from multiple providers.
///
/// For each unique fingerprint:
/// - Picks a "primary" event (from writable calendar, most recently modified)
/// - Records which other calendars have this event in "also_in"
/// - Marks as read-only if only available in iCal subscriptions
///
/// Returns events sorted by start time.
pub fn deduplicate_events(
    events: Vec<CalendarEvent>,
    calendars: &[Calendar],
) -> Vec<DeduplicatedEvent> {
    let groups = group_events_by_fingerprint(&events);
    let calendar_map: HashMap<String, &Calendar> = calendars.iter()
        .map(|c| (c.id.clone(), c))
        .collect();

    let mut deduplicated: Vec<DeduplicatedEvent> = groups
        .into_iter()
        .map(|(fingerprint, group_events)| {
            select_primary_event(fingerprint, group_events, &calendar_map)
        })
        .collect();

    // Sort by start time
    deduplicated.sort_by(|a, b| a.event.start.cmp(&b.event.start));

    deduplicated
}

/// Selects the primary event from a group of duplicates.
///
/// Priority:
/// 1. From a writable calendar (Google/CalDAV over iCal)
/// 2. Most recently modified (if updated_at is available)
/// 3. From the "primary" calendar
fn select_primary_event(
    fingerprint: String,
    events: Vec<&CalendarEvent>,
    calendar_map: &HashMap<String, &Calendar>,
) -> DeduplicatedEvent {
    if events.is_empty() {
        panic!("select_primary_event called with empty events");
    }

    if events.len() == 1 {
        // No duplicates
        let event = events[0];
        let calendar = calendar_map.get(&event.calendar_id);
        let is_read_only = calendar.map(|c| !c.is_writable).unwrap_or(true);

        return DeduplicatedEvent {
            event: event.clone(),
            also_in: Vec::new(),
            is_read_only,
            fingerprint,
        };
    }

    // Score each event to determine primary
    let mut scored: Vec<(i32, &CalendarEvent)> = events.iter()
        .map(|e| {
            let mut score = 0;
            let calendar = calendar_map.get(&e.calendar_id);

            // Prefer writable calendars (+100)
            if calendar.map(|c| c.is_writable).unwrap_or(false) {
                score += 100;
            }

            // Prefer non-iCal providers (+50)
            match e.provider {
                CalendarProvider::ICal => {},
                CalendarProvider::Google => score += 50,
                CalendarProvider::CalDAV | CalendarProvider::ICloud => score += 40,
            }

            // Prefer primary calendar (+20)
            if calendar.map(|c| c.is_primary).unwrap_or(false) {
                score += 20;
            }

            // Prefer more recently modified (+10 for newer)
            if let Some(updated) = e.updated_at {
                // Convert to score based on recency (higher = more recent)
                let age_minutes = (chrono::Utc::now() - updated).num_minutes();
                // Cap benefit at 10 points, decreasing with age
                let recency_score = (10 - (age_minutes / 1440).min(10)) as i32; // 1440 = minutes per day
                score += recency_score;
            }

            (score, *e)
        })
        .collect();

    // Sort by score descending
    scored.sort_by(|a, b| b.0.cmp(&a.0));

    let (_, primary) = scored[0];
    let primary_calendar = calendar_map.get(&primary.calendar_id);

    // Build also_in list from non-primary events
    let also_in: Vec<CalendarProviderInfo> = scored[1..]
        .iter()
        .map(|(_, e)| {
            let cal = calendar_map.get(&e.calendar_id);
            CalendarProviderInfo {
                provider: e.provider,
                calendar_id: e.calendar_id.clone(),
                calendar_name: cal.map(|c| c.name.clone()).unwrap_or_else(|| "Unknown".to_string()),
                event_id: e.id.clone(),
            }
        })
        .collect();

    let is_read_only = primary_calendar.map(|c| !c.is_writable).unwrap_or(true);

    DeduplicatedEvent {
        event: primary.clone(),
        also_in,
        is_read_only,
        fingerprint,
    }
}

/// Checks if an event should be hidden because it's a duplicate of
/// an event in a writable calendar.
///
/// Use case: iCal subscription event that also exists in Google Calendar
/// -> Hide the iCal version, show the Google version
pub fn should_hide_duplicate(
    event: &CalendarEvent,
    deduplicated: &[DeduplicatedEvent],
) -> bool {
    let fingerprint = compute_fingerprint(event);

    // Find the deduplicated entry for this fingerprint
    if let Some(dedup) = deduplicated.iter().find(|d| d.fingerprint == fingerprint) {
        // If this event is not the primary, it should be hidden
        return dedup.event.id != event.id;
    }

    false
}

/// Returns fingerprints that appear in multiple calendars
pub fn find_duplicate_fingerprints(events: &[CalendarEvent]) -> Vec<String> {
    let groups = group_events_by_fingerprint(events);

    groups
        .into_iter()
        .filter(|(_, v)| v.len() > 1)
        .map(|(k, _)| k)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use crate::calendar::models::EventStatus;

    fn make_event(id: &str, title: &str, provider: CalendarProvider, calendar_id: &str) -> CalendarEvent {
        let start = Utc.with_ymd_and_hms(2024, 1, 15, 10, 0, 0).unwrap();
        CalendarEvent {
            id: id.to_string(),
            calendar_id: calendar_id.to_string(),
            provider,
            title: title.to_string(),
            description: None,
            start,
            end: start + chrono::Duration::hours(1),
            all_day: false,
            location: None,
            attendees: Vec::new(),
            recurrence_rule: None,
            status: EventStatus::Confirmed,
            created_at: None,
            updated_at: None,
            etag: None,
            html_link: None,
            color_id: None,
        }
    }

    fn make_calendar(id: &str, provider: CalendarProvider, writable: bool, primary: bool) -> Calendar {
        Calendar {
            id: id.to_string(),
            provider,
            name: format!("Calendar {}", id),
            description: None,
            color: None,
            is_primary: primary,
            is_writable: writable,
            sync_token: None,
            last_synced: None,
            visible: true,
        }
    }

    #[test]
    fn test_no_duplicates() {
        let events = vec![
            make_event("1", "Event A", CalendarProvider::Google, "cal1"),
            make_event("2", "Event B", CalendarProvider::Google, "cal1"),
        ];
        let calendars = vec![make_calendar("cal1", CalendarProvider::Google, true, true)];

        let result = deduplicate_events(events, &calendars);

        assert_eq!(result.len(), 2);
        assert!(result[0].also_in.is_empty());
        assert!(result[1].also_in.is_empty());
    }

    #[test]
    fn test_duplicate_prefers_writable() {
        let events = vec![
            make_event("1", "Team Meeting", CalendarProvider::ICal, "ical1"),
            make_event("2", "Team Meeting", CalendarProvider::Google, "google1"),
        ];
        let calendars = vec![
            make_calendar("ical1", CalendarProvider::ICal, false, false),
            make_calendar("google1", CalendarProvider::Google, true, true),
        ];

        let result = deduplicate_events(events, &calendars);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].event.id, "2"); // Google version is primary
        assert_eq!(result[0].also_in.len(), 1);
        assert_eq!(result[0].also_in[0].event_id, "1"); // iCal is "also in"
    }

    #[test]
    fn test_ical_only_marked_read_only() {
        let events = vec![
            make_event("1", "External Event", CalendarProvider::ICal, "ical1"),
        ];
        let calendars = vec![
            make_calendar("ical1", CalendarProvider::ICal, false, false),
        ];

        let result = deduplicate_events(events, &calendars);

        assert_eq!(result.len(), 1);
        assert!(result[0].is_read_only);
    }
}

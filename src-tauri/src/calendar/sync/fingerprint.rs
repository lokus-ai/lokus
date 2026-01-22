//! Event Fingerprinting
//!
//! Computes content-based fingerprints for calendar events to identify
//! duplicates across different providers. The fingerprint is based on:
//! - Normalized title (lowercase, trimmed, collapsed whitespace)
//! - Start time (rounded to minute precision)
//! - Normalized location (lowercase, trimmed, or empty string)

use crate::calendar::models::CalendarEvent;
use blake3;

/// Computes a unique fingerprint for an event based on its content.
/// Events with the same fingerprint are considered duplicates.
///
/// The fingerprint is computed as:
/// `blake3(normalized_title | start_minute | normalized_location)`
///
/// Where:
/// - start_minute is the Unix timestamp divided by 60 (minute precision)
/// - Title and location are normalized (lowercase, trimmed, collapsed whitespace)
pub fn compute_fingerprint(event: &CalendarEvent) -> String {
    let title = normalize_title(&event.title);
    let start_minute = event.start.timestamp() / 60;
    let location = normalize_location(event.location.as_deref());

    let input = format!("{}|{}|{}", title, start_minute, location);
    let hash = blake3::hash(input.as_bytes());

    // Return first 16 hex characters for a compact but collision-resistant fingerprint
    hash.to_hex()[..16].to_string()
}

/// Normalizes an event title for fingerprint comparison.
/// - Converts to lowercase
/// - Trims leading/trailing whitespace
/// - Collapses multiple spaces into single space
/// - Removes common prefixes like "RE:", "FW:", etc.
pub fn normalize_title(title: &str) -> String {
    let mut normalized = title.trim().to_lowercase();

    // Collapse multiple whitespace characters into single space
    normalized = collapse_whitespace(&normalized);

    // Remove common email-style prefixes
    for prefix in &["re:", "fw:", "fwd:", "re: ", "fw: ", "fwd: "] {
        if normalized.starts_with(prefix) {
            normalized = normalized[prefix.len()..].trim_start().to_string();
        }
    }

    normalized
}

/// Normalizes a location string for fingerprint comparison.
/// - Converts to lowercase
/// - Trims whitespace
/// - Returns empty string for None
pub fn normalize_location(location: Option<&str>) -> String {
    match location {
        Some(loc) => {
            let trimmed = loc.trim().to_lowercase();
            collapse_whitespace(&trimmed)
        }
        None => String::new(),
    }
}

/// Collapses multiple consecutive whitespace characters into a single space.
fn collapse_whitespace(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut prev_was_space = false;

    for c in s.chars() {
        if c.is_whitespace() {
            if !prev_was_space {
                result.push(' ');
                prev_was_space = true;
            }
        } else {
            result.push(c);
            prev_was_space = false;
        }
    }

    result
}

/// Computes fingerprints for multiple events at once.
pub fn compute_fingerprints(events: &[CalendarEvent]) -> Vec<(String, &CalendarEvent)> {
    events.iter()
        .map(|event| (compute_fingerprint(event), event))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use crate::calendar::models::{CalendarProvider, EventStatus};

    fn make_test_event(title: &str, start_minutes_offset: i64, location: Option<&str>) -> CalendarEvent {
        let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 0, 0).unwrap();
        let start = base_time + chrono::Duration::minutes(start_minutes_offset);
        let end = start + chrono::Duration::hours(1);

        CalendarEvent {
            id: "test-id".to_string(),
            calendar_id: "test-cal".to_string(),
            provider: CalendarProvider::Google,
            title: title.to_string(),
            description: None,
            start,
            end,
            all_day: false,
            location: location.map(String::from),
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

    #[test]
    fn test_same_event_same_fingerprint() {
        let event1 = make_test_event("Team Meeting", 0, Some("Room A"));
        let event2 = make_test_event("Team Meeting", 0, Some("Room A"));

        assert_eq!(compute_fingerprint(&event1), compute_fingerprint(&event2));
    }

    #[test]
    fn test_case_insensitive_title() {
        let event1 = make_test_event("Team Meeting", 0, None);
        let event2 = make_test_event("TEAM MEETING", 0, None);
        let event3 = make_test_event("team meeting", 0, None);

        let fp1 = compute_fingerprint(&event1);
        let fp2 = compute_fingerprint(&event2);
        let fp3 = compute_fingerprint(&event3);

        assert_eq!(fp1, fp2);
        assert_eq!(fp2, fp3);
    }

    #[test]
    fn test_whitespace_normalization() {
        let event1 = make_test_event("Team Meeting", 0, None);
        let event2 = make_test_event("  Team   Meeting  ", 0, None);

        assert_eq!(compute_fingerprint(&event1), compute_fingerprint(&event2));
    }

    #[test]
    fn test_different_times_different_fingerprint() {
        let event1 = make_test_event("Team Meeting", 0, None);
        let event2 = make_test_event("Team Meeting", 60, None); // 1 hour later

        assert_ne!(compute_fingerprint(&event1), compute_fingerprint(&event2));
    }

    #[test]
    fn test_same_minute_same_fingerprint() {
        // Events within the same minute should have the same fingerprint
        let event1 = make_test_event("Team Meeting", 0, None);
        // 30 seconds later (still same minute)
        let mut event2 = make_test_event("Team Meeting", 0, None);
        event2.start = event1.start + chrono::Duration::seconds(30);

        assert_eq!(compute_fingerprint(&event1), compute_fingerprint(&event2));
    }

    #[test]
    fn test_location_affects_fingerprint() {
        let event1 = make_test_event("Team Meeting", 0, Some("Room A"));
        let event2 = make_test_event("Team Meeting", 0, Some("Room B"));

        assert_ne!(compute_fingerprint(&event1), compute_fingerprint(&event2));
    }

    #[test]
    fn test_none_and_empty_location_same() {
        let event1 = make_test_event("Team Meeting", 0, None);
        let event2 = make_test_event("Team Meeting", 0, Some(""));
        let event3 = make_test_event("Team Meeting", 0, Some("   "));

        let fp1 = compute_fingerprint(&event1);
        let fp2 = compute_fingerprint(&event2);
        let fp3 = compute_fingerprint(&event3);

        assert_eq!(fp1, fp2);
        assert_eq!(fp2, fp3);
    }

    #[test]
    fn test_normalize_title_removes_prefixes() {
        assert_eq!(normalize_title("RE: Meeting"), "meeting");
        assert_eq!(normalize_title("FW: Meeting"), "meeting");
        assert_eq!(normalize_title("Fwd: Meeting"), "meeting");
    }
}

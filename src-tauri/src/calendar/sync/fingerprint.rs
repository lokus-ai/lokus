//! Event Fingerprinting
//!
//! Computes content-based fingerprints for calendar events to identify
//! duplicates across different providers. The fingerprint is based on:
//! - Normalized title (lowercase, trimmed, collapsed whitespace)
//! - Start time (rounded to minute precision)
//! - Normalized location (lowercase, trimmed, or empty string)

use crate::calendar::models::CalendarEvent;
use blake3;

/// Time bucket size in minutes for fingerprint matching.
/// Events within the same 15-minute window are considered potential duplicates.
/// This handles slight time differences between providers (e.g., 12:15 vs 12:20).
const TIME_BUCKET_MINUTES: i64 = 15;

/// Computes a unique fingerprint for an event based on its content.
/// Events with the same fingerprint are considered duplicates.
///
/// The fingerprint is computed as:
/// `blake3(normalized_title | time_bucket | normalized_location)`
///
/// Where:
/// - time_bucket groups events into 15-minute windows (timestamp / 900)
/// - Title and location are normalized (lowercase, trimmed, collapsed whitespace, iCal escapes stripped)
pub fn compute_fingerprint(event: &CalendarEvent) -> String {
    let title = normalize_title(&event.title);
    // Use 15-minute buckets instead of exact minutes for tolerance
    let time_bucket = event.start.timestamp() / (TIME_BUCKET_MINUTES * 60);
    let location = normalize_location(event.location.as_deref());

    let input = format!("{}|{}|{}", title, time_bucket, location);
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
/// - Strips iCal escape sequences (\, → ,  \; → ;  \\ → \)
/// - Returns empty string for None
pub fn normalize_location(location: Option<&str>) -> String {
    match location {
        Some(loc) => {
            let trimmed = loc.trim().to_lowercase();
            let unescaped = strip_ical_escapes(&trimmed);
            collapse_whitespace(&unescaped)
        }
        None => String::new(),
    }
}

/// Strips iCal escape sequences from a string.
/// iCal format uses backslash escapes: \, for comma, \; for semicolon, \\ for backslash
fn strip_ical_escapes(s: &str) -> String {
    s.replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\n", " ")
        .replace("\\N", " ")
        .replace("\\\\", "\\")
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
    fn test_same_time_bucket_same_fingerprint() {
        // Events within the same 15-minute bucket should have the same fingerprint
        let event1 = make_test_event("Team Meeting", 0, None);
        // 5 minutes later (still same 15-min bucket)
        let event2 = make_test_event("Team Meeting", 5, None);
        // 10 minutes later (still same 15-min bucket)
        let event3 = make_test_event("Team Meeting", 10, None);

        let fp1 = compute_fingerprint(&event1);
        let fp2 = compute_fingerprint(&event2);
        let fp3 = compute_fingerprint(&event3);

        assert_eq!(fp1, fp2);
        assert_eq!(fp2, fp3);
    }

    #[test]
    fn test_different_time_bucket_different_fingerprint() {
        // Events in different 15-minute buckets should have different fingerprints
        let event1 = make_test_event("Team Meeting", 0, None);   // 10:00
        let event2 = make_test_event("Team Meeting", 20, None);  // 10:20 (different bucket)

        assert_ne!(compute_fingerprint(&event1), compute_fingerprint(&event2));
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

    #[test]
    fn test_ical_escape_sequences_normalized() {
        // iCal uses \, for comma, \; for semicolon, \\ for backslash
        // These should be normalized so escaped and unescaped versions match
        let event1 = make_test_event("Meeting", 0, Some("014\\, Building:Z\\, Room:130"));
        let event2 = make_test_event("Meeting", 0, Some("014, Building:Z, Room:130"));

        assert_eq!(compute_fingerprint(&event1), compute_fingerprint(&event2));
    }

    #[test]
    fn test_ical_newline_escape_normalized() {
        // iCal uses \n and \N for newlines - should normalize to space
        let event1 = make_test_event("Meeting", 0, Some("Room A\\nFloor 2"));
        let event2 = make_test_event("Meeting", 0, Some("Room A Floor 2"));

        assert_eq!(compute_fingerprint(&event1), compute_fingerprint(&event2));
    }

    #[test]
    fn test_strip_ical_escapes() {
        assert_eq!(strip_ical_escapes("hello\\, world"), "hello, world");
        assert_eq!(strip_ical_escapes("a\\;b\\;c"), "a;b;c");
        assert_eq!(strip_ical_escapes("path\\\\to\\\\file"), "path\\to\\file");
        assert_eq!(strip_ical_escapes("line1\\nline2"), "line1 line2");
        assert_eq!(strip_ical_escapes("line1\\Nline2"), "line1 line2");
    }
}

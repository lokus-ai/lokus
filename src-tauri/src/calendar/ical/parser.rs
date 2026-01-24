use crate::calendar::models::{CalendarEvent, CalendarProvider, EventStatus, ICalSubscription};
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use ical::parser::ical::component::IcalEvent;
use ical::parser::ical::IcalParser;
use std::io::BufReader;
use uuid::Uuid;

/// Parse ICS content string into calendar events
pub fn parse_ics_content(content: &str, calendar_id: &str) -> Result<Vec<CalendarEvent>, String> {
    let reader = BufReader::new(content.as_bytes());
    let parser = IcalParser::new(reader);

    let mut events = Vec::new();

    for calendar_result in parser {
        match calendar_result {
            Ok(calendar) => {
                for ical_event in calendar.events {
                    if let Some(event) = parse_ical_event(&ical_event, calendar_id) {
                        events.push(event);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to parse iCal calendar: {}", e);
            }
        }
    }

    Ok(events)
}

/// Parse a single iCal event into our CalendarEvent model
fn parse_ical_event(ical_event: &IcalEvent, calendar_id: &str) -> Option<CalendarEvent> {
    let mut uid = None;
    let mut summary = None;
    let mut description = None;
    let mut dtstart = None;
    let mut dtend = None;
    let mut location = None;
    let mut status = EventStatus::Confirmed;
    let mut all_day = false;
    let mut rrule = None;
    let mut created = None;
    let mut last_modified = None;

    for property in &ical_event.properties {
        match property.name.as_str() {
            "UID" => uid = property.value.clone(),
            "SUMMARY" => summary = property.value.clone(),
            "DESCRIPTION" => description = property.value.clone(),
            "DTSTART" => {
                if let Some(ref value) = property.value {
                    // Check if it's an all-day event (DATE vs DATE-TIME)
                    let is_date_only = property.params.as_ref()
                        .map(|p| p.iter().any(|(k, v)| k == "VALUE" && v.contains(&"DATE".to_string())))
                        .unwrap_or(false) || value.len() == 8;

                    // Extract TZID parameter if present
                    let tzid = property.params.as_ref()
                        .and_then(|p| p.iter().find(|(k, _)| k == "TZID"))
                        .and_then(|(_, v)| v.first())
                        .map(|s| s.as_str());

                    all_day = is_date_only;
                    dtstart = parse_ical_datetime(value, is_date_only, tzid);
                }
            }
            "DTEND" => {
                if let Some(ref value) = property.value {
                    let is_date_only = property.params.as_ref()
                        .map(|p| p.iter().any(|(k, v)| k == "VALUE" && v.contains(&"DATE".to_string())))
                        .unwrap_or(false) || value.len() == 8;

                    // Extract TZID parameter if present
                    let tzid = property.params.as_ref()
                        .and_then(|p| p.iter().find(|(k, _)| k == "TZID"))
                        .and_then(|(_, v)| v.first())
                        .map(|s| s.as_str());

                    dtend = parse_ical_datetime(value, is_date_only, tzid);
                }
            }
            "LOCATION" => location = property.value.clone(),
            "STATUS" => {
                if let Some(ref value) = property.value {
                    status = match value.to_uppercase().as_str() {
                        "CONFIRMED" => EventStatus::Confirmed,
                        "TENTATIVE" => EventStatus::Tentative,
                        "CANCELLED" => EventStatus::Cancelled,
                        _ => EventStatus::Confirmed,
                    };
                }
            }
            "RRULE" => rrule = property.value.clone(),
            "CREATED" => {
                if let Some(ref value) = property.value {
                    // CREATED is typically UTC, pass None for tzid
                    created = parse_ical_datetime(value, false, None);
                }
            }
            "LAST-MODIFIED" => {
                if let Some(ref value) = property.value {
                    // LAST-MODIFIED is typically UTC, pass None for tzid
                    last_modified = parse_ical_datetime(value, false, None);
                }
            }
            _ => {}
        }
    }

    // Require at minimum: UID, SUMMARY, DTSTART
    let uid = uid?;
    let title = summary.unwrap_or_else(|| "(No title)".to_string());
    let start = dtstart?;

    // If no DTEND, default to start + 1 hour (or same day for all-day events)
    let end = dtend.unwrap_or_else(|| {
        if all_day {
            start + chrono::Duration::days(1)
        } else {
            start + chrono::Duration::hours(1)
        }
    });

    Some(CalendarEvent {
        id: uid,
        calendar_id: calendar_id.to_string(),
        provider: CalendarProvider::ICal,
        title,
        description,
        start,
        end,
        all_day,
        location,
        attendees: Vec::new(),
        recurrence_rule: rrule,
        status,
        created_at: created,
        updated_at: last_modified,
        etag: None,
        html_link: None,
        color_id: None,
    })
}

/// Parse iCal datetime string to DateTime<Utc>
///
/// Handles three cases:
/// 1. DATE format (YYYYMMDD) - all-day events, treated as UTC midnight
/// 2. UTC datetime (YYYYMMDDTHHmmssZ) - already in UTC
/// 3. Local datetime with TZID - converted from specified timezone to UTC
/// 4. Local datetime without TZID - assumed to be in system local timezone
fn parse_ical_datetime(value: &str, is_date_only: bool, tzid: Option<&str>) -> Option<DateTime<Utc>> {
    if is_date_only || value.len() == 8 {
        // DATE format: YYYYMMDD (all-day events)
        // Treat as UTC midnight to avoid timezone shifts
        NaiveDate::parse_from_str(value, "%Y%m%d")
            .ok()
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|dt| Utc.from_utc_datetime(&dt))
    } else if value.ends_with('Z') {
        // UTC datetime: YYYYMMDDTHHmmssZ
        let value = value.trim_end_matches('Z');
        NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S")
            .ok()
            .map(|dt| Utc.from_utc_datetime(&dt))
    } else if let Some(tz_str) = tzid {
        // Datetime with explicit timezone (TZID parameter)
        let naive = NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S").ok()?;

        // Try to parse the timezone string
        if let Ok(tz) = tz_str.parse::<Tz>() {
            // Convert from the specified timezone to UTC
            tz.from_local_datetime(&naive)
                .earliest()
                .map(|dt| dt.with_timezone(&Utc))
        } else {
            // Fallback: if timezone parsing fails, treat as local time
            tracing::warn!("Unknown timezone '{}', treating as local time", tz_str);
            Local.from_local_datetime(&naive)
                .earliest()
                .map(|dt| dt.with_timezone(&Utc))
        }
    } else {
        // Local datetime without TZID: assume system local timezone
        NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S")
            .ok()
            .and_then(|naive| {
                Local.from_local_datetime(&naive)
                    .earliest()
                    .map(|dt| dt.with_timezone(&Utc))
            })
    }
}

/// Fetch ICS content from a URL
pub async fn fetch_ics_from_url(url: &str) -> Result<String, String> {
    // Handle webcal:// URLs by converting to https://
    let url = if url.starts_with("webcal://") {
        url.replace("webcal://", "https://")
    } else {
        url.to_string()
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Lokus/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch ICS: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let content = response.text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Basic validation - check if it looks like ICS content
    if !content.contains("BEGIN:VCALENDAR") {
        return Err("Invalid ICS content: missing VCALENDAR".to_string());
    }

    Ok(content)
}

/// Parse ICS file from filesystem
pub fn parse_ics_file(path: &std::path::Path, calendar_id: &str) -> Result<Vec<CalendarEvent>, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    parse_ics_content(&content, calendar_id)
}

/// Extract calendar name from ICS content
pub fn extract_calendar_name(content: &str) -> Option<String> {
    let reader = BufReader::new(content.as_bytes());
    let parser = IcalParser::new(reader);

    for calendar_result in parser {
        if let Ok(calendar) = calendar_result {
            for property in &calendar.properties {
                if property.name == "X-WR-CALNAME" {
                    return property.value.clone();
                }
            }
        }
    }

    None
}

/// Create a new iCal subscription
pub fn create_subscription(url: &str, name: Option<String>, color: Option<String>) -> ICalSubscription {
    ICalSubscription {
        id: Uuid::new_v4().to_string(),
        name: name.unwrap_or_else(|| "iCal Calendar".to_string()),
        url: url.to_string(),
        color,
        last_synced: None,
        sync_interval_minutes: 60, // Default: sync every hour
        enabled: true,
    }
}

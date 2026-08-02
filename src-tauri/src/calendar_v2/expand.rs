//! Occurrence expansion: turns event rows into concrete (start, end) rows in
//! the `occurrences` table, which is the ONLY thing the UI range-queries.
//!
//! - Timed singles: one row, verbatim.
//! - Timed recurring: RRULE/RDATE/EXDATE expanded over the horizon with the
//!   `rrule` crate, in the event's original timezone so DST transitions keep
//!   wall-clock times (a 9am standup stays 9am across a DST switch).
//! - All-day: civil dates → local midnight at expansion time. `meta` records
//!   the tz used so the store can re-expand when the system tz changes.
//! - Override instances (RECURRENCE-ID) are separate event rows expanded as
//!   singles; the master's expansion must carry an EXDATE for the overridden
//!   slot (providers send it that way; CalDAV parsing enforces it).

use chrono::{DateTime, LocalResult, NaiveDate, TimeZone, Utc};
use rrule::RRuleSet;

use super::models::EventRow;

/// Hard cap so a pathological RRULE can't wedge the writer thread.
const MAX_OCCURRENCES: u16 = 3000;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Occurrence {
    pub start_ts: i64,
    pub end_ts: i64,
}

/// Expand one event over [horizon_start, horizon_end) (unix ms). `local_tz`
/// is the IANA name used for all-day midnight resolution.
pub fn expand_event(
    ev: &EventRow,
    horizon_start: i64,
    horizon_end: i64,
    local_tz: &str,
) -> Vec<Occurrence> {
    if ev.deleted {
        return vec![];
    }
    if ev.all_day {
        return expand_all_day(ev, horizon_start, horizon_end, local_tz);
    }
    let (Some(start), Some(end)) = (ev.start_ts, ev.end_ts) else {
        return vec![];
    };
    let duration = (end - start).max(0);

    if ev.rrule.is_none() && ev.rdate.is_none() {
        if start < horizon_end && end > horizon_start {
            return vec![Occurrence { start_ts: start, end_ts: end }];
        }
        return vec![];
    }

    expand_recurring(ev, start, duration, horizon_start, horizon_end)
}

fn expand_recurring(
    ev: &EventRow,
    start_ts: i64,
    duration_ms: i64,
    horizon_start: i64,
    horizon_end: i64,
) -> Vec<Occurrence> {
    let Some(ical) = build_ical_snippet(ev, start_ts) else {
        // Unparseable recurrence: fall back to the master as a single so the
        // event isn't invisible.
        return vec![Occurrence { start_ts, end_ts: start_ts + duration_ms }];
    };

    let set: RRuleSet = match ical.parse() {
        Ok(s) => s,
        Err(_) => return vec![Occurrence { start_ts, end_ts: start_ts + duration_ms }],
    };

    let after = ms_to_rrule_tz(horizon_start - duration_ms);
    let before = ms_to_rrule_tz(horizon_end);
    let result = set.after(after).before(before).all(MAX_OCCURRENCES);

    result
        .dates
        .into_iter()
        .map(|d| {
            let s = d.timestamp_millis();
            Occurrence { start_ts: s, end_ts: s + duration_ms }
        })
        .filter(|o| o.start_ts < horizon_end && o.end_ts > horizon_start)
        .collect()
}

/// Build the iCal snippet the rrule crate parses: DTSTART (in the original
/// tz when known), RRULE, and RDATE/EXDATE lines from the stored JSON arrays.
fn build_ical_snippet(ev: &EventRow, start_ts: i64) -> Option<String> {
    let mut lines: Vec<String> = Vec::new();

    let tz: Option<chrono_tz::Tz> = ev.start_tz.as_deref().and_then(|t| t.parse().ok());
    let dtstart = match tz {
        Some(tz) => {
            let dt = tz.timestamp_millis_opt(start_ts).single()?;
            format!("DTSTART;TZID={}:{}", tz.name(), dt.format("%Y%m%dT%H%M%S"))
        }
        None => {
            let dt = Utc.timestamp_millis_opt(start_ts).single()?;
            format!("DTSTART:{}", dt.format("%Y%m%dT%H%M%SZ"))
        }
    };
    lines.push(dtstart);

    if let Some(rr) = &ev.rrule {
        let rr = rr.trim();
        if !rr.is_empty() {
            if rr.to_uppercase().starts_with("RRULE") {
                lines.push(rr.to_string());
            } else {
                lines.push(format!("RRULE:{rr}"));
            }
        }
    }
    for (field, label) in [(&ev.rdate, "RDATE"), (&ev.exdate, "EXDATE")] {
        if let Some(json) = field {
            if let Ok(values) = serde_json::from_str::<Vec<String>>(json) {
                for v in values {
                    let v = v.trim().to_string();
                    if v.is_empty() {
                        continue;
                    }
                    if v.to_uppercase().starts_with(label) {
                        lines.push(v);
                    } else {
                        lines.push(format!("{label}:{v}"));
                    }
                }
            }
        }
    }

    if lines.len() < 2 {
        return None; // DTSTART alone — nothing recurring to parse
    }
    Some(lines.join("\n"))
}

fn ms_to_rrule_tz(ms: i64) -> DateTime<rrule::Tz> {
    let utc = Utc.timestamp_millis_opt(ms).single().unwrap_or_else(Utc::now);
    utc.with_timezone(&rrule::Tz::UTC)
}

fn expand_all_day(
    ev: &EventRow,
    horizon_start: i64,
    horizon_end: i64,
    local_tz: &str,
) -> Vec<Occurrence> {
    let (Some(sd), ed) = (ev.start_date.as_deref(), ev.end_date.as_deref()) else {
        return vec![];
    };
    let Ok(start_date) = NaiveDate::parse_from_str(sd, "%Y-%m-%d") else {
        return vec![];
    };
    let end_date = ed
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .unwrap_or_else(|| start_date.succ_opt().unwrap_or(start_date));

    let tz: chrono_tz::Tz = local_tz.parse().unwrap_or(chrono_tz::UTC);
    let start_ts = civil_midnight_ms(start_date, tz);
    let end_ts = civil_midnight_ms(end_date, tz);

    // Recurring all-day (e.g. birthdays: FREQ=YEARLY). Expand on dates.
    if ev.rrule.is_some() {
        let duration = end_ts - start_ts;
        let synthetic = EventRow {
            all_day: false,
            start_ts: Some(start_ts),
            end_ts: Some(end_ts),
            start_tz: Some(tz.name().to_string()),
            ..ev.clone()
        };
        return expand_recurring(&synthetic, start_ts, duration, horizon_start, horizon_end);
    }

    if start_ts < horizon_end && end_ts > horizon_start {
        vec![Occurrence { start_ts, end_ts }]
    } else {
        vec![]
    }
}

fn civil_midnight_ms(date: NaiveDate, tz: chrono_tz::Tz) -> i64 {
    let naive = date.and_hms_opt(0, 0, 0).unwrap_or_default();
    match tz.from_local_datetime(&naive) {
        LocalResult::Single(dt) => dt.timestamp_millis(),
        LocalResult::Ambiguous(a, _) => a.timestamp_millis(),
        // Midnight skipped by DST (e.g. Brazil historically): use the gap end.
        LocalResult::None => tz
            .from_local_datetime(&naive.and_utc().naive_utc())
            .earliest()
            .map(|d| d.timestamp_millis())
            .unwrap_or_else(|| date.and_hms_opt(1, 0, 0).unwrap_or_default().and_utc().timestamp_millis()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_event() -> EventRow {
        EventRow {
            id: "e1".into(),
            calendar_id: "c1".into(),
            title: "t".into(),
            status: "confirmed".into(),
            transparency: "opaque".into(),
            ..Default::default()
        }
    }

    const HOUR: i64 = 3_600_000;
    const DAY: i64 = 86_400_000;

    #[test]
    fn single_timed_event_one_occurrence() {
        let mut ev = base_event();
        ev.start_ts = Some(1_754_000_000_000);
        ev.end_ts = Some(1_754_000_000_000 + HOUR);
        let occ = expand_event(&ev, 1_753_000_000_000, 1_755_000_000_000, "UTC");
        assert_eq!(occ.len(), 1);
        assert_eq!(occ[0].end_ts - occ[0].start_ts, HOUR);
    }

    #[test]
    fn single_outside_horizon_is_dropped() {
        let mut ev = base_event();
        ev.start_ts = Some(0);
        ev.end_ts = Some(HOUR);
        assert!(expand_event(&ev, DAY, 2 * DAY, "UTC").is_empty());
    }

    #[test]
    fn daily_rrule_expands() {
        let mut ev = base_event();
        // 2026-01-05 09:00 UTC
        ev.start_ts = Some(1_767_603_600_000);
        ev.end_ts = Some(1_767_603_600_000 + HOUR);
        ev.rrule = Some("FREQ=DAILY;COUNT=10".into());
        let occ = expand_event(
            &ev,
            1_767_603_600_000 - DAY,
            1_767_603_600_000 + 30 * DAY,
            "UTC",
        );
        assert_eq!(occ.len(), 10);
        assert_eq!(occ[1].start_ts - occ[0].start_ts, DAY);
    }

    #[test]
    fn exdate_removes_instance() {
        let mut ev = base_event();
        ev.start_ts = Some(1_767_603_600_000); // 2026-01-05 09:00 UTC
        ev.end_ts = Some(1_767_603_600_000 + HOUR);
        ev.rrule = Some("FREQ=DAILY;COUNT=5".into());
        ev.exdate = Some(r#"["20260106T090000Z"]"#.into());
        let occ = expand_event(&ev, 0, 1_767_603_600_000 + 30 * DAY, "UTC");
        assert_eq!(occ.len(), 4);
    }

    #[test]
    fn rdate_adds_instance() {
        let mut ev = base_event();
        ev.start_ts = Some(1_767_603_600_000);
        ev.end_ts = Some(1_767_603_600_000 + HOUR);
        ev.rrule = Some("FREQ=DAILY;COUNT=2".into());
        ev.rdate = Some(r#"["20260120T090000Z"]"#.into());
        let occ = expand_event(&ev, 0, 1_767_603_600_000 + 30 * DAY, "UTC");
        assert_eq!(occ.len(), 3);
    }

    #[test]
    fn weekly_across_dst_keeps_wall_clock() {
        let mut ev = base_event();
        // Mon 2026-03-02 09:00 America/New_York (EST, UTC-5) = 14:00Z
        ev.start_ts = Some(1_772_460_000_000);
        ev.end_ts = Some(1_772_460_000_000 + HOUR);
        ev.start_tz = Some("America/New_York".into());
        ev.rrule = Some("FREQ=WEEKLY;COUNT=4".into());
        let occ = expand_event(&ev, 0, ev.start_ts.unwrap() + 40 * DAY, "UTC");
        assert_eq!(occ.len(), 4);
        // DST starts Mar 8 2026 → the Mar 9+ instances are UTC-4: gap between
        // week 1 and week 2 is 7 days minus 1 hour in absolute time.
        assert_eq!(occ[1].start_ts - occ[0].start_ts, 7 * DAY - HOUR);
        assert_eq!(occ[2].start_ts - occ[1].start_ts, 7 * DAY);
    }

    #[test]
    fn all_day_uses_local_midnight() {
        let mut ev = base_event();
        ev.all_day = true;
        ev.start_date = Some("2026-08-02".into());
        ev.end_date = Some("2026-08-03".into());
        let occ = expand_event(&ev, 0, 4_000_000_000_000, "America/New_York");
        assert_eq!(occ.len(), 1);
        // 2026-08-02 00:00 EDT == 04:00Z
        assert_eq!(occ[0].start_ts % DAY, 4 * HOUR);
        assert_eq!(occ[0].end_ts - occ[0].start_ts, DAY);
    }

    #[test]
    fn deleted_event_expands_to_nothing() {
        let mut ev = base_event();
        ev.start_ts = Some(1_754_000_000_000);
        ev.end_ts = Some(1_754_000_000_000 + HOUR);
        ev.deleted = true;
        assert!(expand_event(&ev, 0, 4_000_000_000_000, "UTC").is_empty());
    }
}

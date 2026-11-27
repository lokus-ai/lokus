//! @part-of calendar
//! Meeting notes and the morning briefing. A meeting note is an ordinary Markdown note in the
//! open folder (`Meetings/2026-12-01 Design review.md`) that names its event; the event side of
//! the link is remembered in the local copy and found again from the note if that is lost.

use std::path::Path;

use chrono::{DateTime, Duration, TimeZone, Utc};
use chrono_tz::Tz;
use serde_json::{json, Value};

use crate::model::{bad, stamp, time, Event, Result};
use crate::store::Store;

fn zone(name: &str) -> Tz {
    name.parse().unwrap_or(chrono_tz::UTC)
}

fn clock(at: &str, tz: Tz) -> String {
    time(at)
        .map(|t| t.with_timezone(&tz).format("%H:%M").to_string())
        .unwrap_or_default()
}

fn who(e: &Event) -> Vec<String> {
    e.guests
        .iter()
        .map(|g| {
            if g.name.is_empty() {
                g.email.clone()
            } else {
                g.name.clone()
            }
        })
        .collect()
}

/// The note an event already has in this folder, if it is still there.
fn linked(store: &Store, root: &Path, key: &str) -> Result<Option<String>> {
    let folder = root.to_string_lossy();
    if let Some(path) = store.note(key, &folder)? {
        if root.join(&path).is_file() {
            return Ok(Some(path));
        }
    }
    let line = format!("event: {key}");
    for entry in std::fs::read_dir(root.join("Meetings"))
        .into_iter()
        .flatten()
        .flatten()
    {
        let found = std::fs::read_to_string(entry.path())
            .is_ok_and(|t| t.lines().take(12).any(|l| l == line));
        if found {
            let path = format!("Meetings/{}", entry.file_name().to_string_lossy());
            store.keep_note(key, &folder, &path)?;
            return Ok(Some(path));
        }
    }
    Ok(None)
}

/// The meeting note of an event: the one it has, or a new one with the time and guests filled in.
pub fn meeting_note(dir: &Path, root: &Path, key: &str, zone_name: &str) -> Result<Value> {
    let store = Store::open(dir)?;
    let event = store.event(key)?.ok_or_else(|| bad("no such event"))?;
    if let Some(path) = linked(&store, root, key)? {
        return Ok(json!({ "path": path, "created": false }));
    }
    let tz = zone(if zone_name.is_empty() {
        &event.zone
    } else {
        zone_name
    });
    let day = time(&event.start)?
        .with_timezone(&tz)
        .format("%Y-%m-%d")
        .to_string();
    let title = if event.title.trim().is_empty() {
        "Meeting"
    } else {
        event.title.trim()
    };
    let safe: String = title
        .chars()
        .map(|c| {
            if "/\\:*?\"<>|#^[]".contains(c) {
                ' '
            } else {
                c
            }
        })
        .collect();
    let vault = lokus_core::Vault::open(root)?;
    let mut path = format!("Meetings/{day} {}.md", safe.trim());
    let mut n = 2;
    while root.join(&path).exists() {
        path = format!("Meetings/{day} {} {n}.md", safe.trim());
        n += 1;
    }
    let hours = format!(
        "{}–{} ({})",
        clock(&event.start, tz),
        clock(&event.end, tz),
        tz.name()
    );
    let guests = who(&event);
    let mut text = format!(
        "---\ntype: meeting\nevent: {key}\ndate: {day}\ntime: {hours}\nguests: [{}]\n---\n# {title}\n\n**When:** {day}, {hours}\n",
        guests.join(", ")
    );
    if !guests.is_empty() {
        text.push_str(&format!("**Guests:** {}\n", guests.join(", ")));
    }
    if !event.location.is_empty() {
        text.push_str(&format!("**Where:** {}\n", event.location));
    }
    if let Some(meeting) = &event.meeting {
        text.push_str(&format!("**Join:** {}\n", meeting.url));
    }
    text.push_str("\n## Notes\n\n\n## Actions\n\n- [ ] \n");
    vault.create(&path, &text)?;
    store.keep_note(key, &root.to_string_lossy(), &path)?;
    Ok(json!({ "path": path, "created": true }))
}

/// A day's events in order, as a few lines to read in the morning.
pub fn briefing(dir: &Path, zone_name: &str, date: Option<&str>) -> Result<Value> {
    let tz = zone(zone_name);
    let day = match date {
        Some(d) => chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
            .map_err(|_| bad("'date' looks like 2026-12-01"))?,
        None => Utc::now().with_timezone(&tz).date_naive(),
    };
    let start: DateTime<Utc> = tz
        .from_local_datetime(&day.and_hms_opt(0, 0, 0).unwrap_or_default())
        .earliest()
        .map(|t| t.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);
    let end = start + Duration::days(1);
    let events = if Store::exists(dir) {
        Store::open(dir)?.events(&stamp(start), &stamp(end), false)?
    } else {
        Vec::new()
    };
    let mut lines = Vec::new();
    let mut busy = Duration::zero();
    for e in events.iter().filter(|e| e.reply != "declined") {
        let mut line = if e.all_day {
            format!("- All day: {}", e.title)
        } else {
            busy += time(&e.end)? - time(&e.start)?;
            format!(
                "- {}–{} {}",
                clock(&e.start, tz),
                clock(&e.end, tz),
                e.title
            )
        };
        let guests = who(e);
        if !guests.is_empty() {
            line.push_str(&format!(" (with {})", guests.join(", ")));
        }
        if e.reply == "needsAction" {
            line.push_str(" · not answered yet");
        }
        if e.pending {
            line.push_str(" · changes not sent");
        }
        if let Some(meeting) = &e.meeting {
            line.push_str(&format!(" · {}", meeting.url));
        }
        lines.push(line);
    }
    let head = match lines.len() {
        0 => format!("{}: nothing on the calendar.", day.format("%A %-d %B")),
        n => format!(
            "{}: {n} event{}, {}h{:02} in meetings.",
            day.format("%A %-d %B"),
            if n == 1 { "" } else { "s" },
            busy.num_minutes() / 60,
            busy.num_minutes() % 60
        ),
    };
    let text = std::iter::once(head)
        .chain(lines)
        .collect::<Vec<_>>()
        .join("\n");
    Ok(json!({ "date": day.to_string(), "zone": tz.name(), "text": text, "events": events }))
}

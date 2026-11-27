//! @part-of calendar
//! Team availability across companies: each member's own app writes when they are busy, and
//! nothing else, into a note in the team's folder (`Team/Availability/<email>.md`). The folder
//! sync the team already has carries it to everyone. No title, guest or place is ever written.

use std::path::Path;

use chrono::{Duration, Utc};
use serde_json::{json, Value};

use crate::model::{now, stamp, time, CalError, Result};
use crate::store::Store;

pub const FOLDER: &str = "Team/Availability";
const DAYS: i64 = 14;

/// Overlapping and touching times as one, in order.
pub fn merged(mut times: Vec<(String, String)>) -> Vec<(String, String)> {
    times.sort();
    let mut out: Vec<(String, String)> = Vec::new();
    for (start, end) in times {
        match out.last_mut() {
            Some(last) if start <= last.1 => {
                if end > last.1 {
                    last.1 = end;
                }
            }
            _ => out.push((start, end)),
        }
    }
    out
}

/// When this person is busy over the next two weeks, from every connected account.
fn own_busy(store: &Store) -> Result<Vec<(String, String)>> {
    let (from, to) = (Utc::now(), Utc::now() + Duration::days(DAYS));
    let events = store.events(&stamp(from), &stamp(to), true)?;
    Ok(merged(
        events
            .into_iter()
            .filter(|e| !e.all_day && e.reply != "declined" && !e.unsent)
            .map(|e| (e.start, e.end))
            .collect(),
    ))
}

fn body_of(text: &str) -> &str {
    text.splitn(3, "---\n").nth(2).unwrap_or(text)
}

/// Write this person's busy times into the team folder. Does nothing when nothing changed in
/// the last ten minutes, so the sync is not fed a new version every minute.
pub fn publish(dir: &Path, root: &Path) -> Result<Value> {
    let store = Store::open(dir)?;
    let accounts = store.accounts()?;
    let Some(first) = accounts.first() else {
        return Ok(json!({ "written": false, "reason": "no calendar account" }));
    };
    let emails: Vec<&str> = accounts.iter().map(|a| a.email.as_str()).collect();
    let lines: String = own_busy(&store)?
        .iter()
        .map(|(s, e)| format!("- {s}/{e}\n"))
        .collect();
    let body = format!(
        "\nWhen {} is busy over the next {DAYS} days. Times only: Lokus writes no titles, guests or places here.\n\n{lines}",
        first.name
    );
    let rel = format!("{FOLDER}/{}.md", first.email);
    let vault = lokus_core::Vault::open(root)?;
    let path = vault.resolve(&rel)?;
    if let Ok(old) = std::fs::read_to_string(&path) {
        let age = field(&old, "updated")
            .and_then(|u| time(&u).ok())
            .map(|u| Utc::now() - u);
        if body_of(&old) == body && age.is_some_and(|a| a < Duration::minutes(10)) {
            return Ok(json!({ "written": false, "path": rel }));
        }
    }
    let text = format!(
        "---\ntype: availability\nmember: {}\nname: {}\nemails: [{}]\nupdated: {}\n---\n{body}",
        first.email,
        first.name,
        emails.join(", "),
        now()
    );
    vault.write_file(&rel, text.as_bytes())?;
    Ok(json!({ "written": true, "path": rel }))
}

fn field(text: &str, name: &str) -> Option<String> {
    let head = text.strip_prefix("---\n")?.split("\n---").next()?;
    head.lines()
        .find_map(|l| l.strip_prefix(name)?.strip_prefix(':'))
        .map(|v| v.trim().to_string())
}

/// Everyone's busy times as last synced into this folder, each with how old it is.
pub fn read(root: &Path) -> Result<Vec<Value>> {
    let folder = root.join(FOLDER);
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(&folder) else {
        return Ok(out);
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_none_or(|e| e != "md") {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        if field(&text, "type").as_deref() != Some("availability") {
            continue;
        }
        let updated = field(&text, "updated").unwrap_or_default();
        let age = time(&updated)
            .ok()
            .map(|u| (Utc::now() - u).num_minutes().max(0));
        let emails: Vec<String> = field(&text, "emails")
            .unwrap_or_default()
            .trim_matches(|c| c == '[' || c == ']')
            .split(',')
            .map(|e| e.trim().to_lowercase())
            .filter(|e| !e.is_empty())
            .collect();
        let busy: Vec<(String, String)> = body_of(&text)
            .lines()
            .filter_map(|l| l.strip_prefix("- ")?.split_once('/'))
            .filter(|(s, e)| time(s).is_ok() && time(e).is_ok())
            .map(|(s, e)| (s.to_string(), e.to_string()))
            .collect();
        out.push(json!({
            "member": field(&text, "member").unwrap_or_default(),
            "name": field(&text, "name").unwrap_or_default(),
            "emails": emails, "updated": updated, "age_minutes": age, "busy": busy,
        }));
    }
    out.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    Ok(out)
}

pub fn need_folder(root: Option<&Path>) -> Result<&Path> {
    root.ok_or_else(|| CalError::new("no_vault", "Open a folder first."))
}

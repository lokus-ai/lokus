//! @part-of core
//! Anything a team's systems know about that is not a customer, and their logs.
//!
//! A **thing** is whatever the sender says it is: a building, an order, a sensor, a job. It
//! arrives as `{"kind": "building", "id": "bld-204", "set": {...}}` and becomes a note in
//! `data/<kind>/`, with whatever details were sent as its properties. Nobody declares a schema
//! first: the details are taken as they come (nested ones flattened, lists kept as lists), and
//! how each is shown is worked out afterwards, in the app. Things point at each other and at
//! customers through `links`, which become ordinary links between notes.
//!
//! A **log line** is different: there are far too many to be notes. Each is appended to a file
//! for its day in `.lokus/logs/<stream>/`, which is not synced and is kept for two weeks. The
//! assistant searches them when it is working something out.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde_json::{json, Map, Value};

use crate::error::Result;
use crate::frontmatter;
use crate::ingest::{bad, compose, detail_key, file_name, find_customer, iso, plain, same, stem, text_of, update, write_event, read_event, label};
use crate::vault::{Vault, META_DIR};

pub const DATA: &str = "data";
const MAX_DETAILS: usize = 80;
const MAX_DEPTH: usize = 3;
const MAX_LIST: usize = 30;
/// How much of a nested list of records is kept in the note's text.
const MAX_RAW: usize = 4 * 1024;

const LOG_DAYS: i64 = 14;
const LOG_LINE: usize = 8 * 1024;
const LOG_DAY_BYTES: u64 = 20 * 1024 * 1024;

fn scalar(value: &Value) -> Option<Value> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => Some(value.clone()),
        Value::String(s) => Some(Value::String(s.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(500).collect())),
        _ => None,
    }
}

/// Take whatever shape was sent and lay it flat: `{"address": {"city": "Pune"}}` becomes
/// `address_city`. A list of plain values stays a list; a list of records is counted, and the
/// records themselves are handed back to be kept in the note's text.
fn flatten(prefix: &str, value: &Value, depth: usize, out: &mut Vec<(String, Value)>, raw: &mut Vec<(String, Value)>) -> Result<()> {
    let Some(object) = value.as_object() else {
        return Err(bad("set is a list of details"));
    };
    for (name, value) in object {
        let key = detail_key(&if prefix.is_empty() { name.clone() } else { format!("{prefix}_{name}") }.chars().take(40).collect::<String>())?;
        match value {
            Value::Object(_) if depth < MAX_DEPTH => flatten(&key, value, depth + 1, out, raw)?,
            Value::Object(_) => raw.push((key, value.clone())),
            Value::Array(items) if items.iter().all(|i| scalar(i).is_some()) => {
                out.push((key, Value::Array(items.iter().take(MAX_LIST).filter_map(scalar).collect())));
            }
            Value::Array(items) => {
                out.push((format!("{key}_count").chars().take(40).collect(), json!(items.len())));
                raw.push((key, value.clone()));
            }
            other => out.push((key, scalar(other).unwrap_or(Value::Null))),
        }
        if out.len() > MAX_DETAILS {
            return Err(bad("too many details in one fact; send the important ones, or split it"));
        }
    }
    Ok(())
}

fn folder(kind: &str) -> String {
    format!("{DATA}/{kind}")
}

/// The note for a thing: found by its `id`, or by the name its file would have.
fn find(vault: &Vault, kind: &str, id: &str) -> Result<Option<String>> {
    let prefix = format!("{}/", folder(kind));
    if let Ok(name) = file_name(id) {
        let direct = format!("{prefix}{name}.md");
        if vault.resolve(&direct)?.exists() {
            return Ok(Some(direct));
        }
    }
    for path in vault.notes()? {
        let Some(rest) = path.strip_prefix(&prefix) else { continue };
        if rest.contains('/') {
            continue;
        }
        let props = frontmatter::read(&vault.read(&path)?.text);
        if props.get("id").map(plain).is_some_and(|v| same(&v, id)) {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

/// The list every kind gets the first time one of its things arrives.
fn ensure_list(vault: &Vault, kind: &str) -> Result<Option<String>> {
    let path = format!("{DATA}/{} list.md", label(kind));
    if vault.resolve(&path)?.exists() {
        return Ok(None);
    }
    let props = [("view", json!("table")), ("source", json!(folder(kind)))];
    vault.create(&path, &compose(&props, ""))?;
    Ok(Some(path))
}

/// What a link points at, as the name of a note: a customer, or another thing (made as a
/// placeholder if it has not arrived yet, so the link is never dangling).
fn target(vault: &Vault, kind: &str, id: &str) -> Result<String> {
    if kind == "customer" {
        if let Some(path) = find_customer(vault, id)? {
            return Ok(stem(&path).to_string());
        }
        // "quivly.com" for a customer filed as "Quivly" with no domain recorded: the same one.
        let bare = |text: &str| text.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>();
        let first = bare(id.split('.').next().unwrap_or(id));
        let prefix = format!("{}/", crate::ingest::CUSTOMERS);
        for path in vault.notes()? {
            let direct = path.strip_prefix(&prefix).is_some_and(|rest| !rest.contains('/'));
            if direct && !first.is_empty() && bare(stem(&path)) == first {
                return Ok(stem(&path).to_string());
            }
        }
        // Not known yet: make them, as a fact about them would, so the link leads somewhere.
        let made = crate::ingest::apply(vault, &json!({ "customer": id }), 0)?;
        return Ok(made.first().map(|p| stem(p).to_string()).unwrap_or_else(|| id.to_string()));
    }
    if let Some(path) = find(vault, kind, id)? {
        return Ok(stem(&path).to_string());
    }
    let name = file_name(id)?;
    vault.create(&format!("{}/{name}.md", folder(kind)), &compose(&[("type", json!(kind)), ("id", json!(id))], ""))?;
    ensure_list(vault, kind)?;
    Ok(name)
}

/// Write one thing into the vault. Gives back the notes it created or changed.
pub fn apply(vault: &Vault, fact: &Value, now: i64) -> Result<Vec<String>> {
    let kind = detail_key(text_of(fact, "kind").ok_or_else(|| bad("a thing says what kind it is"))?)?;
    let id = text_of(fact, "id").ok_or_else(|| bad("a thing has an id: {\"kind\": \"order\", \"id\": \"A-1042\", ...}"))?;
    if id.chars().count() > 120 {
        return Err(bad("the id is too long"));
    }
    let source = text_of(fact, "source").unwrap_or("admin");

    // Read the whole fact before writing any of it, so a bad one changes nothing.
    let (mut details, mut raw) = (Vec::new(), Vec::new());
    if let Some(set) = fact.get("set") {
        flatten("", set, 1, &mut details, &mut raw)?;
    }
    details.retain(|(key, _)| key != "id");
    let event = fact.get("event").map(read_event).transpose()?;
    let mut links: Vec<(String, Vec<String>)> = Vec::new();
    if let Some(wanted) = fact.get("links") {
        for (to, ids) in wanted.as_object().ok_or_else(|| bad("links says what this belongs to: {\"customer\": \"acme.com\"}"))? {
            let to = detail_key(to)?;
            let ids: Vec<String> = match ids {
                Value::String(one) => vec![one.trim().to_string()],
                Value::Array(many) => many.iter().filter_map(|v| v.as_str().map(|s| s.trim().to_string())).take(MAX_LIST).collect(),
                _ => return Err(bad("a link is an id, or a list of ids")),
            };
            links.push((to, ids.into_iter().filter(|i| !i.is_empty() && i.chars().count() <= 120).collect()));
        }
    }

    let mut changed = Vec::new();
    let (path, created) = match find(vault, &kind, id)? {
        Some(path) => (path, false),
        None => {
            let name = file_name(text_of(fact, "name").unwrap_or(id))?;
            let path = format!("{}/{name}.md", folder(&kind));
            vault.create(&path, &compose(&[("type", json!(kind)), ("id", json!(id))], ""))?;
            (path, true)
        }
    };
    if let Some(list) = ensure_list(vault, &kind)? {
        changed.push(list);
    }
    let name = stem(&path).to_string();

    let mut props: Vec<(String, Value)> = details.clone();
    for (to, ids) in &links {
        let names: Vec<Value> = ids.iter().map(|i| target(vault, to, i).map(|n| json!(format!("[[{n}]]")))).collect::<Result<_>>()?;
        match names.len() {
            0 => {}
            1 => props.push((to.clone(), names[0].clone())),
            _ => props.push((to.clone(), Value::Array(names))),
        }
    }
    let before = frontmatter::read(&vault.read(&path)?.text);
    let borrowed: Vec<(&str, Value)> = props.iter().map(|(k, v)| (k.as_str(), v.clone())).collect();
    let mut wrote = update(vault, &path, &borrowed)? || created;

    // Lists of records do not fit in a property: the latest of each is kept in the note's text.
    if !raw.is_empty() {
        let note = vault.read(&path)?;
        let start = frontmatter::body_start(&note.text);
        let mut body = note.text[start..].to_string();
        for (key, value) in &raw {
            let heading = format!("## {}", label(key));
            let shown: String = serde_json::to_string_pretty(value).unwrap_or_default().chars().take(MAX_RAW).collect();
            let block = format!("{heading}\n\n```json\n{shown}\n```\n");
            body = match body.find(&heading) {
                Some(at) => {
                    let end = body[at + heading.len()..].find("\n## ").map(|i| at + heading.len() + i + 1).unwrap_or(body.len());
                    format!("{}{block}{}", &body[..at], &body[end..])
                }
                None => format!("{}\n\n{block}", body.trim_end()),
            };
        }
        let text = format!("{}{}\n", &note.text[..start], body.trim_start_matches('\n').trim_end());
        if text != note.text {
            vault.write(&path, &text, crate::vault::Eol::Lf, Some(&note.hash))?;
            wrote = true;
        }
    }
    if wrote {
        changed.insert(0, path.clone());
    }

    // A detail that changed leaves a note saying so, as it does for a customer.
    let history = format!("{}/{name}", folder(&kind));
    for (detail, value) in &details {
        let was = before.get(detail).unwrap_or(&Value::Null);
        if created || was.is_null() || was == value || value.is_array() {
            continue;
        }
        let props = [
            ("kind", json!("event")),
            ("source", json!(source)),
            ("field", json!(detail)),
            ("title", json!(format!("{} changed from {} to {}", label(detail), plain(was), plain(value)))),
            ("at", json!(iso(now))),
        ];
        let note = format!("{history}/{source}-{detail}-{now}.md");
        if vault.create(&note, &compose(&props, "")).is_ok() {
            changed.push(note);
        }
    }
    if let Some(event) = event {
        write_event(vault, &history, source, &event, now, &mut changed)?;
    }
    Ok(changed)
}

fn log_dir(vault: &Vault) -> PathBuf {
    vault.root().join(META_DIR).join("logs")
}

fn stream_name(raw: &str) -> String {
    let name: String = raw.trim().to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).take(40).collect();
    let name = name.trim_matches('-').to_string();
    if name.is_empty() { "app".into() } else { name }
}

/// Keep one log line. `{"log": {"message": "...", "level": "error", "stream": "api", ...}}`,
/// with `customer` beside it when the line is about one.
pub fn log(vault: &Vault, fact: &Value, now: i64) -> Result<()> {
    let entry = fact.get("log").and_then(Value::as_object).ok_or_else(|| bad("log is a line with a message"))?;
    let message = entry.get("message").map(plain).filter(|m| !m.trim().is_empty()).ok_or_else(|| bad("a log line has a message"))?;
    let stream = stream_name(entry.get("stream").and_then(Value::as_str).unwrap_or("app"));
    let at = entry.get("at").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| iso(now));
    let mut line = Map::new();
    line.insert("at".into(), json!(at));
    line.insert("level".into(), json!(entry.get("level").and_then(Value::as_str).unwrap_or("info").to_lowercase()));
    line.insert("message".into(), json!(message.chars().take(2000).collect::<String>()));
    for key in ["customer", "kind", "id"] {
        if let Some(value) = text_of(fact, key) {
            line.insert(key.into(), json!(value));
        }
    }
    for (key, value) in entry {
        if !["message", "level", "at", "stream"].contains(&key.as_str()) {
            line.insert(key.clone(), value.clone());
        }
    }
    let mut text = Value::Object(line).to_string();
    if text.len() > LOG_LINE {
        text = json!({ "at": at, "level": "info", "message": message.chars().take(1500).collect::<String>(), "cut": true }).to_string();
    }

    let dir = log_dir(vault).join(&stream);
    let today = &iso(now)[..10];
    let file = dir.join(format!("{today}.jsonl"));
    if !file.exists() {
        fs::create_dir_all(&dir)?;
        // A new day: let go of days past keeping.
        let oldest = iso(now - LOG_DAYS * 86_400)[..10].to_string();
        for old in fs::read_dir(&dir).into_iter().flatten().flatten() {
            let name = old.file_name().to_string_lossy().to_string();
            if name.ends_with(".jsonl") && name[..name.len().min(10)] < *oldest {
                let _ = fs::remove_file(old.path());
            }
        }
    }
    if fs::metadata(&file).map(|m| m.len()).unwrap_or(0) > LOG_DAY_BYTES {
        return Err(bad("this stream has sent more than a day's worth of logs today; the rest are not kept"));
    }
    let mut out = fs::OpenOptions::new().create(true).append(true).open(&file)?;
    writeln!(out, "{text}")?;
    Ok(())
}

/// Which log lines are wanted. Every part is optional: empty text and zero mean "any".
#[derive(Clone, Copy, Default)]
pub struct Wanted<'a> {
    pub query: &'a str,
    pub level: &'a str,
    pub stream: &'a str,
    /// A customer's domain or a thing's id the line must mention.
    pub about: &'a str,
    pub hours: i64,
    pub limit: usize,
}

/// Find log lines: newest first. Every filter is optional. Gives back the lines, how many
/// matched in all, and how many of each level, so "is this new?" can be answered at a glance.
pub fn search(vault: &Vault, want: &Wanted, now: i64) -> Result<Value> {
    let Wanted { query, level, stream, about, hours, limit } = *want;
    let since = iso(now - hours.clamp(1, LOG_DAYS * 24) * 3600);
    let wanted: Vec<String> = query.to_lowercase().split_whitespace().map(str::to_string).collect();
    let (level, about) = (level.to_lowercase(), about.to_lowercase());
    let mut streams: Vec<String> = Vec::new();
    let mut found: Vec<Value> = Vec::new();
    let mut levels: std::collections::BTreeMap<String, usize> = Default::default();
    for dir in fs::read_dir(log_dir(vault)).into_iter().flatten().flatten() {
        let name = dir.file_name().to_string_lossy().to_string();
        streams.push(name.clone());
        if !stream.is_empty() && stream_name(stream) != name {
            continue;
        }
        let mut days: Vec<PathBuf> = fs::read_dir(dir.path()).into_iter().flatten().flatten().map(|f| f.path()).collect();
        days.sort();
        for day in days.iter().rev() {
            let day_name = day.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            if day_name.as_str() < &since[..10] {
                break;
            }
            for line in fs::read_to_string(day).unwrap_or_default().lines().rev() {
                let lower = line.to_lowercase();
                if !wanted.iter().all(|w| lower.contains(w)) || (!about.is_empty() && !lower.contains(&about)) {
                    continue;
                }
                let Ok(mut entry) = serde_json::from_str::<Value>(line) else { continue };
                if entry["at"].as_str().is_some_and(|at| at < since.as_str()) {
                    continue;
                }
                let its = entry["level"].as_str().unwrap_or("info").to_string();
                if !level.is_empty() && its != level {
                    continue;
                }
                *levels.entry(its).or_default() += 1;
                if found.len() < limit {
                    entry["stream"] = json!(name);
                    found.push(entry);
                }
            }
        }
    }
    found.sort_by(|a, b| b["at"].as_str().cmp(&a["at"].as_str()));
    Ok(json!({ "matched": levels.values().sum::<usize>(), "by_level": levels, "streams": streams, "lines": found }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_thing_of_any_shape_becomes_a_note_with_links_and_history() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        crate::ingest::apply(&vault, &json!({ "customer": "acme.com", "name": "Acme" }), 50).unwrap();

        let fact = json!({
            "kind": "Building", "id": "bld-204", "name": "North Tower",
            "set": {
                "floors": 12, "status": "active",
                "address": { "city": "Pune", "geo": { "lat": 18.52, "lng": 73.85 } },
                "tags": ["lab", "leed-gold"],
                "sensors": [{ "id": "s-1", "type": "co2" }, { "id": "s-2", "type": "temp" }]
            },
            "links": { "customer": "acme.com", "site": "site-9" }
        });
        let changed = apply(&vault, &fact, 100).unwrap();
        assert_eq!(changed[0], "data/building/North Tower.md");
        let text = vault.read("data/building/North Tower.md").unwrap().text;
        let props = frontmatter::read(&text);
        assert_eq!((props["type"].as_str(), props["id"].as_str()), (Some("building"), Some("bld-204")));
        assert_eq!((props["floors"].as_i64(), props["address_city"].as_str(), props["address_geo_lat"].as_f64()), (Some(12), Some("Pune"), Some(18.52)));
        assert_eq!(props["tags"], json!(["lab", "leed-gold"]));
        assert_eq!((props["sensors_count"].as_i64(), props["customer"].as_str(), props["site"].as_str()), (Some(2), Some("[[Acme]]"), Some("[[site-9]]")));
        // A customer filed by name only is still found from its domain; an unknown one is made.
        crate::ingest::apply(&vault, &json!({ "customer": "Birch Labs" }), 60).unwrap();
        apply(&vault, &json!({ "kind": "order", "id": "o-1", "links": { "customer": "birchlabs.io" } }), 70).unwrap();
        apply(&vault, &json!({ "kind": "order", "id": "o-2", "links": { "customer": "newco.dev" } }), 70).unwrap();
        let linked = |id: &str| frontmatter::read(&vault.read(&format!("data/order/{id}.md")).unwrap().text)["customer"].as_str().unwrap().to_string();
        assert_eq!((linked("o-1").as_str(), linked("o-2").as_str()), ("[[Birch Labs]]", "[[newco.dev]]"));
        assert!(dir.path().join("customers/newco.dev.md").exists());
        assert!(text.contains("## Sensors") && text.contains("\"co2\""));
        // The kind has a list, and what it pointed at exists.
        assert!(dir.path().join("data/Building list.md").exists());
        assert!(dir.path().join("data/site/site-9.md").exists());

        // Sent again with a change: one note, and the change is remembered.
        let again = apply(&vault, &json!({ "kind": "building", "id": "bld-204", "set": { "status": "offline", "floors": 12 } }), 200).unwrap();
        assert!(again.iter().any(|p| p == "data/building/North Tower/admin-status-200.md"));
        assert_eq!(fs::read_dir(dir.path().join("data/building")).unwrap().filter(|e| e.as_ref().unwrap().path().extension().is_some()).count(), 1);
        assert!(apply(&vault, &json!({ "kind": "building", "id": "bld-204", "set": { "status": "offline" } }), 300).unwrap().is_empty());
        assert!(apply(&vault, &json!({ "kind": "../x", "id": "1" }), 1).is_err());
        assert!(apply(&vault, &json!({ "kind": "order" }), 1).is_err());
    }

    #[test]
    fn log_lines_are_kept_by_day_and_found_again() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        let day = 1_794_600_000;
        log(&vault, &json!({ "log": { "message": "export job started", "stream": "API" } }), day).unwrap();
        log(&vault, &json!({ "customer": "acme.com", "log": { "message": "export failed: timeout after 30s", "level": "ERROR", "stream": "api", "job": 77 } }), day + 60).unwrap();
        log(&vault, &json!({ "log": { "message": "worker heartbeat", "stream": "worker" } }), day + 90).unwrap();
        assert!(log(&vault, &json!({ "log": { "level": "info" } }), day).is_err());
        assert!(dir.path().join(format!(".lokus/logs/api/{}.jsonl", &iso(day)[..10])).exists());

        let found = search(&vault, &Wanted { query: "export", hours: 24, limit: 10, ..Default::default() }, day + 120).unwrap();
        assert_eq!((found["matched"].as_u64(), found["by_level"]["error"].as_u64()), (Some(2), Some(1)));
        assert_eq!(found["lines"][0]["message"], "export failed: timeout after 30s");
        assert_eq!((found["lines"][0]["job"].as_i64(), found["lines"][0]["customer"].as_str()), (Some(77), Some("acme.com")));
        let errors = search(&vault, &Wanted { level: "error", stream: "api", about: "acme", hours: 24, limit: 10, ..Default::default() }, day + 120).unwrap();
        assert_eq!(errors["matched"], 1);
        assert_eq!(search(&vault, &Wanted { stream: "worker", hours: 24, limit: 10, ..Default::default() }, day + 120).unwrap()["matched"], 1);
        // Two weeks on, a new day's first line lets the old day go.
        log(&vault, &json!({ "log": { "message": "later", "stream": "api" } }), day + 16 * 86_400).unwrap();
        assert_eq!(fs::read_dir(dir.path().join(".lokus/logs/api")).unwrap().count(), 1);
    }
}

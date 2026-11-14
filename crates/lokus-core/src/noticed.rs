//! @part-of core
//! What the assistant noticed on its own, waiting for the person to look at.
//!
//! Two kinds of thing land here. A **finding** is something worth knowing with a recommended
//! next step ("Quivly has waited two days; the fix already shipped, so tell them"). A
//! **suggestion** is a piece of text proposed for a note, shown on that note until it is added
//! or dismissed. Both are files in `.lokus/noticed/`, which is never synced: they are proposals
//! to one person, not facts about the workspace, until that person acts on them.
//!
//! When the person acts, what they chose can be written into `Assistant.md` as a line under
//! "How we handle things", so the next time the same kind of thing comes up the assistant
//! recommends what they chose before.

use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};

use crate::error::{CoreError, Result};
use crate::vault::{write_atomic, Vault, META_DIR};

/// How many are kept; the oldest handled ones go first.
const KEEP: usize = 300;
const MAX_BYTES: usize = 64 * 1024;
pub const MEMORY: &str = "Assistant.md";
pub const HANDLED: &str = "## How we handle things";

fn dir(vault: &Vault) -> PathBuf {
    vault.root().join(META_DIR).join("noticed")
}

fn bad(message: &str) -> CoreError {
    CoreError::BadArgs {
        command: "noticed".into(),
        message: message.into(),
    }
}

/// A key becomes a file name: lowercase letters, digits and dashes, nothing else.
pub fn id_of(key: &str) -> String {
    let mut id = String::new();
    for c in key.trim().to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            id.push(c);
        } else if !id.ends_with('-') {
            id.push('-');
        }
    }
    id.trim_matches('-').chars().take(80).collect()
}

fn file(vault: &Vault, id: &str) -> Result<PathBuf> {
    let ok = !id.is_empty()
        && id.len() <= 80
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if ok {
        Ok(dir(vault).join(format!("{id}.json")))
    } else {
        Err(bad("an id is lowercase letters, digits and dashes"))
    }
}

fn read(path: &std::path::Path) -> Option<Value> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

/// Everything noticed, newest first.
pub fn list(vault: &Vault) -> Result<Vec<Value>> {
    let Ok(entries) = fs::read_dir(dir(vault)) else {
        return Ok(Vec::new());
    };
    let mut found: Vec<Value> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
        .filter_map(|e| read(&e.path()))
        .collect();
    found.sort_by_key(|item| std::cmp::Reverse(item["created"].as_i64().unwrap_or(0)));
    Ok(found)
}

/// Keep something noticed. `key` names the situation, so noticing it again updates the one
/// already there instead of adding another. Something the person has already dealt with is
/// left alone: the answer says so, and nothing is written.
pub fn report(vault: &Vault, key: &str, mut item: Value, now: i64) -> Result<String> {
    let id = id_of(key);
    let path = file(vault, &id)?;
    if let Some(existing) = read(&path) {
        match existing["state"].as_str() {
            Some("new") | None => item["created"] = existing["created"].clone(),
            Some(state) => return Ok(format!("already {state} by the user; not shown again")),
        }
    } else {
        item["created"] = json!(now);
    }
    item["id"] = json!(id);
    item["state"] = json!("new");
    let text = item.to_string();
    if text.len() > MAX_BYTES {
        return Err(bad("that is too long to keep; say it in fewer words"));
    }
    fs::create_dir_all(dir(vault))?;
    write_atomic(&path, text.as_bytes())?;
    let all = list(vault)?;
    for old in all.iter().filter(|i| i["state"] != "new").skip(KEEP) {
        if let Some(id) = old["id"].as_str() {
            let _ = fs::remove_file(dir(vault).join(format!("{id}.json")));
        }
    }
    Ok("noted".into())
}

/// The person dealt with something: `state` is "done" or "dismissed". With `learn`, what they
/// chose is written down so it is recommended next time. Says what was learned, if anything.
pub fn resolve(
    vault: &Vault,
    id: &str,
    state: &str,
    learn: bool,
    today: &str,
) -> Result<Option<String>> {
    if state != "done" && state != "dismissed" {
        return Err(bad("state is done or dismissed"));
    }
    let path = file(vault, id)?;
    let mut item = read(&path).ok_or_else(|| CoreError::NotFound(format!("noticed {id}")))?;
    item["state"] = json!(state);
    write_atomic(&path, item.to_string().as_bytes())?;

    let situation = item["situation"].as_str().unwrap_or_default().trim();
    if !learn || situation.is_empty() {
        return Ok(None);
    }
    let chose = if state == "done" {
        item["recommend"]
            .as_str()
            .unwrap_or_default()
            .trim()
            .to_string()
    } else {
        "leave it, do not bring it up".to_string()
    };
    if chose.is_empty() {
        return Ok(None);
    }
    let one_line = |s: &str| {
        s.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(240)
            .collect::<String>()
    };
    // "When a customer…", whatever case the situation was written in.
    let lower = |s: String| {
        s.chars()
            .next()
            .map(|c| c.to_lowercase().collect::<String>() + &s[c.len_utf8()..])
            .unwrap_or(s)
    };
    let line = format!(
        "- When {}: {} ({today})",
        lower(one_line(situation)).trim_end_matches('.'),
        lower(one_line(&chose)).trim_end_matches('.')
    );
    let memory = vault.root().join(MEMORY);
    let body = fs::read_to_string(&memory).unwrap_or_else(|_| "# Assistant\n\nWhat the assistant should know and how it should work here. Edit this freely.\n".into());
    if body.contains(line.trim_end_matches(&format!(" ({today})"))) {
        return Ok(None);
    }
    let text = match body.find(HANDLED) {
        // Under the heading, after whatever is already listed there.
        Some(at) => {
            let rest = &body[at + HANDLED.len()..];
            let end = rest
                .find("\n## ")
                .map(|i| at + HANDLED.len() + i)
                .unwrap_or(body.len());
            format!("{}\n{line}\n{}", body[..end].trim_end(), &body[end..])
        }
        None => {
            let section = format!("{HANDLED}\n\nWhat was decided when these came up before. Do the same next time, and say you are.\n\n{line}\n");
            // "Remembered" stays the last section, since new memories are added at the end of the note.
            match body.find("\n## Remembered") {
                Some(at) => format!("{}\n\n{section}{}", body[..at].trim_end(), &body[at..]),
                None => format!("{}\n\n{section}", body.trim_end()),
            }
        }
    };
    write_atomic(&memory, text.as_bytes())?;
    Ok(Some(line))
}

pub fn remove(vault: &Vault, id: &str) -> Result<()> {
    match fs::remove_file(file(vault, id)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn noticing_the_same_thing_twice_keeps_one_and_a_handled_one_stays_handled() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        let finding = |title: &str| json!({ "kind": "finding", "title": title, "situation": "a customer waits two days with no reply", "recommend": "reply the same day" });

        assert_eq!(
            report(
                &vault,
                "Waiting: Acme / thread 12",
                finding("Acme is waiting"),
                100
            )
            .unwrap(),
            "noted"
        );
        assert_eq!(
            report(
                &vault,
                "waiting acme thread 12",
                finding("Acme is still waiting"),
                200
            )
            .unwrap(),
            "noted"
        );
        let all = list(&vault).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(
            (all[0]["title"].as_str(), all[0]["created"].as_i64()),
            (Some("Acme is still waiting"), Some(100))
        );
        assert!(dir
            .path()
            .join(".lokus/noticed/waiting-acme-thread-12.json")
            .exists());

        // Doing it teaches the assistant what was chosen; noticing it again does not bring it back.
        let learned = resolve(&vault, "waiting-acme-thread-12", "done", true, "2026-11-14")
            .unwrap()
            .unwrap();
        assert_eq!(
            learned,
            "- When a customer waits two days with no reply: reply the same day (2026-11-14)"
        );
        let memory = std::fs::read_to_string(dir.path().join("Assistant.md")).unwrap();
        assert!(memory.contains("## How we handle things") && memory.contains(&learned));
        assert!(
            report(&vault, "waiting acme thread 12", finding("again"), 300)
                .unwrap()
                .starts_with("already done")
        );
        assert_eq!(list(&vault).unwrap()[0]["state"], "done");

        // The same lesson is not written twice, and a second one goes under the same heading.
        report(&vault, "other", json!({ "kind": "finding", "situation": "a note says something a service contradicts", "recommend": "x" }), 400).unwrap();
        resolve(&vault, "other", "dismissed", true, "2026-11-15").unwrap();
        let memory = std::fs::read_to_string(dir.path().join("Assistant.md")).unwrap();
        assert_eq!(memory.matches("## How we handle things").count(), 1);
        assert!(memory.contains("contradicts: leave it, do not bring it up (2026-11-15)"));
        assert!(resolve(&vault, "../x", "done", false, "d").is_err());
    }
}

//! @part-of core
//! Tasks: the team's work, one note each.
//!
//! A task is a note marked `type: task` in the tasks folder. Its file name is its title; its
//! properties say where it stands (`status`), how much it matters (`priority`), whose it is
//! (`assignee`), which customer it is for (`customer`), when it is due and how it is labelled.
//! Each gets a short number (`T-12`) so people and the assistant can name it. Recording the same
//! task again updates it, so a sender (a person, the assistant, a team's own systems) may repeat.

use serde_json::{json, Value};

use crate::error::{CoreError, Result};
use crate::frontmatter;
use crate::vault::{Eol, Vault};

pub const TASKS: &str = "tasks";

/// Where a task can stand, in the order a board shows them. A team may use other words; these
/// are what a new task starts from and what "done" means.
pub const STATUSES: [&str; 5] = ["backlog", "todo", "doing", "review", "done"];
pub const PRIORITIES: [&str; 4] = ["urgent", "high", "medium", "low"];

fn bad(message: impl Into<String>) -> CoreError {
    CoreError::BadArgs {
        command: "tasks.record".into(),
        message: message.into(),
    }
}

fn line(value: &Value, key: &str, most: usize) -> Result<Option<String>> {
    match value.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => {
            let text = s.split_whitespace().collect::<Vec<_>>().join(" ");
            if text.chars().count() > most {
                return Err(bad(format!("{key} is too long")));
            }
            Ok(Some(text).filter(|t| !t.is_empty()))
        }
        Some(_) => Err(bad(format!("{key} must be text"))),
    }
}

/// A title as a file name: no path separators, no control characters, not hidden, no dot at the end.
fn file_name(title: &str) -> Result<String> {
    let cleaned: String = title
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '#' | '^' | '[' | ']' => '-',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    let mut cleaned = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    while cleaned.contains("..") {
        cleaned = cleaned.replace("..", ".");
    }
    let cleaned = cleaned
        .trim_start_matches(['.', '-'])
        .trim_end_matches('.')
        .trim()
        .to_string();
    if cleaned.is_empty() || cleaned.chars().count() > 120 {
        return Err(bad("a task needs a title of 1 to 120 characters"));
    }
    Ok(cleaned)
}

struct Found {
    path: String,
    number: i64,
    title: String,
}

fn stem(path: &str) -> &str {
    let name = path.rsplit('/').next().unwrap_or(path);
    name.strip_suffix(".md").unwrap_or(name)
}

/// Every task note directly in the tasks folder.
fn all(vault: &Vault) -> Result<Vec<Found>> {
    let prefix = format!("{TASKS}/");
    let mut found = Vec::new();
    for path in vault.notes()? {
        let Some(rest) = path.strip_prefix(&prefix) else {
            continue;
        };
        if rest.contains('/') {
            continue;
        }
        let props = frontmatter::read(&vault.read(&path)?.text);
        if props.get("type").and_then(Value::as_str) != Some("task") {
            continue;
        }
        found.push(Found {
            number: props.get("number").and_then(Value::as_i64).unwrap_or(0),
            title: stem(&path).to_string(),
            path,
        });
    }
    Ok(found)
}

/// `T-12`, `t12` or `12` as the number 12.
fn number_of(key: &str) -> Option<i64> {
    let digits: String = key.chars().filter(char::is_ascii_digit).collect();
    let rest: String = key.chars().filter(|c| !c.is_ascii_digit()).collect();
    if digits.is_empty() || !matches!(rest.to_lowercase().as_str(), "" | "t" | "t-" | "#") {
        return None;
    }
    digits.parse().ok()
}

/// Add or update one task. Gives back its path and its number.
///
/// `task` may carry: `key` (an existing task's number, to update exactly that one), `title`,
/// `status`, `priority`, `assignee`, `customer`, `due` (YYYY-MM-DD), `labels` (a list of words),
/// `link` and `text` (what the task is about, used when the note is first made). Without `key`,
/// a task with the same title is updated rather than made twice.
pub fn record(vault: &Vault, task: &Value) -> Result<(String, i64)> {
    if !task.is_object() {
        return Err(bad("a task is a list of details"));
    }
    let title = line(task, "title", 200)?;
    let status = line(task, "status", 30)?.map(|s| s.to_lowercase());
    let priority = line(task, "priority", 20)?.map(|s| s.to_lowercase());
    if let Some(p) = &priority {
        if !PRIORITIES.contains(&p.as_str()) {
            return Err(bad("priority is urgent, high, medium or low"));
        }
    }
    let due = line(task, "due", 10)?;
    if let Some(d) = &due {
        let ok = d.len() == 10
            && d.chars().enumerate().all(|(i, c)| {
                if i == 4 || i == 7 {
                    c == '-'
                } else {
                    c.is_ascii_digit()
                }
            });
        if !ok {
            return Err(bad("due is a date like 2026-12-01"));
        }
    }
    let labels: Option<Vec<String>> = match task.get("labels") {
        None | Some(Value::Null) => None,
        Some(Value::Array(items)) if items.len() <= 12 => Some(
            items
                .iter()
                .filter_map(Value::as_str)
                .map(|l| l.trim().to_lowercase())
                .filter(|l| {
                    !l.is_empty()
                        && l.chars().count() <= 30
                        && l.chars()
                            .all(|c| c.is_alphanumeric() || c == '-' || c == ' ')
                })
                .collect(),
        ),
        Some(_) => return Err(bad("labels is a short list of words")),
    };
    let link =
        line(task, "link", 500)?.filter(|l| l.starts_with("https://") || l.starts_with("http://"));
    let text = task
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if text.len() > 32 * 1024 {
        return Err(bad("the text is too long"));
    }

    let existing = all(vault)?;
    let wanted = match line(task, "key", 20)? {
        Some(key) => {
            let number = number_of(&key).ok_or_else(|| bad("key is a task's number, like T-12"))?;
            Some(
                existing
                    .iter()
                    .find(|t| t.number == number)
                    .ok_or_else(|| CoreError::NotFound(format!("task T-{number}")))?,
            )
        }
        None => title.as_ref().and_then(|title| {
            let name = file_name(title).ok()?;
            existing
                .iter()
                .find(|t| t.title.eq_ignore_ascii_case(&name))
        }),
    };

    let mut props: Vec<(&str, Value)> = Vec::new();
    let mut set = |key: &'static str, value: Option<String>| {
        if let Some(value) = value {
            props.push((key, json!(value)));
        }
    };
    set("status", status.clone());
    set("priority", priority);
    set("assignee", line(task, "assignee", 80)?);
    set("customer", line(task, "customer", 120)?);
    set("due", due);
    set("link", link);
    if let Some(labels) = labels {
        props.push(("labels", json!(labels)));
    }

    match wanted {
        Some(found) => {
            let note = vault.read(&found.path)?;
            let had = frontmatter::read(&note.text);
            let mut changed = note.text.clone();
            for (key, value) in &props {
                if had.get(*key).unwrap_or(&Value::Null) != value {
                    changed = frontmatter::set(&changed, key, value);
                }
            }
            if changed != note.text {
                vault.write(&found.path, &changed, Eol::Lf, Some(&note.hash))?;
            }
            Ok((found.path.clone(), found.number))
        }
        None => {
            let title = title.ok_or_else(|| bad("a new task needs a title"))?;
            let name = file_name(&title)?;
            let number = existing.iter().map(|t| t.number).max().unwrap_or(0) + 1;
            let path = format!("{TASKS}/{name}.md");
            let mut head = String::new();
            head = frontmatter::set(&head, "type", &json!("task"));
            head = frontmatter::set(&head, "number", &json!(number));
            if status.is_none() {
                head = frontmatter::set(&head, "status", &json!("todo"));
            }
            for (key, value) in &props {
                head = frontmatter::set(&head, key, value);
            }
            let body = if text.is_empty() {
                String::new()
            } else {
                format!("\n{text}\n")
            };
            vault.create(&path, &format!("{}\n{body}", head.trim_end()))?;
            Ok((path, number))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vault() -> (tempfile::TempDir, Vault) {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        (dir, vault)
    }

    fn props(vault: &Vault, path: &str) -> serde_json::Map<String, Value> {
        frontmatter::read(&vault.read(path).unwrap().text)
    }

    #[test]
    fn a_task_gets_a_number_and_is_updated_not_made_twice() {
        let (_dir, v) = vault();
        let first = record(&v, &json!({ "title": "Fix CSV export over 50k rows", "priority": "high", "customer": "Northwind", "labels": ["Bug", "churn risk"], "text": "Third report." })).unwrap();
        assert_eq!(
            first,
            ("tasks/Fix CSV export over 50k rows.md".to_string(), 1)
        );
        let made = props(&v, &first.0);
        assert_eq!(
            (
                made["type"].clone(),
                made["number"].clone(),
                made["status"].clone()
            ),
            (json!("task"), json!(1), json!("todo"))
        );
        assert_eq!(made["labels"], json!(["bug", "churn risk"]));
        assert!(v
            .read(&first.0)
            .unwrap()
            .text
            .ends_with("\nThird report.\n"));

        let second = record(&v, &json!({ "title": "Audit log" })).unwrap();
        assert_eq!(second.1, 2);

        // The same title again, or its number, moves the task on instead of making another.
        assert_eq!(
            record(
                &v,
                &json!({ "title": "fix csv export over 50k rows", "status": "Doing" })
            )
            .unwrap()
            .1,
            1
        );
        assert_eq!(
            record(
                &v,
                &json!({ "key": "T-1", "assignee": "Pratham", "due": "2026-12-01" })
            )
            .unwrap()
            .1,
            1
        );
        let now = props(&v, &first.0);
        assert_eq!(
            (
                now["status"].clone(),
                now["assignee"].clone(),
                now["due"].clone()
            ),
            (json!("doing"), json!("Pratham"), json!("2026-12-01"))
        );
        assert_eq!(
            now["priority"],
            json!("high"),
            "what was not sent is left as it was"
        );
        assert_eq!(all(&v).unwrap().len(), 2);
    }

    #[test]
    fn a_task_cannot_be_put_anywhere_else_or_given_nonsense() {
        let (_dir, v) = vault();
        let (path, _) = record(&v, &json!({ "title": "../../outside" })).unwrap();
        assert!(path.starts_with("tasks/") && !path.contains(".."), "{path}");
        for bad in [
            json!({ "title": "x", "priority": "whenever" }),
            json!({ "title": "x", "due": "tomorrow" }),
            json!({ "key": "T-99", "status": "done" }),
            json!({ "status": "done" }),
            json!("just text"),
        ] {
            assert!(record(&v, &bad).is_err(), "{bad}");
        }
    }
}

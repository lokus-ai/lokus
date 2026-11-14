//! @part-of core
//! Conversations with the assistant, kept on this device.
//!
//! Each one is a JSON file in `.lokus/chats/`. That folder is never synced, so a conversation
//! stays with the person who had it: what they asked, and whatever came back from the services
//! only they are signed in to, is not handed to the rest of the workspace. Sharing one is a
//! deliberate act (saving it as a note), not the default.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use serde_json::{json, Value};

use crate::error::{CoreError, Result};
use crate::vault::{write_atomic, Vault, META_DIR};

/// The most one conversation may weigh on disk. Long tool results are already cut short before
/// they get here; this stops a runaway one from filling the disk.
const MAX_BYTES: usize = 8 * 1024 * 1024;
/// How many conversations are kept. The oldest go when a new one would pass this.
const KEEP: usize = 200;

#[derive(Debug, Serialize)]
pub struct Summary {
    pub id: String,
    pub title: String,
    /// When it was last added to, in milliseconds since 1970.
    pub updated: i64,
}

fn dir(vault: &Vault) -> PathBuf {
    vault.root().join(META_DIR).join("chats")
}

fn bad(message: &str) -> CoreError {
    CoreError::BadArgs {
        command: "chats".into(),
        message: message.into(),
    }
}

/// An id is only ever a file name.
fn file(vault: &Vault, id: &str) -> Result<PathBuf> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if ok {
        Ok(dir(vault).join(format!("{id}.json")))
    } else {
        Err(bad("a conversation's id is letters, digits and dashes"))
    }
}

fn read(path: &std::path::Path) -> Option<Value> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

/// Every kept conversation, the most recent first.
pub fn list(vault: &Vault) -> Result<Vec<Summary>> {
    let Ok(entries) = fs::read_dir(dir(vault)) else {
        return Ok(Vec::new());
    };
    let mut found: Vec<Summary> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
        .filter_map(|e| {
            let chat = read(&e.path())?;
            Some(Summary {
                id: chat["id"].as_str()?.to_string(),
                title: chat["title"].as_str().unwrap_or("").to_string(),
                updated: chat["updated"].as_i64().unwrap_or(0),
            })
        })
        .collect();
    found.sort_by_key(|chat| std::cmp::Reverse(chat.updated));
    Ok(found)
}

/// Keep a conversation as it now stands. `body` is whatever the app needs to show and continue it.
pub fn save(vault: &Vault, id: &str, title: &str, updated: i64, body: &Value) -> Result<()> {
    let path = file(vault, id)?;
    let title: String = title
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(120)
        .collect();
    let text = json!({ "id": id, "title": title, "updated": updated, "body": body }).to_string();
    if text.len() > MAX_BYTES {
        return Err(bad("this conversation is too long to keep"));
    }
    fs::create_dir_all(dir(vault))?;
    write_atomic(&path, text.as_bytes())?;
    for old in list(vault)?.into_iter().skip(KEEP) {
        let _ = delete(vault, &old.id);
    }
    Ok(())
}

pub fn load(vault: &Vault, id: &str) -> Result<Value> {
    read(&file(vault, id)?).ok_or_else(|| CoreError::NotFound(format!("conversation {id}")))
}

pub fn delete(vault: &Vault, id: &str) -> Result<()> {
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
    fn a_conversation_is_kept_listed_newest_first_and_can_be_removed() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        assert!(list(&vault).unwrap().is_empty());
        save(
            &vault,
            "chat-1",
            "First   question\nwith a break",
            100,
            &json!({ "items": [1] }),
        )
        .unwrap();
        save(&vault, "chat-2", "Second", 200, &json!({ "items": [2] })).unwrap();
        save(
            &vault,
            "chat-1",
            "First question",
            300,
            &json!({ "items": [1, 3] }),
        )
        .unwrap();

        let all = list(&vault).unwrap();
        assert_eq!(
            all.iter().map(|c| c.id.as_str()).collect::<Vec<_>>(),
            ["chat-1", "chat-2"]
        );
        assert_eq!(all[0].title, "First question");
        assert_eq!(
            load(&vault, "chat-1").unwrap()["body"]["items"],
            json!([1, 3])
        );

        // It lives in the folder that is never synced, and an id cannot name anywhere else.
        assert!(dir.path().join(".lokus/chats/chat-2.json").exists());
        assert!(save(&vault, "../escape", "x", 1, &json!({})).is_err());
        assert!(load(&vault, "../../etc/passwd").is_err());

        delete(&vault, "chat-2").unwrap();
        delete(&vault, "chat-2").unwrap();
        assert_eq!(list(&vault).unwrap().len(), 1);
    }
}

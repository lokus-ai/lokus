//! @part-of ai
//! iMessage: the conversations Messages keeps on this Mac, read where they are.
//!
//! Not a tool server: Messages stores every conversation in one SQLite file in the person's
//! Library, and macOS lets an app read it only once the person has given that app Full Disk
//! Access. The file is opened read-only and nothing here can send a message. People are named
//! by the number or address Messages knows them by; names from Contacts are not read.

use std::path::PathBuf;

use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};

use crate::config::McpServer;
use crate::tools::Tool;

/// The connection's name among a workspace's connections; it has no address.
pub const ID: &str = "imessage";
/// Named the way a connected service's tools are, so it is shown and spoken of as one.
pub const TOOL: &str = "mcp__imessage__messages";

/// Whether a saved connection is this one rather than a tool server to reach.
pub fn is(server: &McpServer) -> bool {
    server.name == ID && server.url.is_empty()
}

pub fn tools() -> Vec<Tool> {
    vec![Tool {
        name: TOOL.into(),
        description: "Read the user's recent iMessage and SMS conversations from Messages on this Mac. Read-only: it cannot send, and you must never claim to have sent a message. Returns the newest messages, oldest first, each with its time, conversation, and who wrote it. People appear as phone numbers or email addresses, not contact names.".into(),
        schema: json!({
            "type": "object",
            "properties": {
                "chat": { "type": "string", "description": "Only this conversation: part of a phone number, an email address or a group's name." },
                "search": { "type": "string", "description": "Only messages containing this text." },
                "limit": { "type": "integer", "description": "How many messages, newest first. 30 when left out, 200 at most." }
            }
        }),
        writes: false,
    }]
}

fn file() -> Option<PathBuf> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    Some(PathBuf::from(std::env::var_os("HOME")?).join("Library/Messages/chat.db"))
}

/// Open the Messages file, or say in one sentence why it cannot be read.
fn open() -> Result<Connection, String> {
    let path = file().ok_or("iMessage can only be read on a Mac.")?;
    // macOS answers "not permitted" for the whole Messages folder until access is given.
    match std::fs::File::open(&path) {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err("Messages has no conversations on this Mac yet.".into())
        }
        Err(_) => {
            return Err("Lokus needs Full Disk Access to read Messages: turn it on for Lokus in System Settings, then reopen Lokus.".into())
        }
    }
    let db = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Messages could not be read: {e}"))?;
    let _ = db.busy_timeout(std::time::Duration::from_secs(2));
    Ok(db)
}

/// Whether Messages can be read here; the reason, in one sentence, when it cannot.
pub fn check() -> Result<(), String> {
    let db = open()?;
    db.query_row("SELECT count(*) FROM message", [], |_| Ok(()))
        .map_err(|e| format!("Messages could not be read: {e}"))
}

/// The text of a message whose words Messages kept only in its styled form: the first string
/// of the archive, which is its length (one byte, or a marker and two or four) and the text.
fn styled_text(body: &[u8]) -> Option<String> {
    let at = body.windows(8).position(|w| w == b"NSString")? + 8;
    let rest = &body[at..];
    let rest = &rest[rest.iter().position(|b| *b == b'+')? + 1..];
    let (length, text) = match *rest.first()? {
        0x81 => (
            u16::from_le_bytes(rest.get(1..3)?.try_into().ok()?) as usize,
            rest.get(3..)?,
        ),
        0x82 => (
            u32::from_le_bytes(rest.get(1..5)?.try_into().ok()?) as usize,
            rest.get(5..)?,
        ),
        short => (short as usize, rest.get(1..)?),
    };
    Some(String::from_utf8_lossy(text.get(..length)?).into_owned())
}

const QUERY: &str = "
SELECT datetime(CASE WHEN m.date > 100000000000 THEN m.date / 1000000000 ELSE m.date END + 978307200, 'unixepoch', 'localtime'),
       m.is_from_me, COALESCE(h.id, ''), m.text, m.attributedBody,
       COALESCE(NULLIF(c.display_name, ''), c.chat_identifier, h.id, ''), m.cache_has_attachments
FROM message m
LEFT JOIN handle h ON h.ROWID = m.handle_id
LEFT JOIN chat_message_join j ON j.message_id = m.ROWID
LEFT JOIN chat c ON c.ROWID = j.chat_id
WHERE m.associated_message_type = 0 AND m.item_type = 0
  AND (?1 = '' OR c.display_name LIKE ?1 OR c.chat_identifier LIKE ?1
       OR (c.ROWID IS NULL AND h.id LIKE ?1))
ORDER BY m.date DESC
LIMIT ?2";

/// How many messages are looked through before giving up: rows with nothing to show and rows a
/// search does not match are passed over, so the count asked for cannot be the database's limit.
const SEARCHED: i64 = 20_000;

pub fn call(input: &Value) -> Result<String, String> {
    let db = open()?;
    // A phone number or a year arrives as a number from the command line.
    let word = |key: &str| match &input[key] {
        Value::String(text) => text.trim().to_string(),
        Value::Number(number) => number.to_string(),
        _ => String::new(),
    };
    let (chat, search) = (word("chat"), word("search").to_lowercase());
    let limit = input["limit"].as_u64().unwrap_or(30).clamp(1, 200) as usize;
    let like = if chat.is_empty() {
        String::new()
    } else {
        format!("%{chat}%")
    };
    let failed = |e: rusqlite::Error| format!("Messages could not be read: {e}");
    let mut query = db.prepare(QUERY).map_err(failed)?;
    let mut rows = query.query((&like, SEARCHED)).map_err(failed)?;
    let mut lines = Vec::new();
    while let Some(row) = rows.next().map_err(failed)? {
        let text: Option<String> = row.get(3).map_err(failed)?;
        let styled: Option<Vec<u8>> = row.get(4).map_err(failed)?;
        let mut text = text
            .filter(|t| !t.is_empty())
            .or_else(|| styled.as_deref().and_then(styled_text))
            .unwrap_or_default()
            .replace('\u{fffc}', "")
            .trim()
            .to_string();
        if !search.is_empty() && !text.to_lowercase().contains(&search) {
            continue;
        }
        if row.get::<_, i64>(6).map_err(failed)? != 0 {
            text.push_str(if text.is_empty() {
                "[attachment]"
            } else {
                " [attachment]"
            });
        }
        if text.is_empty() {
            continue;
        }
        let when: Option<String> = row.get(0).map_err(failed)?;
        let from: String = if row.get::<_, i64>(1).map_err(failed)? != 0 {
            "me".into()
        } else {
            row.get(2).map_err(failed)?
        };
        let chat: String = row.get(5).map_err(failed)?;
        lines.push(format!(
            "{} · {chat} · {from}: {text}",
            when.unwrap_or_default()
        ));
        if lines.len() == limit {
            break;
        }
    }
    if lines.is_empty() {
        return Ok("No messages match.".into());
    }
    lines.reverse();
    Ok(lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_message_kept_only_in_styled_form_is_still_read() {
        let archive = |length: &[u8], text: &str| {
            let mut body = b"\x04\x0bstreamtyped\x81\xe8\x03\x84\x01@\x84\x84\x84\x12NSAttributedString\x00\x84\x84\x08NSObject\x00\x85\x92\x84\x84\x84\x08NSString\x01\x94\x84\x01+".to_vec();
            body.extend_from_slice(length);
            body.extend_from_slice(text.as_bytes());
            body.extend_from_slice(b"\x86\x84\x02iI\x01");
            body
        };
        assert_eq!(
            styled_text(&archive(&[11], "Lunch at 1?")).as_deref(),
            Some("Lunch at 1?")
        );
        let long = "é".repeat(100);
        assert_eq!(
            styled_text(&archive(&[0x81, 200, 0], &long)).as_deref(),
            Some(long.as_str())
        );
    }
}

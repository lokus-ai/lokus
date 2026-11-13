//! @part-of ai
//! What the assistant can do in the vault. Each tool is a thin wrapper over
//! a core command, so it obeys the same rules as everything else.

use lokus_core::{commands, Core};
use serde_json::{json, Value};

/// Notes longer than this are not handed to the model in one piece.
const MAX_NOTE: usize = 400_000;

pub struct Tool {
    pub name: String,
    pub description: String,
    pub schema: Value,
    /// Changes something, so the person is asked first.
    pub writes: bool,
}

fn tool(name: &str, description: &str, properties: Value, required: &[&str], writes: bool) -> Tool {
    Tool {
        name: name.into(),
        description: description.into(),
        schema: json!({ "type": "object", "properties": properties, "required": required, "additionalProperties": false }),
        writes,
    }
}

pub fn vault_tools() -> Vec<Tool> {
    let path =
        json!({ "type": "string", "description": "Path inside the vault, e.g. Projects/Plan.md" });
    vec![
        tool(
            "search_notes",
            "Full-text search across every note. Every word must match. Returns paths, titles and matching snippets.",
            json!({ "query": { "type": "string" } }),
            &["query"],
            false,
        ),
        tool("read_note", "Read one note's full Markdown text.", json!({ "path": path }), &["path"], false),
        tool("list_notes", "List the path of every note in the vault.", json!({}), &[], false),
        tool(
            "get_backlinks",
            "List the notes that link to a note, with the line that links.",
            json!({ "path": path }),
            &["path"],
            false,
        ),
        tool(
            "create_note",
            "Create a new note. Fails if the path already exists.",
            json!({ "path": path, "text": { "type": "string", "description": "The note's Markdown" } }),
            &["path", "text"],
            true,
        ),
        tool(
            "edit_note",
            "Replace one passage of a note. old_text must appear in the note exactly once; read the note first. \
             An empty old_text appends new_text to the end.",
            json!({ "path": path, "old_text": { "type": "string" }, "new_text": { "type": "string" } }),
            &["path", "old_text", "new_text"],
            true,
        ),
        tool(
            "set_property",
            "Set one property in a note's frontmatter. A null value removes it.",
            json!({ "path": path, "key": { "type": "string" }, "value": {} }),
            &["path", "key", "value"],
            true,
        ),
    ]
}

fn text(input: &Value, key: &str) -> Result<String, String> {
    input[key]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| format!("'{key}' must be text"))
}

/// Run a vault tool. The error text goes back to the model, so it says what
/// to do differently.
pub fn run(core: &Core, name: &str, input: &Value) -> Result<String, String> {
    let call =
        |command: &str, args: Value| commands::run(core, command, args).map_err(|e| e.to_string());
    let shown = |value: Value| serde_json::to_string_pretty(&value).unwrap_or_default();
    match name {
        "search_notes" => call(
            "search.query",
            json!({ "q": text(input, "query")?, "limit": 20 }),
        )
        .map(shown),
        "list_notes" => call("vault.notes", Value::Null).map(shown),
        "get_backlinks" => {
            call("links.backlinks", json!({ "path": text(input, "path")? })).map(shown)
        }
        "read_note" => {
            let note = call("note.read", json!({ "path": text(input, "path")? }))?;
            let body = note["text"].as_str().unwrap_or_default();
            if body.len() > MAX_NOTE {
                return Err(format!(
                    "this note is {} characters, too long to read in one piece; search it instead",
                    body.len()
                ));
            }
            Ok(body.to_string())
        }
        "create_note" => {
            let path = text(input, "path")?;
            call(
                "note.create",
                json!({ "path": path, "text": text(input, "text")? }),
            )?;
            Ok(format!("created {path}"))
        }
        "edit_note" => {
            let path = text(input, "path")?;
            let (old, new) = (text(input, "old_text")?, text(input, "new_text")?);
            let note = call("note.read", json!({ "path": path }))?;
            let body = note["text"].as_str().unwrap_or_default();
            let changed = if old.is_empty() {
                let gap = if body.is_empty() || body.ends_with('\n') {
                    ""
                } else {
                    "\n"
                };
                format!("{body}{gap}{new}")
            } else {
                match body.matches(old.as_str()).count() {
                    0 => return Err(
                        "old_text is not in the note; read the note and copy the passage exactly"
                            .into(),
                    ),
                    1 => body.replacen(old.as_str(), &new, 1),
                    n => {
                        return Err(format!(
                            "old_text appears {n} times; include more of the surrounding text"
                        ))
                    }
                }
            };
            // The text keeps its own line endings; the hash refuses a note that changed meanwhile.
            call(
                "note.write",
                json!({ "path": path, "text": changed, "eol": "lf", "expected_hash": note["hash"] }),
            )?;
            Ok(format!("edited {path}"))
        }
        "set_property" => {
            let path = text(input, "path")?;
            call(
                "props.set",
                json!({ "path": path, "key": text(input, "key")?, "value": input["value"] }),
            )?;
            Ok(format!("updated {path}"))
        }
        other => Err(format!("there is no tool called {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edit_needs_one_exact_match_and_keeps_the_rest() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("A.md"), "one\r\ntwo\r\none\r\n").unwrap();
        let core = Core::open(dir.path()).unwrap();
        let edit = |old: &str, new: &str| {
            run(
                &core,
                "edit_note",
                &json!({ "path": "A.md", "old_text": old, "new_text": new }),
            )
        };

        assert!(edit("one", "x").unwrap_err().contains("2 times"));
        assert!(edit("three", "x").is_err());
        edit("two", "2").unwrap();
        edit("", "end\r\n").unwrap();
        let bytes = std::fs::read(dir.path().join("A.md")).unwrap();
        assert_eq!(bytes, b"one\r\n2\r\none\r\nend\r\n");
        assert!(run(&core, "search_notes", &json!({ "query": "end" }))
            .unwrap()
            .contains("A.md"));
    }
}

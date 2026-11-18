//! @part-of core.frontmatter
//! Read and change the properties at the top of a note.
//!
//! Only top-level keys are understood: text, numbers, true/false and lists.
//! Changing one key rewrites only that key's lines; everything else in the
//! file is left byte-for-byte as it was.

use serde_json::{Map, Value};

/// Byte range of the frontmatter body (between the `---` lines) and of the whole block.
struct Block {
    body: std::ops::Range<usize>,
    end: usize,
}

fn block(text: &str) -> Option<Block> {
    let rest = text.strip_prefix("---")?;
    let first_break = rest.find('\n')?;
    if !rest[..first_break].trim().is_empty() {
        return None;
    }
    let body_start = 3 + first_break + 1;
    let mut at = body_start;
    for line in text[body_start..].split_inclusive('\n') {
        if line.trim_end() == "---" {
            return Some(Block {
                body: body_start..at,
                end: at + line.len(),
            });
        }
        at += line.len();
    }
    None
}

fn key_of(line: &str) -> Option<(&str, &str)> {
    let first = line.chars().next()?;
    if first.is_whitespace() || first == '#' || first == '-' {
        return None;
    }
    let (key, value) = line.split_once(':')?;
    let key = key.trim();
    let ok = !key.is_empty()
        && key
            .chars()
            .all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | ' '));
    ok.then_some((key, value.trim()))
}

fn scalar(raw: &str) -> Value {
    let raw = raw.trim();
    if raw.starts_with('"') {
        if let Ok(text) = serde_json::from_str::<String>(raw) {
            return Value::String(text);
        }
    }
    let unquoted = raw
        .strip_prefix('"')
        .and_then(|r| r.strip_suffix('"'))
        .or_else(|| raw.strip_prefix('\'').and_then(|r| r.strip_suffix('\'')));
    if let Some(text) = unquoted {
        return Value::String(text.replace("\\\"", "\""));
    }
    match raw {
        "" | "null" | "~" => Value::Null,
        "true" => Value::Bool(true),
        "false" => Value::Bool(false),
        _ => raw
            .parse::<i64>()
            .map(Value::from)
            .or_else(|_| raw.parse::<f64>().map(Value::from))
            .unwrap_or_else(|_| Value::String(raw.to_string())),
    }
}

/// The note's properties, in file order.
pub fn read(text: &str) -> Map<String, Value> {
    let mut out = Map::new();
    let Some(block) = block(text) else { return out };
    let mut current: Option<String> = None;
    for line in text[block.body].lines() {
        if let Some((key, value)) = key_of(line) {
            let parsed = match value.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
                Some(inner) => serde_json::from_str::<Vec<Value>>(value)
                    .map(Value::Array)
                    .unwrap_or_else(|_| {
                        let mut quote = None;
                        let mut escaped = false;
                        let mut start = true;
                        Value::Array(
                            inner
                                .split(|c| {
                                    if escaped {
                                        escaped = false;
                                    } else if let Some(q) = quote {
                                        if q == '"' && c == '\\' {
                                            escaped = true;
                                        } else if c == q {
                                            quote = None;
                                        }
                                    } else if c == ',' {
                                        start = true;
                                        return true;
                                    } else if !char::is_whitespace(c) {
                                        if start && matches!(c, '\'' | '"') {
                                            quote = Some(c);
                                        }
                                        start = false;
                                    }
                                    false
                                })
                                .map(str::trim)
                                .filter(|s| !s.is_empty())
                                .map(scalar)
                                .collect(),
                        )
                    }),
                None => scalar(value),
            };
            out.insert(key.to_string(), parsed);
            current = Some(key.to_string());
        } else if let (Some(key), Some(item)) = (&current, line.trim_start().strip_prefix("- ")) {
            // A block list under the last key.
            let slot = out.entry(key.clone()).or_insert(Value::Null);
            if !slot.is_array() {
                *slot = Value::Array(Vec::new());
            }
            if let Value::Array(items) = slot {
                items.push(scalar(item));
            }
        }
    }
    out
}

fn write_scalar(value: &Value) -> String {
    match value {
        Value::String(s) => {
            let plain = !s.is_empty()
                && s.chars()
                    .all(|c| c.is_alphanumeric() || matches!(c, ' ' | '_' | '-' | '.' | '/'))
                && !matches!(s.as_str(), "true" | "false" | "null")
                && s.parse::<f64>().is_err()
                && s.trim() == s;
            if plain {
                s.clone()
            } else {
                format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
            }
        }
        Value::Array(items) => format!(
            "[{}]",
            items
                .iter()
                .map(write_scalar)
                .collect::<Vec<_>>()
                .join(", ")
        ),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// The note's text with one property set, or removed when `value` is null.
pub fn set(text: &str, key: &str, value: &Value) -> String {
    let line = if value.is_null() {
        String::new()
    } else {
        format!("{key}: {}\n", write_scalar(value))
    };
    let Some(block) = block(text) else {
        return if line.is_empty() {
            text.to_string()
        } else {
            format!("---\n{line}---\n\n{text}")
        };
    };
    // Find the key's lines: its own line plus any indented or list lines under it.
    let mut at = block.body.start;
    let mut found: Option<std::ops::Range<usize>> = None;
    for raw in text[block.body.clone()].split_inclusive('\n') {
        let is_key = key_of(raw.trim_end_matches(['\n', '\r']));
        match (&mut found, is_key) {
            (None, Some((k, _))) if k == key => found = Some(at..at + raw.len()),
            (Some(range), None) if range.end == at => range.end = at + raw.len(),
            _ => {}
        }
        at += raw.len();
    }
    match found {
        Some(range) => format!("{}{}{}", &text[..range.start], line, &text[range.end..]),
        None => format!(
            "{}{}{}",
            &text[..block.body.end],
            line,
            &text[block.body.end..]
        ),
    }
}

/// Where the note's own text starts, after the frontmatter.
pub fn body_start(text: &str) -> usize {
    block(text).map(|b| b.end).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const NOTE: &str = "---\ntitle: \"Launch: plan\"\nstatus: doing\ntags:\n  - a\n  - b\ndone: false\nestimate: 3\n---\n\n# Body\nstatus: not a property\n";

    #[test]
    fn reads_text_numbers_flags_and_lists() {
        let props = read(NOTE);
        assert_eq!(props["title"], json!("Launch: plan"));
        assert_eq!(props["status"], json!("doing"));
        assert_eq!(props["tags"], json!(["a", "b"]));
        assert_eq!(props["done"], json!(false));
        assert_eq!(props["estimate"], json!(3));
        assert_eq!(
            read("---\nlist: [x, \"y z\", 2]\n---\n")["list"],
            json!(["x", "y z", 2])
        );
        assert!(read("no frontmatter\n---\nstatus: x\n---\n").is_empty());
    }

    #[test]
    fn setting_one_key_leaves_the_rest_untouched() {
        let changed = set(NOTE, "status", &json!("done"));
        assert_eq!(changed, NOTE.replace("status: doing", "status: done"));
        // A block list is replaced whole, and the body is never touched.
        let relisted = set(NOTE, "tags", &json!(["c"]));
        assert_eq!(
            relisted,
            NOTE.replace("tags:\n  - a\n  - b\n", "tags: [c]\n")
        );
        let removed = set(NOTE, "estimate", &Value::Null);
        assert_eq!(removed, NOTE.replace("estimate: 3\n", ""));
        let added = set(NOTE, "owner", &json!("Pratham"));
        assert_eq!(
            added,
            NOTE.replace("estimate: 3\n", "estimate: 3\nowner: Pratham\n")
        );
    }

    #[test]
    fn a_note_without_properties_gains_a_block() {
        assert_eq!(
            set("# Title\n", "status", &json!("todo")),
            "---\nstatus: todo\n---\n\n# Title\n"
        );
        assert_eq!(set("# Title\n", "status", &Value::Null), "# Title\n");
        assert_eq!(
            read(&set("x", "when", &json!("2026-11-12")))["when"],
            json!("2026-11-12")
        );
    }

    #[test]
    fn quoted_status_and_column_order_round_trip_without_changing_other_bytes() {
        let status = "qa, [雪]: \"x\" \\done";
        let text = set(NOTE, "status", &json!(status));
        assert_eq!(read(&text)["status"], json!(status));
        assert_eq!(set(&text, "status", &json!(status)), text);
        let order = json!(["plain", status, "quote\" and slash\\", "雪"]);
        assert_eq!(
            read("---\norder: [it's plain, 'a, b', todo]\n---\n")["order"],
            json!(["it's plain", "a, b", "todo"])
        );
        let text = set(&text, "order", &order);
        assert_eq!(read(&text)["order"], order);
        assert_eq!(set(&text, "order", &order), text);
        assert!(text.ends_with("# Body\nstatus: not a property\n"));
        assert!(text.contains("tags:\n  - a\n  - b\ndone: false\nestimate: 3\n"));
        assert_eq!(read(&set(&text, "order", &json!([])))["order"], json!([]));
        assert_eq!(
            read("---\norder: [todo, \"in progress\", 2, true]\nraw: \"plain\\path\"\n---\n")
                ["order"],
            json!(["todo", "in progress", 2, true])
        );
        assert_eq!(
            read("---\nraw: \"plain\\path\"\n---\n")["raw"],
            json!("plain\\path")
        );
    }
}

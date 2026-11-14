//! @part-of ai
//! Files that are not notes, as the assistant meets them.
//!
//! A person attaches a picture, a PDF or a CSV to a message. The conversation keeps only the
//! file's place in the vault, so a saved chat stays small; what the model is sent is made here,
//! fresh for each request: a picture as a picture, anything with words in it as those words.
//!
//! The assistant can also read such a file in parts, and make one: a CSV or an SVG chart from
//! text, a PDF from text laid out like a note.

use std::collections::HashMap;

use lokus_core::{commands, files, Core};
use serde_json::{json, Value};

use crate::tools::Tool;

/// The largest picture sent to a model; bigger ones are named and left out.
const MAX_IMAGE: u64 = 4_500_000;
/// How much of a file's text goes with the message. The rest is read with read_file.
const ATTACHED_CHARS: usize = 24_000;
/// Kinds of file the assistant may make from text.
const WRITABLE: [&str; 8] = ["csv", "tsv", "txt", "json", "svg", "html", "xml", "yaml"];

fn call(core: &Core, command: &str, args: Value) -> Result<Value, String> {
    commands::run(core, command, args).map_err(|e| e.to_string())
}

/// What one attached file becomes in a request.
fn block(core: &Core, path: &str) -> Value {
    let said = |text: String| json!({ "type": "text", "text": text });
    let kind = files::kind(path);
    let raster = kind == "image" && !path.to_lowercase().ends_with(".svg");
    if raster {
        return match call(core, "file.read", json!({ "path": path })) {
            Ok(file) if file["size"].as_u64().unwrap_or(0) <= MAX_IMAGE => json!({
                "type": "image",
                "source": { "type": "base64", "media_type": file["mime"], "data": file["base64"] },
            }),
            Ok(_) => said(format!(
                "<file path={path:?}>This picture is too large to look at (over 4.5 MB).</file>"
            )),
            Err(e) => said(format!(
                "<file path={path:?}>Could not be opened: {e}</file>"
            )),
        };
    }
    match call(core, "file.text", json!({ "path": path, "max_chars": ATTACHED_CHARS })) {
        Ok(read) if read["empty"] == true => said(format!(
            "<file path={path:?} kind={kind:?}>This file has no text in it. A PDF like this is usually scanned pages.</file>"
        )),
        Ok(read) => {
            let more = if read["more"] == true {
                format!(
                    "\n[lines 1-{} of {}; read the rest with read_file from_line={}]",
                    read["to_line"],
                    read["lines"],
                    read["to_line"].as_u64().unwrap_or(0) + 1
                )
            } else {
                String::new()
            };
            said(format!(
                "<file path={path:?} kind={kind:?}>\n{}{more}\n</file>",
                read["text"].as_str().unwrap_or_default().trim_end()
            ))
        }
        Err(_) => said(format!(
            "<file path={path:?} kind={kind:?}>This kind of file cannot be read as text.</file>"
        )),
    }
}

/// The conversation as a model should be sent it: every `attachment` block replaced by what
/// the file holds. `seen` keeps each file's block for the length of one reply, so a long reply
/// reads a file once.
pub fn expand(
    core: Option<&Core>,
    messages: &[Value],
    seen: &mut HashMap<String, Value>,
) -> Vec<Value> {
    messages
        .iter()
        .map(|message| {
            let Some(blocks) = message["content"].as_array() else {
                return message.clone();
            };
            if !blocks.iter().any(|b| b["type"] == "attachment") {
                return message.clone();
            }
            let content: Vec<Value> = blocks
                .iter()
                .map(|b| {
                    if b["type"] != "attachment" {
                        return b.clone();
                    }
                    let path = b["path"].as_str().unwrap_or_default().to_string();
                    match core {
                        Some(core) => seen
                            .entry(path.clone())
                            .or_insert_with(|| block(core, &path))
                            .clone(),
                        None => json!({ "type": "text", "text": format!("<file path={path:?}>No folder is open, so this file cannot be read.</file>") }),
                    }
                })
                .collect();
            json!({ "role": message["role"], "content": content })
        })
        .collect()
}

fn tool(name: &str, description: &str, properties: Value, required: &[&str], writes: bool) -> Tool {
    Tool {
        name: name.into(),
        description: description.into(),
        schema: json!({ "type": "object", "properties": properties, "required": required, "additionalProperties": false }),
        writes,
    }
}

pub fn tools() -> Vec<Tool> {
    let path = |eg: &str| json!({ "type": "string", "description": format!("Path inside the vault, e.g. {eg}") });
    vec![
        tool(
            "read_file",
            "Read the text of a file that is not a note: a CSV, a PDF, a text or JSON file. A long file comes back in \
             parts; the result says which lines it holds and whether there is more. A picture has no text to read.",
            json!({ "path": path("data/sales.csv"), "from_line": { "type": "integer", "description": "First line to return, counting from 1." } }),
            &["path"],
            false,
        ),
        tool(
            "list_files",
            "List the files in the vault that are not notes (pictures, PDFs, CSVs), with their kind and size. \
             Pass folder to look in one folder only.",
            json!({ "folder": { "type": "string", "description": "Folder inside the vault. Leave out for everywhere." } }),
            &[],
            false,
        ),
        tool(
            "create_file",
            "Make a file from text: a table as .csv, a chart or diagram as .svg, or a .txt, .json or .html file. \
             The person sees the file as a card under your reply and can open it, so do not paste its contents \
             into the reply as well. For a chart, write a complete SVG with a viewBox, a white background and \
             readable labels. Fails if the file exists; choose another name.",
            json!({ "path": path("reports/Sales by month.csv"), "text": { "type": "string", "description": "The whole file." } }),
            &["path", "text"],
            true,
        ),
        tool(
            "create_pdf",
            "Make a PDF document from text written like a note: # headings, paragraphs, - lists and | tables. \
             Use it when the person asks for a PDF or a document to send to someone. Latin letters only. \
             The person sees it as a card under your reply.",
            json!({
                "path": path("reports/Q3 report.pdf"),
                "title": { "type": "string" },
                "text": { "type": "string", "description": "The document, in Markdown." },
            }),
            &["path", "text"],
            true,
        ),
    ]
}

fn text<'a>(input: &'a Value, key: &str) -> Result<&'a str, String> {
    input[key]
        .as_str()
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("{key} is needed"))
}

fn collect(entries: &Value, under: &str, out: &mut Vec<String>) {
    for entry in entries.as_array().into_iter().flatten() {
        let path = entry["path"].as_str().unwrap_or_default();
        match entry["kind"].as_str() {
            Some("folder") => collect(&entry["children"], under, out),
            Some("file") if under.is_empty() || path.starts_with(&format!("{under}/")) => {
                out.push(format!("{path}  ({})", files::kind(path)));
            }
            _ => {}
        }
    }
}

/// Run one of the tools above; `None` when the name is not one of them.
pub fn run(core: &Core, name: &str, input: &Value) -> Option<Result<String, String>> {
    Some(match name {
        "read_file" => (|| {
            let path = text(input, "path")?;
            let read = call(
                core,
                "file.text",
                json!({ "path": path, "from_line": input["from_line"].as_u64().unwrap_or(1), "max_chars": 32_000 }),
            )
            .map_err(|e| format!("{e}. A picture or another file without text cannot be read this way."))?;
            if read["empty"] == true {
                return Ok(format!(
                    "{path} has no text in it. If it is a PDF, it is probably scanned pages."
                ));
            }
            let more = if read["more"] == true {
                format!(
                    "; continue with from_line={}",
                    read["to_line"].as_u64().unwrap_or(0) + 1
                )
            } else {
                String::new()
            };
            Ok(format!(
                "[{path}: lines {}-{} of {}{more}]\n{}",
                read["from_line"],
                read["to_line"],
                read["lines"],
                read["text"].as_str().unwrap_or_default()
            ))
        })(),
        "list_files" => (|| {
            let tree = call(core, "vault.tree", Value::Null)?;
            let mut found = Vec::new();
            collect(
                &tree,
                input["folder"]
                    .as_str()
                    .unwrap_or_default()
                    .trim_matches('/'),
                &mut found,
            );
            Ok(if found.is_empty() {
                "There are no files here that are not notes.".to_string()
            } else {
                found.join("\n")
            })
        })(),
        "create_file" => (|| {
            let path = text(input, "path")?;
            let extension = path.rsplit('.').next().unwrap_or_default().to_lowercase();
            if !WRITABLE.contains(&extension.as_str()) {
                return Err(format!(
                    "create_file makes {} files. Use create_note for a note and create_pdf for a PDF.",
                    WRITABLE.join(", ")
                ));
            }
            let made = call(
                core,
                "file.write",
                json!({ "path": path, "text": text(input, "text")? }),
            )?;
            Ok(format!("created {path} ({} bytes)", made["size"]))
        })(),
        "create_pdf" => (|| {
            let path = text(input, "path")?;
            let made = call(
                core,
                "file.pdf",
                json!({ "path": path, "title": input["title"], "text": text(input, "text")? }),
            )?;
            Ok(format!("created {path} ({} bytes)", made["size"]))
        })(),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_attached_file_is_sent_as_what_it_holds() {
        let dir = tempfile::tempdir().unwrap();
        let core = Core::open(dir.path()).unwrap();
        run(
            &core,
            "create_file",
            &json!({ "path": "data/sales.csv", "text": "month,total\nJan,10\nFeb,12\n" }),
        )
        .unwrap()
        .unwrap();
        commands::run(
            &core,
            "file.write",
            json!({ "path": "shot.png", "base64": "iVBORw0KGgo=" }),
        )
        .unwrap();
        let messages = vec![
            json!({ "role": "user", "content": "plain" }),
            json!({ "role": "user", "content": [
                { "type": "text", "text": "what is in these?" },
                { "type": "attachment", "path": "data/sales.csv" },
                { "type": "attachment", "path": "shot.png" },
                { "type": "attachment", "path": "gone.pdf" },
            ] }),
        ];
        let mut seen = HashMap::new();
        let sent = expand(Some(&core), &messages, &mut seen);
        assert_eq!(sent[0], messages[0]);
        let blocks = sent[1]["content"].as_array().unwrap();
        assert!(blocks[1]["text"].as_str().unwrap().contains("Feb,12"));
        assert_eq!(blocks[2]["type"], "image");
        assert_eq!(blocks[2]["source"]["media_type"], "image/png");
        assert!(blocks[3]["text"].as_str().unwrap().contains("gone.pdf"));
        // The conversation itself is left as it was: light, with places and no contents.
        assert_eq!(messages[1]["content"][1]["type"], "attachment");

        assert!(
            run(&core, "read_file", &json!({ "path": "data/sales.csv" }))
                .unwrap()
                .unwrap()
                .contains("Jan,10")
        );
        assert!(run(&core, "list_files", &json!({}))
            .unwrap()
            .unwrap()
            .contains("data/sales.csv  (table)"));
        assert!(run(
            &core,
            "create_file",
            &json!({ "path": "x.md", "text": "no" })
        )
        .unwrap()
        .is_err());
        run(
            &core,
            "create_pdf",
            &json!({ "path": "Report.pdf", "text": "# Hello\n\nA report." }),
        )
        .unwrap()
        .unwrap();
        assert!(run(&core, "read_file", &json!({ "path": "Report.pdf" }))
            .unwrap()
            .unwrap()
            .contains("A report."));
        assert!(run(&core, "search_notes", &json!({})).is_none());
    }
}

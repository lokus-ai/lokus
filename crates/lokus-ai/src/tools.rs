//! @part-of ai
//! What the assistant can do in the vault. Each tool is a thin wrapper over
//! a core command, so it obeys the same rules as everything else.

use lokus_core::{commands, Core};
use serde_json::{json, Value};

/// How much of a note one read returns; the rest is read with `from_line`.
const READ_CHARS: usize = 32_000;
/// How many entries one folder listing returns.
const LIST_ENTRIES: usize = 200;

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
        tool(
            "read_note",
            "Read a note's Markdown text. A long note comes back in parts: the result says which lines it holds and \
             which line to continue from. Pass from_line to read the next part.",
            json!({ "path": path, "from_line": { "type": "integer", "description": "First line to return, counting from 1. Leave out to start at the top." } }),
            &["path"],
            false,
        ),
        tool(
            "list_folder",
            "List what is directly inside one folder: its sub-folders, with how many notes each holds, and its notes. \
             Leave path out for the top of the vault. Use this to find your way around; use search_notes to find a \
             note by what it says.",
            json!({ "path": { "type": "string", "description": "Folder inside the vault, e.g. Projects/2026. Leave out for the top." } }),
            &[],
            false,
        ),
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
            "move_note",
            "Rename a note or move it to another folder. Links to it keep working.",
            json!({ "path": path, "to": { "type": "string", "description": "The new path, e.g. Archive/Plan.md" } }),
            &["path", "to"],
            true,
        ),
        tool(
            "set_property",
            "Set one property in a note's frontmatter. A null value removes it.",
            json!({ "path": path, "key": { "type": "string" }, "value": {} }),
            &["path", "key", "value"],
            true,
        ),
        tool(
            "list_tasks",
            "The team's tasks: each one's number (T-12), title, where it stands, priority, whose it is, the \
             customer it is for, when it is due and its labels. Call this before adding a task, so that you update \
             the one that already covers something instead of making a second. Finished tasks are left out unless \
             you ask for them.",
            json!({ "include_done": { "type": "boolean", "description": "Also list finished tasks. Leave out normally." } }),
            &[],
            false,
        ),
        tool(
            "record_task",
            "Add a task to the team's board, or update one. This is the only right way to track work to be done: \
             never write a to-do list in a note instead. To update a task give its key (T-12); to add one give a \
             title. status is backlog, todo, doing, review or done. priority is urgent, high, medium or low. Give \
             customer when the work is for a customer, so it shows on that customer's page. labels are short \
             words such as bug, request, churn-risk, billing. text is what the task is about and why, with a \
             link to where it came from.",
            json!({
                "key": { "type": "string", "description": "The number of an existing task to update, like T-12. Leave out to add a task." },
                "title": { "type": "string", "description": "What is to be done, as a short imperative line." },
                "status": { "type": "string" },
                "priority": { "type": "string" },
                "assignee": { "type": "string", "description": "Whose it is: a person's name." },
                "customer": { "type": "string", "description": "The customer it is for, by the name list_customers shows." },
                "due": { "type": "string", "description": "YYYY-MM-DD" },
                "labels": { "type": "array", "items": { "type": "string" } },
                "link": { "type": "string" },
                "text": { "type": "string", "description": "What it is about and why. Used when the task is first added." },
            }),
            &[],
            true,
        ),
        tool(
            "timeline",
            "Everything Lokus has on record about one customer or one thing, in the order it happened: messages \
             in and out, issues and their status, changes to their details, events, and the tasks open for them. \
             Use it before drawing a conclusion about a customer: what happened is only clear in order. It shows \
             what is filed in Lokus; for what is true this minute, also ask the connected services and the team's \
             own systems.",
            json!({
                "about": { "type": "string", "description": "A customer's name as it is in Lokus, or a thing's folder path like data/order/A-1042." },
                "days": { "type": "integer", "description": "How far back. 30 unless said." }
            }),
            &["about"],
            false,
        ),
        tool(
            "search_logs",
            "Search the log lines the team's own systems have sent to Lokus (the last two weeks, on this device). \
             Use it when working out why something went wrong for a customer or a thing: look for errors around \
             the time it happened. Gives the newest matching lines, how many matched and how many of each level.",
            json!({
                "query": { "type": "string", "description": "Words that must all be in the line. Leave out to see everything." },
                "level": { "type": "string", "description": "Only this level: error, warn, info, debug." },
                "stream": { "type": "string", "description": "Only this stream (a service or job name). Leave out for all; the answer lists the streams there are." },
                "about": { "type": "string", "description": "A customer's domain or a thing's id that the line must mention." },
                "hours": { "type": "integer", "description": "How far back to look. 24 unless said." },
                "limit": { "type": "integer", "description": "How many lines to bring back, 40 unless said." }
            }),
            &[],
            false,
        ),
        tool(
            "report_finding",
            "Tell the user about something you noticed that they would want to know, with what you would do about it. \
             It goes to their Noticed list; it changes nothing else. Use it when checking on the workspace without \
             being asked, and in conversation when you spot something beyond what was asked. One per situation. \
             Write it the way a sharp colleague would say it across the desk, not the way a monitoring tool would: \
             plain words, real names, what actually happened. Title: a full plain statement with a verb, like \
             'Haladir hasn't heard back in 7 days' or 'The fix Quivly asked for already shipped'; never a label \
             like 'Haladir waiting' or 'LinkedIn safety issue'. Recommendation: what you would actually do, said \
             plainly, like 'Send them the steps to regenerate leads'. Never use: verify, confirm, ensure, triage, \
             follow up, accountable, visibility, remains, unclear, outstanding, action item, stakeholder. In the \
             summary and each evidence line put the one thing that matters (a name, a number, a date) in **bold** \
             and nothing else; no other Markdown.",
            json!({
                "key": { "type": "string", "description": "A stable name for this exact situation, so noticing it again updates the same card: e.g. 'waiting quivly export-thread' or 'contradiction status-page uptime'." },
                "title": { "type": "string", "description": "A plain statement with a verb, at most 60 characters, starting with who or what it is about." },
                "summary": { "type": "string", "description": "One sentence, at most 140 characters: why it matters now." },
                "evidence": { "type": "array", "description": "Up to 5 facts this rests on, in the order they happened, each at most 100 characters and starting with its date when it has one ('Nov 11: …'), with where it came from.", "items": { "type": "object", "properties": { "text": { "type": "string" }, "source": { "type": "string", "description": "slack, linear, a note path, …" }, "link": { "type": "string" } }, "required": ["text", "source"] } },
                "metric": { "type": "string", "description": "The one number that makes this matter, at most 16 characters: '7 days', '53 leads', '$2,400 a month', 'renews Nov 23'. Leave out if there is none or the title already says it." },
                "recommend": { "type": "string", "description": "What you would do, in plain words: at most 90 characters, starting with a verb a person would use (send, tell, assign, fix, move, ask)." },
                "action": { "type": "string", "description": "What you would do if the user says go, written as an instruction to yourself with every name, id and link needed to do it without looking anything up again." },
                "situation": { "type": "string", "description": "The kind of situation this is, with no names in it, so the user's choice can be applied next time: e.g. 'a customer reports a bug that a deploy has already fixed'." },
                "follows": { "type": "string", "description": "If this recommendation follows something under 'How we handle things', quote that line. Otherwise leave out." },
                "customer": { "type": "string", "description": "The customer's name as it is in Lokus, when this is about one." },
                "urgency": { "type": "string", "enum": ["now", "soon", "fyi"], "description": "now: someone is harmed or lost if this waits a day. soon: this week. fyi: worth knowing, nothing breaks." },
                "confidence": { "type": "string", "enum": ["read", "likely", "guess"], "description": "read: every link in the chain is something you read just now. likely: one link is inferred. guess: more than one is. A guess is not reported; go and read what is missing, or leave it." },
                "if_ignored": { "type": "string", "description": "What happens if nobody does anything, in at most 90 characters. If the honest answer is 'nothing much', do not report this." }
            }),
            &["key", "title", "summary", "recommend", "situation", "urgency", "confidence", "if_ignored"],
            false,
        ),
        tool(
            "suggest_note_change",
            "Propose text for a note without changing the note. The user sees it on that note as a suggestion they can \
             add or dismiss. Use it when a note is missing something you found, or says something that is no longer \
             true. Write the text exactly as it should read in the note.",
            json!({
                "path": path,
                "text": { "type": "string", "description": "The Markdown to add, ready to paste: a sentence, a list or a short section." },
                "after": { "type": "string", "description": "The heading (its text, without #) to put it under. Leave out to add at the end." },
                "why": { "type": "string", "description": "One sentence: what you found that makes this worth adding, and where." },
                "link": { "type": "string", "description": "A link to what you found, if there is one." }
            }),
            &["path", "text", "why"],
            false,
        ),
        tool(
            "remember",
            "Keep something for later conversations. It is added to the note Assistant.md, which you are shown at \
             the start of every conversation and which the user can read and edit. Use it when the user tells you \
             something that should still hold next time: how they like things done, who someone is, a decision, a \
             name for something, a standing instruction. One plain sentence that will make sense on its own months \
             from now. Do not use it for passing details of the task at hand, or for anything already written there.",
            json!({ "fact": { "type": "string", "description": "One sentence to remember." } }),
            &["fact"],
            false,
        ),
        tool(
            "list_customers",
            "The customers this team keeps in Lokus: each one's details (health, plan, owner and whatever else the \
             team tracks), how many issues are open, and when anything last happened. Call this first for any \
             question or task about customers, so you know who already exists and which details are in use.",
            json!({}),
            &[],
            false,
        ),
        tool(
            "record_customer",
            "Add or update a customer in Lokus, and what is known about them. This is the only right way to add a \
             customer, something that happened with one, or a person at one: it files everything where the \
             Customers list and the customer's page expect it. Never build a customer by hand with create_note, \
             and never make a table of customers in a note. Calling it again with the same thing changes \
             nothing, so it is safe to repeat. One call records one customer: any of its details, the things \
             that happened (one in event, or many in events), and at most one person. Call it again for each \
             further person. Keep what people actually said: record a conversation message by message with \
             the full text of each, not as one summary.",
            json!({
                "customer": { "type": "string", "description": "Who it is about: their domain (acme.com) if known, otherwise their name. Use the same one every time for the same customer." },
                "name": { "type": "string", "description": "What to call them, used the first time they are seen. Optional." },
                "source": { "type": "string", "description": "Where this comes from: slack, linear, notion, granola, stripe, email. Optional." },
                "set": { "type": "object", "description": "Details to set on the customer, e.g. {\"plan\": \"Scale\", \"mrr\": 2400, \"owner\": \"Pratham\", \"health\": \"at risk\", \"renewal\": \"2027-02-01\"}. health is good, watch or at risk. Dates are YYYY-MM-DD. Text, numbers and true/false only. Use the detail names list_customers shows before inventing new ones." },
                "event": {
                    "type": "object",
                    "description": "One thing that happened. Fields: kind (issue, message, meeting or event), title, id (the source's own id, so sending it again updates it instead of duplicating), from (who said or raised it), at (2026-11-13T21:40:05Z), status (for an issue; done, closed, resolved, fixed or cancelled mean it is closed), text (the full message or description), link. For a message also: thread (an id shared by the messages of one conversation), channel, and direction (in when the customer said it, out when we did).",
                },
                "events": {
                    "type": "array",
                    "items": { "type": "object" },
                    "description": "Several things that happened, each shaped like event. Use this for a conversation: one entry per message, in order, all with the same thread, each with its own id, from, at, direction and its full text. Up to 50 in one call.",
                },
                "person": { "type": "object", "description": "Someone at the customer: name, and any of email, slack, role, phone." },
            }),
            &["customer"],
            true,
        ),
    ]
}

/// Things the assistant can do in the app's window rather than in the files. Nothing here
/// changes a note, so the person is not asked first.
pub fn app_tools() -> Vec<Tool> {
    vec![
        tool(
            "open_note",
            "Open a note in the app so the user is looking at it. Use this when they ask to open, show or go to a \
             note. To jump to a part of the note, give the heading's text.",
            json!({
                "path": { "type": "string", "description": "Path inside the vault, e.g. Projects/Plan.md" },
                "heading": { "type": "string", "description": "A heading in the note to scroll to. Optional." },
            }),
            &["path"],
            false,
        ),
        tool(
            "show_graph",
            "Show the graph of notes and their links in the app.",
            json!({}),
            &[],
            false,
        ),
        tool(
            "ask_user",
            "Ask the user one question and wait for their answer. Use it when a choice is theirs and you cannot \
             tell which they want: which of several matching notes, customers or records they mean, or which of a \
             few sensible ways to do what they asked. Give 2 to 5 short options; the user can also type their own \
             answer. Never use it for something you can find out yourself with another tool, and never to ask \
             permission to change something: that is asked for you.",
            json!({
                "question": { "type": "string", "description": "The question, in one sentence." },
                "options": { "type": "array", "items": { "type": "string" }, "description": "2 to 5 short answers to choose from." },
                "multiple": { "type": "boolean", "description": "True when more than one option may be chosen. Leave out for one." },
            }),
            &["question", "options"],
            false,
        ),
    ]
}

/// How many notes are inside a folder of the tree, at any depth.
fn notes_inside(entry: &Value) -> usize {
    entry["children"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|c| match c["kind"].as_str() {
            Some("folder") => notes_inside(c),
            Some("note") => 1,
            _ => 0,
        })
        .sum()
}

/// One folder's direct contents as short lines: folders first, then notes.
fn list_folder(tree: &Value, path: &str) -> Result<String, String> {
    let mut here = tree.as_array().cloned().unwrap_or_default();
    for part in path.split('/').filter(|p| !p.is_empty()) {
        let next = here
            .iter()
            .find(|e| e["kind"] == "folder" && e["name"] == part)
            .ok_or_else(|| format!("there is no folder {path}; list its parent to see what exists"))?;
        here = next["children"].as_array().cloned().unwrap_or_default();
    }
    let mut lines: Vec<String> = Vec::new();
    for entry in here.iter().filter(|e| e["kind"] == "folder") {
        let name = entry["path"].as_str().unwrap_or_default();
        lines.push(format!("{name}/  ({} notes)", notes_inside(entry)));
    }
    for entry in here.iter().filter(|e| e["kind"] == "note") {
        lines.push(entry["path"].as_str().unwrap_or_default().to_string());
    }
    if lines.is_empty() {
        return Ok("This folder has no notes or folders in it.".into());
    }
    let total = lines.len();
    lines.truncate(LIST_ENTRIES);
    if total > LIST_ENTRIES {
        lines.push(format!(
            "[{} more not shown. Use search_notes to find a note here by what it says.]",
            total - LIST_ENTRIES
        ));
    }
    Ok(lines.join("\n"))
}

/// A note's text from `from_line`, cut at a line end once it is long enough, with a line
/// saying what was returned and where to continue.
fn read_part(body: &str, from_line: usize) -> Result<String, String> {
    let lines: Vec<&str> = body.split_inclusive('\n').collect();
    let start = from_line.max(1) - 1;
    if start > 0 && start >= lines.len() {
        return Err(format!("the note has {} lines; from_line is past the end", lines.len()));
    }
    let mut out = String::new();
    let mut end = start;
    while end < lines.len() && (out.is_empty() || out.len() + lines[end].len() <= READ_CHARS) {
        out.push_str(lines[end]);
        end += 1;
    }
    if start == 0 && end == lines.len() {
        return Ok(out);
    }
    if !out.ends_with('\n') {
        out.push('\n');
    }
    out.push_str(&if end < lines.len() {
        format!("[Lines {}-{end} of {}. Read on with from_line={}.]", start + 1, lines.len(), end + 1)
    } else {
        format!("[Lines {}-{end} of {}. This is the end of the note.]", start + 1, lines.len())
    });
    Ok(out)
}

/// The tasks as a short list the model can read, the most pressing first.
fn tasks(rows: &[Value], include_done: bool) -> String {
    let word = |props: &Value, key: &str| props[key].as_str().unwrap_or_default().to_string();
    let weight = |p: &str| lokus_core::tasks::PRIORITIES.iter().position(|x| *x == p).unwrap_or(9);
    let mut listed: Vec<(usize, i64, String)> = Vec::new();
    let mut done = 0;
    for row in rows {
        let props = &row["props"];
        if props["type"] != "task" {
            continue;
        }
        let status = word(props, "status");
        if !include_done && matches!(status.as_str(), "done" | "closed" | "cancelled" | "canceled") {
            done += 1;
            continue;
        }
        let number = props["number"].as_i64().unwrap_or(0);
        let path = row["path"].as_str().unwrap_or_default();
        let title = path.rsplit('/').next().unwrap_or(path).trim_end_matches(".md");
        let mut parts = vec![format!("T-{number} {title}"), format!("status {}", if status.is_empty() { "none" } else { &status })];
        for key in ["priority", "assignee", "customer", "due"] {
            let value = word(props, key);
            if !value.is_empty() {
                parts.push(format!("{key} {value}"));
            }
        }
        if let Some(labels) = props["labels"].as_array() {
            let labels: Vec<&str> = labels.iter().filter_map(Value::as_str).collect();
            if !labels.is_empty() {
                parts.push(format!("labels {}", labels.join(", ")));
            }
        }
        listed.push((weight(&word(props, "priority")), number, format!("- {}. ({path})", parts.join("; "))));
    }
    listed.sort();
    if listed.is_empty() {
        return format!("There are no open tasks.{}", if done > 0 { format!(" {done} are finished.") } else { String::new() });
    }
    format!(
        "{} tasks{}.\n{}",
        listed.len(),
        if done > 0 { format!(" ({done} finished ones not shown)") } else { String::new() },
        listed.into_iter().map(|(_, _, line)| line).collect::<Vec<_>>().join("\n"),
    )
}

/// Where the assistant's standing instructions and its own memory live, and the heading it adds under.
const MEMORY: &str = "Assistant.md";
const REMEMBERED: &str = "## Remembered";

/// The customers as a short list the model can read: one line each, then what the team tracks.
fn customers(rows: &[Value]) -> String {
    let prefix = format!("{}/", lokus_core::ingest::CUSTOMERS);
    let closed = ["done", "closed", "resolved", "fixed", "canceled", "cancelled"];
    let mut lines = Vec::new();
    let mut details = std::collections::BTreeSet::new();
    for row in rows {
        let path = row["path"].as_str().unwrap_or_default();
        let rest = path.strip_prefix(&prefix).unwrap_or(path);
        if rest.contains('/') || row["props"]["type"] != "customer" {
            continue;
        }
        let name = rest.trim_end_matches(".md");
        let folder = format!("{prefix}{name}/");
        let (mut open, mut messages, mut last) = (0, 0, String::new());
        for item in rows.iter().filter(|r| r["path"].as_str().is_some_and(|p| p.starts_with(&folder))) {
            let props = &item["props"];
            let status = props["status"].as_str().unwrap_or_default().to_lowercase();
            if props["kind"] == "issue" && !closed.contains(&status.as_str()) {
                open += 1;
            }
            if props["kind"] == "message" {
                messages += 1;
            }
            let at = props["at"].as_str().unwrap_or_default();
            if at > last.as_str() {
                last = at.to_string();
            }
        }
        let mut known = Vec::new();
        if let Some(props) = row["props"].as_object() {
            for (key, value) in props {
                if matches!(key.as_str(), "type" | "summary" | "icon" | "cover" | "cover_layout") || value.is_null() {
                    continue;
                }
                details.insert(key.clone());
                known.push(format!("{key}: {}", value.as_str().map(str::to_string).unwrap_or_else(|| value.to_string())));
            }
        }
        lines.push(format!(
            "- {name} ({path}). {}. {open} open issues, {messages} messages, last activity {}.",
            if known.is_empty() { "no details yet".to_string() } else { known.join("; ") },
            if last.is_empty() { "never" } else { last.get(..10).unwrap_or(&last) },
        ));
    }
    if lines.is_empty() {
        return "There are no customers yet. Add one with record_customer.".to_string();
    }
    format!(
        "{} customers.\n{}\n\nDetails in use: {}. A customer's page is its note; what happened with it is the notes in the folder of the same name.",
        lines.len(),
        lines.join("\n"),
        details.into_iter().collect::<Vec<_>>().join(", "),
    )
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
        "list_folder" => list_folder(
            &call("vault.tree", Value::Null)?,
            input["path"].as_str().unwrap_or_default(),
        ),
        "get_backlinks" => {
            call("links.backlinks", json!({ "path": text(input, "path")? })).map(shown)
        }
        "read_note" => {
            let note = call("note.read", json!({ "path": text(input, "path")? }))?;
            let from_line = input["from_line"].as_u64().unwrap_or(1) as usize;
            read_part(note["text"].as_str().unwrap_or_default(), from_line)
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
        "move_note" => {
            let (path, to) = (text(input, "path")?, text(input, "to")?);
            call("note.rename", json!({ "from": path, "to": to }))?;
            Ok(format!("moved {path} to {to}"))
        }
        "list_tasks" => {
            if let Ok(mut index) = core.index() {
                let _ = index.refresh();
            }
            let rows = call("props.rows", json!({ "folder": lokus_core::tasks::TASKS }))?;
            Ok(tasks(rows.as_array().map(Vec::as_slice).unwrap_or_default(), input["include_done"] == true))
        }
        "record_task" => {
            let (path, number) = lokus_core::tasks::record(&core.vault, input).map_err(|e| e.to_string())?;
            Ok(format!("T-{number} is at {path}"))
        }
        "timeline" => {
            let about = text(input, "about")?;
            let days = input["days"].as_i64().unwrap_or(30).clamp(1, 365);
            if let Ok(mut index) = core.index() {
                let _ = index.refresh();
            }
            let folder = if about.contains('/') { about.trim_end_matches(".md").to_string() } else { format!("{}/{}", lokus_core::ingest::CUSTOMERS, about) };
            let rows = call("props.rows", json!({ "folder": folder, "deep": true }))?;
            let since = lokus_core::ingest::iso(
                std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0) - days * 86_400,
            );
            let word = |row: &Value, key: &str| row["props"][key].as_str().unwrap_or_default().to_string();
            let mut lines: Vec<(String, String)> = rows
                .as_array()
                .into_iter()
                .flatten()
                .filter(|row| !word(row, "at").is_empty() && word(row, "at").as_str() >= &since[..10])
                .map(|row| {
                    let at = word(row, "at");
                    let who = match (word(row, "direction").as_str(), word(row, "from")) {
                        ("out", from) => format!("us{}", if from.is_empty() { String::new() } else { format!(" ({from})") }),
                        (_, from) if !from.is_empty() => from,
                        _ => String::new(),
                    };
                    let status = word(row, "status");
                    let mut line = format!("{} · {} {}", &at[..at.len().min(16)].replace('T', " "), word(row, "source"), word(row, "kind"));
                    if !who.is_empty() {
                        line.push_str(&format!(" · {who}"));
                    }
                    line.push_str(&format!(" · {}", word(row, "title").chars().take(160).collect::<String>()));
                    if !status.is_empty() {
                        line.push_str(&format!(" [{status}]"));
                    }
                    (at, line)
                })
                .collect();
            lines.sort();
            let total = lines.len();
            let shown: Vec<String> = lines.into_iter().rev().take(120).rev().map(|(_, line)| line).collect();
            let mut out = format!("{about}: {total} things on record in the last {days} days, oldest first{}.\n", if total > 120 { " (the latest 120 shown)" } else { "" });
            out.push_str(&shown.join("\n"));
            if !about.contains('/') {
                let tasks = call("props.rows", json!({ "folder": lokus_core::tasks::TASKS }))?;
                let open: Vec<String> = tasks
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|t| t["props"]["customer"].as_str().is_some_and(|c| c.eq_ignore_ascii_case(&about)) && !matches!(t["props"]["status"].as_str(), Some("done" | "closed" | "cancelled")))
                    .map(|t| format!("T-{} [{}] {} · {}", t["props"]["number"], t["props"]["status"].as_str().unwrap_or("todo"), t["props"]["priority"].as_str().unwrap_or("no priority"), t["props"]["assignee"].as_str().unwrap_or("nobody's")))
                    .collect();
                out.push_str(&format!("\n\nOpen tasks for them: {}", if open.is_empty() { "none".to_string() } else { format!("\n{}", open.join("\n")) }));
            }
            if total == 0 {
                out.push_str("\nNothing is filed. That does not mean nothing happened: look in the connected services.");
            }
            Ok(out)
        }
        "search_logs" => call("logs.search", input.clone()).map(shown),
        "report_finding" => {
            let key = text(input, "key")?;
            // The user reads these at a glance: anything longer than a glance is sent back to be cut.
            let long = |field: &str, most: usize| input[field].as_str().is_some_and(|v| v.chars().count() > most);
            let mut too_long: Vec<String> = [("title", 60), ("summary", 140), ("recommend", 90), ("metric", 12)]
                .iter()
                // Bold marks are formatting, not words: they are not counted.
                .filter(|(field, most)| long(field, *most + 12 + input[*field].as_str().map_or(0, |v| v.matches("**").count() * 2)))
                .map(|(field, most)| format!("{field} (at most {} characters)", if *field == "metric" { 22 } else { *most }))
                .collect();
            let evidence = input["evidence"].as_array().cloned().unwrap_or_default();
            if evidence.len() > 5 || evidence.iter().any(|e| e["text"].as_str().is_some_and(|t| t.chars().count() > 115)) {
                too_long.push("evidence (at most 5, each at most 100 characters)".into());
            }
            // Five at a time, at most. More than that is a pile, and a pile does not get read.
            let waiting = call("noticed.list", json!({}))?;
            let recent = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0) - 600;
            let id = lokus_core::noticed::id_of(&format!("finding {key}"));
            let just_now = waiting
                .as_array()
                .into_iter()
                .flatten()
                .filter(|i| i["kind"] == "finding" && i["state"] == "new" && i["created"].as_i64().unwrap_or(0) >= recent && i["id"] != id.as_str())
                .count();
            if just_now >= 5 {
                return Err("Not reported: you have already left 5 things in the last few minutes, which is the most the user will read. Stop reporting. If this one matters more than one you left, say so in your reply instead.".into());
            }
            // Speaking up when there was no need is how an assistant like this stops being read.
            if input["confidence"] == "guess" {
                return Err("Not reported: more than one link in this is a guess. Read what is missing and report it then, or leave it.".into());
            }
            if input["urgency"] == "now" && input["confidence"] != "read" {
                return Err("Not reported as 'now': something that interrupts the user must rest only on what you read. Read the missing link, or report it as 'soon'.".into());
            }
            if long("if_ignored", 102) {
                too_long.push("if_ignored (at most 90 characters)".into());
            }
            if !too_long.is_empty() {
                return Err(format!("Too long to read at a glance. Shorten and send again: {}.", too_long.join("; ")));
            }
            let mut item = input.clone();
            item["kind"] = json!("finding");
            call("noticed.report", json!({ "key": format!("finding {key}"), "item": item })).map(|said| said.as_str().unwrap_or("noted").to_string())
        }
        "suggest_note_change" => {
            let path = text(input, "path")?;
            call("note.read", json!({ "path": path }))?;
            let mut item = input.clone();
            item["kind"] = json!("suggestion");
            let words: String = text(input, "text")?.chars().take(40).collect();
            call("noticed.report", json!({ "key": format!("suggestion {path} {words}"), "item": item })).map(|said| said.as_str().unwrap_or("noted").to_string())
        }
        "remember" => {
            let fact = text(input, "fact")?.split_whitespace().collect::<Vec<_>>().join(" ");
            if fact.is_empty() || fact.chars().count() > 400 {
                return Err("a thing to remember is one sentence of up to 400 characters".into());
            }
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let line = format!("- {fact} ({})", &lokus_core::ingest::iso(now)[..10]);
            match call("note.read", json!({ "path": MEMORY })) {
                Ok(note) => {
                    let body = note["text"].as_str().unwrap_or_default();
                    if body.contains(&fact) {
                        return Ok("already remembered".into());
                    }
                    let gap = if body.ends_with('\n') || body.is_empty() { "" } else { "\n" };
                    let heading = if body.contains(REMEMBERED) { String::new() } else { format!("\n{REMEMBERED}\n\n") };
                    call(
                        "note.write",
                        json!({ "path": MEMORY, "text": format!("{body}{gap}{heading}{line}\n"), "eol": "lf", "expected_hash": note["hash"] }),
                    )?;
                }
                Err(_) => {
                    let start = format!("# Assistant\n\nWhat the assistant should know and how it should work here. Edit this freely.\n\n{REMEMBERED}\n\n{line}\n");
                    call("note.create", json!({ "path": MEMORY, "text": start }))?;
                }
            }
            Ok(format!("remembered in {MEMORY}"))
        }
        "list_customers" => {
            // Read what is on disk now: a customer recorded a moment ago must be in the list.
            if let Ok(mut index) = core.index() {
                let _ = index.refresh();
            }
            let rows = call("props.rows", json!({ "folder": lokus_core::ingest::CUSTOMERS, "deep": true }))?;
            Ok(customers(rows.as_array().map(Vec::as_slice).unwrap_or_default()))
        }
        "record_customer" => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let mut wrote = lokus_core::ingest::apply(&core.vault, input, now).map_err(|e| e.to_string())?;
            // A conversation arrives as many events; each is filed like a single one would be.
            let many = input["events"].as_array().cloned().unwrap_or_default();
            if many.len() > 50 {
                return Err("at most 50 events in one call; send the rest in another".into());
            }
            for event in many {
                let fact = json!({ "customer": input["customer"], "name": input["name"], "source": input["source"], "event": event });
                wrote.extend(lokus_core::ingest::apply(&core.vault, &fact, now).map_err(|e| e.to_string())?);
            }
            wrote.dedup();
            Ok(if wrote.is_empty() {
                "nothing changed: this was already recorded".to_string()
            } else {
                format!("recorded in: {}", wrote.join(", "))
            })
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
    fn a_customer_is_recorded_once_and_then_listed_with_what_is_known() {
        let dir = tempfile::tempdir().unwrap();
        let core = Core::open(dir.path()).unwrap();
        assert!(run(&core, "list_customers", &json!({})).unwrap().contains("no customers yet"));

        let fact = json!({
            "customer": "acme.com", "name": "Acme", "source": "slack",
            "set": { "plan": "Scale", "health": "at risk" },
            "event": { "id": "m1", "kind": "issue", "title": "Export fails", "status": "todo", "from": "Dana" },
            "person": { "name": "Dana Whitlock", "role": "Head of Ops" },
        });
        let wrote = run(&core, "record_customer", &fact).unwrap();
        assert!(wrote.contains("customers/Acme.md") && wrote.contains("people/Dana Whitlock.md"), "{wrote}");
        assert!(run(&core, "record_customer", &fact).unwrap().contains("nothing changed"));
        // A whole conversation in one call: every message is kept, in the customer's folder.
        let talk = json!({ "customer": "acme.com", "source": "slack", "events": [
            { "id": "t1", "kind": "message", "thread": "export", "direction": "in", "from": "Dana", "text": "Any update on the export?" },
            { "id": "t2", "kind": "message", "thread": "export", "direction": "out", "from": "Pratham", "text": "Shipping Friday." },
        ] });
        let kept = run(&core, "record_customer", &talk).unwrap();
        assert!(kept.contains("slack-t1.md") && kept.contains("slack-t2.md"), "{kept}");
        // A fact that makes no sense comes back as something the model can act on.
        assert!(run(&core, "record_customer", &json!({ "set": {} })).is_err());

        // Work is tracked as tasks, numbered, tied to the customer, and updated rather than repeated.
        assert!(run(&core, "list_tasks", &json!({})).unwrap().contains("no open tasks"));
        let made = run(&core, "record_task", &json!({ "title": "Fix the export", "priority": "high", "customer": "Acme", "labels": ["bug", "churn-risk"] })).unwrap();
        assert_eq!(made, "T-1 is at tasks/Fix the export.md");
        run(&core, "record_task", &json!({ "title": "Write the audit log", "priority": "low" })).unwrap();
        run(&core, "record_task", &json!({ "key": "T-2", "status": "done" })).unwrap();
        let board = run(&core, "list_tasks", &json!({})).unwrap();
        assert!(board.starts_with("1 tasks (1 finished ones not shown)."), "{board}");
        assert!(board.contains("T-1 Fix the export; status todo; priority high; customer Acme; labels bug, churn-risk"), "{board}");

        // What it is told to remember is kept once, in a note the person can read.
        run(&core, "remember", &json!({ "fact": "Pratham owns the  Acme account." })).unwrap();
        run(&core, "remember", &json!({ "fact": "Replies to customers are drafted, never sent." })).unwrap();
        assert_eq!(run(&core, "remember", &json!({ "fact": "Pratham owns the Acme account." })).unwrap(), "already remembered");
        let memory = std::fs::read_to_string(dir.path().join("Assistant.md")).unwrap();
        assert_eq!(memory.matches("## Remembered").count(), 1, "{memory}");
        assert_eq!(memory.matches("\n- ").count(), 2, "{memory}");

        let listed = run(&core, "list_customers", &json!({})).unwrap();
        assert!(listed.starts_with("1 customers."), "{listed}");
        assert!(listed.contains("Acme (customers/Acme.md)") && listed.contains("plan: Scale"), "{listed}");
        assert!(listed.contains("1 open issues") && listed.contains("Details in use: domain, health, plan"), "{listed}");
    }

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

    #[test]
    fn a_long_note_is_read_in_parts_that_join_back_exactly() {
        let body: String = (1..=4000).map(|n| format!("line {n} of a long note\n")).collect();
        let first = read_part(&body, 1).unwrap();
        assert!(first.len() <= READ_CHARS + 80);
        let next: usize = first.rsplit("from_line=").next().unwrap().trim_end_matches(".]").parse().unwrap();
        let mut joined: String = first.rsplit_once("[Lines").unwrap().0.to_string();
        let mut from = next;
        loop {
            let part = read_part(&body, from).unwrap();
            let (text, note) = part.rsplit_once("[Lines").unwrap();
            joined.push_str(text);
            match note.rsplit_once("from_line=") {
                Some((_, n)) => from = n.trim_end_matches(".]").parse().unwrap(),
                None => break,
            }
        }
        assert_eq!(joined, body);
        assert_eq!(read_part("short\n", 1).unwrap(), "short\n");
        assert!(read_part("short\n", 9).is_err());
    }

    #[test]
    fn a_folder_lists_only_what_is_directly_inside_it() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("work/old")).unwrap();
        std::fs::write(dir.path().join("Home.md"), "x").unwrap();
        std::fs::write(dir.path().join("work/Plan.md"), "x").unwrap();
        std::fs::write(dir.path().join("work/old/Then.md"), "x").unwrap();
        let core = Core::open(dir.path()).unwrap();
        let top = run(&core, "list_folder", &json!({})).unwrap();
        assert_eq!(top, "work/  (2 notes)\nHome.md");
        let work = run(&core, "list_folder", &json!({ "path": "work" })).unwrap();
        assert_eq!(work, "work/old/  (1 notes)\nwork/Plan.md");
        assert!(run(&core, "list_folder", &json!({ "path": "nope" })).is_err());
    }
}

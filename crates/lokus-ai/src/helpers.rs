//! @part-of ai
//! Helpers: separate conversations the assistant hands read-heavy work to. Each is the same
//! loop (`chat::send`) started from a brief instead of the conversation, may only read, and
//! keeps its whole work in one file beside the chat (`.lokus/chats/<chat>.helpers/<id>.json`)
//! so it can be asked again, read or stopped by its id, also after Lokus restarts.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};

use lokus_core::Core;
use serde_json::{json, Value};
use tokio::sync::{watch, Notify, Semaphore};

use crate::chat::{Emitter, Event, Request};
use crate::config::{Config, McpServer};
use crate::tools::Tool;
use crate::web::Web;

/// How many helpers work at the same time, so the model's provider is not flooded.
const AT_ONCE: usize = 4;
/// How many times a helper may ask the model: in a normal chat, and in research.
const ROUNDS: usize = 40;
const RESEARCH_ROUNDS: usize = 300;
/// The most of a helper's answer handed back; the rest is read with `helper_read`.
const ANSWER_CHARS: usize = 6_000;
/// How much of a helper's work one `helper_read` returns.
const PART_CHARS: usize = 12_000;
/// The four things a task must say. A brief missing one is refused before anything runs.
const FIELDS: [&str; 4] = ["goal", "context", "look_in", "return"];

pub const NAMES: [&str; 4] = ["delegate", "helper_send", "helper_read", "helper_stop"];
pub const FINDINGS: &str = "write_findings";
/// Vault tools that are not marked as changing anything but do leave something behind.
pub const LEAVES_A_MARK: [&str; 3] = ["report_finding", "suggest_note_change", "remember"];

/// What makes a run of the loop a helper's: where its work is kept, how long it may go, and
/// the one note it may write (research only).
#[derive(Clone)]
pub struct Role {
    pub file: PathBuf,
    pub rounds: usize,
    pub findings: Option<String>,
}

/// Everything a helper is started with, taken from the assistant's own request.
#[derive(Clone)]
pub struct Launch {
    pub config: Config,
    pub core: Arc<Core>,
    pub extra_servers: Vec<McpServer>,
    pub briefing: String,
    pub web: Option<Web>,
    pub emit: Emitter,
    /// The conversation the helpers belong to.
    pub chat: String,
}

struct Live {
    stop: watch::Sender<bool>,
    done: watch::Receiver<bool>,
}

struct Room {
    live: HashMap<String, Live>,
    gate: Arc<Semaphore>,
    /// What the person wrote while the assistant was working, not yet handed to it.
    said: Vec<String>,
    spoke: Arc<Notify>,
}

impl Default for Room {
    fn default() -> Self {
        Self {
            live: HashMap::new(),
            gate: Arc::new(Semaphore::new(AT_ONCE)),
            said: Vec::new(),
            spoke: Arc::new(Notify::new()),
        }
    }
}

/// One room per conversation that has work running, by its folder of helper files.
static ROOMS: LazyLock<Mutex<HashMap<PathBuf, Room>>> = LazyLock::new(Default::default);

fn room<T>(dir: &Path, with: impl FnOnce(&mut Room) -> T) -> T {
    let mut rooms = ROOMS.lock().unwrap_or_else(|e| e.into_inner());
    with(rooms.entry(dir.to_path_buf()).or_default())
}

/// Where a conversation's helpers keep their work.
pub fn dir(core: &Core, chat: &str) -> PathBuf {
    let safe: String = chat
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .collect();
    core.vault
        .root()
        .join(lokus_core::vault::META_DIR)
        .join("chats")
        .join(format!("{safe}.helpers"))
}

fn file(dir: &Path, id: &str) -> Result<PathBuf, String> {
    let n = id.strip_prefix('h').and_then(|n| n.parse::<u32>().ok());
    match n {
        Some(n) => Ok(dir.join(format!("h{n}.json"))),
        None => Err(format!("'{id}' is not a helper's id; ids look like h1, h2")),
    }
}

fn load(dir: &Path, id: &str) -> Result<Value, String> {
    std::fs::read_to_string(file(dir, id)?)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .ok_or_else(|| format!("there is no helper {id} in this conversation"))
}

fn save(path: &Path, work: &Value) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = lokus_core::vault::write_atomic(path, work.to_string().as_bytes());
}

fn change(path: &Path, with: impl FnOnce(&mut Value)) {
    static ONE: Mutex<()> = Mutex::new(());
    let _one = ONE.lock().unwrap_or_else(|e| e.into_inner());
    let Some(mut work) = std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
    else {
        return;
    };
    with(&mut work);
    save(path, &work);
}

/// Keep a helper's conversation as it stands. Called by the loop after every step, so a helper
/// that is stopped, or cut off by Lokus closing, has lost nothing it read.
pub fn keep(role: &Role, messages: &[Value]) {
    change(&role.file, |work| work["messages"] = json!(messages));
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn tools() -> Vec<Tool> {
    let tool = |name: &str, description: &str, properties: Value, required: &[&str]| Tool {
        name: name.into(),
        description: description.into(),
        schema: json!({ "type": "object", "properties": properties, "required": required, "additionalProperties": false }),
        writes: false,
    };
    let id = json!({ "type": "string", "description": "The helper's id, e.g. h2" });
    vec![
        tool(
            "delegate",
            "Start helpers: each is a separate assistant with a fresh context that reads what you point it at and \
             returns a short answer. All tasks in one call run at the same time (four at once; more wait their turn). \
             Returns each helper's id and answer when all have finished. A helper knows nothing of this conversation: \
             everything it needs must be in its task. Helpers only read; you make every change yourself.",
            json!({ "tasks": { "type": "array", "minItems": 1, "items": { "type": "object", "properties": {
                "name": { "type": "string", "description": "Two to four words the person sees, e.g. Customers A–F" },
                "goal": { "type": "string", "description": "What to find out or produce." },
                "context": { "type": "string", "description": "What the helper must know that only this conversation holds." },
                "look_in": { "type": "string", "description": "Where to look: folders, notes, a connected service, the web. Give each helper its own slice so no two read the same thing." },
                "return": { "type": "string", "description": "The exact shape wanted back." },
                "findings": { "type": "string", "description": "Research only: the note this helper writes its findings to, e.g. research/missed-follow-ups/customers-a-f.md" },
            }, "required": ["name", "goal", "context", "look_in", "return"], "additionalProperties": false } } }),
            &["tasks"],
        ),
        tool(
            "helper_send",
            "Send a further message to a helper. It keeps everything it has already read, so a follow-up or a \
             correction costs no re-reading. Use this instead of starting a new helper when an answer is thin.",
            json!({ "id": id, "message": { "type": "string" } }),
            &["id", "message"],
        ),
        tool(
            "helper_read",
            "Read a helper's full work, every step and result, in parts. For when its short answer is not enough or \
             looks wrong. wait=true first waits for a helper that is still working.",
            json!({ "id": id, "part": { "type": "integer", "description": "Which part, from 1. Leave out for the first." }, "wait": { "type": "boolean" } }),
            &["id"],
        ),
        tool(
            "helper_stop",
            "Stop a helper that is still working and get what it has so far.",
            json!({ "id": id }),
            &["id"],
        ),
    ]
}

pub fn findings_tool() -> Tool {
    Tool {
        name: FINDINGS.into(),
        description: "Write your findings note. This is the only thing you can write; calling it again replaces what you wrote before. Give every claim its source: a note's path or a web link.".into(),
        schema: json!({ "type": "object", "properties": { "text": { "type": "string", "description": "The whole note, in Markdown." } }, "required": ["text"], "additionalProperties": false }),
        writes: false,
    }
}

/// Write a helper's findings note: the one path it was given, nothing else.
pub fn write_findings(core: &Core, role: &Role, input: &Value) -> Result<String, String> {
    let (Some(path), Some(text)) = (role.findings.as_deref(), input["text"].as_str()) else {
        return Err("'text' must be the note's Markdown".into());
    };
    let run = |command: &str, args: Value| {
        lokus_core::commands::run(core, command, args).map_err(|e| e.to_string())
    };
    if run("note.read", json!({ "path": path })).is_ok() {
        run("note.write", json!({ "path": path, "text": text }))?;
    } else {
        run("note.create", json!({ "path": path, "text": text }))?;
    }
    change(&role.file, |work| work["wrote"] = json!(true));
    Ok(format!("wrote {path}"))
}

/// The first message of a helper's conversation.
fn brief(task: &Value, findings: Option<&str>) -> String {
    let field = |name: &str| task[name].as_str().unwrap_or_default().trim().to_string();
    let notes = match findings {
        Some(path) => format!(
            "\n\nWrite what you find, with the source of every claim (a note's path or a web link), into your findings note with write_findings; it is saved as {path}. That note is the only thing you can write. Then answer with a short summary and the note's path."
        ),
        None => String::new(),
    };
    format!(
        "You are a helper working for the assistant in Lokus, not talking to the person. You start knowing only what is written here. You can read: notes, tasks, customers, connected services, the web. You cannot change anything, start helpers or ask questions; if something should change, say so in your answer and the assistant will do it.\n\n\
         Goal: {}\n\nWhat you need to know: {}\n\nWhere to look: {}\n\nWhat to return: {}{notes}\n\n\
         Stay inside where you were told to look. Name the note path or link each fact came from. Your final message is all that is handed back: keep it under {ANSWER_CHARS} characters, in the shape asked for, with no preamble.",
        field("goal"), field("context"), field("look_in"), field("return"),
    )
}

/// What is wrong with a task, if anything: a field missing, or too thin to work from.
fn refuse(task: &Value, research: bool) -> Option<String> {
    for name in FIELDS {
        let said = task[name].as_str().unwrap_or_default().trim();
        if said.split_whitespace().count() < 2 {
            return Some(format!("'{name}' is missing or says too little"));
        }
    }
    match task["findings"].as_str() {
        Some(_) if !research => Some("'findings' is only for research mode; call research_stage first".into()),
        Some(path) if !(path.starts_with("research/") && path.ends_with(".md") && !path.contains("..")) => {
            Some("'findings' must be a note under research/, e.g. research/topic/part.md".into())
        }
        _ => None,
    }
}

fn last_answer(messages: &[Value]) -> String {
    messages
        .iter()
        .rev()
        .find(|m| m["role"] == "assistant")
        .and_then(|m| m["content"].as_array())
        .map(|blocks| {
            blocks
                .iter()
                .filter(|b| b["type"] == "text")
                .filter_map(|b| b["text"].as_str())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

fn capped(id: &str, answer: &str) -> String {
    if answer.chars().count() <= ANSWER_CHARS {
        return answer.to_string();
    }
    let head: String = answer.chars().take(ANSWER_CHARS).collect();
    format!("{head}\n[Cut here. helper_read {id} has the rest.]")
}

fn steps(messages: &[Value]) -> usize {
    messages
        .iter()
        .filter_map(|m| m["content"].as_array())
        .flatten()
        .filter(|b| b["type"] == "tool_use")
        .count()
}

/// What the window is told about a helper, live and when its work is opened later.
fn seen(work: &Value, state: &str, tool: Option<(&str, &Value)>) -> Event {
    Event::Helper {
        id: work["id"].as_str().unwrap_or_default().into(),
        name: work["name"].as_str().unwrap_or_default().into(),
        call: work["call"].as_str().unwrap_or_default().into(),
        state: state.into(),
        tool: tool.map(|(name, _)| name.to_string()),
        input: tool.map(|(_, input)| input.clone()),
        asked: work["asked"].as_u64().unwrap_or(0),
        error: work["error"].as_str().map(str::to_string),
    }
}

/// Run one helper to its end: wait for a free place, run the loop, keep what came of it.
async fn work(launch: Launch, dir: PathBuf, id: String, mut stop: watch::Receiver<bool>) -> String {
    let path = dir.join(format!("{id}.json"));
    let read = || -> Value {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or_default()
    };
    let start = read();
    let gate = room(&dir, |r| r.gate.clone());
    (launch.emit)(seen(&start, "waiting", None));
    let stopped = async {
        let _ = stop.wait_for(|s| *s).await.is_ok();
    };
    let role = Role {
        file: path.clone(),
        rounds: if start["research"] == true { RESEARCH_ROUNDS } else { ROUNDS },
        findings: start["findings"].as_str().map(str::to_string),
    };
    let run = async {
        let _place = gate.acquire().await;
        change(&path, |w| w["state"] = json!("running"));
        (launch.emit)(seen(&start, "running", None));
        let (emit, about) = (launch.emit.clone(), start.clone());
        let inner: Emitter = Arc::new(move |event| {
            if let Event::Tool { name, input, .. } = event {
                emit(seen(&about, "running", Some((&name, &input))));
            }
        });
        let request = Request {
            config: launch.config.clone(),
            messages: start["messages"].as_array().cloned().unwrap_or_default(),
            core: Some(launch.core.clone()),
            extra_servers: launch.extra_servers.clone(),
            briefing: launch.briefing.clone(),
            app: None,
            used: 0,
            unattended: true,
            web: launch.web.clone(),
            chat: None,
            helper: Some(role),
        };
        // Nobody is asked on a helper's behalf: it has nothing that needs a yes.
        let no: crate::chat::Approver = Arc::new(|_| {
            let (answer, wait) = tokio::sync::oneshot::channel();
            let _ = answer.send(false);
            wait
        });
        crate::chat::send_boxed(request, inner, no).await
    };
    let outcome = tokio::select! {
        outcome = run => Some(outcome),
        () = stopped => None,
    };
    let messages = read()["messages"].as_array().cloned().unwrap_or_default();
    let (state, answer, error) = match outcome {
        Some(Ok(outcome)) if outcome.stop == "step_limit" => (
            "done",
            format!("{}\n[This helper reached its limit of steps before finishing. helper_send {id} to have it carry on.]", last_answer(&messages)),
            None,
        ),
        Some(Ok(_)) => ("done", last_answer(&messages), None),
        Some(Err(e)) => ("failed", String::new(), Some(e.to_string())),
        None => ("stopped", last_answer(&messages), None),
    };
    change(&path, |w| {
        w["state"] = json!(state);
        w["answer"] = json!(answer);
        w["error"] = json!(error);
        w["ended"] = json!(now());
    });
    let ended = read();
    (launch.emit)(seen(&ended, state, None));
    report(&ended)
}

/// What the assistant is told about a helper that has stopped working, one way or another.
fn report(work: &Value) -> String {
    let id = work["id"].as_str().unwrap_or_default();
    let name = work["name"].as_str().unwrap_or_default();
    let count = steps(work["messages"].as_array().map(Vec::as_slice).unwrap_or_default());
    let count = format!("{count} {}", if count == 1 { "step" } else { "steps" });
    let answer = capped(id, work["answer"].as_str().unwrap_or_default());
    match work["state"].as_str().unwrap_or_default() {
        "done" => format!("## {id} ({name}): done, {count}\n{answer}"),
        "failed" => format!(
            "## {id} ({name}): failed after {count}: {}\nNothing was returned. helper_read {id} shows what it had read; helper_send {id} tries again from there, or do this part yourself.",
            work["error"].as_str().unwrap_or("unknown reason")
        ),
        "stopped" => format!(
            "## {id} ({name}): stopped after {count}\n{}",
            if answer.trim().is_empty() { format!("It had not answered yet. helper_read {id} shows what it had read.") } else { answer }
        ),
        _ => format!("## {id} ({name}): still working, {count} so far"),
    }
}

/// Start a helper's task in the background and note it as running.
fn begin(launch: &Launch, dir: &Path, id: &str) -> watch::Receiver<bool> {
    let (stop, stopping) = watch::channel(false);
    let (finished, done) = watch::channel(false);
    room(dir, |r| r.live.insert(id.to_string(), Live { stop, done: done.clone() }));
    let (launch, dir, id) = (launch.clone(), dir.to_path_buf(), id.to_string());
    tokio::spawn(async move {
        work(launch, dir.clone(), id.clone(), stopping).await;
        room(&dir, |r| r.live.remove(&id));
        let _ = finished.send(true);
    });
    done
}

/// Wait for helpers to finish. Ends early, saying who is still working, when the person
/// writes something: the assistant should read that before the helpers go further.
async fn wait(dir: &Path, ids: &[String], mut done: Vec<watch::Receiver<bool>>) -> String {
    let spoke = room(dir, |r| r.spoke.clone());
    let all = futures_util::future::join_all(done.iter_mut().map(|d| async move {
        d.wait_for(|d| *d).await.is_ok()
    }));
    let interrupted = tokio::select! {
        _ = all => false,
        () = spoke.notified() => true,
    };
    let mut out: Vec<String> = ids
        .iter()
        .map(|id| load(dir, id).map(|w| report(&w)).unwrap_or_else(|e| e))
        .collect();
    if interrupted {
        out.push("The person wrote a message while helpers were still working; they carry on meanwhile. Read the message, then helper_stop the ones that should end, or helper_read with wait=true to wait for the rest.".into());
    }
    out.join("\n\n")
}

pub async fn delegate(launch: &Launch, call: &str, input: &Value, research: bool) -> Result<String, String> {
    let tasks = input["tasks"].as_array().filter(|t| !t.is_empty()).ok_or("'tasks' must list at least one task")?;
    let wrong: Vec<String> = tasks
        .iter()
        .enumerate()
        .filter_map(|(n, task)| refuse(task, research).map(|why| format!("task {}: {why}", n + 1)))
        .collect();
    if !wrong.is_empty() {
        return Err(format!(
            "No helper was started. Every task needs goal, context, look_in and return, each written out so a helper that knows nothing else could do it. {}",
            wrong.join("; ")
        ));
    }
    let dir = dir(&launch.core, &launch.chat);
    let _ = std::fs::create_dir_all(&dir);
    // Ids count up and are never used twice, whatever became of the earlier helpers.
    static NUMBERING: Mutex<()> = Mutex::new(());
    let ids: Vec<String> = {
        let _one = NUMBERING.lock().unwrap_or_else(|e| e.into_inner());
        let highest = std::fs::read_dir(&dir)
            .into_iter()
            .flatten()
            .filter_map(|e| e.ok()?.file_name().to_str()?.strip_prefix('h')?.strip_suffix(".json")?.parse::<u32>().ok())
            .max()
            .unwrap_or(0);
        tasks
            .iter()
            .enumerate()
            .map(|(n, task)| {
                let id = format!("h{}", highest + 1 + n as u32);
                let findings = task["findings"].as_str();
                let name: String = task["name"].as_str().unwrap_or_default().trim().chars().take(40).collect();
                save(&dir.join(format!("{id}.json")), &json!({
                    "id": id,
                    "name": if name.is_empty() { format!("Helper {id}") } else { name },
                    "call": call,
                    "task": task,
                    "research": research,
                    "findings": findings,
                    "state": "waiting",
                    "asked": 0,
                    "started": now(),
                    "messages": [{ "role": "user", "content": brief(task, findings) }],
                }));
                id
            })
            .collect()
    };
    let done = ids.iter().map(|id| begin(launch, &dir, id)).collect();
    Ok(wait(&dir, &ids, done).await)
}

pub async fn send(launch: &Launch, input: &Value) -> Result<String, String> {
    let id = input["id"].as_str().unwrap_or_default().to_string();
    let message = input["message"].as_str().unwrap_or_default().trim();
    let dir = dir(&launch.core, &launch.chat);
    let work = load(&dir, &id)?;
    if message.is_empty() {
        return Err("'message' must say what the helper should do next".into());
    }
    if room(&dir, |r| r.live.contains_key(&id)) {
        return Err(format!("{id} is still working. helper_read with wait=true waits for it; helper_stop ends it."));
    }
    let mut messages = work["messages"].as_array().cloned().unwrap_or_default();
    // A conversation that ended on a request (it was stopped, or failed) is carried on in the
    // same message, since two requests in a row are not a conversation a model accepts.
    match messages.last_mut().filter(|m| m["role"] == "user") {
        Some(last) => {
            let mut blocks = match &last["content"] {
                Value::String(text) => vec![json!({ "type": "text", "text": text })],
                other => other.as_array().cloned().unwrap_or_default(),
            };
            blocks.push(json!({ "type": "text", "text": message }));
            last["content"] = json!(blocks);
        }
        None => messages.push(json!({ "role": "user", "content": message })),
    }
    change(&file(&dir, &id)?, |w| {
        w["messages"] = json!(messages);
        w["asked"] = json!(w["asked"].as_u64().unwrap_or(0) + 1);
        w["state"] = json!("waiting");
        w["ended"] = Value::Null;
        w["error"] = Value::Null;
        w["restarted"] = json!(now());
    });
    let done = begin(launch, &dir, &id);
    Ok(wait(&dir, &[id], vec![done]).await)
}

/// A helper's whole work as text: its brief, then every step with what came back.
fn transcript(work: &Value) -> String {
    let mut out = String::new();
    for message in work["messages"].as_array().into_iter().flatten() {
        let who = if message["role"] == "assistant" { "Helper" } else { "Asked" };
        match &message["content"] {
            Value::String(text) => out.push_str(&format!("{who}: {text}\n\n")),
            blocks => {
                for block in blocks.as_array().into_iter().flatten() {
                    match block["type"].as_str() {
                        Some("text") => out.push_str(&format!("{who}: {}\n\n", block["text"].as_str().unwrap_or_default())),
                        Some("tool_use") => out.push_str(&format!("Step: {} {}\n", block["name"].as_str().unwrap_or_default(), block["input"])),
                        Some("tool_result") => out.push_str(&format!("Result: {}\n\n", block["content"].as_str().unwrap_or_default())),
                        _ => {}
                    }
                }
            }
        }
    }
    out
}

pub async fn read(launch: &Launch, input: &Value) -> Result<String, String> {
    let id = input["id"].as_str().unwrap_or_default().to_string();
    let dir = dir(&launch.core, &launch.chat);
    load(&dir, &id)?;
    if input["wait"] == true {
        if let Some(done) = room(&dir, |r| r.live.get(&id).map(|l| l.done.clone())) {
            return Ok(wait(&dir, &[id], vec![done]).await);
        }
    }
    let work = load(&dir, &id)?;
    let text: Vec<char> = transcript(&work).chars().collect();
    let parts = text.len().div_ceil(PART_CHARS).max(1);
    let part = (input["part"].as_u64().unwrap_or(1).max(1) as usize).min(parts);
    let slice: String = text.iter().skip((part - 1) * PART_CHARS).take(PART_CHARS).collect();
    Ok(format!(
        "{id} ({}): {}. Part {part} of {parts}.\n\n{slice}",
        work["name"].as_str().unwrap_or_default(),
        work["state"].as_str().unwrap_or_default(),
    ))
}

/// Stop one helper and wait for it to put down what it has.
pub async fn stop(dir: &Path, id: &str) -> Result<String, String> {
    load(dir, id)?;
    let live = room(dir, |r| r.live.get(id).map(|l| (l.stop.clone(), l.done.clone())));
    if let Some((stop, mut done)) = live {
        let _ = stop.send(true);
        let _ = done.wait_for(|d| *d).await.is_ok();
    }
    Ok(report(&load(dir, id)?))
}

/// Stop every helper of a conversation. Their work so far stays in their files.
pub fn stop_all(dir: &Path) {
    room(dir, |r| {
        for live in r.live.values() {
            let _ = live.stop.send(true);
        }
    });
}

/// The person wrote while the assistant was working: hand it over at its next step.
pub fn say(dir: &Path, text: &str) {
    room(dir, |r| {
        r.said.push(text.to_string());
        r.spoke.notify_waiters();
    });
}

pub fn said(dir: &Path) -> Vec<String> {
    room(dir, |r| std::mem::take(&mut r.said))
}

/// Ends a conversation's helpers when the assistant's own run ends, however it ends: finished,
/// failed, or stopped by the person (its task is dropped, and this with it).
pub struct Ending(pub PathBuf);

impl Drop for Ending {
    fn drop(&mut self) {
        stop_all(&self.0);
        room(&self.0, |r| r.said.clear());
    }
}

/// A conversation's helpers for the window: each one's name, state and numbers, oldest first.
/// With `id`, that helper's brief, steps and answer as well.
pub fn list(core: &Core, chat: &str, id: Option<&str>) -> Value {
    let dir = dir(core, chat);
    let mut found: Vec<(u32, Value)> = std::fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| {
            let name = e.ok()?.file_name();
            let n = name.to_str()?.strip_prefix('h')?.strip_suffix(".json")?.parse::<u32>().ok()?;
            let hid = format!("h{n}");
            if id.is_some_and(|id| id != hid) {
                return None;
            }
            let work = load(&dir, &hid).ok()?;
            let messages = work["messages"].as_array().cloned().unwrap_or_default();
            // A helper that was working when Lokus closed did not finish: say so.
            let live = room(&dir, |r| r.live.contains_key(&hid));
            let state = match work["state"].as_str().unwrap_or_default() {
                "running" | "waiting" if !live => "stopped",
                other => other,
            };
            let began = work["restarted"].as_u64().or(work["started"].as_u64()).unwrap_or(0);
            let mut out = json!({
                "id": hid,
                "name": work["name"],
                "call": work["call"],
                "state": state,
                "asked": work["asked"],
                "error": work["error"],
                "steps": steps(&messages),
                "began": began,
                "ended": work["ended"],
                "findings": if work["wrote"] == true { work["findings"].clone() } else { Value::Null },
            });
            if id.is_some() {
                let calls: Vec<Value> = messages
                    .iter()
                    .filter_map(|m| m["content"].as_array())
                    .flatten()
                    .filter(|b| b["type"] == "tool_use")
                    .map(|b| json!({ "name": b["name"], "input": b["input"] }))
                    .collect();
                out["task"] = work["task"].clone();
                out["calls"] = json!(calls);
                out["answer"] = work["answer"].clone();
            }
            Some((n, out))
        })
        .collect();
    found.sort_by_key(|(n, _)| *n);
    json!(found.into_iter().map(|(_, v)| v).collect::<Vec<_>>())
}

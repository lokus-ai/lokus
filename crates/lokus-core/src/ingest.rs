//! @part-of core
//! Facts a team's own systems send about its customers, written into the vault.
//!
//! A fact names a customer and carries any of: details to set, one thing that happened, and a
//! person at that customer. Applying the same fact twice changes nothing the second time, so a
//! sender may retry freely. Everything lands as plain notes: the customer's own note, one small
//! note per thing that happened in the folder beside it, and one note per person.

use serde_json::{json, Value};

use crate::error::{CoreError, Result};
use crate::frontmatter;
use crate::vault::{Eol, Vault};

/// Where customers and the people at them are kept.
pub const CUSTOMERS: &str = "customers";
pub const PEOPLE: &str = "people";

/// Details a sender may not set: they say what a note is, not what is known about a customer.
const RESERVED: [&str; 4] = ["type", "view", "source", "summary"];
const MAX_NAME: usize = 120;
const MAX_TITLE: usize = 300;
const MAX_TEXT: usize = 16 * 1024;
const MAX_DETAILS: usize = 50;

pub(crate) fn bad(message: impl Into<String>) -> CoreError {
    CoreError::BadArgs {
        command: "ingest".into(),
        message: message.into(),
    }
}

/// A name that is safe as a file name: no path separators, no control characters, not hidden.
pub(crate) fn file_name(raw: &str) -> Result<String> {
    let cleaned: String = raw
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    let mut cleaned = cleaned;
    while cleaned.contains("..") {
        cleaned = cleaned.replace("..", ".");
    }
    // No dot at the end either: "Acme Inc." would otherwise become the file "Acme Inc..md".
    let cleaned = cleaned.trim().trim_start_matches(['.', '-']).trim_end_matches('.').trim().to_string();
    if cleaned.is_empty() || cleaned.chars().count() > MAX_NAME {
        return Err(bad("a name must be 1 to 120 characters"));
    }
    Ok(cleaned)
}

/// A detail's name as it is stored: lower case, words joined by `_`.
pub(crate) fn detail_key(raw: &str) -> Result<String> {
    let key: String = raw
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c == ' ' || c == '-' { '_' } else { c })
        .collect();
    let ok = !key.is_empty()
        && key.len() <= 40
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        && !RESERVED.contains(&key.as_str());
    if ok {
        Ok(key)
    } else {
        Err(bad(format!("{raw:?} cannot be used as a detail's name")))
    }
}

/// A detail's value: text, a number or yes/no. Text is kept to one line.
fn detail_value(key: &str, value: &Value) -> Result<Value> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => Ok(value.clone()),
        Value::String(s) if s.chars().count() <= 500 => Ok(Value::String(
            s.split_whitespace().collect::<Vec<_>>().join(" "),
        )),
        _ => Err(bad(format!(
            "{key} must be text of up to 500 characters, a number or true/false"
        ))),
    }
}

pub(crate) fn text_of<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

pub(crate) fn stem(path: &str) -> &str {
    let name = path.rsplit('/').next().unwrap_or(path);
    name.strip_suffix(".md").unwrap_or(name)
}

pub(crate) fn same(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}

/// A value as a person reads it in a sentence.
pub(crate) fn plain(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Null => "nothing".into(),
        other => other.to_string(),
    }
}

/// A detail's name as people read it: `signed_up` is "Signed up".
pub(crate) fn label(key: &str) -> String {
    match key {
        "mrr" => return "Monthly revenue".into(),
        "arr" => return "Yearly revenue".into(),
        _ => {}
    }
    let spaced = key.replace('_', " ");
    let mut chars = spaced.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => spaced,
    }
}

/// Seconds since 1970 as `2026-11-13T21:40:05Z`.
pub fn iso(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let rest = secs.rem_euclid(86_400);
    // Civil date from a day count (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rest / 3_600,
        rest % 3_600 / 60,
        rest % 60
    )
}

/// A new note's text from its properties and body.
pub(crate) fn compose(props: &[(&str, Value)], body: &str) -> String {
    let mut text = String::new();
    for (key, value) in props {
        if !value.is_null() {
            text = frontmatter::set(&text, key, value);
        }
    }
    let body = body.trim();
    if body.is_empty() {
        text.trim_end().to_string() + "\n"
    } else {
        format!("{}\n\n{body}\n", text.trim_end())
    }
}

/// Set properties on a note that exists. Gives back whether anything changed.
pub(crate) fn update(vault: &Vault, path: &str, props: &[(&str, Value)]) -> Result<bool> {
    let note = vault.read(path)?;
    let mut text = note.text.clone();
    let had = frontmatter::read(&note.text);
    for (key, value) in props {
        if had.get(*key).unwrap_or(&Value::Null) != value {
            text = frontmatter::set(&text, key, value);
        }
    }
    if text == note.text {
        return Ok(false);
    }
    vault.write(path, &text, Eol::Lf, Some(&note.hash))?;
    Ok(true)
}

/// The customer a fact is about: matched by `domain`, by `id`, or by the note's name.
pub(crate) fn find_customer(vault: &Vault, key: &str) -> Result<Option<String>> {
    let prefix = format!("{CUSTOMERS}/");
    for path in vault.notes()? {
        let Some(rest) = path.strip_prefix(&prefix) else {
            continue;
        };
        if rest.contains('/') {
            continue;
        }
        let props = frontmatter::read(&vault.read(&path)?.text);
        if props.get("type").and_then(Value::as_str) != Some("customer") {
            continue;
        }
        let known = |name: &str| {
            props
                .get(name)
                .map(plain)
                .is_some_and(|value| same(&value, key))
        };
        if known("domain") || known("id") || same(stem(&path), key) {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

/// A domain is one word with a dot in it: `acme.com`.
fn looks_like_domain(key: &str) -> bool {
    key.contains('.')
        && !key.starts_with('.')
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
}

/// Keep something that happened, in the folder of whatever it happened to. Sent again, it is
/// the same event: only what moved on is changed.
pub(crate) fn write_event(vault: &Vault, folder: &str, source: &str, event: &Event, now: i64, changed: &mut Vec<String>) -> Result<()> {
    let id = event.id.clone().unwrap_or_else(|| {
        let seed = format!("{}|{}", event.title, event.at.as_deref().unwrap_or(""));
        blake3::hash(seed.as_bytes()).to_hex()[..12].to_string()
    });
    // An id that already starts with where it came from is not given that prefix twice.
    let named = if id.starts_with(&format!("{source}-")) { id.clone() } else { format!("{source}-{id}") };
    let note = format!("{folder}/{}.md", file_name(&named)?);
    let at = event.at.clone().unwrap_or_else(|| iso(now));
    let props = [
        ("kind", json!(event.kind)),
        ("source", json!(source)),
        ("title", json!(event.title)),
        ("from", opt(&event.from)),
        ("status", opt(&event.status)),
        ("thread", opt(&event.thread)),
        ("channel", opt(&event.channel)),
        ("direction", opt(&event.direction)),
        ("link", opt(&event.link)),
        ("at", json!(at)),
    ];
    let wrote = if vault.resolve(&note)?.exists() {
        // Sent again: it is the same thing, so only what moved on (a status, say) is set.
        // Its time stays as first recorded unless the sender states one: sending it again
        // later must not make it look as if it just happened.
        let moved: Vec<(&str, Value)> = props
            .iter()
            .filter(|(key, v)| !v.is_null() && (*key != "at" || event.at.is_some()))
            .cloned()
            .collect();
        update(vault, &note, &moved)?
    } else {
        vault.create(&note, &compose(&props, &event.text))?;
        true
    };
    if wrote {
        changed.push(note);
    }
    Ok(())
}

/// Write one fact into the vault. `now` is the time in seconds since 1970.
/// Gives back the notes it created or changed, the customer's own note first.
pub fn apply(vault: &Vault, fact: &Value, now: i64) -> Result<Vec<String>> {
    // A log line is kept in a file for its day; a thing of any other kind goes to `data/`.
    if fact.get("log").is_some() {
        crate::things::log(vault, fact, now)?;
        return Ok(Vec::new());
    }
    if text_of(fact, "kind").is_some_and(|kind| !same(kind, "customer")) {
        return crate::things::apply(vault, fact, now);
    }
    let key = text_of(fact, "customer").ok_or_else(|| bad("a fact names its customer"))?;
    if key.chars().count() > MAX_NAME {
        return Err(bad("the customer's name or domain is too long"));
    }
    let source = text_of(fact, "source").unwrap_or("admin");
    let mut changed = Vec::new();

    // Read the whole fact before writing any of it, so a bad one changes nothing.
    let mut details = Vec::new();
    if let Some(set) = fact.get("set") {
        let set = set.as_object().ok_or_else(|| bad("set is a list of details"))?;
        if set.len() > MAX_DETAILS {
            return Err(bad("too many details in one fact"));
        }
        for (raw, value) in set {
            let name = detail_key(raw)?;
            details.push((name.clone(), detail_value(&name, value)?));
        }
    }
    let task = match fact.get("task") {
        None | Some(Value::Null) => None,
        Some(task) if task.is_object() => Some(task.clone()),
        Some(_) => return Err(bad("a task is a list of details")),
    };
    let event = fact.get("event").map(read_event).transpose()?;
    let person = fact.get("person").map(read_person).transpose()?;

    let (path, created) = match find_customer(vault, key)? {
        Some(path) => (path, false),
        None => {
            let name = file_name(text_of(fact, "name").unwrap_or(key))?;
            let path = format!("{CUSTOMERS}/{name}.md");
            let mut props = vec![("type", json!("customer"))];
            if looks_like_domain(key) {
                props.push(("domain", json!(key)));
            } else if !same(&name, key) {
                props.push(("id", json!(key)));
            }
            vault.create(&path, &compose(&props, ""))?;
            (path, true)
        }
    };
    let name = stem(&path).to_string();
    let folder = format!("{CUSTOMERS}/{name}");

    let before = frontmatter::read(&vault.read(&path)?.text);
    let props: Vec<(&str, Value)> = details.iter().map(|(k, v)| (k.as_str(), v.clone())).collect();
    if update(vault, &path, &props)? || created {
        changed.push(path.clone());
    }
    // A detail that changed leaves a note saying so: that is its history.
    for (detail, value) in &details {
        let was = before.get(detail).unwrap_or(&Value::Null);
        if created || was.is_null() || was == value {
            continue;
        }
        let title = format!(
            "{} changed from {} to {}",
            label(detail),
            plain(was),
            plain(value)
        );
        let note = format!("{folder}/{source}-{detail}-{now}.md");
        let props = [
            ("kind", json!("event")),
            ("source", json!(source)),
            ("field", json!(detail)),
            ("title", json!(title)),
            ("at", json!(iso(now))),
        ];
        if vault.create(&note, &compose(&props, "")).is_ok() {
            changed.push(note);
        }
    }

    if let Some(event) = event {
        write_event(vault, &folder, source, &event, now, &mut changed)?;
    }

    // Work to be done for this customer: filed with the team's tasks, tied to the customer.
    if let Some(mut task) = task {
        task["customer"] = json!(name);
        let (task_path, _) = crate::tasks::record(vault, &task)?;
        changed.push(task_path);
    }

    if let Some(person) = person {
        let note = format!("{PEOPLE}/{}.md", file_name(&person.name)?);
        let mut props = vec![("type", json!("person")), ("customer", json!(name))];
        props.extend(person.details.iter().map(|(k, v)| (k.as_str(), v.clone())));
        let wrote = if vault.resolve(&note)?.exists() {
            update(vault, &note, &props)?
        } else {
            vault.create(&note, &compose(&props, ""))?;
            true
        };
        if wrote {
            changed.push(note);
        }
    }
    Ok(changed)
}

fn opt(value: &Option<String>) -> Value {
    value.as_ref().map_or(Value::Null, |v| json!(v))
}

pub(crate) struct Event {
    id: Option<String>,
    title: String,
    kind: String,
    at: Option<String>,
    from: Option<String>,
    status: Option<String>,
    thread: Option<String>,
    channel: Option<String>,
    direction: Option<String>,
    link: Option<String>,
    text: String,
}

pub(crate) fn read_event(value: &Value) -> Result<Event> {
    let line = |key: &str, most: usize| -> Result<Option<String>> {
        match text_of(value, key) {
            Some(text) if text.chars().count() > most => Err(bad(format!("{key} is too long"))),
            Some(text) => Ok(Some(text.split_whitespace().collect::<Vec<_>>().join(" "))),
            None => Ok(None),
        }
    };
    let text = value.get("text").and_then(Value::as_str).unwrap_or("").trim().to_string();
    if text.len() > MAX_TEXT {
        return Err(bad("the text is too long"));
    }
    let title = match line("title", MAX_TITLE)? {
        Some(title) => title,
        // A message's first line is what it is called.
        None => text
            .lines()
            .next()
            .map(|l| l.chars().take(MAX_TITLE).collect::<String>())
            .filter(|l| !l.trim().is_empty())
            .ok_or_else(|| bad("something that happened needs a title or text"))?,
    };
    let kind = match text_of(value, "kind").unwrap_or("event") {
        kind @ ("event" | "issue" | "message" | "meeting") => kind.to_string(),
        other => return Err(bad(format!("{other:?} is not event, issue, message or meeting"))),
    };
    let direction = match text_of(value, "direction") {
        None => None,
        Some(d @ ("in" | "out")) => Some(d.to_string()),
        Some(_) => return Err(bad("direction is in (from the customer) or out (from us)")),
    };
    let at = match line("at", 40)? {
        Some(at) if at.len() >= 10 && at.as_bytes()[..4].iter().all(u8::is_ascii_digit) => Some(at),
        Some(_) => return Err(bad("at is a date like 2026-11-13T21:40:05Z")),
        None => None,
    };
    Ok(Event {
        id: line("id", 80)?,
        title,
        kind,
        at,
        from: line("from", 120)?,
        status: line("status", 40)?,
        thread: line("thread", 120)?,
        channel: line("channel", 120)?,
        direction,
        link: line("link", 500)?.filter(|l| l.starts_with("https://") || l.starts_with("http://")),
        text,
    })
}

struct Person {
    name: String,
    details: Vec<(String, Value)>,
}

fn read_person(value: &Value) -> Result<Person> {
    let object = value.as_object().ok_or_else(|| bad("a person is a list of details"))?;
    let name = text_of(value, "name").ok_or_else(|| bad("a person needs a name"))?.to_string();
    let mut details = Vec::new();
    for (raw, detail) in object {
        if raw == "name" || raw == "customer" {
            continue;
        }
        let key = detail_key(raw)?;
        details.push((key.clone(), detail_value(&key, detail)?));
    }
    Ok(Person { name, details })
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
    fn a_fact_makes_the_customer_then_updates_it_with_history() {
        let (_dir, v) = vault();
        let first = json!({ "customer": "acme.com", "name": "Acme", "set": { "plan": "Growth", "MRR": 900 } });
        assert_eq!(apply(&v, &first, 100).unwrap(), ["customers/Acme.md"]);
        let made = props(&v, "customers/Acme.md");
        assert_eq!((made["type"].clone(), made["domain"].clone()), (json!("customer"), json!("acme.com")));
        assert_eq!((made["plan"].clone(), made["mrr"].clone()), (json!("Growth"), json!(900)));

        // The same fact again changes nothing, so a sender can retry.
        assert!(apply(&v, &first, 101).unwrap().is_empty());

        // A new value is set, and the change is written down beside the customer.
        let changed = apply(&v, &json!({ "customer": "ACME.com", "set": { "mrr": 1200 } }), 1_794_606_005).unwrap();
        assert_eq!(changed.len(), 2);
        assert_eq!(props(&v, "customers/Acme.md")["mrr"], json!(1200));
        let history = props(&v, &changed[1]);
        assert_eq!(history["field"], json!("mrr"));
        assert_eq!(history["title"], json!("Monthly revenue changed from 900 to 1200"));
        assert_eq!(history["at"], json!("2026-11-13T21:40:05Z"));
    }

    #[test]
    fn something_that_happened_is_kept_once_and_can_move_on() {
        let (_dir, v) = vault();
        let issue = |status: &str| {
            json!({ "customer": "Acme", "source": "linear",
                "event": { "id": "ENG-1", "kind": "issue", "title": "Export fails", "status": status, "from": "Dana", "text": "Third report." } })
        };
        let made = apply(&v, &issue("todo"), 100).unwrap();
        assert_eq!(made, ["customers/Acme.md", "customers/Acme/linear-ENG-1.md"]);
        assert!(v.read(&made[1]).unwrap().text.ends_with("\n\nThird report.\n"));
        // Sent again later, with no time of its own: still nothing changes.
        assert!(apply(&v, &issue("todo"), 5_000).unwrap().is_empty());
        assert_eq!(apply(&v, &issue("done"), 100).unwrap(), ["customers/Acme/linear-ENG-1.md"]);
        assert_eq!(props(&v, "customers/Acme/linear-ENG-1.md")["status"], json!("done"));
    }

    #[test]
    fn a_person_is_filed_under_the_customer_they_belong_to() {
        let (_dir, v) = vault();
        let fact = json!({ "customer": "Acme", "person": { "name": "Dana Whitlock", "email": "dana@acme.com", "role": "Head of Ops" } });
        apply(&v, &fact, 100).unwrap();
        // A name ending in a dot does not leave a doubled dot in the file's name.
        let made = apply(&v, &json!({ "customer": "Neuron Industries Inc.", "source": "slack", "event": { "id": "slack-C1-99", "title": "hello" } }), 100).unwrap();
        assert_eq!(made, ["customers/Neuron Industries Inc.md", "customers/Neuron Industries Inc/slack-C1-99.md"]);
        let dana = props(&v, "people/Dana Whitlock.md");
        assert_eq!((dana["type"].clone(), dana["customer"].clone()), (json!("person"), json!("Acme")));
        assert_eq!(dana["email"], json!("dana@acme.com"));
    }

    #[test]
    fn a_fact_cannot_reach_outside_its_place_or_break_a_note() {
        let (_dir, v) = vault();
        // A name is only ever a file name, never a path.
        let sneaky = json!({ "customer": "../../etc/passwd", "event": { "id": "../../x", "title": "t" } });
        let made = apply(&v, &sneaky, 100).unwrap();
        assert!(made.iter().all(|p| p.starts_with("customers/") && !p.contains("..")), "{made:?}");
        // A detail cannot change what a note is, and a bad fact writes nothing at all.
        for bad in [
            json!({ "customer": "Acme", "set": { "type": "note" } }),
            json!({ "customer": "Acme", "set": { "plan": { "nested": true } } }),
            json!({ "customer": "Acme", "set": { "ok": 1 }, "event": { "kind": "nonsense", "title": "t" } }),
            json!({ "set": { "plan": "x" } }),
        ] {
            assert!(apply(&v, &bad, 100).is_err(), "{bad}");
        }
        assert!(!v.resolve("customers/Acme.md").unwrap().exists());
        // Text that looks like properties stays text: it cannot start a second block.
        let loud = json!({ "customer": "Acme", "set": { "plan": "pro\n---\ntype: evil" } });
        apply(&v, &loud, 100).unwrap();
        let acme = props(&v, "customers/Acme.md");
        assert_eq!((acme["type"].clone(), acme["plan"].clone()), (json!("customer"), json!("pro --- type: evil")));
    }
}

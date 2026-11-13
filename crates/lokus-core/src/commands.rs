//! @part-of core.commands
//! Every core feature is a named command: JSON in, JSON out.
//!
//! The desktop app, the `lokus` CLI, plugins and AI tools all call
//! [`run`]. Adding a feature means adding one entry to [`COMMANDS`] and one
//! arm to [`run`].

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{CoreError, Result};
use crate::vault::Eol;
use crate::Core;

#[derive(Debug, Serialize, Clone, Copy)]
pub struct CommandSpec {
    pub name: &'static str,
    pub summary: &'static str,
    /// Human-readable argument shape, shown by `lokus commands.list`.
    pub args: &'static str,
}

pub const COMMANDS: &[CommandSpec] = &[
    CommandSpec {
        name: "commands.list",
        summary: "List every core command",
        args: "",
    },
    CommandSpec {
        name: "vault.info",
        summary: "Name and root of the open vault",
        args: "",
    },
    CommandSpec {
        name: "vault.tree",
        summary: "Folders and files as a tree",
        args: "",
    },
    CommandSpec {
        name: "vault.notes",
        summary: "Flat list of note paths",
        args: "",
    },
    CommandSpec {
        name: "vault.fidelity",
        summary: "Check that an unchanged save is byte-identical for every note",
        args: "",
    },
    CommandSpec {
        name: "note.read",
        summary: "Read a note",
        args: "path",
    },
    CommandSpec {
        name: "note.write",
        summary: "Save a note atomically",
        args: "path, text, eol?=lf|crlf|mixed, expected_hash?",
    },
    CommandSpec {
        name: "note.create",
        summary: "Create a note; fails if it exists",
        args: "path, text?",
    },
    CommandSpec {
        name: "note.rename",
        summary: "Rename or move a note or folder",
        args: "from, to",
    },
    CommandSpec {
        name: "note.delete",
        summary: "Move a note or folder to the vault trash",
        args: "path",
    },
    CommandSpec {
        name: "index.refresh",
        summary: "Bring the search and link index in line with the files",
        args: "",
    },
    CommandSpec {
        name: "search.query",
        summary: "Full-text search; every word must match",
        args: "q, limit?=30",
    },
    CommandSpec {
        name: "links.backlinks",
        summary: "Notes that link to this note, with the linking line",
        args: "path",
    },
    CommandSpec {
        name: "links.outgoing",
        summary: "Existing notes this note links to",
        args: "path",
    },
    CommandSpec {
        name: "graph.data",
        summary: "Every note and the links between them",
        args: "",
    },
    CommandSpec {
        name: "props.rows",
        summary: "Notes in a folder with their properties, as database rows",
        args: "folder?",
    },
    CommandSpec {
        name: "props.set",
        summary: "Set one property of a note; null removes it",
        args: "path, key, value",
    },
    CommandSpec {
        name: "tags.list",
        summary: "Tags and how many notes use each",
        args: "",
    },
    CommandSpec {
        name: "folder.create",
        summary: "Create a folder",
        args: "path",
    },
];

#[derive(Deserialize)]
struct PathArgs {
    path: String,
}

#[derive(Deserialize)]
struct WriteArgs {
    path: String,
    text: String,
    #[serde(default)]
    eol: Eol,
    expected_hash: Option<String>,
}

#[derive(Deserialize)]
struct CreateArgs {
    path: String,
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
struct RenameArgs {
    from: String,
    to: String,
}

#[derive(Deserialize)]
struct SearchArgs {
    q: String,
    limit: Option<usize>,
}

/// Commands that change files; the index is brought up to date after them.
#[derive(Deserialize)]
struct RowsArgs {
    #[serde(default)]
    folder: String,
}

#[derive(Deserialize)]
struct SetArgs {
    path: String,
    key: String,
    #[serde(default)]
    value: Value,
}

const WRITES: &[&str] = &[
    "props.set",
    "note.write",
    "note.create",
    "note.rename",
    "note.delete",
    "folder.create",
];

pub fn run(core: &Core, name: &str, args: Value) -> Result<Value> {
    let result = dispatch(core, name, args);
    if result.is_ok() && WRITES.contains(&name) {
        core.index()?.refresh()?;
    }
    result
}

fn dispatch(core: &Core, name: &str, args: Value) -> Result<Value> {
    let vault = &core.vault;
    match name {
        "index.refresh" => out(core.index()?.refresh()?),
        "search.query" => {
            let a: SearchArgs = parse(name, args)?;
            out(core.index()?.search(&a.q, a.limit.unwrap_or(30))?)
        }
        "links.backlinks" => {
            let a: PathArgs = parse(name, args)?;
            out(core.index()?.backlinks(&a.path)?)
        }
        "links.outgoing" => {
            let a: PathArgs = parse(name, args)?;
            out(core.index()?.outgoing(&a.path)?)
        }
        "graph.data" => out(core.index()?.graph()?),
        "props.rows" => {
            let a: RowsArgs = parse(name, args)?;
            out(core.index()?.rows(&a.folder)?)
        }
        "props.set" => {
            let a: SetArgs = parse(name, args)?;
            let note = vault.read(&a.path)?;
            let changed = crate::frontmatter::set(&note.text, &a.key, &a.value);
            if changed == note.text {
                return Ok(json!({ "path": a.path, "hash": note.hash }));
            }
            // The text keeps its own line endings, so it is written back as it is.
            out(vault.write(&a.path, &changed, Eol::Lf, Some(&note.hash))?)
        }
        "tags.list" => out(core
            .index()?
            .tags()?
            .into_iter()
            .map(|(tag, notes)| json!({ "tag": tag, "notes": notes }))
            .collect::<Vec<_>>()),
        "commands.list" => out(COMMANDS),
        "vault.info" => Ok(json!({ "name": vault.name(), "root": vault.root() })),
        "vault.tree" => out(vault.tree()?),
        "vault.notes" => out(vault.notes()?),
        "vault.fidelity" => out(vault.fidelity()?),
        "note.read" => {
            let a: PathArgs = parse(name, args)?;
            out(vault.read(&a.path)?)
        }
        "note.write" => {
            let a: WriteArgs = parse(name, args)?;
            out(vault.write(&a.path, &a.text, a.eol, a.expected_hash.as_deref())?)
        }
        "note.create" => {
            let a: CreateArgs = parse(name, args)?;
            out(vault.create(&a.path, &a.text)?)
        }
        "note.rename" => {
            let a: RenameArgs = parse(name, args)?;
            vault.rename(&a.from, &a.to)?;
            Ok(json!({ "path": a.to }))
        }
        "note.delete" => {
            let a: PathArgs = parse(name, args)?;
            Ok(json!({ "trashed_to": vault.delete(&a.path)? }))
        }
        "folder.create" => {
            let a: PathArgs = parse(name, args)?;
            vault.create_folder(&a.path)?;
            Ok(json!({ "path": a.path }))
        }
        other => Err(CoreError::UnknownCommand(other.to_string())),
    }
}

fn parse<T: DeserializeOwned>(command: &str, args: Value) -> Result<T> {
    let args = if args.is_null() { json!({}) } else { args };
    serde_json::from_value(args).map_err(|e| CoreError::BadArgs {
        command: command.to_string(),
        message: e.to_string(),
    })
}

fn out<T: Serialize>(value: T) -> Result<Value> {
    serde_json::to_value(value).map_err(|e| CoreError::Io(std::io::Error::other(e)))
}

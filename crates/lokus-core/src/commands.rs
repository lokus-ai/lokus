//! @part-of core.commands
//! Every core feature is a named command: JSON in, JSON out.
//!
//! The desktop app, the `lokus` CLI, plugins and AI tools all call
//! [`run`]. Adding a feature means adding one entry to [`COMMANDS`] and one
//! arm to [`run`].

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use std::path::Path;

use crate::error::{CoreError, Result};
use crate::plugins;
use crate::vault::Eol;
use crate::Core;

/// Who may call a command besides the app itself. Plugins and AI tools are
/// held to this; the app, the CLI and the dev channel are not.
#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Access {
    /// Reads notes or the index.
    Read,
    /// Changes files in the vault.
    Write,
    /// Only the app itself.
    Private,
}

#[derive(Debug, Serialize, Clone, Copy)]
pub struct CommandSpec {
    pub name: &'static str,
    pub summary: &'static str,
    /// Human-readable argument shape, shown by `lokus commands.list`.
    pub args: &'static str,
    pub access: Access,
}

const fn spec(
    name: &'static str,
    summary: &'static str,
    args: &'static str,
    access: Access,
) -> CommandSpec {
    CommandSpec {
        name,
        summary,
        args,
        access,
    }
}

use Access::{Private, Read, Write};

pub const COMMANDS: &[CommandSpec] = &[
    spec("commands.list", "List every core command", "", Private),
    spec("vault.info", "Name and root of the open vault", "", Read),
    spec("vault.tree", "Folders and files as a tree", "", Read),
    spec("vault.notes", "Flat list of note paths", "", Read),
    spec(
        "vault.fidelity",
        "Check that an unchanged save is byte-identical for every note",
        "",
        Private,
    ),
    spec("note.read", "Read a note", "path", Read),
    spec(
        "note.write",
        "Save a note atomically",
        "path, text, eol?=lf|crlf|mixed, expected_hash?",
        Write,
    ),
    spec(
        "note.create",
        "Create a note; fails if it exists",
        "path, text?",
        Write,
    ),
    spec(
        "note.rename",
        "Rename or move a note or folder",
        "from, to",
        Write,
    ),
    spec(
        "note.delete",
        "Move a note or folder to the vault trash",
        "path",
        Write,
    ),
    spec(
        "index.refresh",
        "Bring the search and link index in line with the files",
        "",
        Private,
    ),
    spec(
        "search.query",
        "Full-text search; every word must match",
        "q, limit?=30",
        Read,
    ),
    spec(
        "links.backlinks",
        "Notes that link to this note, with the linking line",
        "path",
        Read,
    ),
    spec(
        "links.outgoing",
        "Existing notes this note links to",
        "path",
        Read,
    ),
    spec(
        "graph.data",
        "Every note and the links between them",
        "",
        Read,
    ),
    spec(
        "props.rows",
        "Notes in a folder with their properties, as database rows",
        "folder?",
        Read,
    ),
    spec(
        "props.set",
        "Set one property of a note; null removes it",
        "path, key, value",
        Write,
    ),
    spec("tags.list", "Tags and how many notes use each", "", Read),
    spec("folder.create", "Create a folder", "path", Write),
    spec(
        "plugins.list",
        "Installed plugins with their manifests",
        "",
        Private,
    ),
    spec(
        "plugins.install",
        "Copy a plugin folder into the vault; it starts disabled",
        "from",
        Private,
    ),
    spec(
        "plugins.remove",
        "Delete an installed plugin and its data",
        "id",
        Private,
    ),
    spec(
        "plugins.enable",
        "Turn a plugin on or off",
        "id, enabled",
        Private,
    ),
    spec("plugins.data.get", "A plugin's stored data", "id", Private),
    spec(
        "plugins.data.set",
        "Replace a plugin's stored data",
        "id, value",
        Private,
    ),
];

/// The spec of a core command, if there is one by that name.
pub fn find(name: &str) -> Option<&'static CommandSpec> {
    COMMANDS.iter().find(|c| c.name == name)
}

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

pub fn run(core: &Core, name: &str, args: Value) -> Result<Value> {
    let result = dispatch(core, name, args);
    // The index follows every change to the files.
    if result.is_ok() && find(name).is_some_and(|c| c.access == Write) {
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
        "plugins.list" => out(plugins::list(vault)?),
        "plugins.install" => {
            let a: InstallArgs = parse(name, args)?;
            out(plugins::install(vault, Path::new(&a.from))?)
        }
        "plugins.remove" => {
            let a: IdArgs = parse(name, args)?;
            plugins::remove(vault, &a.id)?;
            Ok(json!({ "id": a.id }))
        }
        "plugins.enable" => {
            let a: EnableArgs = parse(name, args)?;
            plugins::set_enabled(vault, &a.id, a.enabled)?;
            Ok(json!({ "id": a.id, "enabled": a.enabled }))
        }
        "plugins.data.get" => {
            let a: IdArgs = parse(name, args)?;
            plugins::data(vault, &a.id)
        }
        "plugins.data.set" => {
            let a: DataArgs = parse(name, args)?;
            plugins::set_data(vault, &a.id, &a.value)?;
            Ok(Value::Null)
        }
        other => Err(CoreError::UnknownCommand(other.to_string())),
    }
}

#[derive(Deserialize)]
struct IdArgs {
    id: String,
}

#[derive(Deserialize)]
struct InstallArgs {
    from: String,
}

#[derive(Deserialize)]
struct EnableArgs {
    id: String,
    #[serde(default = "yes")]
    enabled: bool,
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
struct DataArgs {
    id: String,
    #[serde(default)]
    value: Value,
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

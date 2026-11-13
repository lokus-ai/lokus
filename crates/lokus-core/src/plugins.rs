//! @part-of core.plugins
//! Plugins installed in a vault: `.lokus/plugins/<id>/` holds a `manifest.json`
//! and the plugin's files. This module installs, lists and serves them; running
//! them is the app's job (a sandboxed frame), never the core's.

use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{CoreError, Result};
use crate::vault::{write_atomic, Vault, META_DIR};

/// The one plugin API version this build understands.
pub const API_VERSION: u32 = 1;
/// The script every plugin page loads to get the `lokus` object.
pub const HOST_JS: &str = include_str!("plugins/host.js");
const HOST_JS_PATH: &str = "__lokus.js";
const MAX_FILE: u64 = 8 * 1024 * 1024;
const MAX_DATA: usize = 1024 * 1024;
const PERMISSIONS: &[&str] = &["vault:read", "vault:write", "editor"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    pub api_version: u32,
    #[serde(default = "default_main")]
    pub main: String,
    /// `vault:read`, `vault:write`, `editor`, or `net:<host>`.
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub contributes: Contributes,
    /// `onStartup` loads the plugin with the app; otherwise it loads when one
    /// of its commands or views is first used.
    #[serde(default)]
    pub activation: Vec<String>,
}

fn default_main() -> String {
    "main.js".into()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contributes {
    #[serde(default)]
    pub commands: Vec<CommandContribution>,
    #[serde(default)]
    pub views: Vec<ViewContribution>,
    #[serde(default)]
    pub settings: Vec<SettingContribution>,
    /// Entries for the editor's slash menu.
    #[serde(default)]
    pub snippets: Vec<SnippetContribution>,
    /// Tool servers offered to the AI assistant.
    #[serde(default)]
    pub mcp_servers: Vec<McpContribution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keys: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewContribution {
    pub id: String,
    pub title: String,
    /// An HTML file in the plugin folder.
    pub page: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingContribution {
    pub key: String,
    pub title: String,
    /// `text`, `number`, `toggle` or `select`.
    #[serde(rename = "type", default = "default_setting")]
    pub kind: String,
    #[serde(default)]
    pub default: Value,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
}

fn default_setting() -> String {
    "text".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetContribution {
    pub label: String,
    #[serde(default)]
    pub detail: String,
    pub insert: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpContribution {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct Installed {
    pub id: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest: Option<Manifest>,
    /// Why the plugin cannot run, if its folder is broken.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// A file served to a plugin frame.
pub struct Served {
    pub mime: &'static str,
    pub bytes: Vec<u8>,
    /// The content-security policy the frame runs under.
    pub csp: String,
}

fn bad(message: impl Into<String>) -> CoreError {
    CoreError::Plugin(message.into())
}

fn plugins_dir(vault: &Vault) -> PathBuf {
    vault.root().join(META_DIR).join("plugins")
}

fn state_file(vault: &Vault) -> PathBuf {
    vault.root().join(META_DIR).join("plugins.json")
}

fn data_file(vault: &Vault, id: &str) -> PathBuf {
    vault
        .root()
        .join(META_DIR)
        .join("plugin-data")
        .join(format!("{id}.json"))
}

fn valid_id(id: &str) -> bool {
    let mut chars = id.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        && id.len() <= 64
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn check_id(id: &str) -> Result<()> {
    if valid_id(id) {
        Ok(())
    } else {
        Err(bad(format!(
            "'{id}' is not a plugin id (lowercase letters, digits and dashes)"
        )))
    }
}

/// A host a plugin may call, from a `net:<host>` permission.
fn net_host(permission: &str) -> Option<&str> {
    let host = permission.strip_prefix("net:")?;
    let ok = !host.is_empty()
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':'));
    ok.then_some(host)
}

/// A relative path with no way out of the folder it is joined to.
fn inside(rel: &str) -> Option<PathBuf> {
    let mut clean = PathBuf::new();
    for part in Path::new(rel).components() {
        match part {
            Component::Normal(p) => clean.push(p),
            Component::CurDir => {}
            _ => return None,
        }
    }
    (!clean.as_os_str().is_empty()).then_some(clean)
}

pub fn parse_manifest(text: &str) -> Result<Manifest> {
    let manifest: Manifest =
        serde_json::from_str(text).map_err(|e| bad(format!("manifest.json: {e}")))?;
    check_id(&manifest.id)?;
    if manifest.api_version != API_VERSION {
        return Err(bad(format!(
            "plugin needs API version {}, this app has {API_VERSION}",
            manifest.api_version
        )));
    }
    for permission in &manifest.permissions {
        if !PERMISSIONS.contains(&permission.as_str()) && net_host(permission).is_none() {
            return Err(bad(format!("unknown permission '{permission}'")));
        }
    }
    let prefix = format!("{}.", manifest.id);
    for command in &manifest.contributes.commands {
        if !command.id.starts_with(&prefix) {
            return Err(bad(format!(
                "command '{}' must start with '{prefix}'",
                command.id
            )));
        }
    }
    let files = manifest
        .contributes
        .views
        .iter()
        .map(|v| v.page.as_str())
        .chain([manifest.main.as_str()]);
    for file in files {
        if inside(file).is_none() {
            return Err(bad(format!("'{file}' is not a path inside the plugin")));
        }
    }
    for server in &manifest.contributes.mcp_servers {
        if !server.url.starts_with("https://") && !server.url.starts_with("http://") {
            return Err(bad(format!("tool server '{}' needs a URL", server.name)));
        }
    }
    Ok(manifest)
}

fn read_manifest(dir: &Path) -> Result<Manifest> {
    let text = fs::read_to_string(dir.join("manifest.json"))
        .map_err(|_| bad("manifest.json is missing or unreadable"))?;
    parse_manifest(&text)
}

fn enabled_ids(vault: &Vault) -> Vec<String> {
    fs::read_to_string(state_file(vault))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|v| serde_json::from_value(v["enabled"].clone()).ok())
        .unwrap_or_default()
}

pub fn list(vault: &Vault) -> Result<Vec<Installed>> {
    let enabled = enabled_ids(vault);
    let Ok(entries) = fs::read_dir(plugins_dir(vault)) else {
        return Ok(Vec::new());
    };
    let mut found = Vec::new();
    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().into_owned();
        let loaded = read_manifest(&entry.path()).and_then(|m| {
            if m.id == id {
                Ok(m)
            } else {
                Err(bad(format!(
                    "manifest id '{}' does not match its folder",
                    m.id
                )))
            }
        });
        let (manifest, error) = match loaded {
            Ok(m) => (Some(m), None),
            Err(e) => (None, Some(e.to_string())),
        };
        found.push(Installed {
            enabled: error.is_none() && enabled.contains(&id),
            id,
            manifest,
            error,
        });
    }
    found.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(found)
}

fn copy_tree(from: &Path, to: &Path) -> Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let name = entry.file_name();
        // Links are not followed, so a plugin folder cannot pull in outside files.
        let kind = entry.file_type()?;
        if name.to_string_lossy().starts_with('.') || kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            copy_tree(&entry.path(), &to.join(&name))?;
        } else if entry.metadata()?.len() <= MAX_FILE {
            fs::copy(entry.path(), to.join(&name))?;
        } else {
            return Err(bad(format!(
                "{} is larger than 8 MB",
                entry.path().display()
            )));
        }
    }
    Ok(())
}

/// Copy a plugin folder into the vault. A plugin starts disabled, so its
/// permissions can be read before it runs. Installing again replaces the files.
pub fn install(vault: &Vault, from: &Path) -> Result<Manifest> {
    let manifest = read_manifest(from)?;
    let target = plugins_dir(vault).join(&manifest.id);
    let staging = plugins_dir(vault).join(format!(".installing-{}", manifest.id));
    let _ = fs::remove_dir_all(&staging);
    if let Err(e) = copy_tree(from, &staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }
    if !staging.join(&manifest.main).is_file() {
        let _ = fs::remove_dir_all(&staging);
        return Err(bad(format!("{} is missing", manifest.main)));
    }
    let _ = fs::remove_dir_all(&target);
    fs::rename(&staging, &target)?;
    Ok(manifest)
}

pub fn remove(vault: &Vault, id: &str) -> Result<()> {
    check_id(id)?;
    let dir = plugins_dir(vault).join(id);
    if !dir.is_dir() {
        return Err(CoreError::NotFound(format!("plugin {id}")));
    }
    set_enabled(vault, id, false)?;
    fs::remove_dir_all(dir)?;
    let _ = fs::remove_file(data_file(vault, id));
    Ok(())
}

pub fn set_enabled(vault: &Vault, id: &str, enabled: bool) -> Result<()> {
    check_id(id)?;
    if enabled {
        read_manifest(&plugins_dir(vault).join(id))?;
    }
    let mut ids = enabled_ids(vault);
    ids.retain(|existing| existing != id);
    if enabled {
        ids.push(id.to_string());
    }
    let file = state_file(vault);
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir)?;
    }
    write_atomic(&file, json!({ "enabled": ids }).to_string().as_bytes())
}

/// Whatever the plugin last stored, or null.
pub fn data(vault: &Vault, id: &str) -> Result<Value> {
    check_id(id)?;
    Ok(fs::read_to_string(data_file(vault, id))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null))
}

pub fn set_data(vault: &Vault, id: &str, value: &Value) -> Result<()> {
    check_id(id)?;
    let text = value.to_string();
    if text.len() > MAX_DATA {
        return Err(bad("plugin data is limited to 1 MB"));
    }
    let file = data_file(vault, id);
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir)?;
    }
    write_atomic(&file, text.as_bytes())
}

/// The policy a plugin's frames run under: its own files, plus only the
/// network hosts its manifest asks for. `origin` is how the app addresses
/// plugin files (it differs by platform).
fn csp(manifest: &Manifest, origin: &str) -> String {
    let hosts: Vec<String> = manifest
        .permissions
        .iter()
        .filter_map(|p| net_host(p))
        .map(|h| format!("https://{h}"))
        .collect();
    let connect = if hosts.is_empty() {
        "'none'".to_string()
    } else {
        hosts.join(" ")
    };
    format!(
        "default-src 'none'; script-src {origin}; style-src {origin} 'unsafe-inline'; \
         img-src {origin} data: https:; font-src {origin} data:; connect-src {connect}; \
         form-action 'none'; base-uri 'none'"
    )
}

fn mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

/// Answer a request from a plugin frame for `<id>/<path>`. An empty path is
/// the plugin's background page, which loads the API and then its main script.
pub fn serve(vault: &Vault, id: &str, path: &str, origin: &str) -> Result<Served> {
    check_id(id)?;
    if !enabled_ids(vault).iter().any(|e| e == id) {
        return Err(bad(format!("plugin {id} is not enabled")));
    }
    let dir = plugins_dir(vault).join(id);
    let manifest = read_manifest(&dir)?;
    let csp = csp(&manifest, origin);
    if path.is_empty() {
        let page = format!(
            "<!doctype html><meta charset=\"utf-8\"><script src=\"{HOST_JS_PATH}\"></script>\
             <script src=\"{}\"></script>",
            manifest.main
        );
        return Ok(Served {
            mime: "text/html; charset=utf-8",
            bytes: page.into_bytes(),
            csp,
        });
    }
    if path == HOST_JS_PATH {
        return Ok(Served {
            mime: "text/javascript; charset=utf-8",
            bytes: HOST_JS.as_bytes().to_vec(),
            csp,
        });
    }
    let rel = inside(path).ok_or_else(|| CoreError::InvalidPath(path.to_string()))?;
    let file = dir.join(&rel);
    let real = file
        .canonicalize()
        .map_err(|_| CoreError::NotFound(path.to_string()))?;
    if !real.starts_with(dir.canonicalize()?) || !real.is_file() {
        return Err(CoreError::InvalidPath(path.to_string()));
    }
    Ok(Served {
        mime: mime(&rel),
        bytes: fs::read(real)?,
        csp,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const MANIFEST: &str = r#"{ "id": "demo", "apiVersion": 1,
        "permissions": ["vault:read", "net:api.example.com"],
        "contributes": { "commands": [{ "id": "demo.hello", "title": "Hello" }] } }"#;

    fn plugin(dir: &Path, manifest: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(dir.join("manifest.json"), manifest).unwrap();
        fs::write(dir.join("main.js"), "// demo").unwrap();
    }

    #[test]
    fn install_enable_serve_remove() {
        let home = tempfile::tempdir().unwrap();
        let source = tempfile::tempdir().unwrap();
        plugin(source.path(), MANIFEST);
        let vault = Vault::open(home.path()).unwrap();

        install(&vault, source.path()).unwrap();
        let listed = list(&vault).unwrap();
        assert_eq!(listed.len(), 1);
        assert!(!listed[0].enabled, "a plugin starts disabled");
        assert!(serve(&vault, "demo", "main.js", "x:").is_err());

        set_enabled(&vault, "demo", true).unwrap();
        let page = serve(&vault, "demo", "", "lokus-plugin:").unwrap();
        assert!(page.csp.contains("connect-src https://api.example.com;"));
        assert!(String::from_utf8(page.bytes).unwrap().contains("main.js"));
        assert!(serve(&vault, "demo", "../../../secret", "x:").is_err());
        assert!(serve(&vault, "demo", "../plugins.json", "x:").is_err());

        set_data(&vault, "demo", &json!({ "n": 1 })).unwrap();
        assert_eq!(data(&vault, "demo").unwrap()["n"], 1);
        remove(&vault, "demo").unwrap();
        assert!(list(&vault).unwrap().is_empty());
        assert_eq!(data(&vault, "demo").unwrap(), Value::Null);
    }

    #[test]
    fn bad_manifests_are_refused() {
        let wrong_prefix = MANIFEST.replace("demo.hello", "other.hello");
        assert!(parse_manifest(&wrong_prefix).is_err());
        assert!(
            parse_manifest(&MANIFEST.replace("\"apiVersion\": 1", "\"apiVersion\": 2")).is_err()
        );
        assert!(parse_manifest(&MANIFEST.replace("vault:read", "fs:everything")).is_err());
        assert!(parse_manifest(&MANIFEST.replace("\"demo\"", "\"../demo\"")).is_err());
    }
}

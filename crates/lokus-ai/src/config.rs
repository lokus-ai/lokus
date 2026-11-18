//! @part-of ai
//! Assistant settings (a small JSON file in the app's config folder) and
//! secrets (the OS keychain). Settings never contain a key. The model is the person's, for the
//! whole app; a connection belongs to one workspace, the folder it was made in.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{AiError, Result};

/// Where saved sign-ins are kept in the keychain. A build made while developing keeps its own
/// apart from the released app's. They used to share one, and since macOS ties each entry to
/// the app that made it, the released app asked for the keychain password once for every
/// entry a development build had made (2026-11-14).
const SERVICE: &str = if cfg!(debug_assertions) {
    "io.lokus.app.dev"
} else {
    "io.lokus.app"
};
/// Where development builds kept theirs before they were given their own place.
#[cfg(debug_assertions)]
const SHARED: &str = "io.lokus.app";
const FILE: &str = "ai.json";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    /// Claude, through the Anthropic API.
    #[default]
    Anthropic,
    /// Any service that speaks the OpenAI chat-completions format.
    OpenAi,
    /// The person's own ChatGPT plan, through Sign in with ChatGPT. No key.
    ChatGpt,
}

impl Provider {
    pub fn id(self) -> &'static str {
        match self {
            Self::Anthropic => "anthropic",
            Self::OpenAi => "openai",
            Self::ChatGpt => "chatgpt",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Anthropic => "Anthropic",
            Self::OpenAi => "OpenAI",
            Self::ChatGpt => "ChatGPT",
        }
    }

    pub fn default_url(self) -> &'static str {
        match self {
            Self::Anthropic => "https://api.anthropic.com",
            Self::OpenAi | Self::ChatGpt => "https://api.openai.com/v1",
        }
    }

    fn env_key(self) -> &'static str {
        match self {
            Self::Anthropic => "ANTHROPIC_API_KEY",
            Self::OpenAi => "OPENAI_API_KEY",
            // Never read: this provider signs in instead.
            Self::ChatGpt => "",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub url: String,
    #[serde(default = "yes")]
    pub enabled: bool,
    /// Whose keys this connection uses: the workspace's folder, or nothing for keys kept under
    /// the name alone. Never saved and never taken from the window; `Config` fills it in.
    #[serde(skip)]
    pub keys: String,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub provider: Provider,
    /// Empty means the provider's default.
    #[serde(default)]
    pub model: String,
    /// Empty means the provider's own address.
    #[serde(default)]
    pub base_url: String,
    /// Let the assistant change notes and call tool servers without asking.
    #[serde(default)]
    pub auto_approve: bool,
    #[serde(default)]
    pub mcp: Vec<McpServer>,
    /// The team's own systems, called as they are: an address, and where to start.
    #[serde(default)]
    pub apis: Vec<OwnApi>,
    /// Each workspace's connections, by the folder's id (`Vault::id`, which moves with the
    /// folder). In the saved file `mcp` and `apis` above hold only what an install from before
    /// connections belonged to a workspace left there, until `hand_on` gives it to them.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub workspaces: BTreeMap<String, Workspace>,
}

/// Where connections made with no workspace open wait for the next folder that is opened.
const WAITING: &str = "-";

/// The place a workspace's connections and keys are kept under; with none open, the waiting one.
fn place(at: &str) -> &str {
    if at.is_empty() {
        WAITING
    } else {
        at
    }
}

/// One workspace's connections.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Workspace {
    #[serde(default)]
    pub mcp: Vec<McpServer>,
    #[serde(default)]
    pub apis: Vec<OwnApi>,
    /// Connections here (`mcp:<name>`, `api:<name>`) whose keys are kept under the name alone,
    /// where they were before connections belonged to a workspace. Other workspaces may be
    /// using the same keys, so they are removed only when the last one lets go.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shared: Vec<String>,
}

/// A team's own API: its product's admin or staff API. The key is kept in the keychain.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct OwnApi {
    pub name: String,
    pub url: String,
    /// A few words for the assistant: what this system is and which route to read first.
    #[serde(default)]
    pub about: String,
    #[serde(default = "yes")]
    pub enabled: bool,
    /// As `McpServer::keys`.
    #[serde(skip)]
    pub keys: String,
}

impl Config {
    pub fn load(dir: &Path) -> Self {
        fs::read_to_string(dir.join(FILE))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, dir: &Path) -> Result<()> {
        let failed = |e: std::io::Error| AiError::Config(e.to_string());
        fs::create_dir_all(dir).map_err(failed)?;
        let text =
            serde_json::to_string_pretty(self).map_err(|e| AiError::Config(e.to_string()))?;
        let tmp = dir.join(format!("{FILE}.tmp"));
        fs::write(&tmp, text).map_err(failed)?;
        fs::rename(tmp, dir.join(FILE)).map_err(failed)
    }

    /// Whose keys a connection of the workspace `at` uses.
    fn keys(&self, at: &str, kind: &str, name: &str) -> String {
        let shares = self
            .workspaces
            .get(place(at))
            .is_some_and(|w| w.shared.contains(&format!("{kind}:{name}")));
        if shares {
            String::new()
        } else {
            place(at).to_string()
        }
    }

    /// A tool server as the workspace `at` reaches it. What the window sends names no keys.
    pub fn place(&self, at: &str, mut server: McpServer) -> McpServer {
        server.keys = self.keys(at, "mcp", &server.name);
        server
    }

    /// A tool server with keys of the workspace's own, whatever it used before.
    pub fn own(at: &str, mut server: McpServer) -> McpServer {
        server.keys = place(at).to_string();
        server
    }

    /// The settings as one workspace has them: the model, and that workspace's connections.
    /// `at` is the workspace's id; empty means none is open, and the connections are the ones
    /// waiting for one.
    pub fn seen_from(&self, at: &str) -> Config {
        let own = self.workspaces.get(place(at)).cloned().unwrap_or_default();
        let mut seen = Config {
            mcp: own.mcp,
            apis: own.apis,
            workspaces: BTreeMap::new(),
            ..self.clone()
        };
        for server in &mut seen.mcp {
            server.keys = self.keys(at, "mcp", &server.name);
        }
        for api in &mut seen.apis {
            api.keys = self.keys(at, "api", &api.name);
        }
        seen
    }

    /// Save what one workspace sees: the model for the app, the connections for `at` alone.
    pub fn put(dir: &Path, at: &str, seen: Config) -> Result<()> {
        let mut now = Self::load(dir);
        let Config { mcp, apis, .. } = seen.clone();
        now = Config {
            mcp: now.mcp,
            apis: now.apis,
            workspaces: now.workspaces,
            ..seen
        };
        let own = now.workspaces.entry(place(at).to_string()).or_default();
        own.shared.retain(|shared| {
            mcp.iter().any(|s| *shared == format!("mcp:{}", s.name))
                || apis.iter().any(|a| *shared == format!("api:{}", a.name))
        });
        (own.mcp, own.apis) = (mcp, apis);
        if own.mcp.is_empty() && own.apis.is_empty() {
            now.workspaces.remove(place(at));
        }
        now.save(dir)
    }

    /// Give the connections from before they belonged to a workspace to each of `ids`, and
    /// stop holding them. Their keys stay where they are, under the name alone: nothing in the
    /// keychain is read, copied or removed. A workspace that has one of that name keeps its own.
    pub fn hand_on(dir: &Path, ids: &[String]) -> Result<()> {
        let mut now = Self::load(dir);
        if ids.is_empty() || (now.mcp.is_empty() && now.apis.is_empty()) {
            return Ok(());
        }
        let (mcp, apis) = (std::mem::take(&mut now.mcp), std::mem::take(&mut now.apis));
        for id in ids {
            let own = now.workspaces.entry(id.clone()).or_default();
            for server in &mcp {
                if !own.mcp.iter().any(|s| s.name == server.name) {
                    own.mcp.push(server.clone());
                    own.shared.push(format!("mcp:{}", server.name));
                }
            }
            for api in &apis {
                if !own.apis.iter().any(|a| a.name == api.name) {
                    own.apis.push(api.clone());
                    own.shared.push(format!("api:{}", api.name));
                }
            }
        }
        now.save(dir)
    }

    /// Give what was connected with no workspace open (first-run setup) to the workspace `at`,
    /// keys and all. A connection `at` already has by that name stays, and the waiting one is
    /// dropped. The keys are the app's own, made moments ago under the waiting place, so moving
    /// them asks nobody anything.
    pub fn settle(dir: &Path, at: &str) -> Result<()> {
        let mut now = Self::load(dir);
        if at.is_empty() {
            return Ok(());
        }
        let Some(waiting) = now.workspaces.remove(WAITING) else {
            return Ok(());
        };
        let mut own = now.workspaces.remove(at).unwrap_or_default();
        let mut still = Workspace::default();
        let mut done = Vec::new();
        // One connection at a time, its keys before the connection itself. A key the keychain
        // would not show (locked, or the person said no) or would not take keeps the connection
        // waiting, keys and all, and it moves when a later folder is opened.
        let mut carry = |kind: &'static str, name: &str, taken: bool| -> bool {
            if taken {
                done.push((kind, name.to_string()));
                return false;
            }
            let pairs = accounts(kind, name, WAITING)
                .into_iter()
                .zip(accounts(kind, name, at));
            let (mut found, mut unread, mut in_memory) = (Vec::new(), false, false);
            for (from, to) in pairs {
                match read_raw(&from) {
                    Ok(value) => found.push((to, value.or_else(|| kept(&from)))),
                    // Not shown: locked, refused, or not there to ask just now. What it holds
                    // is not known, unless the sign-in was never in it and is held in memory.
                    Err(_) => match kept(&from) {
                        Some(value) => {
                            in_memory = true;
                            found.push((to, Some(value)));
                        }
                        None => unread = true,
                    },
                }
            }
            // Could not read always means leave it waiting. The one exception is a sign-in made
            // while there was no keychain: memory is then all there ever was of it.
            if unread && !in_memory {
                return false;
            }
            for (to, value) in found {
                let Some(value) = value else { continue };
                if set_secret(&to, &value).is_err() {
                    // A browser sign-in may live in memory until the app quits; a token may not.
                    if !to.starts_with("mcp-oauth:") {
                        return false;
                    }
                    keep(&to, &value);
                }
            }
            done.push((kind, name.to_string()));
            true
        };
        for server in waiting.mcp {
            let taken = own.mcp.iter().any(|s| s.name == server.name);
            if carry("mcp", &server.name, taken) {
                own.mcp.push(server);
            } else if !taken {
                still.mcp.push(server);
            }
        }
        for api in waiting.apis {
            let taken = own.apis.iter().any(|a| a.name == api.name);
            if carry("api", &api.name, taken) {
                own.apis.push(api);
            } else if !taken {
                still.apis.push(api);
            }
        }
        if !(own.mcp.is_empty() && own.apis.is_empty()) {
            now.workspaces.insert(at.to_string(), own);
        }
        if !(still.mcp.is_empty() && still.apis.is_empty()) {
            now.workspaces.insert(WAITING.to_string(), still);
        }
        now.save(dir)?;
        for (kind, name) in done {
            for account in accounts(kind, &name, WAITING) {
                forget(&account);
            }
        }
        Ok(())
    }

    /// The workspace `at` stops using the keys kept under the name alone for one connection
    /// (`kind` is `mcp` or `api`): it has its own now, or none. They are removed once no
    /// workspace uses them.
    pub fn let_go(dir: &Path, at: &str, kind: &str, name: &str) -> Result<()> {
        let mut now = Self::load(dir);
        let shared = format!("{kind}:{name}");
        let Some(own) = now.workspaces.get_mut(place(at)) else {
            return Ok(());
        };
        if !own.shared.contains(&shared) {
            return Ok(());
        }
        own.shared.retain(|s| *s != shared);
        now.save(dir)?;
        // Not yet handed on: some workspace is still to be given it.
        let owed = match kind {
            "mcp" => now.mcp.iter().any(|s| s.name == name),
            _ => now.apis.iter().any(|a| a.name == name),
        };
        if owed || now.workspaces.values().any(|w| w.shared.contains(&shared)) {
            return Ok(());
        }
        for account in accounts(kind, name, "") {
            forget(&account);
        }
        Ok(())
    }

    /// A ChatGPT plan with no model takes the first one the plan recommends; nobody is asked. A
    /// key's list is in no such order, so a key is never given a model nobody chose. The saved
    /// settings are read again: they may have changed while the provider was answering.
    pub fn adopt_model(dir: &Path, asked: &Config, listed: &[String]) -> Result<()> {
        let mut now = Self::load(dir);
        let same = asked.provider == Provider::ChatGpt && now.provider == asked.provider;
        match listed.first() {
            Some(first) if same && now.model().is_err() => {
                now.model = first.clone();
                now.save(dir)
            }
            _ => Ok(()),
        }
    }

    pub fn url(&self) -> &str {
        let trimmed = self.base_url.trim().trim_end_matches('/');
        if trimmed.is_empty() {
            self.provider.default_url()
        } else {
            trimmed
        }
    }

    pub fn model(&self) -> Result<&str> {
        match (self.model.trim(), self.provider) {
            ("", Provider::Anthropic) => Ok("claude-opus-5-5"),
            ("", Provider::OpenAi | Provider::ChatGpt) => Err(AiError::NoModel),
            (model, _) => Ok(model),
        }
    }
}

/// Scripted flows set `LOKUS_KEYCHAIN` so their stand-in sign-ins go to a keychain of their own.
/// Without it, a flow's fake ChatGPT session overwrote the person's real one (2026-11-13).
fn entry_raw(account: &str) -> keyring::Result<keyring::Entry> {
    let service = std::env::var("LOKUS_KEYCHAIN")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| SERVICE.to_string());
    keyring::Entry::new(&service, account)
}

fn entry(account: &str) -> Result<keyring::Entry> {
    entry_raw(account).map_err(|e| AiError::Keychain(e.to_string()))
}

/// What the keychain answered for each account since the app started. The keychain is asked
/// once per account per run: on macOS every read can put a password prompt on screen, and the
/// settings page alone used to read four entries each time it opened.
static ASKED: std::sync::LazyLock<
    std::sync::Mutex<std::collections::HashMap<String, Option<String>>>,
> = std::sync::LazyLock::new(Default::default);

/// Store a secret in the OS keychain; an empty value removes it.
pub fn set_secret(account: &str, secret: &str) -> Result<()> {
    let entry = entry(account)?;
    let result = if secret.is_empty() {
        match entry.delete_credential() {
            Err(keyring::Error::NoEntry) => Ok(()),
            other => other,
        }
    } else {
        // Replaced, not changed in place. A keychain entry remembers which app made it and asks
        // for the login password whenever a different one touches it; an entry that is changed
        // in place keeps its first maker for ever. Making it afresh hands it to the app as it is
        // signed today, so a sign-in saved by an older build stops prompting once it is renewed.
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => entry.set_password(secret),
            Err(_) => entry.set_password(secret),
        }
    };
    result.map_err(|e| AiError::Keychain(e.to_string()))?;
    if let Ok(mut asked) = ASKED.lock() {
        asked.insert(
            account.to_string(),
            Some(secret.to_string()).filter(|s| !s.is_empty()),
        );
    }
    Ok(())
}

pub fn secret(account: &str) -> Option<String> {
    read_secret(account).ok().flatten()
}

/// Unlike an optional sign-in lookup, replacing a credential must stop if its old value
/// cannot be read: a denied keychain prompt does not mean there is nothing to restore.
pub fn read_secret(account: &str) -> Result<Option<String>> {
    read_raw(account).map_err(|e| AiError::Keychain(e.to_string()))
}

fn read_raw(account: &str) -> keyring::Result<Option<String>> {
    // Held for the whole read. Without it, several parts of the app asking at the same moment
    // each put their own password prompt on screen for the same entry, one behind another, and
    // answering the first did not dismiss the rest (2026-11-13).
    let mut asked = ASKED.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(known) = asked.get(account) {
        return Ok(known.clone());
    }
    // Not remembered when it fails, so the next time it is needed the keychain is asked again.
    // Remembering a refusal as "nothing saved" made every connected service look signed out
    // until the app was restarted (2026-11-13). Refused or dismissed says nothing about
    // whether a sign-in is saved.
    let found = match entry_raw(account)?.get_password() {
        Ok(found) => Some(found).filter(|s| !s.is_empty()),
        Err(keyring::Error::NoEntry) => moved_in(account),
        Err(e) => return Err(e),
    };
    asked.insert(account.to_string(), found.clone());
    Ok(found)
}

/// A development build that finds nothing in its own place looks once in the place it used
/// to share with the released app. What it finds there it made itself: it takes it along and
/// removes it, so the released app is never asked about it.
#[cfg(debug_assertions)]
fn moved_in(account: &str) -> Option<String> {
    if std::env::var("LOKUS_KEYCHAIN").is_ok_and(|s| !s.is_empty()) {
        return None;
    }
    let old = keyring::Entry::new(SHARED, account).ok()?;
    let found = old.get_password().ok().filter(|s| !s.is_empty())?;
    if entry(account)
        .and_then(|e| {
            e.set_password(&found)
                .map_err(|e| AiError::Keychain(e.to_string()))
        })
        .is_ok()
    {
        let _ = old.delete_credential();
    }
    Some(found)
}

#[cfg(not(debug_assertions))]
fn moved_in(_account: &str) -> Option<String> {
    None
}

pub fn key_account(provider: Provider) -> String {
    format!("ai:{}", provider.id())
}

/// A connection's entry in the keychain: under the name alone, or the name and the workspace's id.
fn account(kind: &str, name: &str, keys: &str) -> String {
    if keys.is_empty() {
        format!("{kind}:{name}")
    } else {
        format!("{kind}:{name}@{keys}")
    }
}

/// Every entry a connection can have.
fn accounts(kind: &str, name: &str, keys: &str) -> Vec<String> {
    match kind {
        "mcp" => vec![account("mcp", name, keys), account("mcp-oauth", name, keys)],
        _ => vec![account(kind, name, keys)],
    }
}

pub fn api_account(api: &OwnApi) -> String {
    account("api", &api.name, &api.keys)
}

/// A tool server's pasted token.
pub fn mcp_account(server: &McpServer) -> String {
    account("mcp", &server.name, &server.keys)
}

/// A tool server's browser sign-in.
pub fn oauth_account(server: &McpServer) -> String {
    account("mcp-oauth", &server.name, &server.keys)
}

/// Keep (or, with an empty value, remove) the key of one of the workspace `at`'s connections.
/// The workspace's own entry is written; one it shared with other workspaces is left to them.
pub fn set_key(dir: &Path, at: &str, kind: &str, name: &str, value: &str) -> Result<()> {
    set_secret(&account(kind, name, place(at)), value)?;
    Config::let_go(dir, at, kind, name)
}

/// The key for a provider: the keychain first, then the usual environment
/// variable (which is how the command line and tests supply one).
pub fn api_key(provider: Provider) -> Result<String> {
    secret(&key_account(provider))
        .or_else(|| {
            std::env::var(provider.env_key())
                .ok()
                .filter(|k| !k.is_empty())
        })
        .ok_or_else(|| AiError::NoKey(provider.label().to_string()))
}

pub fn has_key(provider: Provider) -> bool {
    match provider {
        Provider::ChatGpt => crate::chatgpt::signed_in(),
        _ => api_key(provider).is_ok(),
    }
}

/// Where sign-ins live when the keychain cannot be used: until the app quits.
static MEMORY: std::sync::LazyLock<std::sync::Mutex<std::collections::HashMap<String, String>>> =
    std::sync::LazyLock::new(Default::default);

/// Keep a sign-in: in the keychain, or in memory if the keychain refuses.
pub fn keep(account: &str, value: &str) {
    if set_secret(account, value).is_err() {
        if let Ok(mut memory) = MEMORY.lock() {
            memory.insert(account.to_string(), value.to_string());
        }
    }
}

pub fn kept(account: &str) -> Option<String> {
    secret(account).or_else(|| MEMORY.lock().ok()?.get(account).cloned())
}

pub fn forget(account: &str) {
    let _ = forget_checked(account);
}

/// Clear fallback memory even when persisted credentials cannot be removed.
pub fn forget_checked(account: &str) -> Result<()> {
    let removed = set_secret(account, "");
    if let Ok(mut memory) = MEMORY.lock() {
        memory.remove(account);
    }
    removed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn server(name: &str, url: &str) -> McpServer {
        McpServer {
            name: name.into(),
            url: url.into(),
            enabled: true,
            keys: String::new(),
        }
    }

    #[test]
    fn a_connection_belongs_to_the_workspace_it_was_made_in() {
        let dir = tempfile::tempdir().unwrap();
        let (dir, a, b) = (dir.path(), "/w/a".to_string(), "/w/b".to_string());
        // As an install from before connections belonged to a workspace left it.
        std::fs::write(
            dir.join(FILE),
            r#"{"provider":"openai","model":"m","mcp":[{"name":"slack","url":"https://x"}]}"#,
        )
        .unwrap();
        Config::hand_on(dir, &[a.clone(), b.clone()]).unwrap();
        let now = Config::load(dir);
        assert!(now.mcp.is_empty(), "handed on once, not kept");
        // Both have it, on the keys that were already there.
        for root in [&a, &b] {
            let seen = now.seen_from(root);
            assert_eq!(seen.mcp[0].url, "https://x");
            assert_eq!(mcp_account(&seen.mcp[0]), "mcp:slack");
            assert_eq!(oauth_account(&seen.mcp[0]), "mcp-oauth:slack");
        }
        // A workspace made later has none, and a second hand-on gives it none.
        Config::hand_on(dir, &["/w/c".to_string()]).unwrap();
        assert!(Config::load(dir).seen_from("/w/c").mcp.is_empty());

        // B replaces its Slack: A is as it was, and B's keys are its own.
        Config::let_go(dir, &b, "mcp", "slack").unwrap();
        let mut seen = Config::load(dir).seen_from(&b);
        seen.mcp = vec![server("slack", "https://y"), server("github", "https://g")];
        seen.model = "n".into();
        Config::put(dir, &b, seen).unwrap();
        let now = Config::load(dir);
        let (in_a, in_b) = (now.seen_from(&a), now.seen_from(&b));
        assert_eq!(in_a.mcp.len(), 1);
        assert_eq!(in_a.mcp[0].url, "https://x");
        assert_eq!(mcp_account(&in_a.mcp[0]), "mcp:slack");
        assert_eq!(in_b.mcp[0].url, "https://y");
        assert_eq!(mcp_account(&in_b.mcp[0]), "mcp:slack@/w/b");
        assert_eq!(oauth_account(&in_b.mcp[1]), "mcp-oauth:github@/w/b");
        // The model is the person's, in every workspace.
        assert_eq!(in_a.model, "n");
        // B disconnects everything: A still has its own.
        let mut seen = now.seen_from(&b);
        seen.mcp.clear();
        Config::put(dir, &b, seen).unwrap();
        let now = Config::load(dir);
        assert!(now.seen_from(&b).mcp.is_empty());
        assert_eq!(now.seen_from(&a).mcp.len(), 1);
        // Connected with no workspace open: it waits under keys of its own, never the ones
        // the workspaces above still share, and goes to the next folder opened, once.
        let mut seen = Config::load(dir).seen_from("");
        assert!(seen.mcp.is_empty());
        seen.mcp = vec![server("slack", "https://z")];
        Config::put(dir, "", seen).unwrap();
        let waiting = Config::load(dir).seen_from("");
        assert_eq!(oauth_account(&waiting.mcp[0]), "mcp-oauth:slack@-");
        // Signed in, as the app keeps it: in the keychain, or in memory where there is none.
        // Without that, a keychain that cannot be read would leave it waiting (below).
        keep(&oauth_account(&waiting.mcp[0]), "sign-in");
        Config::settle(dir, "/w/d").unwrap();
        let now = Config::load(dir);
        assert!(now.seen_from("").mcp.is_empty());
        let in_d = now.seen_from("/w/d");
        assert_eq!(in_d.mcp[0].url, "https://z");
        assert_eq!(oauth_account(&in_d.mcp[0]), "mcp-oauth:slack@/w/d");
        assert_eq!(mcp_account(&now.seen_from(&a).mcp[0]), "mcp:slack");
        Config::settle(dir, "/w/e").unwrap();
        assert!(Config::load(dir).seen_from("/w/e").mcp.is_empty());
        assert_eq!(
            kept(&oauth_account(&in_d.mcp[0])).as_deref(),
            Some("sign-in")
        );
        forget(&oauth_account(&in_d.mcp[0]));
        // Nothing that names a key's place is written to the file.
        assert!(!std::fs::read_to_string(dir.join(FILE))
            .unwrap()
            .contains("keys"));
    }

    #[test]
    fn the_first_listed_model_is_taken_only_by_the_chatgpt_plan_that_listed_it() {
        // Review of 2026-11-15: the list came back after the provider was changed, and the old
        // provider was written over the new one.
        let dir = tempfile::tempdir().unwrap();
        let asked = Config {
            provider: Provider::ChatGpt,
            ..Config::default()
        };
        let listed = ["gpt-new".to_string(), "gpt-old".to_string()];

        asked.save(dir.path()).unwrap();
        Config::adopt_model(dir.path(), &asked, &listed).unwrap();
        assert_eq!(Config::load(dir.path()).model, "gpt-new");

        // A model the person chose stays.
        Config::adopt_model(dir.path(), &asked, &["other".to_string()]).unwrap();
        assert_eq!(Config::load(dir.path()).model, "gpt-new");

        // A key's list is in no recommended order: nothing is chosen for it.
        let keyed = Config {
            provider: Provider::OpenAi,
            ..Config::default()
        };
        keyed.save(dir.path()).unwrap();
        Config::adopt_model(dir.path(), &keyed, &listed).unwrap();
        assert_eq!(Config::load(dir.path()).model, "");

        // Changed to Claude while ChatGPT was answering: nothing of ChatGPT's is written.
        Config::default().save(dir.path()).unwrap();
        Config::adopt_model(dir.path(), &asked, &listed).unwrap();
        let now = Config::load(dir.path());
        assert_eq!(
            (now.provider, now.model.as_str()),
            (Provider::Anthropic, "")
        );
    }
}

//! @part-of ai
//! The connectors Lokus offers by name, so nobody has to know an address.
//!
//! A connector is a tool server (MCP) run by the service itself. Each entry here was checked
//! against the live server on 2026-11-13: its address, and whether an app nobody has registered
//! with that service may sign a person in. The ones that may are ready; the others wait until
//! Lokus is registered with that service, which only the people who ship Lokus can do.

use serde::Serialize;

/// Whether a person can connect today, and if not, what is missing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Ready {
    /// Sign in with the service in the browser; nothing else is needed.
    Yes,
    /// The service only lets apps it has registered sign people in, and Lokus is not one yet.
    NeedsRegistration,
    /// Runs on this computer rather than at a service; not built yet.
    NotBuilt,
}

#[derive(Debug, Clone, Serialize)]
pub struct Connector {
    /// Also the tool server's name, so its tools read `mcp__linear__...`.
    pub id: &'static str,
    pub name: &'static str,
    /// What connecting it lets the assistant do, in a sentence.
    pub about: &'static str,
    /// Empty when there is no server to reach yet.
    pub url: &'static str,
    pub kind: &'static str,
    pub ready: Ready,
    /// Set for a service that only signs people in through an app registered with it.
    #[serde(skip)]
    pub app: Option<App>,
}

/// Lokus as a service knows it: the app registered there, where its sign-in returns to on the
/// person's own computer, and what it asks to be allowed to do. None of this is a secret: a
/// desktop app proves itself with a one-time code, not a password.
#[derive(Debug, Clone, Copy)]
pub struct App {
    pub client_id: &'static str,
    /// The sign-in returns to `http://localhost:<port>/callback`, which the service has on file.
    pub port: u16,
    pub scopes: &'static [&'static str],
}

/// The Slack app described in `deploy/slack/manifest.json`. The permissions here are that
/// file's, and the two must be changed together.
const SLACK: App = App {
    client_id: "10926891427024.12599669935782",
    port: 53683,
    scopes: &[
        "search:read.public",
        "search:read.private",
        "search:read.mpim",
        "search:read.im",
        "search:read.files",
        "search:read.users",
        "channels:history",
        "groups:history",
        "mpim:history",
        "im:history",
        "channels:read",
        "groups:read",
        "mpim:read",
        "im:read",
        "users:read",
        "users:read.email",
        "files:read",
        "emoji:read",
        "reactions:read",
        "reactions:write",
        "chat:write",
        "canvases:read",
        "canvases:write",
    ],
};

/// The registered app for a tool server, when signing in to it needs one.
pub fn app_for(name: &str, url: &str) -> Option<App> {
    all().into_iter().find(|c| c.id == name && c.url == url)?.app
}

const fn open(id: &'static str, name: &'static str, kind: &'static str, about: &'static str, url: &'static str) -> Connector {
    Connector { id, name, about, url, kind, ready: Ready::Yes, app: None }
}

const fn closed(id: &'static str, name: &'static str, kind: &'static str, about: &'static str, url: &'static str) -> Connector {
    Connector { id, name, about, url, kind, ready: Ready::NeedsRegistration, app: None }
}

/// Every connector, the ready ones first.
pub fn all() -> Vec<Connector> {
    vec![
        open("linear", "Linear", "Issues", "Read and update issues, projects and customer requests.", "https://mcp.linear.app/mcp"),
        open("notion", "Notion", "Docs", "Search and read pages and databases; create and update pages.", "https://mcp.notion.com/mcp"),
        open("granola", "Granola", "Meetings", "Read meeting notes and transcripts.", "https://mcp.granola.ai/mcp"),
        open("sentry", "Sentry", "Errors", "Look up errors, issues and releases.", "https://mcp.sentry.dev/mcp"),
        open("atlassian", "Jira and Confluence", "Issues", "Search and update Jira issues and Confluence pages.", "https://mcp.atlassian.com/v2/mcp"),
        open("stripe", "Stripe", "Billing", "Look up customers, subscriptions, invoices and payments.", "https://mcp.stripe.com"),
        open("intercom", "Intercom", "Support", "Read conversations and contacts.", "https://mcp.intercom.com/mcp"),
        open("zapier", "Zapier", "Automation", "Run the actions you have set up in Zapier, across thousands of apps.", "https://mcp.zapier.com/api/mcp/mcp"),
        Connector {
            // Works in the workspace the Slack app was made in; other workspaces need the app
            // to be published in the Slack Marketplace first.
            app: Some(SLACK),
            ..open("slack", "Slack", "Messages", "Search and read channels and threads; send and draft messages.", "https://mcp.slack.com/mcp")
        },
        closed("github", "GitHub", "Code", "Read and update issues, pull requests and code.", "https://api.githubcopilot.com/mcp/"),
        closed("gmail", "Gmail", "Messages", "Search and read mail; draft replies.", "https://gmailmcp.googleapis.com/mcp/v1"),
        closed("google-calendar", "Google Calendar", "Meetings", "Read and create events.", "https://calendarmcp.googleapis.com/mcp/v1"),
        closed("google-drive", "Google Drive", "Docs", "Search and read files.", "https://drivemcp.googleapis.com/mcp/v1"),
        closed("asana", "Asana", "Issues", "Read and update tasks and projects.", "https://mcp.asana.com/v2/mcp"),
        closed("hubspot", "HubSpot", "Customers", "Read and update contacts, companies and deals.", "https://mcp.hubspot.com"),
        Connector {
            id: "imessage",
            name: "iMessage",
            kind: "Messages",
            about: "Read your conversations on this Mac and send messages you approve.",
            url: "",
            ready: Ready::NotBuilt,
            app: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_connector_has_a_usable_name_and_a_safe_address() {
        let all = all();
        let mut seen = std::collections::HashSet::new();
        for c in &all {
            assert!(seen.insert(c.id), "{} is listed twice", c.id);
            // The id becomes part of a tool's name, so it stays to letters, digits and `-`.
            assert!(c.id.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-'), "{}", c.id);
            assert_eq!(c.url.is_empty(), c.ready == Ready::NotBuilt, "{}", c.id);
            assert!(c.url.is_empty() || c.url.starts_with("https://"), "{} must be reached over https", c.id);
            if let Some(app) = c.app {
                assert!(app.client_id.chars().all(|ch| ch.is_ascii_digit() || ch == '.'), "{}", c.id);
                assert!(app.port > 1024 && !app.scopes.is_empty(), "{}", c.id);
            }
        }
    }
}

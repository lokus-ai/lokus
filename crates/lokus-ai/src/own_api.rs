//! @part-of ai
//! A team's own API, called by the assistant as it is.
//!
//! Many products already have an admin or staff API with a key: every read and every action
//! their own team can do. Nothing has to be built on their side for Lokus to use it. The team
//! gives its address, a key, and a few words on where to start (often one route that lists the
//! rest); the assistant reads that route and finds its own way from there.
//!
//! Two tools, so reading and changing are different things to the person: `api_get` only ever
//! reads and runs without asking; `api_send` can change something, so the person is asked
//! first, and it is refused outright while the assistant is working in the background. A
//! request can only go to the address the team gave: the path is joined to it, never replaces
//! it, and redirects are not followed, so a key cannot be sent anywhere else.

use std::time::Duration;

use reqwest::{redirect, Method, Url};
use serde_json::{json, Value};

use crate::config::{api_account, secret, Config, OwnApi};
use crate::tools::Tool;

const TIMEOUT: Duration = Duration::from_secs(40);

fn schema(extra: Value) -> Value {
    let mut properties = json!({
        "api": { "type": "string", "description": "Which of the team's systems, by the name given in your instructions. May be left out when there is only one." },
        "path": { "type": "string", "description": "The path on that system, starting with /, exactly as its own route list gives it: /v1/admin/clients" },
        "query": { "type": "object", "description": "Query parameters, if the route takes any.", "additionalProperties": true }
    });
    if let (Some(all), Some(more)) = (properties.as_object_mut(), extra.as_object()) {
        all.extend(more.clone());
    }
    json!({ "type": "object", "properties": properties, "required": ["path"] })
}

pub fn tools() -> Vec<Tool> {
    vec![
        Tool {
            name: "api_get".into(),
            description: "Read from one of the team's own systems (their product's admin or staff API). It can only read: it sends a GET and nothing else. Use it to look up a customer, an account, a job, a setting, as that system holds it right now. If you do not yet know the routes, begin where your instructions say to begin for that system. Never state a number you did not read from a response.".into(),
            schema: schema(json!({})),
            writes: false,
        },
        Tool {
            name: "api_send".into(),
            description: "Change something in one of the team's own systems: a POST, PUT, PATCH or DELETE to its API. The user is asked before each one. Read the route's own description of its arguments first (with api_get), send exactly what it asks for, and when the system refuses, say its reason instead of trying again blindly.".into(),
            schema: schema(json!({
                "method": { "type": "string", "enum": ["POST", "PUT", "PATCH", "DELETE"] },
                "body": { "type": "object", "description": "The JSON body the route asks for.", "additionalProperties": true }
            })),
            writes: true,
        },
    ]
}

/// What the assistant is told about the team's systems: their names and where to start.
pub fn briefing(config: &Config) -> Option<String> {
    let live: Vec<&OwnApi> = config.apis.iter().filter(|a| a.enabled).collect();
    if live.is_empty() {
        return None;
    }
    let mut text = String::from(
        "## The team's own systems\n\nYou can call these directly: api_get to read, api_send to change something (the user is asked first). They hold what is true right now, so when a question is about a customer's account, a job, a setting or anything else the product itself knows, look there rather than guessing from notes.\n",
    );
    for api in live {
        let about = api.about.trim();
        text.push_str(&format!(
            "\n- **{}** ({}){}{}",
            api.name,
            api.url.trim_end_matches('/'),
            if about.is_empty() { "" } else { ": " },
            about
        ));
    }
    Some(text)
}

fn local(host: &str) -> bool {
    host == "localhost" || host == "127.0.0.1" || host == "[::1]"
}

/// The full address for a path on this system, or why it cannot be asked for.
fn address(api: &OwnApi, path: &str, query: &Value) -> Result<Url, String> {
    let base = Url::parse(api.url.trim())
        .map_err(|_| format!("{}'s address is not a web address", api.name))?;
    let host = base.host_str().unwrap_or_default().to_string();
    if base.scheme() != "https" && !(base.scheme() == "http" && local(&host)) {
        return Err(format!("{}'s address must start with https://", api.name));
    }
    if !path.starts_with('/')
        || path.starts_with("//")
        || path.contains("://")
        || path.contains('\\')
        || path.chars().any(char::is_control)
    {
        return Err(
            "path must start with / and name a route on that system, like /v1/admin".into(),
        );
    }
    let (route, inline) = path.split_once('?').unwrap_or((path, ""));
    let mut url = base.clone();
    url.set_path(&format!("{}{}", base.path().trim_end_matches('/'), route));
    url.set_query(if inline.is_empty() {
        None
    } else {
        Some(inline)
    });
    if let Some(pairs) = query.as_object() {
        let mut out = url.query_pairs_mut();
        for (key, value) in pairs {
            match value {
                Value::String(s) => out.append_pair(key, s),
                Value::Null => continue,
                other => out.append_pair(key, &other.to_string()),
            };
        }
    }
    // Whatever the path held, the request still goes to the system the team named.
    if url.host_str() != base.host_str()
        || url.port_or_known_default() != base.port_or_known_default()
        || url.scheme() != base.scheme()
    {
        return Err("that path leads somewhere other than this system".into());
    }
    Ok(url)
}

/// Carry out one call. `write` is whether it came through `api_send`.
pub async fn call(config: &Config, write: bool, input: &Value) -> Result<String, String> {
    let live: Vec<&OwnApi> = config.apis.iter().filter(|a| a.enabled).collect();
    let wanted = input["api"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    let api = match (wanted.is_empty(), live.len()) {
        (_, 0) => {
            return Err("no system of the team's own is connected (Settings, Connections)".into())
        }
        (true, 1) => live[0],
        (true, _) => {
            return Err(format!(
                "say which system with `api`: {}",
                live.iter()
                    .map(|a| a.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ))
        }
        (false, _) => *live
            .iter()
            .find(|a| a.name.to_lowercase() == wanted)
            .ok_or_else(|| {
                format!(
                    "there is no system called {wanted}; there is: {}",
                    live.iter()
                        .map(|a| a.name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            })?,
    };
    let method = if write {
        match input["method"]
            .as_str()
            .unwrap_or("POST")
            .to_uppercase()
            .as_str()
        {
            "POST" => Method::POST,
            "PUT" => Method::PUT,
            "PATCH" => Method::PATCH,
            "DELETE" => Method::DELETE,
            other => {
                return Err(format!(
                    "{other} is not something api_send does; use POST, PUT, PATCH or DELETE"
                ))
            }
        }
    } else {
        Method::GET
    };
    let url = address(
        api,
        input["path"].as_str().unwrap_or_default(),
        &input["query"],
    )?;
    let http = reqwest::Client::builder()
        .redirect(redirect::Policy::none())
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;
    let mut request = http
        .request(method.clone(), url.clone())
        .header("accept", "application/json");
    if let Some(key) = secret(&api_account(&api.name)).filter(|k| !k.is_empty()) {
        request = request.bearer_auth(key);
    }
    if write && method != Method::DELETE || input["body"].is_object() {
        request = request.json(&if input["body"].is_object() {
            input["body"].clone()
        } else {
            json!({})
        });
    }
    let response = request.send().await.map_err(|e| {
        if e.is_timeout() {
            format!(
                "{} did not answer within {} seconds",
                api.name,
                TIMEOUT.as_secs()
            )
        } else {
            format!(
                "could not reach {} at {}",
                api.name,
                url.host_str().unwrap_or_default()
            )
        }
    })?;
    let status = response.status();
    let moved = response
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let body = response.text().await.unwrap_or_default();
    let shown = serde_json::from_str::<Value>(&body)
        .ok()
        .and_then(|v| serde_json::to_string_pretty(&v).ok())
        .unwrap_or(body);
    let line = format!("{} {} answered {}", method, url.path(), status.as_u16());
    if status.is_redirection() {
        return Err(format!(
            "{line} and pointed elsewhere ({}). It was not followed.",
            moved.unwrap_or_default()
        ));
    }
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(format!(
            "{line}: the key for {} was not accepted for this. {}",
            api.name,
            shown.chars().take(600).collect::<String>()
        ));
    }
    if status.is_success() {
        Ok(format!("{line}\n{shown}"))
    } else {
        Err(format!("{line}\n{shown}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn api(url: &str) -> OwnApi {
        OwnApi {
            name: "clean".into(),
            url: url.into(),
            about: "Start with GET /v1/admin.".into(),
            enabled: true,
        }
    }

    /// A key must never leave for anywhere but the system it was given for.
    #[test]
    fn a_request_can_only_go_to_the_system_that_was_named() {
        let clean = api("https://app.example.com/base/");
        let to = |path: &str| address(&clean, path, &Value::Null).map(|u| u.to_string());
        assert_eq!(
            to("/v1/admin").unwrap(),
            "https://app.example.com/base/v1/admin"
        );
        assert_eq!(
            to("/v1/clients?limit=5").unwrap(),
            "https://app.example.com/base/v1/clients?limit=5"
        );
        assert_eq!(
            address(&clean, "/v1/x", &json!({ "family": "sequencer", "n": 3 }))
                .unwrap()
                .query(),
            Some("family=sequencer&n=3")
        );
        for bad in [
            "https://evil.example/steal",
            "//evil.example/x",
            "v1/admin",
            "/x\\y",
            "/a://b",
        ] {
            assert!(to(bad).is_err(), "{bad}");
        }
        // Plain http is for a system on this computer only.
        assert!(address(&api("http://app.example.com"), "/v1", &Value::Null).is_err());
        assert!(address(&api("http://127.0.0.1:8080"), "/v1", &Value::Null).is_ok());
    }

    #[test]
    fn the_assistant_is_told_where_each_system_starts() {
        let mut config = Config::default();
        assert!(briefing(&config).is_none());
        config.apis.push(api("https://app.example.com"));
        let told = briefing(&config).unwrap();
        assert!(told.contains("**clean** (https://app.example.com): Start with GET /v1/admin."));
        assert_eq!(
            tools()
                .iter()
                .map(|t| (t.name.as_str(), t.writes))
                .collect::<Vec<_>>(),
            [("api_get", false), ("api_send", true)]
        );
    }
}

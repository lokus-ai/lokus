//! @part-of ai
//! Web search and page reading. The assistant asks the Lokus server, which asks the search
//! service with a key only the server holds; nothing here knows that key.

use std::time::Duration;

use serde::Deserialize;
use serde_json::{json, Value};

use crate::tools::Tool;

/// Where to ask and who is asking: the Lokus server's address and the account's sign-in.
#[derive(Debug, Clone, Deserialize)]
pub struct Web {
    pub server: String,
    pub token: String,
}

pub fn tools() -> Vec<Tool> {
    let tool = |name: &str, description: &str, field: &str, about: &str| Tool {
        name: name.into(),
        description: description.into(),
        schema: json!({ "type": "object", "properties": { field: { "type": "string", "description": about } }, "required": [field], "additionalProperties": false }),
        writes: false,
    };
    vec![
        tool(
            "web_search",
            "Search the web. Returns titles, links and short extracts. Use it when the answer is not in the workspace or its connected services; open a result with web_read before relying on it.",
            "query",
            "What to search for, in a few words.",
        ),
        tool(
            "web_read",
            "Read a web page as text, given its link.",
            "url",
            "The page's full link, starting with https://",
        ),
    ]
}

/// Run `web_search` or `web_read`. A failure is one plain line the model can carry on from.
pub async fn call(web: Option<&Web>, name: &str, input: &Value) -> Result<String, String> {
    const CARRY_ON: &str = "Carry on with the workspace and say the web could not be used.";
    let Some(web) = web.filter(|w| !w.server.is_empty() && !w.token.is_empty()) else {
        return Err(format!(
            "The web is not available: nobody is signed in to a Lokus account here. {CARRY_ON}"
        ));
    };
    let (path, body) = match name {
        "web_search" => ("search", json!({ "query": input["query"] })),
        _ => ("read", json!({ "url": input["url"] })),
    };
    let down = || {
        format!("The web is not available right now: the Lokus server did not answer. {CARRY_ON}")
    };
    let response = reqwest::Client::new()
        .post(format!(
            "{}/v1/web/{path}",
            web.server.trim_end_matches('/')
        ))
        .bearer_auth(&web.token)
        .timeout(Duration::from_secs(60))
        .json(&body)
        .send()
        .await
        .map_err(|_| down())?;
    let ok = response.status().is_success();
    let answer: Value = response.json().await.map_err(|_| down())?;
    if !ok {
        let why = answer["message"].as_str().unwrap_or("it was refused");
        return Err(format!("The web is not available: {why}. {CARRY_ON}"));
    }
    if name == "web_read" {
        let text = answer["text"].as_str().unwrap_or_default();
        let cut = if answer["cut"] == true {
            "\n[The page is longer; this is its start.]"
        } else {
            ""
        };
        return Ok(format!(
            "{}\n\n{text}{cut}",
            answer["url"].as_str().unwrap_or_default()
        ));
    }
    let found: Vec<String> = answer["results"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|r| {
            format!(
                "{}\n{}\n{}",
                r["title"].as_str().unwrap_or_default(),
                r["url"].as_str().unwrap_or_default(),
                r["extract"].as_str().unwrap_or_default()
            )
        })
        .collect();
    if found.is_empty() {
        return Ok("Nothing was found for that search.".into());
    }
    Ok(found.join("\n\n"))
}

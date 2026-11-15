//! @part-of ai
//! The two wire formats: Anthropic's Messages API for Claude, and the OpenAI
//! chat-completions format for everything else. Conversations are kept in the
//! Anthropic shape (a list of messages whose content is a list of blocks) and
//! translated on the way out for the other format.

use std::time::Duration;

use futures_util::StreamExt;
pub use reqwest::Client;
use reqwest::{RequestBuilder, Response, StatusCode};
use serde_json::{json, Map, Value};

use crate::config::{Config, Provider};
use crate::error::{AiError, Result};
use crate::tools::Tool;

const ANTHROPIC_VERSION: &str = "2026-10-21";
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
/// Models that can hand a declined request to another model on the server.
const FALLBACK_MODELS: &[&str] = &[
    "claude-fable-5-2",
    "claude-fable-5-1",
    "claude-opus-5-5",
    "claude-opus-5",
    "claude-sonnet-5-5",
];
const MAX_TOKENS: u32 = 32_000;
const ATTEMPTS: u32 = 3;
/// How long a reply may go without sending anything before it is given up on.
const QUIET: Duration = Duration::from_secs(120);

/// One reply from the model.
pub struct Turn {
    /// Content blocks, exactly as they must be sent back next time.
    pub content: Vec<Value>,
    /// `end_turn`, `tool_use`, `max_tokens`, `refusal`, …
    pub stop: String,
    /// Ids of tool calls whose arguments did not arrive as valid JSON.
    pub invalid: Vec<String>,
    /// Tokens read and written, when the provider says. Zero when it does not.
    pub tokens: (u64, u64),
}

fn network(config: &Config) -> impl Fn(reqwest::Error) -> AiError + '_ {
    |_| AiError::Network(config.url().to_string())
}

async fn refusal(response: Response) -> AiError {
    let status = response.status();
    let body: Value = response.json().await.unwrap_or_default();
    if let Some(friendly) = body["error"]["code"].as_str().and_then(plan_error) {
        return AiError::Provider(friendly.to_string());
    }
    let message = body["error"]["message"]
        .as_str()
        .or_else(|| body["detail"].as_str())
        .map(str::to_string)
        .unwrap_or_else(|| format!("the provider answered {status}"));
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => AiError::BadKey,
        StatusCode::TOO_MANY_REQUESTS => AiError::Busy,
        s if s.is_server_error() => AiError::Busy,
        _ => AiError::Provider(message),
    }
}

/// Send a request, trying again a couple of times when the provider is busy
/// or unreachable. Nothing has streamed yet at this point, so a retry is safe.
async fn send(config: &Config, build: impl Fn() -> RequestBuilder) -> Result<Response> {
    let mut last = AiError::Busy;
    for attempt in 0..ATTEMPTS {
        if attempt > 0 {
            tokio::time::sleep(Duration::from_millis(
                600 * u64::from(attempt) * u64::from(attempt),
            ))
            .await;
        }
        match build().send().await {
            Ok(response) if response.status().is_success() => return Ok(response),
            Ok(response) => match refusal(response).await {
                AiError::Busy => last = AiError::Busy,
                other => return Err(other),
            },
            Err(e) => last = network(config)(e),
        }
    }
    Err(last)
}

/// Read a server-sent-event stream, handing each event's data to `on`.
async fn events(
    response: Response,
    config: &Config,
    mut on: impl FnMut(&str) -> Result<()>,
) -> Result<()> {
    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();
    loop {
        // A reply that stops arriving must end, not leave the app showing "working" for ever.
        let chunk = match tokio::time::timeout(QUIET, stream.next()).await {
            Ok(Some(chunk)) => chunk,
            Ok(None) => break,
            Err(_) => {
                return Err(AiError::Provider(format!(
                    "The model stopped answering part-way (nothing for {} seconds). What it had done so far is kept; say \"keep going\" to carry on.",
                    QUIET.as_secs()
                )))
            }
        };
        buffer.extend_from_slice(&chunk.map_err(network(config))?);
        loop {
            let end = buffer
                .windows(2)
                .position(|w| w == b"\n\n")
                .map(|at| (at, 2))
                .into_iter()
                .chain(
                    buffer
                        .windows(4)
                        .position(|w| w == b"\r\n\r\n")
                        .map(|at| (at, 4)),
                )
                .min();
            let Some((at, gap)) = end else { break };
            let event: Vec<u8> = buffer.drain(..at + gap).collect();
            let data: Vec<&str> = std::str::from_utf8(&event[..at])
                .unwrap_or_default()
                .lines()
                .filter_map(|line| line.strip_prefix("data:"))
                .map(str::trim_start)
                .collect();
            if !data.is_empty() {
                on(&data.join("\n"))?;
            }
        }
    }
    Ok(())
}

fn add_text(block: &mut Value, key: &str, more: &str) {
    let joined = format!("{}{more}", block[key].as_str().unwrap_or_default());
    block[key] = Value::String(joined);
}

/// Tool arguments arrive as JSON text in pieces; they are only trusted once
/// they parse as an object.
fn arguments(raw: &str) -> Option<Value> {
    if raw.trim().is_empty() {
        return Some(json!({}));
    }
    serde_json::from_str::<Value>(raw)
        .ok()
        .filter(Value::is_object)
}

async fn anthropic(
    http: &Client,
    config: &Config,
    key: &str,
    system: &str,
    tools: &[Tool],
    messages: &[Value],
    on_text: &mut (dyn FnMut(&str) + Send),
) -> Result<Turn> {
    let model = config.model()?;
    let mut body = json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "stream": true,
        // The system prompt and tool list never change mid-conversation, so
        // everything before the newest message is read from the cache.
        "cache_control": { "type": "ephemeral" },
        "system": [{ "type": "text", "text": system }],
        "messages": messages,
    });
    if !tools.is_empty() {
        body["tools"] = tools
            .iter()
            .map(|t| {
                json!({
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.schema,
                    "eager_input_streaming": true,
                })
            })
            .collect();
    }
    let fallback = FALLBACK_MODELS.contains(&model);
    if fallback {
        // If the model declines a request, the provider retries it on another one.
        body["fallbacks"] = json!("default");
    }
    let response = send(config, || {
        let request = http
            .post(format!("{}/v1/messages", config.url()))
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&body);
        if fallback {
            request.header("anthropic-beta", FALLBACK_BETA)
        } else {
            request
        }
    })
    .await?;

    let mut blocks: Vec<Value> = Vec::new();
    let mut partial: Vec<String> = Vec::new();
    let mut invalid = Vec::new();
    let mut stop = String::from("end_turn");
    let mut tokens = (0u64, 0u64);
    events(response, config, |data| {
        let Ok(event) = serde_json::from_str::<Value>(data) else {
            return Ok(());
        };
        let index = event["index"].as_u64().unwrap_or(0) as usize;
        match event["type"].as_str().unwrap_or_default() {
            "content_block_start" => {
                while blocks.len() <= index {
                    blocks.push(Value::Null);
                    partial.push(String::new());
                }
                blocks[index] = event["content_block"].clone();
            }
            "content_block_delta" if index < blocks.len() => {
                let delta = &event["delta"];
                match delta["type"].as_str().unwrap_or_default() {
                    "text_delta" => {
                        let text = delta["text"].as_str().unwrap_or_default();
                        add_text(&mut blocks[index], "text", text);
                        on_text(text);
                    }
                    "input_json_delta" => {
                        partial[index].push_str(delta["partial_json"].as_str().unwrap_or_default())
                    }
                    "thinking_delta" => add_text(
                        &mut blocks[index],
                        "thinking",
                        delta["thinking"].as_str().unwrap_or_default(),
                    ),
                    "signature_delta" => blocks[index]["signature"] = delta["signature"].clone(),
                    _ => {}
                }
            }
            "content_block_stop" if index < blocks.len() && blocks[index]["type"] == "tool_use" => {
                match arguments(&partial[index]) {
                    Some(input) => blocks[index]["input"] = input,
                    None => {
                        blocks[index]["input"] = json!({});
                        invalid.push(blocks[index]["id"].as_str().unwrap_or_default().to_string());
                    }
                }
            }
            "message_start" => {
                let usage = &event["message"]["usage"];
                tokens.0 = [
                    "input_tokens",
                    "cache_read_input_tokens",
                    "cache_creation_input_tokens",
                ]
                .iter()
                .filter_map(|k| usage[*k].as_u64())
                .sum();
            }
            "message_delta" => {
                if let Some(reason) = event["delta"]["stop_reason"].as_str() {
                    stop = reason.to_string();
                }
                if let Some(written) = event["usage"]["output_tokens"].as_u64() {
                    tokens.1 = written;
                }
            }
            "error" => {
                let message = event["error"]["message"]
                    .as_str()
                    .unwrap_or("the provider failed");
                return Err(if event["error"]["type"] == "overloaded_error" {
                    AiError::Busy
                } else {
                    AiError::Provider(message.to_string())
                });
            }
            _ => {}
        }
        Ok(())
    })
    .await?;
    blocks.retain(|b| !b.is_null());
    Ok(Turn {
        content: blocks,
        stop,
        invalid,
        tokens,
    })
}

/// Our message list in the chat-completions shape.
fn to_openai(system: &str, messages: &[Value]) -> Vec<Value> {
    let mut out = vec![json!({ "role": "system", "content": system })];
    for message in messages {
        let role = message["role"].as_str().unwrap_or("user");
        let blocks: Vec<Value> = match &message["content"] {
            Value::String(text) => vec![json!({ "type": "text", "text": text })],
            Value::Array(blocks) => blocks.clone(),
            _ => Vec::new(),
        };
        let text: Vec<&str> = blocks
            .iter()
            .filter(|b| b["type"] == "text")
            .filter_map(|b| b["text"].as_str())
            .collect();
        if role == "assistant" {
            let calls: Vec<Value> = blocks
                .iter()
                .filter(|b| b["type"] == "tool_use")
                .map(|b| {
                    json!({
                        "id": b["id"],
                        "type": "function",
                        "function": { "name": b["name"], "arguments": b["input"].to_string() },
                    })
                })
                .collect();
            let mut entry = Map::new();
            entry.insert("role".into(), json!("assistant"));
            entry.insert("content".into(), json!(text.join("")));
            if !calls.is_empty() {
                entry.insert("tool_calls".into(), Value::Array(calls));
            }
            out.push(Value::Object(entry));
            continue;
        }
        for block in blocks.iter().filter(|b| b["type"] == "tool_result") {
            let content = match &block["content"] {
                Value::String(text) => text.clone(),
                other => other.to_string(),
            };
            out.push(
                json!({ "role": "tool", "tool_call_id": block["tool_use_id"], "content": content }),
            );
        }
        // A picture goes as a picture: the message becomes parts, the words first.
        let pictures: Vec<Value> = blocks
            .iter()
            .filter_map(data_url)
            .map(|url| json!({ "type": "image_url", "image_url": { "url": url } }))
            .collect();
        if !pictures.is_empty() {
            let mut parts = vec![json!({ "type": "text", "text": text.join("\n") })];
            parts.extend(pictures);
            out.push(json!({ "role": "user", "content": parts }));
        } else if !text.is_empty() {
            out.push(json!({ "role": "user", "content": text.join("\n") }));
        }
    }
    out
}

/// An attached picture as the address-with-the-bytes-in-it that OpenAI's APIs take.
fn data_url(block: &Value) -> Option<String> {
    if block["type"] != "image" {
        return None;
    }
    Some(format!(
        "data:{};base64,{}",
        block["source"]["media_type"].as_str()?,
        block["source"]["data"].as_str()?
    ))
}

async fn openai(
    http: &Client,
    config: &Config,
    key: &str,
    system: &str,
    tools: &[Tool],
    messages: &[Value],
    on_text: &mut (dyn FnMut(&str) + Send),
) -> Result<Turn> {
    let mut body = json!({
        "model": config.model()?,
        "stream": true,
        "messages": to_openai(system, messages),
    });
    if !tools.is_empty() {
        body["tools"] = tools
            .iter()
            .map(|t| {
                json!({
                    "type": "function",
                    "function": { "name": t.name, "description": t.description, "parameters": t.schema },
                })
            })
            .collect();
    }
    let response = send(config, || {
        http.post(format!("{}/chat/completions", config.url()))
            .bearer_auth(key)
            .json(&body)
    })
    .await?;

    let mut text = String::new();
    // (id, name, arguments so far), by the index the provider gives each call.
    let mut calls: Vec<(String, String, String)> = Vec::new();
    let mut stop = String::from("end_turn");
    let mut tokens = (0u64, 0u64);
    events(response, config, |data| {
        let Ok(event) = serde_json::from_str::<Value>(data) else {
            return Ok(());
        };
        if let Some(message) = event["error"]["message"].as_str() {
            return Err(AiError::Provider(message.to_string()));
        }
        if event["usage"].is_object() {
            tokens = (
                event["usage"]["prompt_tokens"].as_u64().unwrap_or(0),
                event["usage"]["completion_tokens"].as_u64().unwrap_or(0),
            );
        }
        let choice = &event["choices"][0];
        if let Some(piece) = choice["delta"]["content"].as_str() {
            text.push_str(piece);
            on_text(piece);
        }
        for call in choice["delta"]["tool_calls"]
            .as_array()
            .into_iter()
            .flatten()
        {
            let index = call["index"].as_u64().unwrap_or(0) as usize;
            while calls.len() <= index {
                calls.push(Default::default());
            }
            let entry = &mut calls[index];
            if let Some(id) = call["id"].as_str() {
                entry.0 = id.to_string();
            }
            if let Some(name) = call["function"]["name"].as_str() {
                entry.1.push_str(name);
            }
            if let Some(more) = call["function"]["arguments"].as_str() {
                entry.2.push_str(more);
            }
        }
        match choice["finish_reason"].as_str() {
            Some("tool_calls") => stop = "tool_use".into(),
            Some("length") => stop = "max_tokens".into(),
            Some("content_filter") => stop = "refusal".into(),
            _ => {}
        }
        Ok(())
    })
    .await?;

    let mut content = Vec::new();
    let mut invalid = Vec::new();
    if !text.is_empty() {
        content.push(json!({ "type": "text", "text": text }));
    }
    for (id, name, raw) in calls {
        let input = arguments(&raw).unwrap_or_else(|| {
            invalid.push(id.clone());
            json!({})
        });
        content.push(json!({ "type": "tool_use", "id": id, "name": name, "input": input }));
    }
    if content.iter().any(|b| b["type"] == "tool_use") && stop == "end_turn" {
        stop = "tool_use".into();
    }
    Ok(Turn {
        content,
        stop,
        invalid,
        tokens,
    })
}

/// What to tell the person when their ChatGPT plan cannot serve a request.
fn plan_error(code: &str) -> Option<&'static str> {
    Some(match code {
        "subscription_sharing_user_not_eligible" => {
            "This ChatGPT account cannot use its plan in other apps (it needs Plus or Pro)."
        }
        "subscription_sharing_usage_limit_exceeded" => {
            "Your ChatGPT plan's limit for this app is used up. See https://chatgpt.com/settings/usage"
        }
        "subscription_sharing_usage_unavailable" => {
            "ChatGPT plan usage is unavailable right now; try again in a moment."
        }
        "subscription_sharing_unsupported_capability" | "subscription_sharing_route_not_supported" => {
            "This model or feature is not available through a ChatGPT plan."
        }
        "subscription_sharing_invalid_user" => "Sign in with ChatGPT again in Settings.",
        _ => return None,
    })
}

/// Our message list as input items for the Responses API.
fn to_responses(messages: &[Value]) -> Vec<Value> {
    let mut out = Vec::new();
    for message in messages {
        let role = message["role"].as_str().unwrap_or("user");
        let blocks: Vec<Value> = match &message["content"] {
            Value::String(text) => vec![json!({ "type": "text", "text": text })],
            Value::Array(blocks) => blocks.clone(),
            _ => Vec::new(),
        };
        for block in &blocks {
            match block["type"].as_str().unwrap_or_default() {
                "text" => out.push(json!({ "role": role, "content": block["text"] })),
                "tool_use" => out.push(json!({
                    "type": "function_call",
                    "call_id": block["id"],
                    "name": block["name"],
                    "arguments": block["input"].to_string(),
                })),
                "tool_result" => {
                    let output = match &block["content"] {
                        Value::String(text) => text.clone(),
                        other => other.to_string(),
                    };
                    out.push(json!({ "type": "function_call_output", "call_id": block["tool_use_id"], "output": output }));
                }
                "image" => {
                    if let Some(url) = data_url(block) {
                        out.push(json!({ "role": "user", "content": [{ "type": "input_image", "image_url": url }] }));
                    }
                }
                _ => {}
            }
        }
    }
    out
}

/// The OpenAI Responses API, which is what a ChatGPT plan is served through.
async fn responses(
    http: &Client,
    config: &Config,
    key: &str,
    system: &str,
    tools: &[Tool],
    messages: &[Value],
    on_text: &mut (dyn FnMut(&str) + Send),
) -> Result<Turn> {
    let mut body = json!({
        "model": config.model()?,
        "instructions": system,
        "input": to_responses(messages),
        "stream": true,
        "store": false,
    });
    if !tools.is_empty() {
        body["tools"] = tools
            .iter()
            // Not strict: in strict mode every field of a tool must be filled in, so the model sent
            // an empty value for each optional one, and services such as Slack refuse an empty
            // channel id or cursor (2026-11-13).
            .map(|t| json!({ "type": "function", "name": t.name, "description": t.description, "parameters": t.schema, "strict": false }))
            .collect();
    }
    let response = send(config, || {
        http.post(format!("{}/responses", config.url()))
            .bearer_auth(key)
            .json(&body)
    })
    .await?;

    let mut content: Vec<Value> = Vec::new();
    let mut text = String::new();
    let mut invalid = Vec::new();
    let mut stop = String::new();
    let mut tokens = (0u64, 0u64);
    events(response, config, |data| {
        let Ok(event) = serde_json::from_str::<Value>(data) else {
            return Ok(());
        };
        match event["type"].as_str().unwrap_or_default() {
            "response.output_text.delta" => {
                let piece = event["delta"].as_str().unwrap_or_default();
                text.push_str(piece);
                on_text(piece);
            }
            "response.output_item.done" if event["item"]["type"] == "function_call" => {
                let item = &event["item"];
                let id = item["call_id"].as_str().unwrap_or_default().to_string();
                let input = arguments(item["arguments"].as_str().unwrap_or_default())
                    .unwrap_or_else(|| {
                        invalid.push(id.clone());
                        json!({})
                    });
                content.push(
                    json!({ "type": "tool_use", "id": id, "name": item["name"], "input": input }),
                );
            }
            "response.completed" => {
                stop = "end_turn".into();
                let usage = &event["response"]["usage"];
                tokens = (
                    usage["input_tokens"].as_u64().unwrap_or(0),
                    usage["output_tokens"].as_u64().unwrap_or(0),
                );
            }
            "response.incomplete" => stop = "max_tokens".into(),
            "response.failed" | "error" => {
                let error = if event["response"]["error"].is_object() {
                    &event["response"]["error"]
                } else {
                    &event["error"]
                };
                let message = error["code"]
                    .as_str()
                    .and_then(plan_error)
                    .or_else(|| error["message"].as_str())
                    .unwrap_or("the request failed");
                return Err(AiError::Provider(message.to_string()));
            }
            _ => {}
        }
        Ok(())
    })
    .await?;
    if stop.is_empty() {
        // The stream ended without saying it was complete.
        return Err(AiError::Network(config.url().to_string()));
    }
    if !text.is_empty() {
        content.insert(0, json!({ "type": "text", "text": text }));
    }
    if stop == "end_turn" && content.iter().any(|b| b["type"] == "tool_use") {
        stop = "tool_use".into();
    }
    Ok(Turn {
        content,
        stop,
        invalid,
        tokens,
    })
}

/// Ask the model for its next turn, streaming text to `on_text` as it comes.
pub async fn turn(
    http: &Client,
    config: &Config,
    key: &str,
    system: &str,
    tools: &[Tool],
    messages: &[Value],
    on_text: &mut (dyn FnMut(&str) + Send),
) -> Result<Turn> {
    match config.provider {
        Provider::Anthropic => anthropic(http, config, key, system, tools, messages, on_text).await,
        Provider::OpenAi => openai(http, config, key, system, tools, messages, on_text).await,
        Provider::ChatGpt => responses(http, config, key, system, tools, messages, on_text).await,
    }
}

/// The models the key can use, newest first where the provider says so.
pub async fn models(http: &Client, config: &Config, key: &str) -> Result<Vec<String>> {
    let response = send(config, || match config.provider {
        Provider::Anthropic => http
            .get(format!("{}/v1/models?limit=100", config.url()))
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION),
        Provider::OpenAi | Provider::ChatGpt => http
            .get(format!("{}/models", config.url()))
            .bearer_auth(key),
    })
    .await?;
    let body: Value = response.json().await.map_err(network(config))?;
    Ok(model_ids(&body, config.provider))
}

/// The usable model names in a provider's answer. A key's models come as `data[].id`; a ChatGPT
/// plan's come as `models[].slug`, already in the order ChatGPT recommends them.
fn model_ids(body: &Value, provider: Provider) -> Vec<String> {
    let (list, name) = match body["models"].as_array() {
        Some(list) => (Some(list), "slug"),
        None => (body["data"].as_array(), "id"),
    };
    let mut ids: Vec<String> = list
        .into_iter()
        .flatten()
        .filter(|m| m["visibility"].is_null() || m["visibility"] == "list")
        .filter_map(|m| m[name].as_str().map(str::to_string))
        .collect();
    if provider == Provider::OpenAi {
        ids.sort();
    }
    ids
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_chatgpt_plan_lists_its_models_by_slug_and_hides_the_hidden_ones() {
        // The shape ChatGPT answered with on 2026-11-13; the first version read only `data[].id` and showed nothing.
        let body = json!({ "models": [
            { "slug": "gpt-6.1-sol", "display_name": "GPT-6.1-Sol", "visibility": "list", "priority": 1 },
            { "slug": "gpt-reserve", "display_name": "GPT-Reserve", "visibility": "hide", "priority": 5 },
            { "slug": "gpt-6-astra", "display_name": "GPT-6-Astra", "visibility": "list", "priority": 2 },
        ] });
        assert_eq!(
            model_ids(&body, Provider::ChatGpt),
            ["gpt-6.1-sol", "gpt-6-astra"]
        );
        let keyed = json!({ "data": [{ "id": "b" }, { "id": "a" }] });
        assert_eq!(model_ids(&keyed, Provider::OpenAi), ["a", "b"]);
    }

    #[test]
    fn tool_arguments_must_be_a_json_object() {
        assert_eq!(arguments(""), Some(json!({})));
        assert_eq!(arguments("{\"a\":1}"), Some(json!({ "a": 1 })));
        assert_eq!(arguments("{\"a\":"), None);
        assert_eq!(arguments("[1]"), None);
    }

    #[test]
    fn a_tool_round_trip_translates_to_chat_completions() {
        let messages = vec![
            json!({ "role": "user", "content": "find it" }),
            json!({ "role": "assistant", "content": [
                { "type": "thinking", "thinking": "", "signature": "s" },
                { "type": "text", "text": "Looking." },
                { "type": "tool_use", "id": "c1", "name": "search_notes", "input": { "query": "x" } },
            ] }),
            json!({ "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "c1", "content": "[]" }] }),
        ];
        let out = to_openai("sys", &messages);
        assert_eq!(out.len(), 4);
        assert_eq!(
            out[2]["tool_calls"][0]["function"]["arguments"],
            "{\"query\":\"x\"}"
        );
        assert_eq!(
            out[3],
            json!({ "role": "tool", "tool_call_id": "c1", "content": "[]" })
        );
    }
}

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

/// One reply from the model.
pub struct Turn {
    /// Content blocks, exactly as they must be sent back next time.
    pub content: Vec<Value>,
    /// `end_turn`, `tool_use`, `max_tokens`, `refusal`, …
    pub stop: String,
    /// Ids of tool calls whose arguments did not arrive as valid JSON.
    pub invalid: Vec<String>,
}

fn network(config: &Config) -> impl Fn(reqwest::Error) -> AiError + '_ {
    |_| AiError::Network(config.url().to_string())
}

async fn refusal(response: Response) -> AiError {
    let status = response.status();
    let body: Value = response.json().await.unwrap_or_default();
    let message = body["error"]["message"]
        .as_str()
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
    while let Some(chunk) = stream.next().await {
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
            "message_delta" => {
                if let Some(reason) = event["delta"]["stop_reason"].as_str() {
                    stop = reason.to_string();
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
        if !text.is_empty() {
            out.push(json!({ "role": "user", "content": text.join("\n") }));
        }
    }
    out
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
    events(response, config, |data| {
        let Ok(event) = serde_json::from_str::<Value>(data) else {
            return Ok(());
        };
        if let Some(message) = event["error"]["message"].as_str() {
            return Err(AiError::Provider(message.to_string()));
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
    }
}

/// The models the key can use, newest first where the provider says so.
pub async fn models(http: &Client, config: &Config, key: &str) -> Result<Vec<String>> {
    let response = send(config, || match config.provider {
        Provider::Anthropic => http
            .get(format!("{}/v1/models?limit=100", config.url()))
            .header("x-api-key", key)
            .header("anthropic-version", ANTHROPIC_VERSION),
        Provider::OpenAi => http
            .get(format!("{}/models", config.url()))
            .bearer_auth(key),
    })
    .await?;
    let body: Value = response.json().await.map_err(network(config))?;
    let mut ids: Vec<String> = body["data"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|m| m["id"].as_str().map(str::to_string))
        .collect();
    if config.provider == Provider::OpenAi {
        ids.sort();
    }
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;

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

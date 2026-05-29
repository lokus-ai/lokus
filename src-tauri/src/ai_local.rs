//! Local model integration — Ollama.
//!
//! Provides $0, fully-offline LLM completion + embeddings by talking to a
//! locally-running Ollama daemon (default `http://127.0.0.1:11434`). These
//! commands are the "local" backend of the client `AIProvider`/`ModelRouter`:
//! ambient/ghost surfaces and the embeddings pipeline route here when Ollama is
//! available, so they never spend credits and never leave the machine.
//!
//! `ollama_stream_request` deliberately emits the **same** Tauri events as
//! `llm_stream_request` (`lokus:llm-chunk:{session_id}` / `lokus:llm-done:{session_id}`)
//! so the existing JS listen/unlisten streaming loop works unchanged — the
//! frontend just passes `provider: "ollama"`.
//!
//! Gating: these use `reqwest`, which lives in the
//! `cfg(not(any(target_os = "ios", target_os = "android")))` target block of
//! `Cargo.toml`, so they are gated identically (NOT a generic `#[cfg(desktop)]`).

#![cfg(not(any(target_os = "ios", target_os = "android")))]

use serde::{Deserialize, Serialize};
use tauri::Emitter;

/// Base URL of the local Ollama daemon. Overridable via `OLLAMA_BASE_URL`
/// (matches the proxy env var name) so power users can point at a remote box.
fn ollama_base_url() -> String {
    std::env::var("OLLAMA_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:11434".to_string())
}

#[derive(Debug, Serialize)]
pub struct OllamaStatus {
    pub running: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OllamaModel {
    pub name: String,
    #[serde(default)]
    pub size: u64,
}

#[derive(Debug, Deserialize)]
struct OllamaVersionResp {
    version: String,
}

/// Cheap liveness probe — `GET /api/version`. Never errors: a down daemon is a
/// normal, expected state (the router degrades rather than failing).
#[tauri::command]
pub async fn ollama_check() -> OllamaStatus {
    let client = reqwest::Client::new();
    let url = format!("{}/api/version", ollama_base_url());

    match client
        .get(&url)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            let version = resp.json::<OllamaVersionResp>().await.ok().map(|v| v.version);
            OllamaStatus { running: true, version }
        }
        _ => OllamaStatus { running: false, version: None },
    }
}

/// List locally-pulled models — `GET /api/tags`.
#[tauri::command]
pub async fn ollama_list_models() -> Result<Vec<OllamaModel>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", ollama_base_url());

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Ollama not reachable: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama /api/tags failed ({})", resp.status().as_u16()));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama model list: {}", e))?;

    let models = body
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    let name = m.get("name")?.as_str()?.to_string();
                    let size = m.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
                    Some(OllamaModel { name, size })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

/// Stream a chat completion from Ollama.
///
/// Ollama's `/api/chat` returns **NDJSON** (one JSON object per line), e.g.
/// `{"message":{"content":"…"},"done":false}`, NOT SSE — so we split the byte
/// stream on `\n` and parse each complete line. The final line is `done:true`
/// and carries `eval_count` / `prompt_eval_count` token counters.
///
/// Emits, per the shared streaming contract:
///   - `lokus:llm-chunk:{session_id}`  with `{ "text": "<delta>" }`
///   - `lokus:llm-done:{session_id}`   with `{ "prompt_tokens", "completion_tokens" }`
#[tauri::command]
pub async fn ollama_stream_request(
    app: tauri::AppHandle,
    session_id: String,
    model: String,
    system_prompt: String,
    user_prompt: String,
    stream: bool,
) -> Result<serde_json::Value, String> {
    use futures_util::StreamExt;

    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", ollama_base_url());

    let mut messages = Vec::new();
    if !system_prompt.is_empty() {
        messages.push(serde_json::json!({ "role": "system", "content": system_prompt }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": user_prompt }));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": stream,
    });

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API error ({}): {}", status, text));
    }

    // Non-streaming: return the whole NDJSON object (single line).
    if !stream {
        let parsed: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
        let text = parsed
            .pointer("/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        return Ok(serde_json::json!({
            "content": [{ "text": text }],
            "prompt_tokens": parsed.get("prompt_eval_count").and_then(|v| v.as_u64()).unwrap_or(0),
            "completion_tokens": parsed.get("eval_count").and_then(|v| v.as_u64()).unwrap_or(0),
        }));
    }

    let chunk_event = format!("lokus:llm-chunk:{}", session_id);
    let done_event = format!("lokus:llm-done:{}", session_id);

    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut prompt_tokens: u64 = 0;
    let mut completion_tokens: u64 = 0;

    while let Some(chunk_result) = byte_stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Ollama stream read error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // NDJSON: one JSON object per newline-terminated line.
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                let text = json
                    .pointer("/message/content")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if !text.is_empty() {
                    let _ = app.emit(&chunk_event, serde_json::json!({ "text": text }));
                }

                if json.get("done").and_then(|v| v.as_bool()) == Some(true) {
                    prompt_tokens =
                        json.get("prompt_eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
                    completion_tokens =
                        json.get("eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
                }
            }
        }
    }

    let _ = app.emit(
        &done_event,
        serde_json::json!({
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
        }),
    );

    Ok(serde_json::json!({ "done": true }))
}

/// Pull (download) a model — `POST /api/pull`, NDJSON progress stream.
/// Emits `lokus:ollama-pull:{model}` with each `{status, completed?, total?}`
/// progress object so the UI can render a download bar.
#[tauri::command]
pub async fn ollama_pull_model(app: tauri::AppHandle, model: String) -> Result<(), String> {
    use futures_util::StreamExt;

    let client = reqwest::Client::new();
    let url = format!("{}/api/pull", ollama_base_url());
    let progress_event = format!("lokus:ollama-pull:{}", model);

    let response = client
        .post(&url)
        .json(&serde_json::json!({ "model": model, "stream": true }))
        .send()
        .await
        .map_err(|e| format!("Ollama pull failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        return Err(format!("Ollama pull error ({})", status));
    }

    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = byte_stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Ollama pull read error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();
            if line.is_empty() {
                continue;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                let _ = app.emit(&progress_event, json);
            }
        }
    }

    Ok(())
}

/// Generate an embedding for a single text — `POST /api/embeddings`.
/// Returns the raw float vector (768-dim for `nomic-embed-text`). The JS
/// `embed()` helper batches many texts over this one-at-a-time command.
#[tauri::command]
pub async fn ollama_embed(model: String, text: String) -> Result<Vec<f32>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/embeddings", ollama_base_url());

    let response = client
        .post(&url)
        .json(&serde_json::json!({ "model": model, "prompt": text }))
        .send()
        .await
        .map_err(|e| format!("Ollama embed failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama embed error ({}): {}", status, body));
    }

    let parsed: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama embedding: {}", e))?;

    let embedding = parsed
        .get("embedding")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Ollama response missing `embedding` array".to_string())?
        .iter()
        .map(|n| n.as_f64().unwrap_or(0.0) as f32)
        .collect();

    Ok(embedding)
}

//! Deepgram WebSocket streaming transcription module for Lokus.
//!
//! Connects to the Deepgram live transcription API (or a Lokus proxy), forwards
//! raw PCM audio received via [`lokus:audio-chunk`] Tauri events, and emits
//! [`lokus:transcript-update`] events to the frontend as Deepgram returns
//! transcript results.
//!
//! # Connection modes
//!
//! - **BYOK** (`mode = "byok"`) — connects directly to
//!   `wss://api.deepgram.com/v1/listen` using the user-supplied API key.
//! - **Proxy** (`mode = "proxy"`) — connects to a Supabase Edge Function
//!   WebSocket URL supplied in `proxy_url`.  The edge function authenticates
//!   to Deepgram on the caller's behalf.
//!
//! # Audio flow
//!
//! ```text
//! [OS mic] ──cpal──► audio.rs ──lokus:audio-chunk──► transcription.rs
//!                                                          │
//!                                                 base64-decode PCM
//!                                                          │
//!                                             WebSocket binary frame
//!                                                          │
//!                                               Deepgram / proxy
//!                                                          │
//!                                              JSON transcript result
//!                                                          │
//!                                           lokus:transcript-update
//!                                                          │
//!                                                      Frontend
//! ```
//!
//! # Keep-alive
//!
//! Deepgram requires that either audio data or a keep-alive message is sent at
//! least every 12 seconds.  A background timer fires every 8 seconds to send
//! `{"type":"KeepAlive"}` when no audio has been forwarded recently.
//!
//! # Reconnection
//!
//! On unexpected WebSocket closure, the module retries up to
//! [`MAX_RETRIES`] times with exponential back-off (1 s → 2 s → 4 s).
//! After all retries are exhausted a [`lokus:transcription-error`] event is
//! emitted and the state machine resets to `Idle`.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{Emitter, Listener};
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Deepgram streaming API endpoint.
const DEEPGRAM_URL: &str = "wss://api.deepgram.com/v1/listen";

/// Query string appended to the Deepgram URL (BYOK mode only).
const DEEPGRAM_QUERY: &str =
    "model=nova-2&language=en&punctuate=true&diarize=true&smart_format=true\
     &encoding=linear16&sample_rate=16000&channels=1";

/// Keep-alive interval.  Deepgram requires traffic at least every 12 s.
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(8);

/// Maximum number of reconnection attempts on unexpected WebSocket closure.
const MAX_RETRIES: u32 = 3;

/// Base delay for exponential back-off between retries.
const RETRY_BASE_DELAY: Duration = Duration::from_secs(1);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Configuration passed by the frontend when starting a transcription session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionConfig {
    /// Deepgram API key (used in BYOK mode).
    pub api_key: String,

    /// Connection mode: `"byok"` or `"proxy"`.
    pub mode: String,

    /// Proxy WebSocket URL (required when `mode == "proxy"`).
    pub proxy_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Internal Deepgram response types
// ---------------------------------------------------------------------------

/// A single word inside a Deepgram transcript alternative.
#[derive(Debug, Clone, Deserialize, Serialize)]
struct DgWord {
    word: String,
    start: f64,
    end: f64,
    #[serde(default)]
    speaker: u32,
    #[serde(default)]
    confidence: f64,
}

/// A single transcript alternative from Deepgram.
#[derive(Debug, Clone, Deserialize)]
struct DgAlternative {
    transcript: String,
    #[serde(default)]
    words: Vec<DgWord>,
}

/// The `channel` object inside a Deepgram `Results` message.
#[derive(Debug, Clone, Deserialize)]
struct DgChannel {
    alternatives: Vec<DgAlternative>,
}

/// A full Deepgram streaming message.  We only use the `Results` and `Error`
/// types; all other types are silently ignored.
#[derive(Debug, Clone, Deserialize)]
struct DgMessage {
    #[serde(rename = "type")]
    msg_type: String,

    /// Present when `msg_type == "Results"`.
    channel: Option<DgChannel>,

    /// Whether this result is final (as opposed to interim).
    #[serde(default)]
    is_final: bool,

    /// Whether the current speech segment has ended.
    #[serde(default)]
    speech_final: bool,

    /// Present when `msg_type == "Error"`.
    description: Option<String>,
}

// ---------------------------------------------------------------------------
// Frontend event payloads
// ---------------------------------------------------------------------------

/// A single word in the frontend transcript event.
#[derive(Debug, Clone, Serialize)]
pub struct TranscriptWord {
    pub word: String,
    pub start: f64,
    pub end: f64,
    pub speaker: u32,
}

/// Payload emitted on `lokus:transcript-update`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptUpdatePayload {
    /// The full transcript text for this result.
    pub text: String,
    /// Speaker identifier (0-based) — taken from the first word, defaulting
    /// to 0 when diarisation is unavailable.
    pub speaker: u32,
    /// Start timestamp of the first word in seconds.
    pub timestamp: f64,
    /// Whether this is a final (non-revisable) result.
    pub is_final: bool,
    /// Whether this marks the end of a speech segment.
    pub speech_final: bool,
    /// Individual word-level detail.
    pub words: Vec<TranscriptWord>,
}

/// Payload emitted on `lokus:transcription-error`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionErrorPayload {
    pub error: String,
}

// ---------------------------------------------------------------------------
// Global transcription state
// ---------------------------------------------------------------------------

/// Everything that must survive across Tauri command invocations.
struct TranscriptionState {
    /// Whether a session is currently active.
    is_running: bool,

    /// Signals the WebSocket task to shut down cleanly.
    stop_flag: Arc<AtomicBool>,

    /// Channel used to push raw PCM bytes from the audio-chunk listener into
    /// the WebSocket sender task.
    audio_tx: Option<tokio::sync::mpsc::UnboundedSender<Vec<u8>>>,

    /// Handle to the `lokus:audio-chunk` event listener so it can be
    /// unregistered on stop.
    listener_id: Option<tauri::EventId>,
}

impl TranscriptionState {
    fn new() -> Self {
        Self {
            is_running: false,
            stop_flag: Arc::new(AtomicBool::new(false)),
            audio_tx: None,
            listener_id: None,
        }
    }
}

static TRANSCRIPTION_STATE: Lazy<Arc<Mutex<TranscriptionState>>> =
    Lazy::new(|| Arc::new(Mutex::new(TranscriptionState::new())));

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Start a live transcription session.
///
/// Connects to Deepgram (directly or via proxy), registers a listener for
/// `lokus:audio-chunk` events, and forwards decoded PCM bytes to the
/// WebSocket.  Deepgram transcript results are emitted back to the frontend
/// as `lokus:transcript-update` events.
///
/// # Errors
///
/// Returns an error string if a session is already running or if the initial
/// WebSocket connection cannot be established.
///
/// # Examples
///
/// ```rust,ignore
/// start_transcription(
///     app,
///     TranscriptionConfig {
///         api_key: "dg_...".into(),
///         mode: "byok".into(),
///         proxy_url: None,
///     },
/// ).await.expect("transcription started");
/// ```
#[tauri::command]
pub async fn start_transcription(
    app: tauri::AppHandle,
    config: TranscriptionConfig,
) -> Result<(), String> {
    // Guard against double-start.
    {
        let state = TRANSCRIPTION_STATE.lock().await;
        if state.is_running {
            return Err("Transcription is already running".to_string());
        }
    }

    // Validate config.
    if config.mode == "proxy" && config.proxy_url.is_none() {
        return Err("proxy_url is required when mode is 'proxy'".to_string());
    }

    // Reset stop flag and create the inter-task channel.
    let stop_flag = Arc::new(AtomicBool::new(false));
    let (audio_tx, audio_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();

    // Clone handles for the audio-chunk listener closure.
    let audio_tx_for_listener = audio_tx.clone();
    let stop_flag_for_listener = Arc::clone(&stop_flag);

    // Register the audio-chunk event listener.
    let listener_id = app.listen("lokus:audio-chunk", move |event: tauri::Event| {
        // If we are shutting down, ignore incoming chunks.
        if stop_flag_for_listener.load(Ordering::Relaxed) {
            return;
        }

        // Decode the JSON payload.
        let payload: Value = match serde_json::from_str(event.payload()) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "Failed to parse audio-chunk payload");
                return;
            }
        };

        let data_b64 = match payload.get("data").and_then(Value::as_str) {
            Some(s) => s.to_owned(),
            None => {
                tracing::warn!("audio-chunk payload missing 'data' field");
                return;
            }
        };

        let pcm_bytes = match BASE64.decode(&data_b64) {
            Ok(b) => b,
            Err(e) => {
                tracing::warn!(error = %e, "Failed to base64-decode audio chunk");
                return;
            }
        };

        if pcm_bytes.is_empty() {
            return;
        }

        // Forward to the WebSocket task — drop if the channel is full (no back-pressure block).
        if audio_tx_for_listener.send(pcm_bytes).is_err() {
            tracing::debug!("audio-chunk sender dropped; listener teardown in progress");
        }
    });

    // Store state.
    {
        let mut state = TRANSCRIPTION_STATE.lock().await;
        state.is_running = true;
        state.stop_flag = Arc::clone(&stop_flag);
        state.audio_tx = Some(audio_tx);
        state.listener_id = Some(listener_id);
    }

    // Spawn the WebSocket management task.
    let app_clone = app.clone();
    let stop_flag_ws = Arc::clone(&stop_flag);

    tauri::async_runtime::spawn(run_websocket_manager(
        app_clone,
        config,
        audio_rx,
        stop_flag_ws,
    ));

    tracing::info!("Transcription session started");
    Ok(())
}

/// Stop the active transcription session.
///
/// Signals the WebSocket task to close the connection, unregisters the
/// audio-chunk listener, and resets internal state.  Safe to call when no
/// session is active.
#[tauri::command]
pub async fn stop_transcription(app: tauri::AppHandle) -> Result<(), String> {
    let mut state = TRANSCRIPTION_STATE.lock().await;

    if !state.is_running {
        return Ok(());
    }

    // Signal background tasks to stop.
    state.stop_flag.store(true, Ordering::Relaxed);

    // Unregister the audio-chunk listener.
    if let Some(id) = state.listener_id.take() {
        app.unlisten(id);
    }

    // Dropping the sender closes the channel, which will cause the WebSocket
    // task to flush and exit.
    state.audio_tx = None;
    state.is_running = false;

    tracing::info!("Transcription session stopped");
    Ok(())
}

// ---------------------------------------------------------------------------
// WebSocket management task
// ---------------------------------------------------------------------------

/// Manages the lifetime of the Deepgram WebSocket connection.
///
/// Implements the reconnection loop with exponential back-off.  Each attempt
/// delegates to [`run_websocket_session`].  If all retries are exhausted a
/// `lokus:transcription-error` event is emitted.
async fn run_websocket_manager(
    app: tauri::AppHandle,
    config: TranscriptionConfig,
    mut audio_rx: tokio::sync::mpsc::UnboundedReceiver<Vec<u8>>,
    stop_flag: Arc<AtomicBool>,
) {
    let mut attempt = 0u32;

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            tracing::debug!("WebSocket manager: stop flag set; exiting");
            break;
        }

        if attempt > 0 {
            let delay = RETRY_BASE_DELAY * 2u32.pow(attempt - 1);
            tracing::info!(attempt, delay_secs = delay.as_secs(), "Retrying WebSocket connection");
            tokio::time::sleep(delay).await;

            if stop_flag.load(Ordering::Relaxed) {
                break;
            }
        }

        tracing::info!(attempt, "Connecting to Deepgram WebSocket");

        match run_websocket_session(&app, &config, &mut audio_rx, &stop_flag).await {
            Ok(()) => {
                // Clean shutdown (stop_flag was set) — exit the retry loop.
                tracing::info!("WebSocket session ended cleanly");
                break;
            }
            Err(e) => {
                tracing::warn!(error = %e, attempt, "WebSocket session error");

                attempt += 1;
                if attempt > MAX_RETRIES {
                    tracing::error!("All WebSocket reconnection attempts exhausted");
                    emit_error(&app, format!("Transcription failed after {MAX_RETRIES} retries: {e}"));
                    break;
                }
            }
        }
    }

    // Ensure global state is cleaned up if the task exits for any reason.
    let mut state = TRANSCRIPTION_STATE.lock().await;
    state.is_running = false;
    state.audio_tx = None;

    tracing::debug!("WebSocket manager exiting");
}

// ---------------------------------------------------------------------------
// Single WebSocket session
// ---------------------------------------------------------------------------

/// Type alias for the WebSocket sink/stream split over a TLS stream.
type WsSink = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    Message,
>;

type WsStream = futures_util::stream::SplitStream<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
>;

/// Run a single WebSocket session until it closes or an error occurs.
///
/// Returns `Ok(())` on a clean stop-flag-driven shutdown, or `Err(msg)` on
/// connection/protocol errors so the caller can decide whether to retry.
async fn run_websocket_session(
    app: &tauri::AppHandle,
    config: &TranscriptionConfig,
    audio_rx: &mut tokio::sync::mpsc::UnboundedReceiver<Vec<u8>>,
    stop_flag: &Arc<AtomicBool>,
) -> Result<(), String> {
    // Build the WebSocket URL and request.
    let (url, request) = build_ws_request(config)?;
    tracing::debug!(%url, "Connecting to WebSocket");

    // Connect.
    let (ws_stream, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("WebSocket connect failed: {e}"))?;

    tracing::info!("WebSocket connected to Deepgram");

    let (sink, stream) = ws_stream.split();

    // Shared flag: set when the receiver task detects closure.
    let ws_closed = Arc::new(AtomicBool::new(false));
    let ws_closed_recv = Arc::clone(&ws_closed);

    // Wrap the sink in an Arc<Mutex> so both the audio-forward loop and the
    // keep-alive timer can send on it.
    let sink_shared: Arc<Mutex<WsSink>> = Arc::new(Mutex::new(sink));
    let sink_for_keepalive = Arc::clone(&sink_shared);
    let sink_for_audio = Arc::clone(&sink_shared);

    let stop_flag_recv = Arc::clone(stop_flag);
    let app_recv = app.clone();

    // Spawn receiver task — reads Deepgram messages and emits frontend events.
    let recv_task = tauri::async_runtime::spawn(run_receiver(
        app_recv,
        stream,
        ws_closed_recv,
        stop_flag_recv,
    ));

    // Keep-alive timer task.
    let stop_flag_ka = Arc::clone(stop_flag);
    let ws_closed_ka = Arc::clone(&ws_closed);
    let ka_task = tauri::async_runtime::spawn(run_keepalive(
        sink_for_keepalive,
        stop_flag_ka,
        ws_closed_ka,
    ));

    // Track when we last sent audio so the keep-alive can be smarter.
    // (The keep-alive timer handles this independently; this is just for tracing.)
    let session_start = Instant::now();
    let mut frames_sent: u64 = 0;

    // Main audio-forward loop.
    loop {
        if stop_flag.load(Ordering::Relaxed) {
            tracing::debug!("Audio-forward loop: stop flag set");
            break;
        }

        if ws_closed.load(Ordering::Relaxed) {
            tracing::warn!("Audio-forward loop: WebSocket closed by remote");
            // Abort keepalive (it may already be finishing).
            ka_task.abort();
            recv_task.abort();
            return Err("WebSocket closed unexpectedly".to_string());
        }

        // Wait for the next PCM chunk or a 100 ms timeout (so we check flags).
        match tokio::time::timeout(Duration::from_millis(100), audio_rx.recv()).await {
            Ok(Some(pcm_bytes)) => {
                let mut sink_guard = sink_for_audio.lock().await;
                if let Err(e) = sink_guard.send(Message::Binary(pcm_bytes.into())).await {
                    tracing::warn!(error = %e, "Failed to send audio frame to WebSocket");
                    drop(sink_guard);
                    ka_task.abort();
                    recv_task.abort();
                    return Err(format!("WebSocket send error: {e}"));
                }
                frames_sent += 1;
            }
            Ok(None) => {
                // Channel was closed (stop_transcription dropped the sender).
                tracing::debug!("Audio channel closed; finishing session");
                break;
            }
            Err(_timeout) => {
                // No audio arrived — loop back to check flags.
            }
        }
    }

    tracing::info!(
        frames_sent,
        elapsed_secs = session_start.elapsed().as_secs(),
        "Audio-forward loop finished; closing WebSocket"
    );

    // Send a CloseStream message so Deepgram flushes its buffers and returns
    // any remaining transcript results before closing.
    {
        let close_msg = serde_json::json!({ "type": "CloseStream" }).to_string();
        let mut sink_guard = sink_shared.lock().await;
        let _ = sink_guard.send(Message::Text(close_msg.into())).await;
        let _ = sink_guard.close().await;
    }

    // Wait briefly for the receiver to drain remaining Deepgram messages.
    let _ = tokio::time::timeout(Duration::from_secs(3), recv_task).await;
    ka_task.abort();

    Ok(())
}

// ---------------------------------------------------------------------------
// WebSocket receiver task
// ---------------------------------------------------------------------------

/// Reads messages from the Deepgram WebSocket and emits frontend events.
///
/// Exits when the stream ends, the stop flag is set, or a WebSocket close
/// frame is received.  Sets `ws_closed` to `true` on unexpected closure.
async fn run_receiver(
    app: tauri::AppHandle,
    mut stream: WsStream,
    ws_closed: Arc<AtomicBool>,
    stop_flag: Arc<AtomicBool>,
) {
    tracing::debug!("Receiver task started");

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        match tokio::time::timeout(Duration::from_millis(200), stream.next()).await {
            Ok(Some(Ok(msg))) => {
                handle_deepgram_message(&app, msg, &ws_closed);

                // If the connection was closed, exit.
                if ws_closed.load(Ordering::Relaxed) {
                    break;
                }
            }
            Ok(Some(Err(e))) => {
                tracing::warn!(error = %e, "WebSocket receive error");
                ws_closed.store(true, Ordering::Relaxed);
                emit_error(&app, format!("WebSocket receive error: {e}"));
                break;
            }
            Ok(None) => {
                // Stream exhausted — remote closed cleanly.
                tracing::info!("WebSocket stream ended (remote close)");
                ws_closed.store(true, Ordering::Relaxed);
                break;
            }
            Err(_timeout) => {
                // No message within 200 ms — continue checking the stop flag.
            }
        }
    }

    tracing::debug!("Receiver task exiting");
}

/// Dispatch a single WebSocket message received from Deepgram.
fn handle_deepgram_message(
    app: &tauri::AppHandle,
    msg: Message,
    ws_closed: &Arc<AtomicBool>,
) {
    match msg {
        Message::Text(text) => {
            tracing::trace!(text = %text, "Deepgram message received");
            parse_and_emit_transcript(app, &text);
        }
        Message::Close(frame) => {
            tracing::info!(?frame, "WebSocket close frame received");
            ws_closed.store(true, Ordering::Relaxed);
        }
        Message::Ping(_) | Message::Pong(_) | Message::Binary(_) | Message::Frame(_) => {
            // Nothing to do for these variants.
        }
    }
}

// ---------------------------------------------------------------------------
// Keep-alive task
// ---------------------------------------------------------------------------

/// Sends `{"type":"KeepAlive"}` to Deepgram every [`KEEPALIVE_INTERVAL`].
///
/// Deepgram requires a message at least every 12 seconds; we use 8 s to be safe.
async fn run_keepalive(
    sink: Arc<Mutex<WsSink>>,
    stop_flag: Arc<AtomicBool>,
    ws_closed: Arc<AtomicBool>,
) {
    let keepalive_msg = serde_json::json!({ "type": "KeepAlive" }).to_string();
    let mut ticker = tokio::time::interval(KEEPALIVE_INTERVAL);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    // Skip the first (immediate) tick.
    ticker.tick().await;

    loop {
        ticker.tick().await;

        if stop_flag.load(Ordering::Relaxed) || ws_closed.load(Ordering::Relaxed) {
            break;
        }

        let mut sink_guard = sink.lock().await;
        if let Err(e) = sink_guard
            .send(Message::Text(keepalive_msg.clone().into()))
            .await
        {
            tracing::warn!(error = %e, "Failed to send keep-alive; connection may be dead");
            break;
        }

        tracing::trace!("Keep-alive sent");
    }

    tracing::debug!("Keep-alive task exiting");
}

// ---------------------------------------------------------------------------
// Transcript parsing
// ---------------------------------------------------------------------------

/// Parse a Deepgram JSON message and emit a `lokus:transcript-update` event.
///
/// Silently ignores messages that are not `Results` type or have no transcript.
fn parse_and_emit_transcript(app: &tauri::AppHandle, text: &str) {
    let dg_msg: DgMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!(error = %e, raw = %text, "Failed to parse Deepgram message");
            return;
        }
    };

    match dg_msg.msg_type.as_str() {
        "Results" => {
            let channel = match dg_msg.channel {
                Some(ch) => ch,
                None => return,
            };

            let alternative = match channel.alternatives.into_iter().next() {
                Some(a) => a,
                None => return,
            };

            // Skip empty transcripts (common for interim silence results).
            if alternative.transcript.is_empty() {
                return;
            }

            // Extract speaker and timestamp from the first word.
            let (speaker, timestamp) = alternative
                .words
                .first()
                .map(|w| (w.speaker, w.start))
                .unwrap_or((0, 0.0));

            let words: Vec<TranscriptWord> = alternative
                .words
                .iter()
                .map(|w| TranscriptWord {
                    word: w.word.clone(),
                    start: w.start,
                    end: w.end,
                    speaker: w.speaker,
                })
                .collect();

            let payload = TranscriptUpdatePayload {
                text: alternative.transcript,
                speaker,
                timestamp,
                is_final: dg_msg.is_final,
                speech_final: dg_msg.speech_final,
                words,
            };

            if let Err(e) = app.emit("lokus:transcript-update", &payload) {
                tracing::warn!(error = %e, "Failed to emit transcript-update event");
            }
        }
        "Error" => {
            let description = dg_msg
                .description
                .unwrap_or_else(|| "Unknown Deepgram error".to_string());

            tracing::error!(%description, "Deepgram returned an error message");
            emit_error(app, format!("Deepgram error: {description}"));
        }
        "Metadata" | "SpeechStarted" | "UtteranceEnd" => {
            // Informational messages — no action required.
            tracing::trace!(msg_type = %dg_msg.msg_type, "Deepgram info message");
        }
        other => {
            tracing::debug!(msg_type = %other, "Unhandled Deepgram message type");
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Emit a `lokus:transcription-error` event to the frontend.
fn emit_error(app: &tauri::AppHandle, error: String) {
    tracing::error!(%error, "Emitting transcription error");
    let payload = TranscriptionErrorPayload { error };
    if let Err(e) = app.emit("lokus:transcription-error", &payload) {
        tracing::warn!(error = %e, "Failed to emit transcription-error event");
    }
}

/// Build a [`tokio_tungstenite`] WebSocket request with appropriate URL and
/// authentication headers.
///
/// Returns `(url_string, request)`.
fn build_ws_request(
    config: &TranscriptionConfig,
) -> Result<
    (
        String,
        tokio_tungstenite::tungstenite::handshake::client::Request,
    ),
    String,
> {
    use tokio_tungstenite::tungstenite::http::{Request, Uri};

    let url_str = match config.mode.as_str() {
        "byok" => format!("{DEEPGRAM_URL}?{DEEPGRAM_QUERY}"),
        "proxy" => config
            .proxy_url
            .clone()
            .ok_or_else(|| "proxy_url is required in proxy mode".to_string())?,
        other => return Err(format!("Unknown transcription mode: '{other}'")),
    };

    let uri: Uri = url_str
        .parse()
        .map_err(|e| format!("Invalid WebSocket URL '{url_str}': {e}"))?;

    let mut request_builder = Request::builder().uri(uri);

    // Add the Authorization header in BYOK mode.
    if config.mode == "byok" {
        let auth_value = format!("Token {}", config.api_key);
        request_builder = request_builder.header("Authorization", auth_value);
    }

    let request = request_builder
        .body(())
        .map_err(|e| format!("Failed to build WebSocket request: {e}"))?;

    Ok((url_str, request))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- TranscriptionConfig serialisation ---

    #[test]
    fn transcription_config_byok_serde_roundtrip() {
        let cfg = TranscriptionConfig {
            api_key: "dg_test_key".to_string(),
            mode: "byok".to_string(),
            proxy_url: None,
        };

        let json = serde_json::to_string(&cfg).unwrap();
        let recovered: TranscriptionConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(recovered.api_key, "dg_test_key");
        assert_eq!(recovered.mode, "byok");
        assert!(recovered.proxy_url.is_none());
    }

    #[test]
    fn transcription_config_proxy_serde_roundtrip() {
        let cfg = TranscriptionConfig {
            api_key: String::new(),
            mode: "proxy".to_string(),
            proxy_url: Some("wss://proxy.example.com/transcribe".to_string()),
        };

        let json = serde_json::to_string(&cfg).unwrap();
        let recovered: TranscriptionConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(recovered.mode, "proxy");
        assert_eq!(
            recovered.proxy_url.as_deref(),
            Some("wss://proxy.example.com/transcribe")
        );
    }

    // --- build_ws_request ---

    #[test]
    fn build_ws_request_byok_includes_auth_header() {
        let config = TranscriptionConfig {
            api_key: "dg_secret_key".to_string(),
            mode: "byok".to_string(),
            proxy_url: None,
        };

        let (url, request) = build_ws_request(&config).unwrap();

        assert!(url.starts_with("wss://api.deepgram.com/v1/listen"));
        assert!(url.contains("model=nova-2"));
        assert!(url.contains("encoding=linear16"));
        assert!(url.contains("sample_rate=16000"));

        let auth = request
            .headers()
            .get("Authorization")
            .expect("Authorization header must be present");

        assert_eq!(auth.to_str().unwrap(), "Token dg_secret_key");
    }

    #[test]
    fn build_ws_request_proxy_uses_proxy_url() {
        let proxy = "wss://xyz.supabase.co/functions/v1/deepgram-proxy";

        let config = TranscriptionConfig {
            api_key: String::new(),
            mode: "proxy".to_string(),
            proxy_url: Some(proxy.to_string()),
        };

        let (url, request) = build_ws_request(&config).unwrap();

        assert_eq!(url, proxy);
        // No Authorization header in proxy mode.
        assert!(request.headers().get("Authorization").is_none());
    }

    #[test]
    fn build_ws_request_unknown_mode_returns_error() {
        let config = TranscriptionConfig {
            api_key: "key".to_string(),
            mode: "unknown".to_string(),
            proxy_url: None,
        };

        let result = build_ws_request(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown transcription mode"));
    }

    #[test]
    fn build_ws_request_proxy_without_url_returns_error() {
        let config = TranscriptionConfig {
            api_key: String::new(),
            mode: "proxy".to_string(),
            proxy_url: None,
        };

        let result = build_ws_request(&config);
        assert!(result.is_err());
    }

    // --- parse_and_emit_transcript (parsing logic extracted for testing) ---

    fn parse_dg_message(text: &str) -> Option<DgMessage> {
        serde_json::from_str(text).ok()
    }

    #[test]
    fn parses_results_message_with_words() {
        let json = r#"{
            "type": "Results",
            "channel": {
                "alternatives": [{
                    "transcript": "hello world",
                    "words": [
                        {"word": "hello", "start": 0.5, "end": 0.9, "speaker": 0, "confidence": 0.99},
                        {"word": "world", "start": 1.0, "end": 1.4, "speaker": 1, "confidence": 0.98}
                    ]
                }]
            },
            "is_final": true,
            "speech_final": true
        }"#;

        let msg = parse_dg_message(json).expect("should parse");
        assert_eq!(msg.msg_type, "Results");
        assert!(msg.is_final);
        assert!(msg.speech_final);

        let channel = msg.channel.unwrap();
        let alt = &channel.alternatives[0];
        assert_eq!(alt.transcript, "hello world");
        assert_eq!(alt.words.len(), 2);
        assert_eq!(alt.words[0].word, "hello");
        assert_eq!(alt.words[0].speaker, 0);
        assert_eq!(alt.words[1].word, "world");
        assert_eq!(alt.words[1].speaker, 1);
    }

    #[test]
    fn parses_interim_results_message() {
        let json = r#"{
            "type": "Results",
            "channel": {
                "alternatives": [{"transcript": "hel", "words": []}]
            },
            "is_final": false,
            "speech_final": false
        }"#;

        let msg = parse_dg_message(json).unwrap();
        assert!(!msg.is_final);
        assert!(!msg.speech_final);
    }

    #[test]
    fn parses_error_message() {
        let json = r#"{
            "type": "Error",
            "description": "Invalid API key"
        }"#;

        let msg = parse_dg_message(json).unwrap();
        assert_eq!(msg.msg_type, "Error");
        assert_eq!(msg.description.as_deref(), Some("Invalid API key"));
    }

    #[test]
    fn parses_results_without_words_field() {
        // Deepgram omits `words` when diarize is off; our default should handle it.
        let json = r#"{
            "type": "Results",
            "channel": {
                "alternatives": [{"transcript": "test"}]
            },
            "is_final": true,
            "speech_final": false
        }"#;

        let msg = parse_dg_message(json).unwrap();
        let alt = &msg.channel.unwrap().alternatives[0];
        assert!(alt.words.is_empty());
    }

    // --- Speaker / timestamp extraction logic ---

    #[test]
    fn first_word_speaker_and_timestamp_extracted_correctly() {
        let words = vec![
            DgWord { word: "hi".to_string(), start: 1.23, end: 1.5, speaker: 2, confidence: 0.9 },
            DgWord { word: "there".to_string(), start: 1.6, end: 1.9, speaker: 2, confidence: 0.9 },
        ];

        let (speaker, timestamp) = words.first().map(|w| (w.speaker, w.start)).unwrap_or((0, 0.0));

        assert_eq!(speaker, 2);
        assert!((timestamp - 1.23).abs() < f64::EPSILON);
    }

    #[test]
    fn empty_words_defaults_to_speaker_zero_and_zero_timestamp() {
        let words: Vec<DgWord> = vec![];
        let (speaker, timestamp) = words.first().map(|w| (w.speaker, w.start)).unwrap_or((0, 0.0));
        assert_eq!(speaker, 0);
        assert_eq!(timestamp, 0.0);
    }

    // --- TranscriptUpdatePayload serialisation ---

    #[test]
    fn transcript_update_payload_serialises_correctly() {
        let payload = TranscriptUpdatePayload {
            text: "Hello everyone".to_string(),
            speaker: 0,
            timestamp: 1.23,
            is_final: true,
            speech_final: true,
            words: vec![TranscriptWord {
                word: "Hello".to_string(),
                start: 1.0,
                end: 1.2,
                speaker: 0,
            }],
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"text\":\"Hello everyone\""));
        assert!(json.contains("\"speaker\":0"));
        assert!(json.contains("\"isFinal\":true"));
        assert!(json.contains("\"speechFinal\":true"));
        assert!(json.contains("\"words\":["));
    }

    #[test]
    fn transcription_error_payload_serialises() {
        let payload = TranscriptionErrorPayload {
            error: "connection refused".to_string(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"error\":\"connection refused\""));
    }

    // --- Base64 decode path (mirrors audio.rs listener logic) ---

    #[test]
    fn base64_pcm_decode_roundtrip() {
        let original: Vec<i16> = vec![0, 1024, -1024, i16::MAX, i16::MIN];
        // Reinterpret as bytes the same way audio.rs does.
        let bytes: Vec<u8> = original
            .iter()
            .flat_map(|s| s.to_le_bytes())
            .collect();

        let encoded = BASE64.encode(&bytes);
        let decoded = BASE64.decode(&encoded).unwrap();
        assert_eq!(decoded, bytes);
    }

    // --- Constants sanity checks ---

    #[test]
    fn keepalive_interval_is_less_than_deepgram_timeout() {
        // Deepgram requires a message every 12 s; our interval must be shorter.
        assert!(KEEPALIVE_INTERVAL.as_secs() < 12);
    }

    #[test]
    fn retry_base_delay_is_positive() {
        assert!(RETRY_BASE_DELAY.as_millis() > 0);
    }

    #[test]
    fn max_retries_is_at_least_one() {
        assert!(MAX_RETRIES >= 1);
    }

    #[test]
    fn deepgram_url_is_wss() {
        assert!(DEEPGRAM_URL.starts_with("wss://"));
    }

    #[test]
    fn deepgram_query_has_required_params() {
        assert!(DEEPGRAM_QUERY.contains("encoding=linear16"));
        assert!(DEEPGRAM_QUERY.contains("sample_rate=16000"));
        assert!(DEEPGRAM_QUERY.contains("channels=1"));
        assert!(DEEPGRAM_QUERY.contains("model=nova-2"));
    }
}

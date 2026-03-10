//! Local speech-to-text bridge for Lokus meeting notes.
//!
//! Spawns the `lokus-stt` sidecar process (via [`tauri_plugin_shell`]) and
//! wires it to the audio pipeline:
//!
//! ```text
//! [mic] ──audio.rs──► forward_audio_to_stt() ──► stt_bridge.rs
//!                        (direct f32 channel)           │
//!                                                       │
//!                                            JSON line → lokus-stt stdin
//!                                                 │
//!                                      lokus-stt stdout (JSON lines)
//!                                                 │
//!                          ┌──────────────────────┤
//!                     transcript                 vad
//!                          │                      │
//!              lokus:transcript-update   lokus:vad-status
//! ```
//!
//! # Sidecar protocol
//!
//! **Stdin** (one JSON object per line):
//! - `{"type":"audio","samples":[f32, ...]}` — float32 audio samples
//! - `{"type":"stop"}` — graceful shutdown request
//!
//! **Stdout** (one JSON object per line):
//! - `{"type":"ready"}` — models loaded, accepting audio
//! - `{"type":"transcript","text":"...","duration":2.4,"process_time":0.24}`
//! - `{"type":"vad","speaking":true}` / `{"type":"vad","speaking":false}`
//! - `{"type":"stopped"}` — response to the stop message
//! - `{"type":"error","message":"..."}` — runtime error
//!
//! # Required Cargo.toml additions
//!
//! No new dependencies are needed beyond what is already present:
//! - `tauri-plugin-shell = "2.3.3"` (already in Cargo.toml)
//! - `base64 = "0.22"` (already in Cargo.toml)
//! - `serde` / `serde_json` (already in Cargo.toml)
//! - `tokio` with `full` feature (already in Cargo.toml)
//! - `once_cell` (already in Cargo.toml)
//! - `tracing` (already in Cargo.toml)

use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Maximum time to wait for the sidecar to exit after sending the stop message
/// before forcibly killing it.
const STOP_TIMEOUT: Duration = Duration::from_secs(3);

// ---------------------------------------------------------------------------
// Sidecar output message types
// ---------------------------------------------------------------------------

/// A message received on the sidecar stdout.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum SidecarMessage {
    Ready,
    Transcript {
        text: String,
        duration: f64,
        #[serde(default)]
        process_time: f64,
    },
    Vad {
        speaking: bool,
    },
    Stopped,
    Error {
        message: String,
    },
}

// ---------------------------------------------------------------------------
// Frontend event payloads
// ---------------------------------------------------------------------------

/// Payload emitted on `lokus:transcript-update` from local STT.
///
/// Mirrors the shape used by [`crate::transcription`] so the frontend can
/// handle both sources with the same handler.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTranscriptPayload {
    /// The recognised speech text.
    pub text: String,
    /// Always `null` for local STT (no diarisation from the sidecar).
    pub speaker: Option<u32>,
    /// Wall-clock timestamp (milliseconds since Unix epoch) at emit time.
    pub timestamp: u64,
    /// Always `true` — the sidecar only emits final results.
    pub is_final: bool,
    /// Placeholder; the sidecar does not return word-level detail.
    pub words: Vec<()>,
}

/// Payload emitted on `lokus:vad-status`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VadStatusPayload {
    pub speaking: bool,
}

/// Payload emitted on `lokus:transcription-error`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttErrorPayload {
    pub error: String,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// Session-level mutable state.
///
/// The `CommandChild` is stored separately in [`CHILD_SLOT`] because its
/// `kill()` method consumes the value by moving it out of a `Mutex<Option<_>>`.
struct SttState {
    /// Set once the sidecar emits `{"type":"ready"}`.
    is_ready: bool,
    /// `true` while a session is active.
    is_running: bool,
}

impl SttState {
    const fn new() -> Self {
        Self {
            is_ready: false,
            is_running: false,
        }
    }
}

static STT_STATE: Lazy<Arc<Mutex<SttState>>> =
    Lazy::new(|| Arc::new(Mutex::new(SttState::new())));

/// Direct audio channel from [`crate::audio`] to the writer task.
///
/// Uses a `std::sync::Mutex` (not tokio) so it can be called from any context
/// including the sync audio emitter task.
static AUDIO_TX: std::sync::Mutex<Option<tokio::sync::mpsc::UnboundedSender<Vec<f32>>>> =
    std::sync::Mutex::new(None);

/// Forward f32 audio samples directly from the audio capture module to STT.
///
/// Called by [`crate::audio`] on every chunk.  If STT is not running, this is
/// a no-op.  The samples are sent through an unbounded channel to the writer
/// task which serialises them to JSON and writes to the sidecar's stdin.
pub fn forward_audio_to_stt(samples: &[f32]) {
    if let Ok(guard) = AUDIO_TX.lock() {
        if let Some(ref tx) = *guard {
            let _ = tx.send(samples.to_vec());
        }
    }
}

/// Stores the live `CommandChild` so `stop_stt` can write to stdin and kill it.
///
/// `CommandChild::kill` takes `self`, so the value must be moved out of the
/// slot (via `.take()`) rather than accessed through a shared reference.
static CHILD_SLOT: Lazy<Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

// ---------------------------------------------------------------------------
// Model path helpers
// ---------------------------------------------------------------------------

/// Returns the path to `~/.lokus/models/`.
fn models_dir() -> Result<std::path::PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".lokus").join("models"))
        .ok_or_else(|| "cannot determine home directory".to_string())
}

/// Returns the absolute path to `silero_vad.onnx` under the models directory.
fn vad_model_path() -> Result<std::path::PathBuf, String> {
    Ok(models_dir()?.join("silero_vad.onnx"))
}

/// Returns the absolute path to the whisper model directory.
fn whisper_model_dir() -> Result<std::path::PathBuf, String> {
    Ok(models_dir()?.join("sherpa-onnx-whisper-base.en"))
}

/// Returns `true` when both the VAD model and the whisper model bundle are present.
///
/// The archive ships files like `base.en-encoder.int8.onnx` rather than plain
/// `encoder.onnx`, so we use substring matching — the same approach the
/// `lokus-stt` sidecar uses when resolving model paths at runtime.
fn models_present() -> Result<bool, String> {
    let vad = vad_model_path()?;
    let whisper_dir = whisper_model_dir()?;

    let vad_ok = vad.exists() && vad.is_file();

    if !whisper_dir.is_dir() {
        return Ok(false);
    }

    let files: Vec<String> = std::fs::read_dir(&whisper_dir)
        .map_err(|e| format!("cannot read whisper model dir: {e}"))?
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();

    let whisper_ok = ["encoder", "decoder", "tokens"]
        .iter()
        .all(|pattern| files.iter().any(|f| f.contains(pattern)));

    Ok(vad_ok && whisper_ok)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Start local speech-to-text using the `lokus-stt` sidecar.
///
/// # Errors
///
/// Returns an error string if:
/// - A session is already running.
/// - The STT models are not downloaded (call `download_stt_model` first).
/// - The sidecar cannot be spawned.
///
/// # Events emitted
///
/// | Event | When |
/// |---|---|
/// | `lokus:transcript-update` | Speech recognised by the sidecar |
/// | `lokus:vad-status` | Voice-activity detection change |
/// | `lokus:transcription-error` | Sidecar runtime error |
#[tauri::command]
pub async fn start_stt(app: tauri::AppHandle) -> Result<(), String> {
    // Guard against double-start.
    {
        let state = STT_STATE.lock().await;
        if state.is_running {
            return Err("STT is already running".to_string());
        }
    }

    // Verify models exist before spawning the sidecar.
    if !models_present()? {
        return Err("STT models not found — call download_stt_model first".to_string());
    }

    let vad_path = vad_model_path()?
        .to_str()
        .ok_or("vad model path contains non-UTF-8 characters")?
        .to_owned();

    let whisper_path = whisper_model_dir()?
        .to_str()
        .ok_or("whisper model path contains non-UTF-8 characters")?
        .to_owned();

    // Spawn the sidecar.  `tauri_plugin_shell` resolves the binary from the
    // app's bundled sidecar directory automatically.
    let sidecar_cmd = app
        .shell()
        .sidecar("lokus-stt")
        .map_err(|e| format!("failed to build sidecar command: {e}"))?
        .args(["--vad-model", &vad_path, "--whisper-model", &whisper_path]);

    let (stdout_rx, child) = sidecar_cmd
        .spawn()
        .map_err(|e| format!("failed to spawn lokus-stt sidecar: {e}"))?;

    tracing::info!("lokus-stt sidecar spawned");

    // Store the child in the global slot so stop_stt can write to it / kill it.
    *CHILD_SLOT.lock().await = Some(child);

    // Create the direct audio channel (audio.rs → writer task).
    let (audio_tx, audio_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<f32>>();

    // Store the sender in the static slot so `forward_audio_to_stt()` can use it.
    {
        let mut slot = AUDIO_TX.lock().expect("AUDIO_TX poisoned");
        *slot = Some(audio_tx);
    }

    // Writer task: audio_rx → sidecar stdin JSON lines.
    let child_slot = Arc::clone(&*CHILD_SLOT);
    tauri::async_runtime::spawn(run_writer_task(audio_rx, child_slot));

    // Reader task: sidecar stdout → Tauri events.
    let app_reader = app.clone();
    let stt_state_reader = Arc::clone(&*STT_STATE);
    tauri::async_runtime::spawn(run_reader_task(app_reader, stdout_rx, stt_state_reader));

    // Commit session to global state.
    {
        let mut state = STT_STATE.lock().await;
        state.is_running = true;
        state.is_ready = false;
    }

    tracing::info!("STT session started");
    Ok(())
}

/// Stop the active local STT session.
///
/// Sends `{"type":"stop"}` to the sidecar, waits up to 3 seconds for it to
/// exit, then kills it if the timeout is exceeded.  Unregisters the
/// `lokus:audio-chunk` listener and clears all state.
///
/// Safe to call when no session is active.
#[tauri::command]
pub async fn stop_stt(_app: tauri::AppHandle) -> Result<(), String> {
    // Mark session as stopped.
    {
        let mut state = STT_STATE.lock().await;
        if !state.is_running {
            return Ok(());
        }
        state.is_running = false;
        state.is_ready = false;
    }

    // Close the audio channel — the writer task will exit once drained.
    {
        let mut slot = AUDIO_TX.lock().expect("AUDIO_TX poisoned");
        *slot = None;
    }

    // Send the stop message to the sidecar.
    let stop_msg = b"{\"type\":\"stop\"}\n";
    {
        let mut slot = CHILD_SLOT.lock().await;
        if let Some(ref mut child) = *slot {
            if let Err(e) = child.write(stop_msg) {
                tracing::warn!(error = %e, "stt_bridge: failed to write stop message");
            }
        }
    }

    // Poll until the reader task clears CHILD_SLOT (sidecar exited) or we time out.
    let deadline = tokio::time::Instant::now() + STOP_TIMEOUT;
    let mut acknowledged = false;

    while tokio::time::Instant::now() < deadline {
        tokio::time::sleep(Duration::from_millis(100)).await;
        if CHILD_SLOT.lock().await.is_none() {
            acknowledged = true;
            break;
        }
    }

    if !acknowledged {
        tracing::warn!("stt_bridge: sidecar did not exit within timeout; killing");
        // Move the child out of the slot and kill it.
        let child_opt = CHILD_SLOT.lock().await.take();
        if let Some(child) = child_opt {
            if let Err(e) = child.kill() {
                tracing::warn!(error = %e, "stt_bridge: failed to kill sidecar process");
            }
        }
    }

    tracing::info!("STT session stopped");
    Ok(())
}

// ---------------------------------------------------------------------------
// Writer task
// ---------------------------------------------------------------------------

/// Receives batches of f32 audio samples and writes them as JSON lines to the
/// sidecar stdin via [`CHILD_SLOT`].
async fn run_writer_task(
    mut audio_rx: tokio::sync::mpsc::UnboundedReceiver<Vec<f32>>,
    child_slot: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
) {
    tracing::debug!("stt_bridge: writer task started");

    while let Some(samples) = audio_rx.recv().await {
        let mut msg = match serde_json::to_vec(&serde_json::json!({
            "type": "audio",
            "samples": samples,
        })) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "stt_bridge: failed to serialise audio message");
                continue;
            }
        };
        msg.push(b'\n');

        let mut slot = child_slot.lock().await;
        match *slot {
            Some(ref mut child) => {
                if let Err(e) = child.write(&msg) {
                    tracing::warn!(error = %e, "stt_bridge: stdin write failed; sidecar may have exited");
                    break;
                }
            }
            None => {
                // Child was taken by stop_stt or the reader task.
                break;
            }
        }
    }

    tracing::debug!("stt_bridge: writer task exiting");
}

// ---------------------------------------------------------------------------
// Reader task
// ---------------------------------------------------------------------------

/// Reads `CommandEvent`s from the sidecar stdout and emits the appropriate
/// Tauri frontend events.
async fn run_reader_task(
    app: tauri::AppHandle,
    mut stdout_rx: tokio::sync::mpsc::Receiver<CommandEvent>,
    stt_state: Arc<Mutex<SttState>>,
) {
    tracing::debug!("stt_bridge: reader task started");

    while let Some(event) = stdout_rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                handle_sidecar_line(&app, line.trim());
            }
            CommandEvent::Stderr(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                tracing::debug!(stderr = %line.trim(), "lokus-stt stderr");
            }
            CommandEvent::Error(e) => {
                tracing::error!(error = %e, "stt_bridge: sidecar process error");
                emit_stt_error(&app, format!("sidecar process error: {e}"));
                break;
            }
            CommandEvent::Terminated(status) => {
                tracing::info!(?status, "stt_bridge: sidecar terminated");
                break;
            }
            // CommandEvent is non-exhaustive; ignore unknown future variants.
            _ => {}
        }
    }

    // Clear the child slot so stop_stt knows the process has ended.
    *CHILD_SLOT.lock().await = None;

    // Reset session state.
    let mut state = stt_state.lock().await;
    state.is_running = false;
    state.is_ready = false;

    tracing::debug!("stt_bridge: reader task exiting");
}

// ---------------------------------------------------------------------------
// Sidecar line parser
// ---------------------------------------------------------------------------

/// Parse a single stdout line from the sidecar and emit the appropriate event.
fn handle_sidecar_line(app: &tauri::AppHandle, line: &str) {
    if line.is_empty() {
        return;
    }

    let msg: SidecarMessage = match serde_json::from_str(line) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!(error = %e, raw = %line, "stt_bridge: failed to parse sidecar line");
            return;
        }
    };

    match msg {
        SidecarMessage::Ready => {
            tracing::info!("lokus-stt: models ready");
            let state_arc = Arc::clone(&*STT_STATE);
            tauri::async_runtime::spawn(async move {
                state_arc.lock().await.is_ready = true;
            });
        }

        SidecarMessage::Transcript {
            text,
            duration,
            process_time,
        } => {
            if text.is_empty() {
                return;
            }

            tracing::debug!(
                text = %text,
                duration_s = duration,
                process_time_s = process_time,
                "stt_bridge: transcript received"
            );

            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            let payload = LocalTranscriptPayload {
                text,
                speaker: None,
                timestamp,
                is_final: true,
                words: Vec::new(),
            };

            if let Err(e) = app.emit("lokus:transcript-update", &payload) {
                tracing::warn!(error = %e, "stt_bridge: failed to emit transcript-update");
            }
        }

        SidecarMessage::Vad { speaking } => {
            tracing::trace!(speaking, "stt_bridge: VAD status");
            let payload = VadStatusPayload { speaking };
            if let Err(e) = app.emit("lokus:vad-status", &payload) {
                tracing::warn!(error = %e, "stt_bridge: failed to emit vad-status");
            }
        }

        SidecarMessage::Stopped => {
            tracing::info!("lokus-stt: acknowledged stop");
        }

        SidecarMessage::Error { message } => {
            tracing::error!(message = %message, "lokus-stt: runtime error");
            emit_stt_error(app, message);
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn emit_stt_error(app: &tauri::AppHandle, error: String) {
    let payload = SttErrorPayload { error };
    if let Err(e) = app.emit("lokus:transcription-error", &payload) {
        tracing::warn!(error = %e, "stt_bridge: failed to emit transcription-error");
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

    #[test]
    fn i16_to_f32_normalisation_bounds() {
        // i16::MAX → +1.0
        let pos = f32::from(i16::MAX) / f32::from(i16::MAX);
        assert!((pos - 1.0).abs() < f32::EPSILON);

        // 0 → 0.0
        let zero = f32::from(0_i16) / f32::from(i16::MAX);
        assert_eq!(zero, 0.0);
    }

    #[test]
    fn pcm_chunk_conversion_roundtrip() {
        // Simulate: audio.rs encodes i16-LE PCM as base64, stt_bridge decodes it.
        let original_f32: Vec<f32> = vec![0.0, 0.5, -0.5, 1.0, -1.0];

        // audio.rs: clamp → scale to i16 → LE bytes → base64
        let as_i16: Vec<i16> = original_f32
            .iter()
            .map(|&s| (s.max(-1.0).min(1.0) * f32::from(i16::MAX)) as i16)
            .collect();
        let bytes: Vec<u8> = as_i16.iter().flat_map(|s| s.to_le_bytes()).collect();
        let encoded = BASE64.encode(&bytes);

        // stt_bridge: base64 → LE bytes → i16 → f32
        let decoded = BASE64.decode(&encoded).unwrap();
        let recovered: Vec<f32> = decoded
            .chunks_exact(2)
            .map(|b| {
                let sample = i16::from_le_bytes([b[0], b[1]]);
                f32::from(sample) / f32::from(i16::MAX)
            })
            .collect();

        let tolerance = 1.0 / f32::from(i16::MAX);
        for (original, recovered) in original_f32.iter().zip(recovered.iter()) {
            let clamped = original.max(-1.0_f32).min(1.0);
            assert!(
                (clamped - recovered).abs() <= tolerance,
                "expected {clamped:.6} ≈ {recovered:.6} (tolerance {tolerance:.6})"
            );
        }
    }

    #[test]
    fn sidecar_transcript_message_deserialises() {
        let json =
            r#"{"type":"transcript","text":"hello world","duration":1.5,"process_time":0.12}"#;
        let msg: SidecarMessage = serde_json::from_str(json).unwrap();
        match msg {
            SidecarMessage::Transcript {
                text,
                duration,
                process_time,
            } => {
                assert_eq!(text, "hello world");
                assert!((duration - 1.5).abs() < f64::EPSILON);
                assert!((process_time - 0.12).abs() < 1e-9);
            }
            other => panic!("expected Transcript, got {other:?}"),
        }
    }

    #[test]
    fn sidecar_vad_message_deserialises() {
        let json_on = r#"{"type":"vad","speaking":true}"#;
        let msg: SidecarMessage = serde_json::from_str(json_on).unwrap();
        assert!(matches!(msg, SidecarMessage::Vad { speaking: true }));

        let json_off = r#"{"type":"vad","speaking":false}"#;
        let msg: SidecarMessage = serde_json::from_str(json_off).unwrap();
        assert!(matches!(msg, SidecarMessage::Vad { speaking: false }));
    }

    #[test]
    fn sidecar_ready_message_deserialises() {
        let json = r#"{"type":"ready"}"#;
        let msg: SidecarMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, SidecarMessage::Ready));
    }

    #[test]
    fn sidecar_stopped_message_deserialises() {
        let json = r#"{"type":"stopped"}"#;
        let msg: SidecarMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, SidecarMessage::Stopped));
    }

    #[test]
    fn sidecar_error_message_deserialises() {
        let json = r#"{"type":"error","message":"out of memory"}"#;
        let msg: SidecarMessage = serde_json::from_str(json).unwrap();
        match msg {
            SidecarMessage::Error { message } => assert_eq!(message, "out of memory"),
            other => panic!("expected Error, got {other:?}"),
        }
    }

    #[test]
    fn local_transcript_payload_serialises() {
        let payload = LocalTranscriptPayload {
            text: "hello".to_string(),
            speaker: None,
            timestamp: 1_700_000_000_000,
            is_final: true,
            words: Vec::new(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"text\":\"hello\""));
        assert!(json.contains("\"speaker\":null"));
        assert!(json.contains("\"isFinal\":true"));
        assert!(json.contains("\"words\":[]"));
    }

    #[test]
    fn vad_payload_serialises() {
        let on = serde_json::to_string(&VadStatusPayload { speaking: true }).unwrap();
        assert!(on.contains("\"speaking\":true"));

        let off = serde_json::to_string(&VadStatusPayload { speaking: false }).unwrap();
        assert!(off.contains("\"speaking\":false"));
    }

    #[test]
    fn models_dir_is_under_home() {
        let dir = models_dir().expect("home dir must be resolvable in test env");
        let dir_str = dir.to_str().unwrap();
        assert!(dir_str.ends_with("/.lokus/models") || dir_str.ends_with("\\.lokus\\models"));
    }

    #[test]
    fn vad_model_path_ends_with_onnx() {
        let path = vad_model_path().unwrap();
        assert_eq!(path.file_name().unwrap(), "silero_vad.onnx");
    }

    #[test]
    fn whisper_model_dir_name_is_correct() {
        let dir = whisper_model_dir().unwrap();
        assert_eq!(dir.file_name().unwrap(), "sherpa-onnx-whisper-base.en");
    }
}

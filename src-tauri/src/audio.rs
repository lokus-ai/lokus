//! Audio capture module for Lokus meeting notes.
//!
//! Provides microphone capture via [`cpal`] and emits raw PCM audio chunks as
//! Tauri events so the STT sidecar can perform local real-time transcription.
//!
//! # Event protocol
//!
//! Once capture is running, the event `lokus:audio-chunk` is emitted on the
//! Tauri app handle every `chunk_duration_ms` milliseconds.  The payload is a
//! JSON object:
//!
//! ```json
//! { "data": "<base64-encoded i16-le PCM bytes>", "sample_rate": 16000, "channels": 1 }
//! ```
//!
//! # Thread model
//!
//! `cpal` drives a real-time audio callback on an OS audio thread.  That
//! callback writes samples into a lock-free [`ringbuf`] ring buffer.  A
//! dedicated Tokio task drains the ring buffer on a timer and emits the Tauri
//! event.  A shared [`AudioState`] protected by a `Mutex` coordinates
//! start/stop and exposes the latest RMS level.

use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use bytemuck::cast_slice;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use once_cell::sync::Lazy;
use ringbuf::{
    traits::{Consumer, Producer, Split},
    HeapCons, HeapRb,
};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Configuration passed by the frontend when starting a capture session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioConfig {
    /// Target sample rate in Hz.  Deepgram expects 16 000 Hz.
    #[serde(default = "default_sample_rate")]
    pub sample_rate: u32,

    /// Number of channels (1 = mono).
    #[serde(default = "default_channels")]
    pub channels: u16,

    /// How often (in milliseconds) to emit an audio chunk event.
    #[serde(default = "default_chunk_duration_ms")]
    pub chunk_duration_ms: u32,

    /// Optional device identifier returned by [`get_audio_devices`].
    /// `None` means "use the system default input device".
    pub device_id: Option<String>,
}

fn default_sample_rate() -> u32 {
    16_000
}
fn default_channels() -> u16 {
    1
}
fn default_chunk_duration_ms() -> u32 {
    100
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: default_sample_rate(),
            channels: default_channels(),
            chunk_duration_ms: default_chunk_duration_ms(),
            device_id: None,
        }
    }
}

/// Describes a single audio input device available on the host.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    /// Stable identifier used in [`AudioConfig::device_id`].
    pub id: String,
    /// Human-readable name shown in the UI.
    pub name: String,
    /// Whether this is the system default input device.
    pub is_default: bool,
    /// Always `true` — we only enumerate input devices.
    pub is_input: bool,
}

// ---------------------------------------------------------------------------
// Payload emitted on "lokus:audio-chunk"
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AudioChunkPayload {
    /// Base64-encoded little-endian i16 PCM samples.
    data: String,
    sample_rate: u32,
    channels: u16,
}

// ---------------------------------------------------------------------------
// Global audio state
// ---------------------------------------------------------------------------

/// All mutable state that lives across Tauri command invocations.
struct AudioState {
    /// Whether a capture stream is currently active.
    is_capturing: bool,
    /// The active cpal stream.  Kept alive so the OS callback keeps running.
    /// Dropped explicitly on stop.
    stream: Option<cpal::Stream>,
    /// Most-recent RMS level, updated from the audio callback thread.
    /// Stored as `u32` bits so it can cross the `Mutex` without f32 concerns.
    rms_bits: u32,
    /// A simple stop flag read by the chunk-emitter task.
    stop_flag: Arc<std::sync::atomic::AtomicBool>,
    /// The configuration active during the current (or last) session.
    config: AudioConfig,
}

// Safety: `cpal::Stream` is not `Send` in general, but we only access it
// through the `Mutex` which serialises all operations.  We never move the
// `Stream` across threads; we only drop it from whichever thread holds the
// lock.  This is the standard workaround for cpal's non-Send stream handle.
#[allow(unsafe_code)]
unsafe impl Send for AudioState {}

impl AudioState {
    fn new() -> Self {
        Self {
            is_capturing: false,
            stream: None,
            rms_bits: 0,
            stop_flag: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            config: AudioConfig::default(),
        }
    }
}

static AUDIO_STATE: Lazy<Arc<Mutex<AudioState>>> =
    Lazy::new(|| Arc::new(Mutex::new(AudioState::new())));

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Return all available audio input devices.
///
/// The frontend can present these to the user so they can choose a specific
/// microphone instead of relying on the system default.
#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    // cpal host enumeration is synchronous and may block briefly — run it on
    // the blocking thread pool so we do not starve the async executor.
    tokio::task::spawn_blocking(enumerate_input_devices)
        .await
        .map_err(|e| format!("task join error: {e}"))?
}

/// Start capturing audio from the microphone.
///
/// Opens the requested (or default) input device, configures a 16 kHz mono
/// f32 stream, converts samples to i16 PCM, and periodically emits
/// `lokus:audio-chunk` events on `app`.
#[tauri::command]
pub async fn start_audio_capture(
    app: tauri::AppHandle,
    config: AudioConfig,
) -> Result<(), String> {
    {
        let state = AUDIO_STATE.lock().map_err(|e| format!("lock error: {e}"))?;
        if state.is_capturing {
            return Err("Audio capture is already running".to_string());
        }
    }

    // Do the blocking cpal work on the thread pool.
    let config_clone = config.clone();
    let app_clone = app.clone();

    tokio::task::spawn_blocking(move || start_capture_inner(app_clone, config_clone))
        .await
        .map_err(|e| format!("task join error: {e}"))??;

    Ok(())
}

/// Stop the active capture stream and release all resources.
#[tauri::command]
pub async fn stop_audio_capture(_app: tauri::AppHandle) -> Result<(), String> {
    let mut state = AUDIO_STATE
        .lock()
        .map_err(|e| format!("lock error: {e}"))?;

    if !state.is_capturing {
        return Ok(());
    }

    // Signal the emitter task to stop.
    state
        .stop_flag
        .store(true, std::sync::atomic::Ordering::Relaxed);

    // Dropping the stream stops the OS audio callback immediately.
    state.stream = None;
    state.is_capturing = false;
    state.rms_bits = 0;

    tracing::info!("Audio capture stopped");
    Ok(())
}

/// Return the current RMS audio level in the range `[0.0, 1.0]`.
///
/// Suitable for driving a VU meter in the UI.  Returns `0.0` when no capture
/// session is active.
#[tauri::command]
pub async fn get_audio_level(_app: tauri::AppHandle) -> Result<f32, String> {
    let state = AUDIO_STATE
        .lock()
        .map_err(|e| format!("lock error: {e}"))?;
    let rms = f32::from_bits(state.rms_bits);
    // Clamp to [0, 1] defensively — NaN becomes 0.
    Ok(rms.max(0.0).min(1.0))
}

/// Stub for system audio capture (macOS ScreenCaptureKit).
///
/// Not yet implemented — the backend returns an informative error so the
/// frontend can show a "coming soon" message rather than hanging.
#[tauri::command]
#[cfg(target_os = "macos")]
pub async fn start_system_audio_capture(_app: tauri::AppHandle) -> Result<(), String> {
    Err("System audio capture not implemented yet".to_string())
}

/// Stub for non-macOS platforms.
#[tauri::command]
#[cfg(not(target_os = "macos"))]
pub async fn start_system_audio_capture(_app: tauri::AppHandle) -> Result<(), String> {
    Err("System audio capture is only planned for macOS".to_string())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Enumerate input devices using the default cpal host.
///
/// Runs on a blocking thread — cpal device enumeration can block.
fn enumerate_input_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();

    let default_device_name = host
        .default_input_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_default();

    let devices = host
        .input_devices()
        .map_err(|e| format!("failed to enumerate input devices: {e}"))?;

    let mut result = Vec::new();
    for device in devices {
        let name = device.name().unwrap_or_else(|_| "Unknown Device".to_string());
        let is_default = name == default_device_name;
        // Use the name as the stable ID — cpal doesn't expose separate IDs.
        result.push(AudioDevice {
            id: name.clone(),
            name,
            is_default,
            is_input: true,
        });
    }

    Ok(result)
}

/// Core capture logic — runs on the blocking thread pool.
///
/// 1. Resolves the requested device (or default).
/// 2. Negotiates a stream config closest to 16 kHz mono f32.
/// 3. Builds a lock-free ring buffer between the OS callback and the emitter task.
/// 4. Starts the cpal stream.
/// 5. Spawns the Tokio task that drains the ring buffer and emits events.
/// 6. Stores the stream handle in `AUDIO_STATE` so it stays alive.
fn start_capture_inner(app: tauri::AppHandle, config: AudioConfig) -> Result<(), String> {
    let host = cpal::default_host();

    // Resolve device.
    let device = resolve_device(&host, config.device_id.as_deref())?;

    // Negotiate stream config — prefer 16 kHz mono f32; fall back gracefully.
    let stream_config = negotiate_stream_config(&device, &config)?;
    let actual_sample_rate = stream_config.sample_rate.0;
    let actual_channels = stream_config.channels;

    tracing::info!(
        device = %device.name().unwrap_or_default(),
        sample_rate = actual_sample_rate,
        channels = actual_channels,
        "Starting audio capture"
    );

    // Ring buffer: capacity = 1 second of stereo f32 samples at negotiated rate.
    let ring_capacity = (actual_sample_rate as usize) * (actual_channels as usize);
    let rb = HeapRb::<f32>::new(ring_capacity);
    let (mut producer, consumer) = rb.split();

    // Reset the stop flag for this new session and obtain a clone for the
    // emitter task.  The Mutex lock is released before the stream is built.
    let stop_flag_arc = {
        let state = AUDIO_STATE.lock().map_err(|e| format!("lock error: {e}"))?;
        state
            .stop_flag
            .store(false, std::sync::atomic::Ordering::Relaxed);
        Arc::clone(&state.stop_flag)
    };

    // Clone state arc for use inside the audio callback closure.
    let state_arc = Arc::clone(&*AUDIO_STATE);

    // Build cpal stream with error handler.
    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _info: &cpal::InputCallbackInfo| {
                // Compute RMS for VU meter and store it in global state.
                if !data.is_empty() {
                    let sum_sq: f32 = data.iter().map(|s| s * s).sum();
                    let rms = (sum_sq / data.len() as f32).sqrt();
                    // Store as f32 bits via the global Mutex — Relaxed is fine
                    // here because the UI only reads this at human timescales.
                    if let Ok(mut st) = state_arc.try_lock() {
                        st.rms_bits = rms.to_bits();
                    }
                }

                // Push samples into the ring buffer.  Drop samples that don't
                // fit rather than blocking the real-time callback.
                let _ = producer.push_slice(data);
            },
            move |err| {
                // Device disconnection or driver errors land here.
                tracing::error!(error = %err, "Audio stream error");
                // Attempt graceful teardown — best effort, no panic.
                if let Ok(mut state) = AUDIO_STATE.lock() {
                    state.stop_flag
                        .store(true, std::sync::atomic::Ordering::Relaxed);
                    state.is_capturing = false;
                    state.stream = None;
                }
            },
            None, // no timeout
        )
        .map_err(|e| format!("failed to build input stream: {e}"))?;

    stream.play().map_err(|e| format!("failed to start stream: {e}"))?;

    // Store the stream and mark as capturing.
    {
        let mut state = AUDIO_STATE.lock().map_err(|e| format!("lock error: {e}"))?;
        state.stream = Some(stream);
        state.is_capturing = true;
        state.config = config.clone();
    }

    // Spawn the emitter task on the Tokio runtime.
    let chunk_ms = config.chunk_duration_ms;
    let emit_sample_rate = config.sample_rate;
    let emit_channels = config.channels;

    tauri::async_runtime::spawn(run_emitter_task(
        app,
        consumer,
        stop_flag_arc,
        chunk_ms,
        actual_sample_rate,
        actual_channels,
        emit_sample_rate,
        emit_channels,
    ));

    Ok(())
}

/// Pick the requested device by name, or return the default input device.
fn resolve_device(
    host: &cpal::Host,
    device_id: Option<&str>,
) -> Result<cpal::Device, String> {
    if let Some(id) = device_id {
        // cpal uses device names as the closest thing to a stable ID.
        let mut devices = host
            .input_devices()
            .map_err(|e| format!("failed to enumerate devices: {e}"))?;

        devices
            .find(|d| d.name().map(|n| n == id).unwrap_or(false))
            .ok_or_else(|| format!("audio device '{id}' not found"))
    } else {
        host.default_input_device()
            .ok_or_else(|| "no default input device found".to_string())
    }
}

/// Build a `cpal::StreamConfig` that is as close as possible to 16 kHz mono f32.
///
/// We always request f32 samples because the conversion to i16 PCM is simple
/// and uniform; we let cpal handle whatever sample rate the device supports.
fn negotiate_stream_config(
    device: &cpal::Device,
    config: &AudioConfig,
) -> Result<cpal::StreamConfig, String> {
    let supported_configs = device
        .supported_input_configs()
        .map_err(|e| format!("failed to query stream configs: {e}"))?;

    let target_rate = cpal::SampleRate(config.sample_rate);

    // Prefer: exact sample rate + mono + f32.
    // Fall back to: any f32 config (we resample in software — trivial
    //   because we only downsample from 44.1/48 kHz to 16 kHz via simple
    //   decimation).
    let mut best: Option<cpal::SupportedStreamConfig> = None;

    for supported in supported_configs {
        // We only use f32 input paths to keep the callback simple.
        if supported.sample_format() != cpal::SampleFormat::F32 {
            continue;
        }

        let candidate = if supported.min_sample_rate() <= target_rate
            && target_rate <= supported.max_sample_rate()
        {
            supported.with_sample_rate(target_rate)
        } else {
            // Fall back to whatever rate the device prefers.
            supported.with_max_sample_rate()
        };

        best = Some(match best {
            None => candidate,
            Some(prev) => {
                // Prefer mono, then prefer exact 16 kHz.
                let prefer_new = (candidate.channels() == 1 && prev.channels() != 1)
                    || (candidate.channels() == prev.channels()
                        && candidate.sample_rate() == target_rate
                        && prev.sample_rate() != target_rate);
                if prefer_new { candidate } else { prev }
            }
        });
    }

    best.map(|sc| sc.config())
        .ok_or_else(|| "device does not support f32 audio input".to_string())
}

// ---------------------------------------------------------------------------
// Emitter task
// ---------------------------------------------------------------------------

/// Drains the ring buffer on a timer and emits `lokus:audio-chunk` events.
///
/// Runs until `stop_flag` is set (by `stop_audio_capture` or by a stream
/// error handler).
async fn run_emitter_task(
    app: tauri::AppHandle,
    mut consumer: HeapCons<f32>,
    stop_flag: Arc<std::sync::atomic::AtomicBool>,
    chunk_ms: u32,
    device_sample_rate: u32,
    device_channels: u16,
    target_sample_rate: u32,
    target_channels: u16,
) {
    let interval = tokio::time::Duration::from_millis(u64::from(chunk_ms));
    let mut ticker = tokio::time::interval(interval);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    // Pre-allocate a scratch buffer; capacity = ~2 seconds of f32 samples at
    // device rate (generous upper bound to avoid realloc in the hot path).
    let scratch_cap = (device_sample_rate as usize) * (device_channels as usize) * 2;
    let mut scratch: Vec<f32> = Vec::with_capacity(scratch_cap);

    loop {
        ticker.tick().await;

        if stop_flag.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }

        // Drain everything available in the ring buffer.
        scratch.clear();
        scratch.extend(consumer.pop_iter());

        if scratch.is_empty() {
            continue;
        }

        // --- Channel downmix to mono ---
        let mono: Vec<f32> = if device_channels == 1 {
            scratch.clone()
        } else {
            // Average all channels into mono.
            let ch = device_channels as usize;
            scratch
                .chunks_exact(ch)
                .map(|frame| frame.iter().sum::<f32>() / ch as f32)
                .collect()
        };

        // --- Simple decimation to target sample rate ---
        // We use integer decimation (drop every Nth sample) because the
        // common case is 44100→16000 or 48000→16000.  For production quality
        // a polyphase FIR would be used; for speech transcription this is
        // perfectly adequate.
        let pcm_mono: Vec<f32> = if device_sample_rate == target_sample_rate {
            mono
        } else {
            let ratio = device_sample_rate as f64 / target_sample_rate as f64;
            let out_len = (mono.len() as f64 / ratio).ceil() as usize;
            let mut out = Vec::with_capacity(out_len);
            let mut pos: f64 = 0.0;
            while pos < mono.len() as f64 {
                out.push(mono[pos as usize]);
                pos += ratio;
            }
            out
        };

        // --- Convert f32 [-1.0, 1.0] to i16 PCM ---
        let pcm_i16: Vec<i16> = pcm_mono
            .iter()
            .map(|&s| {
                let clamped = s.max(-1.0).min(1.0);
                (clamped * i16::MAX as f32) as i16
            })
            .collect();

        // Reinterpret as bytes (little-endian i16 on all Tauri targets).
        let bytes: &[u8] = cast_slice(&pcm_i16);

        let encoded = BASE64.encode(bytes);

        let payload = AudioChunkPayload {
            data: encoded,
            sample_rate: target_sample_rate,
            channels: target_channels,
        };

        if let Err(e) = app.emit("lokus:audio-chunk", &payload) {
            tracing::warn!(error = %e, "Failed to emit audio chunk event");
        }
    }

    tracing::debug!("Audio emitter task exiting");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_config_defaults() {
        let cfg = AudioConfig::default();
        assert_eq!(cfg.sample_rate, 16_000);
        assert_eq!(cfg.channels, 1);
        assert_eq!(cfg.chunk_duration_ms, 100);
        assert!(cfg.device_id.is_none());
    }

    #[test]
    fn f32_to_i16_conversion_bounds() {
        // +1.0 should map to i16::MAX (or very close due to float truncation).
        let positive: i16 = (1.0_f32.max(-1.0).min(1.0) * i16::MAX as f32) as i16;
        assert_eq!(positive, i16::MAX);

        // -1.0 should map to i16::MIN (or -32767 due to asymmetry of i16).
        let negative: i16 = ((-1.0_f32).max(-1.0).min(1.0) * i16::MAX as f32) as i16;
        assert_eq!(negative, -i16::MAX);

        // Silence (0.0) maps to 0.
        let silence: i16 = (0.0_f32.max(-1.0).min(1.0) * i16::MAX as f32) as i16;
        assert_eq!(silence, 0);
    }

    #[test]
    fn rms_bits_roundtrip() {
        let original: f32 = 0.314_159;
        let bits = original.to_bits();
        let recovered = f32::from_bits(bits);
        assert!((recovered - original).abs() < f32::EPSILON);
    }

    #[test]
    fn audio_config_serde_roundtrip() {
        let cfg = AudioConfig {
            sample_rate: 16_000,
            channels: 1,
            chunk_duration_ms: 200,
            device_id: Some("Built-in Microphone".to_string()),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let recovered: AudioConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(recovered.sample_rate, 16_000);
        assert_eq!(recovered.channels, 1);
        assert_eq!(recovered.chunk_duration_ms, 200);
        assert_eq!(recovered.device_id.as_deref(), Some("Built-in Microphone"));
    }

    #[test]
    fn audio_device_serde() {
        let device = AudioDevice {
            id: "test-id".to_string(),
            name: "Test Microphone".to_string(),
            is_default: true,
            is_input: true,
        };
        let json = serde_json::to_string(&device).unwrap();
        assert!(json.contains("\"isDefault\":true"));
        assert!(json.contains("\"isInput\":true"));
    }

    #[test]
    fn base64_pcm_encoding() {
        // Verify that the encoding path produces valid base64 that round-trips.
        let samples: Vec<i16> = vec![0, 1000, -1000, i16::MAX, i16::MIN];
        let bytes: &[u8] = cast_slice(&samples);
        let encoded = BASE64.encode(bytes);
        let decoded = BASE64.decode(&encoded).unwrap();
        assert_eq!(decoded, bytes);
    }
}

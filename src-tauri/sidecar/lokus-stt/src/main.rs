//! Lokus STT sidecar binary.
//!
//! Reads JSON lines from stdin, writes JSON lines to stdout.
//! All diagnostic output goes to stderr — stdout carries only protocol messages.
//!
//! # Protocol
//!
//! ## Input (host → sidecar)
//!
//! ```json
//! {"type":"audio","samples":[0.01, 0.02, ...]}
//! {"type":"stop"}
//! ```
//!
//! ## Output (sidecar → host)
//!
//! ```json
//! {"type":"ready"}
//! {"type":"vad","speaking":true}
//! {"type":"vad","speaking":false}
//! {"type":"transcript","text":"hello world","duration":2.4,"process_time":0.24}
//! {"type":"stopped"}
//! {"type":"error","message":"..."}
//! ```

#![allow(clippy::too_many_lines)] // main() is intentionally long — it is a sequential protocol loop

use std::io::{self, BufRead, Write};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use sherpa_rs::silero_vad::{SileroVad, SileroVadConfig};
use sherpa_rs::whisper::{WhisperConfig, WhisperRecognizer};

// ── Constants ─────────────────────────────────────────────────────────────────

const SAMPLE_RATE: u32 = 16_000;
/// Must match `SileroVadConfig::window_size`.
const WINDOW_SIZE: usize = 512;

// ── Protocol types ────────────────────────────────────────────────────────────

/// Messages received from the host on stdin.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum InMessage {
    Audio { samples: Vec<f32> },
    Stop,
}

/// Messages sent to the host on stdout.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum OutMessage<'a> {
    Ready,
    Vad { speaking: bool },
    Transcript {
        text: &'a str,
        /// Duration of the speech segment in seconds.
        duration: f32,
        /// Wall-clock time taken by Whisper to decode the segment, in seconds.
        process_time: f32,
    },
    Stopped,
    Error { message: String },
}

// ── CLI args ──────────────────────────────────────────────────────────────────

struct Args {
    /// Path to `silero_vad.onnx`.
    vad_model: String,
    /// Path to the Whisper model directory.
    /// Expected to contain `*-encoder*.onnx`, `*-decoder*.onnx`, and `*-tokens.txt`.
    whisper_dir: String,
    /// Optional: explicit encoder filename inside `whisper_dir`.
    encoder: Option<String>,
    /// Optional: explicit decoder filename inside `whisper_dir`.
    decoder: Option<String>,
    /// Optional: explicit tokens filename inside `whisper_dir`.
    tokens: Option<String>,
}

fn parse_args() -> Result<Args, String> {
    let argv: Vec<String> = std::env::args().collect();
    let mut vad_model = None::<String>;
    let mut whisper_dir = None::<String>;
    let mut encoder = None::<String>;
    let mut decoder = None::<String>;
    let mut tokens = None::<String>;

    let mut i = 1;
    while i < argv.len() {
        match argv[i].as_str() {
            "--vad-model" => {
                i += 1;
                vad_model = argv.get(i).cloned();
            }
            "--whisper-model" => {
                i += 1;
                whisper_dir = argv.get(i).cloned();
            }
            "--encoder" => {
                i += 1;
                encoder = argv.get(i).cloned();
            }
            "--decoder" => {
                i += 1;
                decoder = argv.get(i).cloned();
            }
            "--tokens" => {
                i += 1;
                tokens = argv.get(i).cloned();
            }
            other => {
                return Err(format!("Unknown argument: {other}"));
            }
        }
        i += 1;
    }

    Ok(Args {
        vad_model: vad_model.ok_or("Missing --vad-model <path>")?,
        whisper_dir: whisper_dir.ok_or("Missing --whisper-model <directory>")?,
        encoder,
        decoder,
        tokens,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Write a single JSON-line message to stdout.
///
/// Uses a line-buffered approach: serialise → newline → flush.
/// This is the only function that may write to stdout.
fn emit(msg: &OutMessage<'_>) {
    let mut line = serde_json::to_string(msg).unwrap_or_else(|e| {
        // Serialisation of OutMessage should never fail, but handle defensively.
        eprintln!("[lokus-stt] INTERNAL: failed to serialise output: {e}");
        String::new()
    });
    if line.is_empty() {
        return;
    }
    line.push('\n');
    // Lock once per emission so the call is safe if ever used from multiple
    // threads in the future.
    let stdout = io::stdout();
    let mut out = stdout.lock();
    let _ = out.write_all(line.as_bytes());
    let _ = out.flush();
}

/// Resolve a model file inside `dir`, preferring an explicit override, then
/// scanning for files whose names contain one of `patterns` (first match wins).
fn resolve_model_file(
    dir: &str,
    explicit: Option<&str>,
    patterns: &[&str],
    label: &str,
) -> Result<String, String> {
    if let Some(name) = explicit {
        let path = format!("{dir}/{name}");
        if std::path::Path::new(&path).exists() {
            return Ok(path);
        }
        return Err(format!("{label}: explicit file not found: {path}"));
    }

    let entries =
        std::fs::read_dir(dir).map_err(|e| format!("Cannot read whisper dir '{dir}': {e}"))?;

    let names: Vec<String> = entries
        .filter_map(std::result::Result::ok)
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();

    for pattern in patterns {
        if let Some(name) = names.iter().find(|n| n.contains(pattern)) {
            return Ok(format!("{dir}/{name}"));
        }
    }

    Err(format!(
        "{label}: could not find a matching file in '{dir}'. \
         Files present: {names:?}. \
         Use --encoder / --decoder / --tokens to specify explicitly."
    ))
}

/// Compute the duration of a sample slice in seconds.
///
/// The division involves a precision-loss cast that is intentional here:
/// audio durations fit comfortably in f32 and the tiny imprecision is acceptable
/// for diagnostic/reporting purposes.
#[allow(clippy::cast_precision_loss)]
fn samples_to_secs(n_samples: usize) -> f32 {
    n_samples as f32 / SAMPLE_RATE as f32
}

/// Feed all complete windows of [`WINDOW_SIZE`] samples from `buf` into the VAD.
///
/// Returns the number of samples consumed (always a multiple of `WINDOW_SIZE`).
fn feed_windows(vad: &mut SileroVad, buf: &[f32]) -> usize {
    let mut consumed = 0_usize;
    while consumed + WINDOW_SIZE <= buf.len() {
        let window = buf[consumed..consumed + WINDOW_SIZE].to_vec();
        vad.accept_waveform(window);
        consumed += WINDOW_SIZE;
    }
    consumed
}

/// Attempt to transcribe a speech segment with Whisper.
///
/// Returns `Some(text)` on success (text may be empty if Whisper found nothing),
/// or `None` if Whisper panicked (the error is logged to stderr and a protocol
/// error message is emitted so the host is informed).
fn try_transcribe(recognizer: &mut WhisperRecognizer, samples: &[f32]) -> Option<String> {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        recognizer.transcribe(SAMPLE_RATE, samples)
    })) {
        Ok(result) => Some(result.text.trim().to_owned()),
        Err(e) => {
            eprintln!("[lokus-stt] Whisper panicked: {e:?}");
            emit(&OutMessage::Error {
                message: "Whisper panicked on audio segment — skipping".into(),
            });
            None
        }
    }
}

/// Drain all completed speech segments from the VAD, transcribe each one, and
/// emit protocol messages.
///
/// `is_speaking` tracks whether a `vad: speaking=true` edge has been sent and
/// no corresponding `speaking=false` has been sent yet.
fn drain_segments(
    vad: &mut SileroVad,
    recognizer: &mut WhisperRecognizer,
    is_speaking: &mut bool,
) {
    while !vad.is_empty() {
        let segment = vad.front();
        let duration = samples_to_secs(segment.samples.len());

        // Emit speaking=false before starting the (blocking) Whisper decode so
        // the UI can enter a "processing" state immediately.
        if *is_speaking {
            *is_speaking = false;
            emit(&OutMessage::Vad { speaking: false });
        }

        eprintln!(
            "[lokus-stt] Transcribing segment: {duration:.2}s ({} samples)",
            segment.samples.len()
        );

        let t_start = Instant::now();
        if let Some(text) = try_transcribe(recognizer, &segment.samples) {
            let process_time = t_start.elapsed().as_secs_f32();
            eprintln!("[lokus-stt] Transcript ({process_time:.3}s): {text:?}");
            if !text.is_empty() {
                emit(&OutMessage::Transcript {
                    text: &text,
                    duration,
                    process_time,
                });
            }
        }

        vad.pop();
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("[lokus-stt] Argument error: {e}");
            eprintln!(
                "Usage: lokus-stt \
                 --vad-model <silero_vad.onnx> \
                 --whisper-model <dir> \
                 [--encoder <file>] [--decoder <file>] [--tokens <file>]"
            );
            std::process::exit(1);
        }
    };

    // ── Resolve Whisper model files ───────────────────────────────────────────

    let encoder_path = match resolve_model_file(
        &args.whisper_dir,
        args.encoder.as_deref(),
        &["encoder.int8", "encoder"],
        "encoder",
    ) {
        Ok(p) => p,
        Err(e) => {
            emit(&OutMessage::Error {
                message: format!("Failed to locate Whisper encoder: {e}"),
            });
            eprintln!("[lokus-stt] {e}");
            std::process::exit(1);
        }
    };

    let decoder_path = match resolve_model_file(
        &args.whisper_dir,
        args.decoder.as_deref(),
        &["decoder.int8", "decoder"],
        "decoder",
    ) {
        Ok(p) => p,
        Err(e) => {
            emit(&OutMessage::Error {
                message: format!("Failed to locate Whisper decoder: {e}"),
            });
            eprintln!("[lokus-stt] {e}");
            std::process::exit(1);
        }
    };

    let tokens_path = match resolve_model_file(
        &args.whisper_dir,
        args.tokens.as_deref(),
        &["tokens"],
        "tokens",
    ) {
        Ok(p) => p,
        Err(e) => {
            emit(&OutMessage::Error {
                message: format!("Failed to locate Whisper tokens: {e}"),
            });
            eprintln!("[lokus-stt] {e}");
            std::process::exit(1);
        }
    };

    eprintln!("[lokus-stt] encoder  : {encoder_path}");
    eprintln!("[lokus-stt] decoder  : {decoder_path}");
    eprintln!("[lokus-stt] tokens   : {tokens_path}");
    eprintln!("[lokus-stt] vad model: {}", args.vad_model);

    // ── Load VAD ──────────────────────────────────────────────────────────────

    eprintln!("[lokus-stt] Loading Silero VAD...");
    let vad_config = SileroVadConfig {
        model: args.vad_model.clone(),
        min_silence_duration: 0.5,
        min_speech_duration: 0.25,
        max_speech_duration: 30.0,
        threshold: 0.5,
        sample_rate: SAMPLE_RATE,
        // WINDOW_SIZE = 512 fits in i32 on all targets; cast is safe.
        #[allow(clippy::cast_possible_truncation, clippy::cast_possible_wrap)]
        window_size: WINDOW_SIZE as i32,
        num_threads: Some(1),
        debug: false,
        ..Default::default()
    };

    let mut vad = match SileroVad::new(vad_config, 120.0) {
        Ok(v) => v,
        Err(e) => {
            emit(&OutMessage::Error {
                message: format!("Failed to load Silero VAD: {e}"),
            });
            eprintln!("[lokus-stt] Failed to load Silero VAD: {e}");
            std::process::exit(1);
        }
    };

    eprintln!("[lokus-stt] Silero VAD loaded.");

    // ── Load Whisper ──────────────────────────────────────────────────────────

    eprintln!("[lokus-stt] Loading Whisper...");
    let whisper_config = WhisperConfig {
        encoder: encoder_path,
        decoder: decoder_path,
        tokens: tokens_path,
        language: "en".into(),
        num_threads: Some(2),
        debug: false,
        ..Default::default()
    };

    let mut recognizer = match WhisperRecognizer::new(whisper_config) {
        Ok(r) => r,
        Err(e) => {
            emit(&OutMessage::Error {
                message: format!("Failed to load Whisper: {e}"),
            });
            eprintln!("[lokus-stt] Failed to load Whisper: {e}");
            std::process::exit(1);
        }
    };

    eprintln!("[lokus-stt] Whisper loaded. Ready.");

    // ── Signal readiness ──────────────────────────────────────────────────────

    emit(&OutMessage::Ready);

    // ── Main stdin loop ───────────────────────────────────────────────────────

    // Leftover samples that have not yet filled a complete VAD window.
    let mut pending: Vec<f32> = Vec::with_capacity(WINDOW_SIZE * 4);
    // Tracks whether a `vad: speaking=true` edge has been sent without a
    // matching `speaking=false`.
    let mut is_speaking = false;

    let stdin = io::stdin();
    for line_result in stdin.lock().lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[lokus-stt] stdin read error: {e}");
                break;
            }
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let msg: InMessage = match serde_json::from_str(trimmed) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[lokus-stt] Invalid JSON on stdin: {e} -- line: {trimmed}");
                emit(&OutMessage::Error {
                    message: format!("Invalid input JSON: {e}"),
                });
                continue;
            }
        };

        match msg {
            // ── Stop ─────────────────────────────────────────────────────────
            InMessage::Stop => {
                eprintln!("[lokus-stt] Stop requested. Flushing VAD...");

                // Pad the leftover buffer with silence so Silero can close any
                // open speech segment before we call flush().
                if !pending.is_empty() {
                    let silence_needed = WINDOW_SIZE - (pending.len() % WINDOW_SIZE);
                    pending.extend(std::iter::repeat_n(0.0_f32, silence_needed));
                    let consumed = feed_windows(&mut vad, &pending);
                    pending.drain(..consumed);
                }

                vad.flush();
                drain_segments(&mut vad, &mut recognizer, &mut is_speaking);

                emit(&OutMessage::Stopped);
                return;
            }

            // ── Audio chunk ───────────────────────────────────────────────────
            InMessage::Audio { samples } => {
                if samples.is_empty() {
                    continue;
                }

                // Accumulate into the pending buffer, then feed complete windows.
                pending.extend_from_slice(&samples);
                let consumed = feed_windows(&mut vad, &pending);
                pending.drain(..consumed);

                // Emit rising edge of speech detection.
                if vad.is_speech() && !is_speaking {
                    is_speaking = true;
                    emit(&OutMessage::Vad { speaking: true });
                }

                // Drain any segments whose trailing silence has been detected.
                drain_segments(&mut vad, &mut recognizer, &mut is_speaking);
            }
        }
    }

    // stdin closed without a Stop message — emit Stopped so the host can clean up.
    eprintln!("[lokus-stt] stdin closed unexpectedly.");
    emit(&OutMessage::Stopped);
}

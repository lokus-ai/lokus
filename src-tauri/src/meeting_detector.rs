//! Meeting detection module for Lokus.
//!
//! Monitors microphone activity to detect and manage meeting sessions.  Two
//! separate background tasks cover the two phases of a meeting lifecycle:
//!
//! 1. **Detection phase** — polls the mic RMS level every 500 ms.  When
//!    sustained non-silence (RMS ≥ 0.01) persists for more than 3 seconds the
//!    `lokus:meeting-detected` event is emitted and detection pauses.
//!
//! 2. **Active-meeting phase** — polls the same RMS level while a meeting is
//!    in progress.  After 60 seconds of continuous silence a
//!    `lokus:meeting-ending` event (with a 15-second grace period) is emitted.
//!    If silence continues for the full grace period `lokus:meeting-ended` is
//!    emitted.  Any audio during the grace period cancels the sequence.
//!
//! # State machine
//!
//! ```text
//! Idle ──enable──► Monitoring ──sustained_audio──► Detected
//!                       ▲                               │
//!                       │ dismiss (cooldown)             │ start_meeting_monitoring
//!                  Cooldown ◄──────────────────── ActiveMeeting
//!                                                       │
//!                                               60s silence
//!                                                       │
//!                                                MeetingEnding
//!                                                  │        │
//!                                          15s silence    audio_resume
//!                                                  │        │
//!                                           (ended event)   │
//!                                                           ▼
//!                                                     ActiveMeeting
//! ```
//!
//! # Events emitted
//!
//! | Event | Payload |
//! |-------|---------|
//! | `lokus:meeting-detected` | `{ "source": "mic_activity", "timestamp": <unix_secs_u64> }` |
//! | `lokus:meeting-ending` | `{ "grace_period_secs": 15 }` |
//! | `lokus:meeting-ended` | `{}` |

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::watch;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// RMS value below which a sample is considered silence.
const SILENCE_THRESHOLD: f32 = 0.01;

/// How often the background task polls the audio level.
const POLL_INTERVAL: Duration = Duration::from_millis(500);

/// How long sustained non-silence must persist before a meeting is detected.
const DETECTION_WINDOW: Duration = Duration::from_secs(3);

/// How long continuous silence must persist (in active-meeting mode) before
/// the ending sequence begins.
const SILENCE_BEFORE_ENDING: Duration = Duration::from_secs(60);

/// Grace period between the `meeting-ending` event and the `meeting-ended`
/// event.  Any audio during this period cancels the ending sequence.
const ENDING_GRACE_PERIOD: Duration = Duration::from_secs(15);

/// How long the cooldown lasts after the user dismisses a detection prompt.
const COOLDOWN_DURATION: Duration = Duration::from_secs(5 * 60);

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/// Lifecycle state of the meeting detector.
#[derive(Debug, Clone, PartialEq)]
enum DetectorPhase {
    /// No background tasks are running.
    Idle,
    /// Actively polling the mic for sustained audio.
    Monitoring,
    /// Sustained audio was detected; waiting for the user to respond.
    Detected,
    /// User dismissed the prompt; detection suppressed until cooldown expires.
    Cooldown { until: Instant },
    /// A meeting is in progress; polling for sustained silence to auto-stop.
    ActiveMeeting,
    /// Silence threshold crossed in an active meeting; grace period counting
    /// down before `meeting-ended` is emitted.
    MeetingEnding { grace_started: Instant },
}

/// Shared mutable state for the meeting detector.
struct DetectorState {
    phase: DetectorPhase,
    /// Sender half of the cancellation channel for the detection task.
    detection_cancel: Option<watch::Sender<bool>>,
    /// Sender half of the cancellation channel for the active-meeting task.
    meeting_cancel: Option<watch::Sender<bool>>,
}

impl DetectorState {
    fn new() -> Self {
        Self {
            phase: DetectorPhase::Idle,
            detection_cancel: None,
            meeting_cancel: None,
        }
    }

    /// Cancel and clear the detection background task if one is running.
    fn cancel_detection(&mut self) {
        if let Some(tx) = self.detection_cancel.take() {
            let _ = tx.send(true);
        }
    }

    /// Cancel and clear the active-meeting background task if one is running.
    fn cancel_meeting(&mut self) {
        if let Some(tx) = self.meeting_cancel.take() {
            let _ = tx.send(true);
        }
    }
}

static DETECTOR: Lazy<Arc<Mutex<DetectorState>>> =
    Lazy::new(|| Arc::new(Mutex::new(DetectorState::new())));

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
struct MeetingDetectedPayload {
    source: &'static str,
    timestamp: u64,
}

#[derive(Debug, Serialize, Clone)]
struct MeetingEndingPayload {
    grace_period_secs: u64,
}

// An empty struct so we can call `app.emit("lokus:meeting-ended", MeetingEndedPayload {})`.
#[derive(Debug, Serialize, Clone)]
struct MeetingEndedPayload {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Read the current mic RMS by sampling the default input device for ~100 ms.
///
/// This opens a temporary cpal stream, collects samples, computes RMS, then
/// closes everything.  It runs on the blocking thread pool so as not to
/// starve the async executor.
fn sample_mic_rms() -> f32 {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();

    let device = match host.default_input_device() {
        Some(d) => d,
        None => return 0.0,
    };

    // Prefer the device's default supported config (avoids lengthy negotiation).
    let supported = match device.default_input_config() {
        Ok(c) => c,
        Err(_) => return 0.0,
    };

    let stream_config = supported.config();

    // Accumulate samples for ~100 ms.
    let samples_needed =
        (stream_config.sample_rate.0 as usize * stream_config.channels as usize) / 10;

    let collected: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(samples_needed)));
    let done = Arc::new(std::sync::atomic::AtomicBool::new(false));

    let collected_cb = Arc::clone(&collected);
    let done_cb = Arc::clone(&done);

    // Build the stream.  We accept any sample format and convert to f32.
    let build_result = match supported.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if done_cb.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                if let Ok(mut guard) = collected_cb.lock() {
                    let remaining = samples_needed.saturating_sub(guard.len());
                    let take = remaining.min(data.len());
                    guard.extend_from_slice(&data[..take]);
                    if guard.len() >= samples_needed {
                        done_cb.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            },
            |_err| {},
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                if done_cb.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                if let Ok(mut guard) = collected_cb.lock() {
                    let remaining = samples_needed.saturating_sub(guard.len());
                    let take = remaining.min(data.len());
                    for &s in &data[..take] {
                        guard.push(f32::from(s) / f32::from(i16::MAX));
                    }
                    if guard.len() >= samples_needed {
                        done_cb.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            },
            |_err| {},
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &stream_config,
            move |data: &[u16], _: &cpal::InputCallbackInfo| {
                if done_cb.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                if let Ok(mut guard) = collected_cb.lock() {
                    let remaining = samples_needed.saturating_sub(guard.len());
                    let take = remaining.min(data.len());
                    for &s in &data[..take] {
                        // U16: midpoint is 32768.  Normalise to [-1, 1].
                        let normalised = (f32::from(s) - 32768.0) / 32768.0;
                        guard.push(normalised);
                    }
                    if guard.len() >= samples_needed {
                        done_cb.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            },
            |_err| {},
            None,
        ),
        _ => return 0.0,
    };

    let stream = match build_result {
        Ok(s) => s,
        Err(_) => return 0.0,
    };

    if stream.play().is_err() {
        return 0.0;
    }

    // Block until we have enough samples or 200 ms passes (safety timeout).
    let deadline = Instant::now() + Duration::from_millis(200);
    loop {
        if done.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }
        if Instant::now() >= deadline {
            break;
        }
        std::thread::sleep(Duration::from_millis(5));
    }

    // Stream drops here, closing the OS audio handle.
    drop(stream);

    let guard = match collected.lock() {
        Ok(g) => g,
        Err(_) => return 0.0,
    };

    if guard.is_empty() {
        return 0.0;
    }

    let sum_sq: f32 = guard.iter().map(|s| s * s).sum();
    (sum_sq / guard.len() as f32).sqrt()
}

/// Returns the current Unix timestamp in seconds.
fn unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

// ---------------------------------------------------------------------------
// Background task: detection
// ---------------------------------------------------------------------------

/// Polls mic RMS every [`POLL_INTERVAL`] and emits `lokus:meeting-detected`
/// when sustained non-silence exceeds [`DETECTION_WINDOW`].
///
/// Cancelled via the watch channel when `cancel_rx` receives `true`.
async fn run_detection_task(app: tauri::AppHandle, mut cancel_rx: watch::Receiver<bool>) {
    let mut ticker = tokio::time::interval(POLL_INTERVAL);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    // Timestamp of the first non-silent sample in the current run.
    let mut audio_start: Option<Instant> = None;

    tracing::debug!("Meeting detection task started");

    loop {
        tokio::select! {
            _ = ticker.tick() => {}
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    tracing::debug!("Meeting detection task cancelled");
                    break;
                }
            }
        }

        // Check cooldown state before any expensive work.
        {
            let state = match DETECTOR.lock() {
                Ok(g) => g,
                Err(_) => break,
            };
            match state.phase {
                DetectorPhase::Cooldown { until } => {
                    if Instant::now() < until {
                        // Still in cooldown — reset window and skip.
                        drop(state);
                        audio_start = None;
                        continue;
                    }
                    // Cooldown expired; will fall through to monitoring.
                }
                DetectorPhase::Monitoring => {}
                // Any other phase means this task should not be running.
                _ => break,
            }
        }

        // Sample mic on the blocking pool so we do not block the async executor.
        let rms = tokio::task::spawn_blocking(sample_mic_rms)
            .await
            .unwrap_or(0.0);

        let is_active = rms >= SILENCE_THRESHOLD;

        if is_active {
            let start = audio_start.get_or_insert_with(Instant::now);
            if start.elapsed() >= DETECTION_WINDOW {
                // Sustained audio detected — emit event and stop monitoring.
                tracing::info!(rms, "Meeting detected via mic activity");

                let payload = MeetingDetectedPayload {
                    source: "mic_activity",
                    timestamp: unix_secs(),
                };

                if let Err(e) = app.emit("lokus:meeting-detected", &payload) {
                    tracing::warn!(error = %e, "Failed to emit meeting-detected event");
                }

                // Transition to Detected state and exit.
                if let Ok(mut state) = DETECTOR.lock() {
                    state.phase = DetectorPhase::Detected;
                    state.detection_cancel = None;
                }
                break;
            }
        } else {
            // Reset the window on any silent sample.
            audio_start = None;
        }
    }

    tracing::debug!("Meeting detection task exiting");
}

// ---------------------------------------------------------------------------
// Background task: active-meeting silence monitor
// ---------------------------------------------------------------------------

/// Monitors for sustained silence while a meeting is active.
///
/// After [`SILENCE_BEFORE_ENDING`] of continuous silence, emits
/// `lokus:meeting-ending`.  After [`ENDING_GRACE_PERIOD`] more seconds of
/// continuous silence, emits `lokus:meeting-ended`.  Any audio during the
/// grace period resets the sequence back to active monitoring.
async fn run_meeting_monitor_task(app: tauri::AppHandle, mut cancel_rx: watch::Receiver<bool>) {
    let mut ticker = tokio::time::interval(POLL_INTERVAL);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    // Timestamp of the first silent sample in the current silence run.
    let mut silence_start: Option<Instant> = None;
    let mut in_grace_period = false;

    tracing::debug!("Active-meeting monitor task started");

    loop {
        tokio::select! {
            _ = ticker.tick() => {}
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    tracing::debug!("Active-meeting monitor task cancelled");
                    break;
                }
            }
        }

        // Verify we are still in an appropriate phase.
        {
            let state = match DETECTOR.lock() {
                Ok(g) => g,
                Err(_) => break,
            };
            match state.phase {
                DetectorPhase::ActiveMeeting | DetectorPhase::MeetingEnding { .. } => {}
                _ => break,
            }
        }

        let rms = tokio::task::spawn_blocking(sample_mic_rms)
            .await
            .unwrap_or(0.0);

        let is_silent = rms < SILENCE_THRESHOLD;

        if is_silent {
            let start = silence_start.get_or_insert_with(Instant::now);
            let elapsed = start.elapsed();

            if in_grace_period {
                // Already in grace period — check if it has expired.
                if elapsed >= SILENCE_BEFORE_ENDING + ENDING_GRACE_PERIOD {
                    tracing::info!("Meeting ended after sustained silence");

                    if let Err(e) = app.emit("lokus:meeting-ended", MeetingEndedPayload {}) {
                        tracing::warn!(error = %e, "Failed to emit meeting-ended event");
                    }

                    if let Ok(mut state) = DETECTOR.lock() {
                        state.phase = DetectorPhase::Idle;
                        state.meeting_cancel = None;
                    }
                    break;
                }
            } else if elapsed >= SILENCE_BEFORE_ENDING {
                // Just entered grace period.
                tracing::info!("Meeting ending — grace period started");
                in_grace_period = true;

                let payload = MeetingEndingPayload {
                    grace_period_secs: ENDING_GRACE_PERIOD.as_secs(),
                };

                if let Err(e) = app.emit("lokus:meeting-ending", &payload) {
                    tracing::warn!(error = %e, "Failed to emit meeting-ending event");
                }

                if let Ok(mut state) = DETECTOR.lock() {
                    state.phase = DetectorPhase::MeetingEnding {
                        grace_started: Instant::now(),
                    };
                }
            }
        } else {
            // Audio resumed.
            if in_grace_period {
                tracing::info!("Audio resumed during grace period — cancelling meeting-ending");
                in_grace_period = false;

                // Restore phase to ActiveMeeting.
                if let Ok(mut state) = DETECTOR.lock() {
                    state.phase = DetectorPhase::ActiveMeeting;
                }
            }
            // Reset silence window.
            silence_start = None;
        }
    }

    tracing::debug!("Active-meeting monitor task exiting");
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Start background mic-activity detection.
///
/// Spawns a polling task that watches the default input device.  When
/// sustained non-silence is detected for more than 3 seconds the
/// `lokus:meeting-detected` event is emitted.
///
/// Calling this command while detection is already running is a no-op.
#[tauri::command]
pub async fn enable_meeting_detection(app: tauri::AppHandle) -> Result<(), String> {
    let mut state = DETECTOR
        .lock()
        .map_err(|e| format!("detector lock error: {e}"))?;

    match state.phase {
        DetectorPhase::Monitoring => {
            tracing::debug!("enable_meeting_detection called while already monitoring — no-op");
            return Ok(());
        }
        DetectorPhase::Cooldown { until } if Instant::now() < until => {
            tracing::debug!("enable_meeting_detection called during cooldown — will monitor but suppress events");
        }
        _ => {}
    }

    // Cancel any stale detection task.
    state.cancel_detection();

    let (cancel_tx, cancel_rx) = watch::channel(false);
    state.detection_cancel = Some(cancel_tx);
    state.phase = DetectorPhase::Monitoring;

    tokio::spawn(run_detection_task(app, cancel_rx));

    tracing::info!("Meeting detection enabled");
    Ok(())
}

/// Stop background mic-activity detection.
///
/// Transitions the detector to [`DetectorPhase::Idle`].  Safe to call even
/// if detection is not running.
#[tauri::command]
pub async fn disable_meeting_detection() -> Result<(), String> {
    let mut state = DETECTOR
        .lock()
        .map_err(|e| format!("detector lock error: {e}"))?;

    state.cancel_detection();
    state.phase = DetectorPhase::Idle;

    tracing::info!("Meeting detection disabled");
    Ok(())
}

/// Signal that the user dismissed the meeting-detected prompt.
///
/// Starts a 5-minute cooldown during which `lokus:meeting-detected` events
/// are suppressed.  The cooldown timer resets each time this command is
/// called.
///
/// This command re-enables the detection task (in cooldown mode) so that the
/// detector can resume automatically once the cooldown expires.
#[tauri::command]
pub async fn dismiss_detection(app: tauri::AppHandle) -> Result<(), String> {
    let mut state = DETECTOR
        .lock()
        .map_err(|e| format!("detector lock error: {e}"))?;

    let until = Instant::now() + COOLDOWN_DURATION;
    state.phase = DetectorPhase::Cooldown { until };

    // Restart the detection task so it can resume once the cooldown expires.
    state.cancel_detection();
    let (cancel_tx, cancel_rx) = watch::channel(false);
    state.detection_cancel = Some(cancel_tx);

    // Drop the lock before spawning to avoid holding it across an await point.
    drop(state);

    tokio::spawn(run_detection_task(app, cancel_rx));

    tracing::info!("Detection dismissed — cooldown started ({} min)", COOLDOWN_DURATION.as_secs() / 60);
    Ok(())
}

/// Switch to active-meeting mode and begin monitoring for silence-triggered auto-stop.
///
/// Stops any existing detection task and starts the silence-monitoring task
/// instead.
#[tauri::command]
pub async fn start_meeting_monitoring(app: tauri::AppHandle) -> Result<(), String> {
    let mut state = DETECTOR
        .lock()
        .map_err(|e| format!("detector lock error: {e}"))?;

    // Stop detection polling — we are now in a meeting.
    state.cancel_detection();
    // Stop any pre-existing meeting monitor (defensive).
    state.cancel_meeting();

    let (cancel_tx, cancel_rx) = watch::channel(false);
    state.meeting_cancel = Some(cancel_tx);
    state.phase = DetectorPhase::ActiveMeeting;

    drop(state);

    tokio::spawn(run_meeting_monitor_task(app, cancel_rx));

    tracing::info!("Active-meeting silence monitoring started");
    Ok(())
}

/// Stop active-meeting silence monitoring.
///
/// Transitions the detector back to [`DetectorPhase::Idle`].  Safe to call
/// even if monitoring is not running.
#[tauri::command]
pub async fn stop_meeting_monitoring() -> Result<(), String> {
    let mut state = DETECTOR
        .lock()
        .map_err(|e| format!("detector lock error: {e}"))?;

    state.cancel_meeting();
    state.phase = DetectorPhase::Idle;

    tracing::info!("Active-meeting silence monitoring stopped");
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_threshold_constant_is_reasonable() {
        // Threshold should be strictly positive and below a typical speech level.
        assert!(SILENCE_THRESHOLD > 0.0);
        assert!(SILENCE_THRESHOLD < 0.1);
    }

    #[test]
    fn detection_window_is_at_least_poll_interval() {
        assert!(DETECTION_WINDOW >= POLL_INTERVAL);
    }

    #[test]
    fn ending_grace_period_is_positive() {
        assert!(ENDING_GRACE_PERIOD.as_secs() > 0);
    }

    #[test]
    fn cooldown_duration_is_five_minutes() {
        assert_eq!(COOLDOWN_DURATION.as_secs(), 5 * 60);
    }

    #[test]
    fn unix_secs_is_plausible() {
        let t = unix_secs();
        // After 2020-01-01 00:00:00 UTC.
        assert!(t > 1_577_836_800, "unix_secs returned a timestamp before 2020");
    }

    #[test]
    fn meeting_detected_payload_serialises() {
        let payload = MeetingDetectedPayload {
            source: "mic_activity",
            timestamp: 1_700_000_000,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"source\":\"mic_activity\""));
        assert!(json.contains("\"timestamp\":1700000000"));
    }

    #[test]
    fn meeting_ending_payload_serialises() {
        let payload = MeetingEndingPayload {
            grace_period_secs: 15,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"grace_period_secs\":15"));
    }

    #[test]
    fn detector_state_starts_idle() {
        let state = DetectorState::new();
        assert_eq!(state.phase, DetectorPhase::Idle);
        assert!(state.detection_cancel.is_none());
        assert!(state.meeting_cancel.is_none());
    }

    #[test]
    fn cancel_detection_clears_sender() {
        let mut state = DetectorState::new();
        let (tx, _rx) = watch::channel(false);
        state.detection_cancel = Some(tx);
        state.cancel_detection();
        assert!(state.detection_cancel.is_none());
    }

    #[test]
    fn cancel_meeting_clears_sender() {
        let mut state = DetectorState::new();
        let (tx, _rx) = watch::channel(false);
        state.meeting_cancel = Some(tx);
        state.cancel_meeting();
        assert!(state.meeting_cancel.is_none());
    }

    #[test]
    fn cooldown_phase_has_future_deadline() {
        let until = Instant::now() + COOLDOWN_DURATION;
        let phase = DetectorPhase::Cooldown { until };
        if let DetectorPhase::Cooldown { until: t } = phase {
            assert!(t > Instant::now());
        } else {
            panic!("unexpected phase variant");
        }
    }

    #[test]
    fn rms_of_silence_is_zero() {
        let samples: Vec<f32> = vec![0.0; 100];
        let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum_sq / samples.len() as f32).sqrt();
        assert_eq!(rms, 0.0);
    }

    #[test]
    fn rms_of_full_scale_sine_approximates_point_seven() {
        use std::f32::consts::PI;
        // A full-scale sine wave has RMS = 1/√2 ≈ 0.7071.
        let n = 4_096usize;
        let samples: Vec<f32> = (0..n)
            .map(|i| (2.0 * PI * 440.0 * i as f32 / 44_100.0).sin())
            .collect();
        let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum_sq / samples.len() as f32).sqrt();
        let expected = std::f32::consts::FRAC_1_SQRT_2;
        assert!(
            (rms - expected).abs() < 0.01,
            "RMS {rms} not close to expected {expected}"
        );
    }

    #[test]
    fn rms_above_silence_threshold_for_loud_signal() {
        // A constant signal of amplitude 0.5 should be well above the threshold.
        let samples: Vec<f32> = vec![0.5; 100];
        let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum_sq / samples.len() as f32).sqrt();
        assert!(rms >= SILENCE_THRESHOLD);
    }

    #[tokio::test]
    async fn cancel_channel_stops_receiver() {
        let (tx, mut rx) = watch::channel(false);
        // Receiver starts with the initial value; changed() only fires on a new send.
        tx.send(true).unwrap();
        rx.changed().await.unwrap();
        assert!(*rx.borrow());
    }
}

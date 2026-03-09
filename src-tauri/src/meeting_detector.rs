#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::cast_precision_loss)]

use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::Emitter;
use tokio::sync::watch;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// RMS value below which a sample is considered silence.
/// Used only by the active-meeting monitor (cpal-based), not by detection.
const SILENCE_THRESHOLD: f32 = 0.002;

/// How often the detection task polls `CoreAudio`.
const POLL_INTERVAL: Duration = Duration::from_secs(2);

/// How many consecutive positive checks must occur before a meeting is declared.
/// At 2s per check, 2 checks = 4 seconds of sustained detection.
const DETECTION_CONSECUTIVE_REQUIRED: u32 = 2;

/// How often the active-meeting monitor polls the mic RMS.
const MONITOR_POLL_INTERVAL: Duration = Duration::from_millis(500);

/// How long continuous silence must persist (in active-meeting mode) before
/// the ending sequence begins.
const SILENCE_BEFORE_ENDING: Duration = Duration::from_secs(60);

/// Grace period between the `meeting-ending` event and the `meeting-ended`
/// event. Any audio during this period cancels the ending sequence.
const ENDING_GRACE_PERIOD: Duration = Duration::from_secs(15);

/// How long the cooldown lasts after the user dismisses a detection prompt.
const COOLDOWN_DURATION: Duration = Duration::from_secs(5 * 60);

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
enum DetectorPhase {
    Idle,
    Monitoring,
    Detected,
    Cooldown { until: Instant },
    ActiveMeeting,
    MeetingEnding { grace_started: Instant },
}

struct DetectorState {
    phase: DetectorPhase,
    detection_cancel: Option<watch::Sender<bool>>,
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

    fn cancel_detection(&mut self) {
        if let Some(tx) = self.detection_cancel.take() {
            let _ = tx.send(true);
        }
    }

    fn cancel_meeting(&mut self) {
        if let Some(tx) = self.meeting_cancel.take() {
            let _ = tx.send(true);
        }
    }
}

static DETECTOR: LazyLock<Arc<Mutex<DetectorState>>> =
    LazyLock::new(|| Arc::new(Mutex::new(DetectorState::new())));

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
struct MeetingDetectedPayload {
    source: &'static str,
    app: String,
    timestamp: u64,
}

#[derive(Debug, Serialize, Clone)]
struct MeetingEndingPayload {
    grace_period_secs: u64,
}

#[derive(Debug, Serialize, Clone)]
struct MeetingEndedPayload {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

// ---------------------------------------------------------------------------
// macOS CoreAudio + NSWorkspace detection
// ---------------------------------------------------------------------------

/// Dedicated meeting apps — if one of these is running AND any mic is active,
/// we consider a meeting to be in progress.
#[cfg(target_os = "macos")]
const MEETING_APP_IDS: &[&str] = &[
    "us.zoom.xos",
    "com.microsoft.teams",
    "com.microsoft.teams2",
    "com.cisco.webex.meetings",
    "com.apple.FaceTime",
    "com.hnc.Discord",
    "com.tinyspeck.slackmacgap",
];

/// Browsers — these only count if a mic is active (could be Google Meet, etc.).
#[cfg(target_os = "macos")]
const BROWSER_IDS: &[&str] = &[
    "com.google.Chrome",
    "com.apple.Safari",
    "company.thebrowser.Browser",
    "com.microsoft.edgemac",
    "com.brave.Browser",
    "org.mozilla.firefox",
    "org.chromium.Chromium",
    "com.operasoftware.Opera",
];

/// Get all audio input device IDs from CoreAudio.
#[cfg(target_os = "macos")]
fn all_input_device_ids() -> Vec<u32> {
    use coreaudio_sys::{
        kAudioHardwareNoError, kAudioHardwarePropertyDevices,
        kAudioObjectPropertyElementMain, kAudioObjectPropertyScopeGlobal,
        kAudioObjectSystemObject, kAudioDevicePropertyStreams,
        kAudioObjectPropertyScopeInput,
        AudioObjectGetPropertyData, AudioObjectGetPropertyDataSize,
        AudioObjectPropertyAddress,
    };
    use std::mem;

    // First get all devices.
    let devices_addr = AudioObjectPropertyAddress {
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain,
    };

    let mut data_size: u32 = 0;
    let status = unsafe {
        AudioObjectGetPropertyDataSize(
            kAudioObjectSystemObject,
            std::ptr::addr_of!(devices_addr),
            0,
            std::ptr::null(),
            std::ptr::addr_of_mut!(data_size),
        )
    };

    #[allow(clippy::cast_possible_wrap)]
    if status != kAudioHardwareNoError as i32 || data_size == 0 {
        return Vec::new();
    }

    let device_count = data_size as usize / mem::size_of::<u32>();
    let mut device_ids = vec![0u32; device_count];

    let status = unsafe {
        AudioObjectGetPropertyData(
            kAudioObjectSystemObject,
            std::ptr::addr_of!(devices_addr),
            0,
            std::ptr::null(),
            std::ptr::addr_of_mut!(data_size),
            device_ids.as_mut_ptr().cast(),
        )
    };

    #[allow(clippy::cast_possible_wrap)]
    if status != kAudioHardwareNoError as i32 {
        return Vec::new();
    }

    // Filter to only devices that have input streams.
    device_ids
        .into_iter()
        .filter(|&dev_id| {
            let stream_addr = AudioObjectPropertyAddress {
                mSelector: kAudioDevicePropertyStreams,
                mScope: kAudioObjectPropertyScopeInput,
                mElement: kAudioObjectPropertyElementMain,
            };
            let mut stream_size: u32 = 0;
            let s = unsafe {
                AudioObjectGetPropertyDataSize(
                    dev_id,
                    std::ptr::addr_of!(stream_addr),
                    0,
                    std::ptr::null(),
                    std::ptr::addr_of_mut!(stream_size),
                )
            };
            #[allow(clippy::cast_possible_wrap)]
            { s == kAudioHardwareNoError as i32 && stream_size > 0 }
        })
        .collect()
}

/// Check if ANY input device is in use by any process.
#[cfg(target_os = "macos")]
fn is_any_mic_in_use() -> bool {
    use coreaudio_sys::{
        kAudioDevicePropertyDeviceIsRunningSomewhere, kAudioHardwareNoError,
        kAudioObjectPropertyElementMain, kAudioObjectPropertyScopeGlobal,
        AudioObjectGetPropertyData, AudioObjectPropertyAddress,
    };
    use std::mem;

    for device_id in all_input_device_ids() {
        let address = AudioObjectPropertyAddress {
            mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain,
        };

        let mut is_running: u32 = 0;
        let mut data_size = mem::size_of::<u32>() as u32;

        let status = unsafe {
            AudioObjectGetPropertyData(
                device_id,
                std::ptr::addr_of!(address),
                0,
                std::ptr::null(),
                std::ptr::addr_of_mut!(data_size),
                std::ptr::addr_of_mut!(is_running).cast(),
            )
        };

        #[allow(clippy::cast_possible_wrap)]
        if status == kAudioHardwareNoError as i32 && is_running != 0 {
            return true;
        }
    }

    false
}

/// Detect running meeting apps via NSWorkspace.
/// Returns `Some(bundle_id)` for the first known meeting/browser app found.
#[cfg(target_os = "macos")]
fn detect_meeting_app() -> Option<String> {
    use objc2_app_kit::NSWorkspace;

    let workspace = NSWorkspace::sharedWorkspace();
    let running_apps = workspace.runningApplications();

    for app in &running_apps {
        let Some(id) = app.bundleIdentifier().map(|ns| ns.to_string()) else {
            continue;
        };
        if MEETING_APP_IDS.iter().any(|&known| known == id) {
            return Some(id);
        }
        if BROWSER_IDS.iter().any(|&known| known == id) {
            return Some(id);
        }
    }

    None
}

#[cfg(not(target_os = "macos"))]
fn is_any_mic_in_use() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
fn detect_meeting_app() -> Option<String> {
    None
}

async fn check_meeting_active() -> (bool, String) {
    tokio::task::spawn_blocking(|| {
        let mic_in_use = is_any_mic_in_use();

        if !mic_in_use {
            return (false, String::new());
        }

        match detect_meeting_app() {
            Some(app) => (true, app),
            None => (false, String::new()),
        }
    })
    .await
    .unwrap_or((false, String::new()))
}

/// Sample the default mic RMS for ~100 ms via cpal. Used by the
/// active-meeting monitor while a meeting is in progress.
#[allow(clippy::too_many_lines)]
fn sample_mic_rms() -> f32 {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();
    let Some(device) = host.default_input_device() else {
        return 0.0;
    };
    let Ok(supported) = device.default_input_config() else {
        return 0.0;
    };
    let stream_config = supported.config();

    let samples_needed =
        (stream_config.sample_rate.0 as usize * stream_config.channels as usize) / 10;
    let collected: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(samples_needed)));
    let done = Arc::new(std::sync::atomic::AtomicBool::new(false));

    let collected_cb = Arc::clone(&collected);
    let done_cb = Arc::clone(&done);

    let build_result = match supported.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if done_cb.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                if let Ok(mut g) = collected_cb.lock() {
                    let remaining = samples_needed.saturating_sub(g.len());
                    let take = remaining.min(data.len());
                    g.extend_from_slice(&data[..take]);
                    if g.len() >= samples_needed {
                        done_cb.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            },
            |_| {},
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                if done_cb.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                if let Ok(mut g) = collected_cb.lock() {
                    let remaining = samples_needed.saturating_sub(g.len());
                    let take = remaining.min(data.len());
                    for &s in &data[..take] {
                        g.push(f32::from(s) / f32::from(i16::MAX));
                    }
                    if g.len() >= samples_needed {
                        done_cb.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            },
            |_| {},
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &stream_config,
            move |data: &[u16], _: &cpal::InputCallbackInfo| {
                if done_cb.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }
                if let Ok(mut g) = collected_cb.lock() {
                    let remaining = samples_needed.saturating_sub(g.len());
                    let take = remaining.min(data.len());
                    for &s in &data[..take] {
                        let normalised = (f32::from(s) - 32768.0) / 32768.0;
                        g.push(normalised);
                    }
                    if g.len() >= samples_needed {
                        done_cb.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            },
            |_| {},
            None,
        ),
        _ => return 0.0,
    };

    let Ok(stream) = build_result else {
        return 0.0;
    };

    if stream.play().is_err() {
        return 0.0;
    }

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
    drop(stream);

    let Ok(guard) = collected.lock() else {
        return 0.0;
    };
    if guard.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = guard.iter().map(|s| s * s).sum();
    (sum_sq / guard.len() as f32).sqrt()
}

// ---------------------------------------------------------------------------
// Background task: detection
// ---------------------------------------------------------------------------

async fn run_detection_task(app: tauri::AppHandle, mut cancel_rx: watch::Receiver<bool>) {
    let mut ticker = tokio::time::interval(POLL_INTERVAL);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    let mut consecutive_positive: u32 = 0;

    tracing::debug!("Meeting detection task started (CoreAudio mode)");

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

        {
            let Ok(state) = DETECTOR.lock() else { break };
            match state.phase {
                DetectorPhase::Cooldown { until } => {
                    if Instant::now() < until {
                        drop(state);
                        consecutive_positive = 0;
                        continue;
                    }
                }
                DetectorPhase::Monitoring => {}
                _ => break,
            }
        }

        let (is_active, app_name) = check_meeting_active().await;

        if is_active {
            consecutive_positive += 1;
            tracing::debug!(consecutive_positive, app = %app_name, "Meeting detection positive check");

            if consecutive_positive >= DETECTION_CONSECUTIVE_REQUIRED {
                tracing::info!(app = %app_name, "Meeting detected via CoreAudio + app detection");

                let payload = MeetingDetectedPayload {
                    source: "coreaudio",
                    app: app_name,
                    timestamp: unix_secs(),
                };

                if let Err(e) = app.emit("lokus:meeting-detected", &payload) {
                    tracing::warn!(error = %e, "Failed to emit meeting-detected event");
                }

                if let Ok(mut state) = DETECTOR.lock() {
                    state.phase = DetectorPhase::Detected;
                    state.detection_cancel = None;
                }
                break;
            }
        } else {
            consecutive_positive = 0;
        }
    }

    tracing::debug!("Meeting detection task exiting");
}

// ---------------------------------------------------------------------------
// Background task: active-meeting silence monitor
// ---------------------------------------------------------------------------

async fn run_meeting_monitor_task(app: tauri::AppHandle, mut cancel_rx: watch::Receiver<bool>) {
    let mut ticker = tokio::time::interval(MONITOR_POLL_INTERVAL);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

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

        {
            let Ok(state) = DETECTOR.lock() else { break };
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
            if in_grace_period {
                tracing::info!("Audio resumed during grace period — cancelling meeting-ending");
                in_grace_period = false;

                if let Ok(mut state) = DETECTOR.lock() {
                    state.phase = DetectorPhase::ActiveMeeting;
                }
            }
            silence_start = None;
        }
    }

    tracing::debug!("Active-meeting monitor task exiting");
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

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

    state.cancel_detection();

    let (cancel_tx, cancel_rx) = watch::channel(false);
    state.detection_cancel = Some(cancel_tx);
    state.phase = DetectorPhase::Monitoring;

    tokio::spawn(run_detection_task(app, cancel_rx));

    tracing::info!("Meeting detection enabled");
    Ok(())
}

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

#[tauri::command]
pub async fn dismiss_detection(app: tauri::AppHandle) -> Result<(), String> {
    let mut state = DETECTOR
        .lock()
        .map_err(|e| format!("detector lock error: {e}"))?;

    let until = Instant::now() + COOLDOWN_DURATION;
    state.phase = DetectorPhase::Cooldown { until };

    state.cancel_detection();
    let (cancel_tx, cancel_rx) = watch::channel(false);
    state.detection_cancel = Some(cancel_tx);

    drop(state);

    tokio::spawn(run_detection_task(app, cancel_rx));

    tracing::info!(
        "Detection dismissed — cooldown started ({} min)",
        COOLDOWN_DURATION.as_secs() / 60
    );
    Ok(())
}

#[tauri::command]
pub async fn start_meeting_monitoring(app: tauri::AppHandle) -> Result<(), String> {
    let mut state = DETECTOR
        .lock()
        .map_err(|e| format!("detector lock error: {e}"))?;

    state.cancel_detection();
    state.cancel_meeting();

    let (cancel_tx, cancel_rx) = watch::channel(false);
    state.meeting_cancel = Some(cancel_tx);
    state.phase = DetectorPhase::ActiveMeeting;

    drop(state);

    tokio::spawn(run_meeting_monitor_task(app, cancel_rx));

    tracing::info!("Active-meeting silence monitoring started");
    Ok(())
}

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
        assert!(SILENCE_THRESHOLD > 0.0);
        assert!(SILENCE_THRESHOLD < 0.1);
    }

    #[test]
    fn detection_consecutive_required_is_positive() {
        assert!(DETECTION_CONSECUTIVE_REQUIRED > 0);
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
        assert!(t > 1_577_836_800, "unix_secs returned a timestamp before 2020");
    }

    #[test]
    fn meeting_detected_payload_serialises() {
        let payload = MeetingDetectedPayload {
            source: "coreaudio",
            app: "us.zoom.xos".to_string(),
            timestamp: 1_700_000_000,
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"source\":\"coreaudio\""));
        assert!(json.contains("\"app\":\"us.zoom.xos\""));
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
        let samples: Vec<f32> = vec![0.5; 100];
        let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum_sq / samples.len() as f32).sqrt();
        assert!(rms >= SILENCE_THRESHOLD);
    }

    #[tokio::test]
    async fn cancel_channel_stops_receiver() {
        let (tx, mut rx) = watch::channel(false);
        tx.send(true).unwrap();
        rx.changed().await.unwrap();
        assert!(*rx.borrow());
    }
}

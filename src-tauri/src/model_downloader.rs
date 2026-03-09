//! STT model downloader for Lokus meeting notes.
//!
//! Downloads the sherpa-onnx Whisper base.en model bundle and the Silero VAD
//! model from the official sherpa-onnx GitHub releases into `~/.lokus/models/`.
//!
//! Progress is reported to the frontend via `lokus:model-download-progress`
//! events as files are streamed from the network.
//!
//! # Model layout expected by `lokus-stt`
//!
//! ```text
//! ~/.lokus/models/
//!   silero_vad.onnx
//!   sherpa-onnx-whisper-base.en/
//!     encoder.onnx
//!     decoder.onnx
//!     tokens.txt
//! ```
//!
//! # Required Cargo.toml additions
//!
//! Add to `[dependencies]` (or the desktop-only target block):
//! ```toml
//! tar  = "0.4"
//! bzip2 = "0.4"
//! ```
//!
//! All other dependencies (`reqwest`, `dirs`, `serde`, `serde_json`, `tokio`,
//! `tracing`, `futures-util`) are already present in Cargo.toml.
//!
//! # Download URLs
//!
//! | Model | URL |
//! |---|---|
//! | Whisper base.en | <https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2> |
//! | Silero VAD | <https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx> |

use std::io::Write as _;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Emitter;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WHISPER_TARBALL_URL: &str =
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/\
     sherpa-onnx-whisper-base.en.tar.bz2";

const SILERO_VAD_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/\
     silero_vad.onnx";

/// Minimum Content-Length that the tarball must have to be considered valid.
/// The actual release is ~130 MB; this guards against truncated downloads.
const MIN_TARBALL_BYTES: u64 = 10 * 1024 * 1024; // 10 MiB

/// Minimum Content-Length for the VAD ONNX model.
/// The sherpa-onnx silero_vad.onnx is ~640 KiB.
const MIN_VAD_BYTES: u64 = 500 * 1024; // 500 KiB

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Status of the STT model files on disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    /// Whether `silero_vad.onnx` is present.
    pub vad_downloaded: bool,
    /// Whether the whisper model directory (with all required files) is present.
    pub whisper_downloaded: bool,
    /// Total size in bytes of all whisper model files, if downloaded.
    pub whisper_model_size: Option<u64>,
    /// Absolute path to the models directory.
    pub models_dir: String,
}

/// Progress event payload emitted on `lokus:model-download-progress`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressPayload {
    /// Download completion percentage `[0.0, 100.0]`.
    pub percent: f32,
    /// Number of bytes received so far in the current file transfer.
    pub bytes_downloaded: u64,
    /// Total size of the current file in bytes (0 when unknown).
    pub bytes_total: u64,
    /// Human-readable status label.
    pub status: DownloadStatus,
    /// Which model is currently being processed.
    pub model: String,
}

/// Status label for the progress event.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Downloading,
    Extracting,
    Complete,
    Error,
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

fn models_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".lokus").join("models"))
        .ok_or_else(|| "cannot determine home directory".to_string())
}

fn vad_model_path() -> Result<PathBuf, String> {
    Ok(models_dir()?.join("silero_vad.onnx"))
}

fn whisper_model_dir() -> Result<PathBuf, String> {
    Ok(models_dir()?.join("sherpa-onnx-whisper-base.en"))
}

/// Required files inside the whisper model directory.
const WHISPER_REQUIRED_FILES: &[&str] = &["encoder.onnx", "decoder.onnx", "tokens.txt"];

fn whisper_fully_present(dir: &Path) -> bool {
    dir.is_dir() && WHISPER_REQUIRED_FILES.iter().all(|f| dir.join(f).is_file())
}

fn whisper_dir_size(dir: &Path) -> u64 {
    walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Return the current download status of the STT models.
///
/// The frontend can call this to decide whether to show a download prompt.
///
/// # Examples
///
/// ```rust,ignore
/// let status = get_stt_model_status().await?;
/// if !status.whisper_downloaded || !status.vad_downloaded {
///     download_stt_model(app).await?;
/// }
/// ```
#[tauri::command]
pub async fn get_stt_model_status() -> Result<ModelStatus, String> {
    let dir = models_dir()?;
    let vad_path = vad_model_path()?;
    let whisper_dir = whisper_model_dir()?;

    let vad_downloaded = vad_path.is_file();
    let whisper_downloaded = whisper_fully_present(&whisper_dir);

    let whisper_model_size = if whisper_downloaded {
        Some(whisper_dir_size(&whisper_dir))
    } else {
        None
    };

    Ok(ModelStatus {
        vad_downloaded,
        whisper_downloaded,
        whisper_model_size,
        models_dir: dir.to_string_lossy().into_owned(),
    })
}

/// Download the Whisper base.en model and the Silero VAD model.
///
/// Emits `lokus:model-download-progress` events throughout.  On any error the
/// partially-downloaded files are cleaned up before the error is returned.
///
/// # Events emitted
///
/// ```json
/// {
///   "percent": 45.2,
///   "bytesDownloaded": 47185920,
///   "bytesTotal": 136314880,
///   "status": "downloading",
///   "model": "whisper-base.en"
/// }
/// ```
///
/// # Errors
///
/// Returns an error string on network failure, I/O error, or extraction
/// failure.  Partial artifacts are deleted before returning.
#[tauri::command]
pub async fn download_stt_model(app: tauri::AppHandle) -> Result<(), String> {
    let dir = models_dir()?;

    // Create the models directory (and all parents) if it does not exist.
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create models directory '{}': {e}", dir.display()))?;

    // Build an HTTP client.  reqwest is a desktop-only dependency in Cargo.toml.
    let client = reqwest::Client::builder()
        .user_agent("Lokus/1.0 model-downloader")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("failed to build HTTP client: {e}"))?;

    // Download Silero VAD model if not already present.
    let vad_path = vad_model_path()?;
    if !vad_path.is_file() {
        download_file(
            &app,
            &client,
            SILERO_VAD_URL,
            &vad_path,
            MIN_VAD_BYTES,
            "silero-vad",
        )
        .await
        .map_err(|e| {
            // Clean up any partial download.
            let _ = std::fs::remove_file(&vad_path);
            e
        })?;
    } else {
        tracing::info!("silero_vad.onnx already present, skipping download");
    }

    // Download and extract the Whisper tarball if not already present.
    let whisper_dir = whisper_model_dir()?;
    if !whisper_fully_present(&whisper_dir) {
        // Temporary file for the tarball in the same directory (same filesystem
        // as the final target → rename is atomic on most OS/FS combinations).
        let tarball_tmp = dir.join("sherpa-onnx-whisper-base.en.tar.bz2.part");

        let download_result = download_file(
            &app,
            &client,
            WHISPER_TARBALL_URL,
            &tarball_tmp,
            MIN_TARBALL_BYTES,
            "whisper-base.en",
        )
        .await;

        if let Err(e) = download_result {
            let _ = std::fs::remove_file(&tarball_tmp);
            return Err(e);
        }

        // Emit "extracting" progress.
        emit_progress(
            &app,
            DownloadProgressPayload {
                percent: 0.0,
                bytes_downloaded: 0,
                bytes_total: 0,
                status: DownloadStatus::Extracting,
                model: "whisper-base.en".to_string(),
            },
        );

        // Extract the tarball on a blocking thread to avoid stalling the executor.
        let tarball_tmp_clone = tarball_tmp.clone();
        let dir_clone = dir.clone();

        let extract_result =
            tokio::task::spawn_blocking(move || extract_tar_bz2(&tarball_tmp_clone, &dir_clone))
                .await
                .map_err(|e| format!("extraction task panicked: {e}"))?;

        // Always delete the tarball temp file.
        let _ = std::fs::remove_file(&tarball_tmp);

        if let Err(e) = extract_result {
            // Remove any partially-extracted directory.
            let _ = std::fs::remove_dir_all(&whisper_dir);
            return Err(e);
        }

        tracing::info!(
            path = %whisper_dir.display(),
            "Whisper model extracted successfully"
        );
    } else {
        tracing::info!("whisper model already present, skipping download");
    }

    // Verify the final layout.
    if !whisper_fully_present(&whisper_dir) {
        return Err(format!(
            "extraction completed but required model files are missing in '{}'",
            whisper_dir.display()
        ));
    }

    // Emit final completion event.
    emit_progress(
        &app,
        DownloadProgressPayload {
            percent: 100.0,
            bytes_downloaded: 0,
            bytes_total: 0,
            status: DownloadStatus::Complete,
            model: "all".to_string(),
        },
    );

    tracing::info!("STT model download complete");
    Ok(())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Stream a single file from `url` to `dest_path`, emitting progress events.
///
/// `min_expected_bytes` is used as a sanity check: if the response body is
/// shorter than this, the download is considered corrupt and an error is
/// returned.
async fn download_file(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    url: &str,
    dest_path: &Path,
    min_expected_bytes: u64,
    model_label: &str,
) -> Result<(), String> {
    use futures_util::StreamExt as _;

    tracing::info!(url, dest = %dest_path.display(), "Starting download");

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("HTTP GET '{url}' failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "HTTP error {} downloading '{url}'",
            response.status()
        ));
    }

    let bytes_total = response.content_length().unwrap_or(0);

    // Create (or truncate) the destination file.
    let mut dest_file = std::fs::File::create(dest_path)
        .map_err(|e| format!("failed to create '{}': {e}", dest_path.display()))?;

    let mut bytes_downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("download stream error for '{url}': {e}"))?;

        dest_file
            .write_all(&chunk)
            .map_err(|e| format!("write error to '{}': {e}", dest_path.display()))?;

        bytes_downloaded += chunk.len() as u64;

        let percent = if bytes_total > 0 {
            (bytes_downloaded as f32 / bytes_total as f32) * 100.0
        } else {
            0.0
        };

        // Throttle events: emit every 512 KiB to avoid flooding the frontend.
        if bytes_downloaded % (512 * 1024) < chunk.len() as u64 {
            emit_progress(
                app,
                DownloadProgressPayload {
                    percent,
                    bytes_downloaded,
                    bytes_total,
                    status: DownloadStatus::Downloading,
                    model: model_label.to_string(),
                },
            );
        }
    }

    // Flush to ensure all bytes are on disk before we consider the file valid.
    dest_file
        .flush()
        .map_err(|e| format!("flush error for '{}': {e}", dest_path.display()))?;

    tracing::info!(
        bytes_downloaded,
        dest = %dest_path.display(),
        "Download complete"
    );

    // Sanity-check the file size.
    if bytes_downloaded < min_expected_bytes {
        return Err(format!(
            "downloaded file '{}' is only {bytes_downloaded} bytes, expected at least \
             {min_expected_bytes} — the download may be incomplete or the URL is wrong",
            dest_path.display()
        ));
    }

    // Emit a 100% progress for this file.
    emit_progress(
        app,
        DownloadProgressPayload {
            percent: 100.0,
            bytes_downloaded,
            bytes_total: bytes_downloaded,
            status: DownloadStatus::Downloading,
            model: model_label.to_string(),
        },
    );

    Ok(())
}

/// Extract a `.tar.bz2` archive to `dest_dir`.
///
/// Runs synchronously — call from a blocking thread pool task.
///
/// # Errors
///
/// Returns an error string if the file cannot be opened, the bzip2 stream is
/// corrupt, or any entry cannot be unpacked.
fn extract_tar_bz2(tarball_path: &Path, dest_dir: &Path) -> Result<(), String> {
    use bzip2::read::BzDecoder;
    use tar::Archive;

    let file = std::fs::File::open(tarball_path)
        .map_err(|e| format!("failed to open tarball '{}': {e}", tarball_path.display()))?;

    let bz_decoder = BzDecoder::new(file);
    let mut archive = Archive::new(bz_decoder);

    archive.unpack(dest_dir).map_err(|e| {
        format!(
            "failed to extract '{}' to '{}': {e}",
            tarball_path.display(),
            dest_dir.display()
        )
    })?;

    Ok(())
}

/// Emit a `lokus:model-download-progress` event; logs a warning on failure.
fn emit_progress(app: &tauri::AppHandle, payload: DownloadProgressPayload) {
    if let Err(e) = app.emit("lokus:model-download-progress", &payload) {
        tracing::warn!(error = %e, "model_downloader: failed to emit progress event");
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // --- Path helpers ---

    #[test]
    fn models_dir_ends_with_expected_suffix() {
        let dir = models_dir().expect("home dir must be resolvable in test env");
        let s = dir.to_str().unwrap();
        assert!(
            s.ends_with("/.lokus/models") || s.ends_with("\\.lokus\\models"),
            "unexpected models dir: {s}"
        );
    }

    #[test]
    fn vad_model_path_filename() {
        let path = vad_model_path().unwrap();
        assert_eq!(path.file_name().unwrap(), "silero_vad.onnx");
    }

    #[test]
    fn whisper_model_dir_name() {
        let dir = whisper_model_dir().unwrap();
        assert_eq!(dir.file_name().unwrap(), "sherpa-onnx-whisper-base.en");
    }

    // --- whisper_fully_present ---

    #[test]
    fn whisper_fully_present_returns_false_for_missing_dir() {
        let tmp = std::env::temp_dir().join("lokus_test_nonexistent_12345678");
        assert!(!whisper_fully_present(&tmp));
    }

    #[test]
    fn whisper_fully_present_returns_false_when_files_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let model_dir = tmp.path().join("sherpa-onnx-whisper-base.en");
        std::fs::create_dir_all(&model_dir).unwrap();

        // Only create encoder.onnx — decoder and tokens are missing.
        std::fs::write(model_dir.join("encoder.onnx"), b"fake").unwrap();

        assert!(!whisper_fully_present(&model_dir));
    }

    #[test]
    fn whisper_fully_present_returns_true_when_all_files_present() {
        let tmp = tempfile::tempdir().unwrap();
        let model_dir = tmp.path().join("sherpa-onnx-whisper-base.en");
        std::fs::create_dir_all(&model_dir).unwrap();

        for filename in WHISPER_REQUIRED_FILES {
            std::fs::write(model_dir.join(filename), b"fake model data").unwrap();
        }

        assert!(whisper_fully_present(&model_dir));
    }

    // --- whisper_dir_size ---

    #[test]
    fn whisper_dir_size_sums_files() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("a"), vec![0u8; 1024]).unwrap();
        std::fs::write(tmp.path().join("b"), vec![0u8; 2048]).unwrap();

        let size = whisper_dir_size(tmp.path());
        assert_eq!(size, 3072);
    }

    #[test]
    fn whisper_dir_size_zero_for_empty_dir() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(whisper_dir_size(tmp.path()), 0);
    }

    // --- ModelStatus serialisation ---

    #[test]
    fn model_status_serialises_correctly() {
        let status = ModelStatus {
            vad_downloaded: true,
            whisper_downloaded: false,
            whisper_model_size: None,
            models_dir: "/home/user/.lokus/models".to_string(),
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"vadDownloaded\":true"));
        assert!(json.contains("\"whisperDownloaded\":false"));
        assert!(json.contains("\"whisperModelSize\":null"));
        assert!(json.contains("\"modelsDir\":"));
    }

    #[test]
    fn model_status_with_size_serialises_correctly() {
        let status = ModelStatus {
            vad_downloaded: true,
            whisper_downloaded: true,
            whisper_model_size: Some(136_314_880),
            models_dir: "/home/user/.lokus/models".to_string(),
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"whisperModelSize\":136314880"));
    }

    // --- DownloadProgressPayload serialisation ---

    #[test]
    fn download_progress_payload_serialises() {
        let payload = DownloadProgressPayload {
            percent: 42.5,
            bytes_downloaded: 44_564_480,
            bytes_total: 104_857_600,
            status: DownloadStatus::Downloading,
            model: "whisper-base.en".to_string(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"status\":\"downloading\""));
        assert!(json.contains("\"model\":\"whisper-base.en\""));
        assert!(json.contains("\"percent\":42.5"));
    }

    #[test]
    fn download_status_extracting_serialises() {
        let s = serde_json::to_string(&DownloadStatus::Extracting).unwrap();
        assert_eq!(s, "\"extracting\"");
    }

    #[test]
    fn download_status_complete_serialises() {
        let s = serde_json::to_string(&DownloadStatus::Complete).unwrap();
        assert_eq!(s, "\"complete\"");
    }

    #[test]
    fn download_status_error_serialises() {
        let s = serde_json::to_string(&DownloadStatus::Error).unwrap();
        assert_eq!(s, "\"error\"");
    }

    // --- URL constants ---

    #[test]
    fn whisper_tarball_url_points_to_sherpa_onnx() {
        assert!(WHISPER_TARBALL_URL.contains("k2-fsa/sherpa-onnx"));
        assert!(WHISPER_TARBALL_URL.contains("whisper-base.en.tar.bz2"));
    }

    #[test]
    fn silero_vad_url_points_to_sherpa_onnx() {
        assert!(SILERO_VAD_URL.contains("k2-fsa/sherpa-onnx"));
        assert!(SILERO_VAD_URL.contains("silero_vad.onnx"));
    }

    // --- tar.bz2 extraction ---

    #[test]
    fn extract_tar_bz2_unpacks_files() {
        use bzip2::write::BzEncoder;
        use bzip2::Compression;
        use tar::Builder;

        // Build a minimal tar.bz2 in memory.
        let tmp = tempfile::tempdir().unwrap();
        let tarball_path = tmp.path().join("test.tar.bz2");
        let dest_dir = tmp.path().join("out");
        std::fs::create_dir_all(&dest_dir).unwrap();

        {
            let file = std::fs::File::create(&tarball_path).unwrap();
            let encoder = BzEncoder::new(file, Compression::fast());
            let mut builder = Builder::new(encoder);

            // Add a single file to the archive.
            let content = b"hello from archive";
            let mut header = tar::Header::new_gnu();
            header.set_size(content.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder
                .append_data(
                    &mut header,
                    "sherpa-onnx-whisper-base.en/tokens.txt",
                    content.as_ref(),
                )
                .unwrap();

            builder.finish().unwrap();
        }

        extract_tar_bz2(&tarball_path, &dest_dir).expect("extraction must succeed");

        let extracted = dest_dir
            .join("sherpa-onnx-whisper-base.en")
            .join("tokens.txt");
        assert!(
            extracted.is_file(),
            "extracted file must exist at {extracted:?}"
        );
        assert_eq!(std::fs::read(&extracted).unwrap(), b"hello from archive");
    }

    #[test]
    fn extract_tar_bz2_returns_error_for_missing_file() {
        let tmp = tempfile::tempdir().unwrap();
        let nonexistent = tmp.path().join("does_not_exist.tar.bz2");
        let result = extract_tar_bz2(&nonexistent, tmp.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("failed to open tarball"));
    }

    #[test]
    fn extract_tar_bz2_returns_error_for_corrupt_data() {
        let tmp = tempfile::tempdir().unwrap();
        let corrupt = tmp.path().join("corrupt.tar.bz2");
        std::fs::write(&corrupt, b"this is not a valid bzip2 stream").unwrap();

        let dest = tmp.path().join("out");
        std::fs::create_dir_all(&dest).unwrap();

        let result = extract_tar_bz2(&corrupt, &dest);
        assert!(result.is_err());
    }

    // --- PathBuf construction sanity ---

    #[test]
    fn models_dir_is_absolute() {
        let dir = models_dir().unwrap();
        assert!(
            dir.is_absolute(),
            "models_dir must be absolute, got: {}",
            dir.display()
        );
    }

    #[test]
    fn vad_path_is_under_models_dir() {
        let models = models_dir().unwrap();
        let vad = vad_model_path().unwrap();
        assert!(vad.starts_with(&models));
    }

    #[test]
    fn whisper_dir_is_under_models_dir() {
        let models = models_dir().unwrap();
        let whisper = whisper_model_dir().unwrap();
        assert!(whisper.starts_with(&models));
    }
}

use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::fs;

// ========== Data Structures ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResult {
    pub text: String,
    pub confidence: f32,
    pub language: String,
    pub processing_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRConfig {
    pub language: String,
    pub psm: u8,  // Page segmentation mode (0-13)
    pub oem: u8,  // OCR Engine mode (0-3)
    pub confidence_threshold: f32,
}

impl Default for OCRConfig {
    fn default() -> Self {
        OCRConfig {
            language: "eng".to_string(),
            psm: 3,  // Fully automatic page segmentation
            oem: 3,  // Default OCR Engine mode
            confidence_threshold: 0.6,
        }
    }
}

// ========== OCR Engine ==========

pub struct OCREngine {
    config: OCRConfig,
    tesseract_path: Option<PathBuf>,
}

impl OCREngine {
    pub fn new(config: OCRConfig) -> Self {
        let tesseract_path = find_tesseract_binary();
        OCREngine {
            config,
            tesseract_path,
        }
    }

    /// Perform OCR on an image file using command-line Tesseract
    pub fn process_image(&self, image_path: &Path) -> Result<OCRResult, String> {
        let start_time = std::time::Instant::now();

        if self.tesseract_path.is_none() {
            return Err("Tesseract is not installed. Please install Tesseract OCR to use this feature.".to_string());
        }

        let tesseract_cmd = self.tesseract_path
            .as_ref()
            .and_then(|p| p.to_str())
            .unwrap_or("tesseract");

        // Run Tesseract command
        let output = Command::new(tesseract_cmd)
            .arg(image_path.to_str().unwrap())
            .arg("stdout")  // Output to stdout instead of file
            .arg("-l")
            .arg(&self.config.language)
            .arg("--psm")
            .arg(format!("{}", self.config.psm))
            .arg("--oem")
            .arg(format!("{}", self.config.oem))
            .output()
            .map_err(|e| format!("Failed to run Tesseract: {}. Please ensure Tesseract is installed.", e))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            if error_msg.contains("not found") || error_msg.contains("No such file") {
                return Err("Tesseract is not installed. Please install Tesseract OCR.".to_string());
            }
            return Err(format!("Tesseract failed: {}", error_msg));
        }

        let text = String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 in OCR output: {}", e))?
            .trim()
            .to_string();

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        Ok(OCRResult {
            text,
            confidence: 0.75,  // Default confidence when using CLI
            language: self.config.language.clone(),
            processing_time_ms,
        })
    }

    /// Process multiple images in batch
    pub fn batch_process(&self, image_paths: &[PathBuf]) -> Vec<Result<OCRResult, String>> {
        image_paths.iter()
            .map(|path| self.process_image(path))
            .collect()
    }
}

// ========== Utility Functions ==========

/// Find Tesseract binary on the system
fn find_tesseract_binary() -> Option<PathBuf> {
    // Common locations for Tesseract on different platforms
    let possible_paths = vec![
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
        "/opt/homebrew/bin/tesseract",  // macOS with Homebrew on Apple Silicon
        "/usr/local/opt/tesseract/bin/tesseract",  // macOS with Homebrew on Intel
        "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
        "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
    ];

    for path_str in possible_paths {
        let path = PathBuf::from(path_str);
        if path.exists() {
            return Some(path);
        }
    }

    // Try to find in PATH using 'which' command (Unix-like systems)
    #[cfg(unix)]
    {
        if let Ok(output) = Command::new("which").arg("tesseract").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() {
                    return Some(PathBuf::from(path_str));
                }
            }
        }
    }

    // Try to find in PATH using 'where' command (Windows)
    #[cfg(windows)]
    {
        if let Ok(output) = Command::new("where").arg("tesseract").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() {
                    // 'where' might return multiple paths, take the first one
                    if let Some(first_line) = path_str.lines().next() {
                        return Some(PathBuf::from(first_line));
                    }
                }
            }
        }
    }

    None
}

/// Check if Tesseract is installed
pub fn is_tesseract_available() -> bool {
    find_tesseract_binary().is_some()
}

/// Get available languages for Tesseract
pub fn get_available_languages() -> Result<Vec<String>, String> {
    let tesseract_path = find_tesseract_binary()
        .ok_or_else(|| "Tesseract not found. Please install Tesseract OCR.".to_string())?;

    let output = Command::new(tesseract_path)
        .arg("--list-langs")
        .output()
        .map_err(|e| format!("Failed to get languages: {}", e))?;

    if !output.status.success() {
        return Err("Failed to list languages".to_string());
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    let languages: Vec<String> = output_str
        .lines()
        .skip(1)  // Skip the header line
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    Ok(languages)
}

// ========== Tauri Commands ==========

#[tauri::command]
pub async fn ocr_process_image(
    image_path: String,
    config: Option<OCRConfig>,
) -> Result<OCRResult, String> {
    let config = config.unwrap_or_default();
    let engine = OCREngine::new(config);
    let path = Path::new(&image_path);

    engine.process_image(path)
}

#[tauri::command]
pub async fn ocr_batch_process(
    image_paths: Vec<String>,
    config: Option<OCRConfig>,
) -> Result<Vec<OCRResult>, String> {
    let config = config.unwrap_or_default();
    let engine = OCREngine::new(config);

    let paths: Vec<PathBuf> = image_paths
        .iter()
        .map(|p| PathBuf::from(p))
        .collect();

    let results = engine.batch_process(&paths);

    // Convert Results to a single Result containing all successful OCR results
    let mut successful_results = Vec::new();
    for result in results {
        match result {
            Ok(ocr_result) => successful_results.push(ocr_result),
            Err(e) => eprintln!("OCR error: {}", e),
        }
    }

    Ok(successful_results)
}

#[tauri::command]
pub async fn check_ocr_availability() -> Result<bool, String> {
    Ok(is_tesseract_available())
}

#[tauri::command]
pub async fn get_ocr_languages() -> Result<Vec<String>, String> {
    get_available_languages()
}

// ========== Tests ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = OCRConfig::default();
        assert_eq!(config.language, "eng");
        assert_eq!(config.psm, 3);
    }

    #[test]
    fn test_tesseract_detection() {
        // This test will pass or fail depending on whether Tesseract is installed
        let available = is_tesseract_available();
        println!("Tesseract available: {}", available);
    }
}
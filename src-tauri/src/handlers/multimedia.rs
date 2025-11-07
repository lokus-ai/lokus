use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use image::GenericImageView;
use mime_guess::from_path;
use chrono::{DateTime, Utc};
use sha2::{Sha256, Digest};
use walkdir::WalkDir;
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Global hash cache
static HASH_CACHE: Lazy<Mutex<HashMap<PathBuf, (DateTime<Utc>, String)>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

// ========== Data Structures ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultimediaFile {
    pub id: String,
    pub file_path: PathBuf,
    pub media_type: MediaType,
    pub metadata: FileMetadata,
    pub extracted_content: Option<ExtractedContent>,
    pub thumbnail_path: Option<String>,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MediaType {
    Image,
    Pdf,
    Video,
    Audio,
    Markdown,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_name: String,
    pub file_size: u64,
    pub mime_type: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub dimensions: Option<ImageDimensions>,
    pub exif_data: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageDimensions {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedContent {
    pub text: String,
    pub extraction_method: ExtractionMethod,
    pub confidence: f32,
    pub extracted_at: DateTime<Utc>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtractionMethod {
    Ocr,
    PdfExtract,
    Manual,
    AudioTranscript,
}

// ========== Core Functions ==========

/// Classify a file based on its extension and MIME type
pub fn classify_media_type(path: &Path) -> MediaType {
    let mime_type = from_path(path).first_or_octet_stream();
    let type_str = mime_type.type_().as_str();
    let subtype_str = mime_type.subtype().as_str();

    match (type_str, subtype_str) {
        ("image", _) => MediaType::Image,
        ("application", "pdf") => MediaType::Pdf,
        ("video", _) => MediaType::Video,
        ("audio", _) => MediaType::Audio,
        ("text", "markdown") | ("text", "x-markdown") => MediaType::Markdown,
        _ => {
            // Fallback to extension-based detection
            if let Some(ext) = path.extension() {
                match ext.to_str().unwrap_or("").to_lowercase().as_str() {
                    "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "svg" => MediaType::Image,
                    "pdf" => MediaType::Pdf,
                    "mp4" | "avi" | "mkv" | "mov" | "webm" => MediaType::Video,
                    "mp3" | "wav" | "ogg" | "m4a" | "flac" => MediaType::Audio,
                    "md" | "markdown" => MediaType::Markdown,
                    _ => MediaType::Unknown,
                }
            } else {
                MediaType::Unknown
            }
        }
    }
}

/// Calculate SHA256 hash of a file with caching
/// Only recalculates if file modified timestamp changed
pub fn calculate_file_hash(path: &Path) -> Result<String, String> {
    // Get file metadata first
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let modified: DateTime<Utc> = metadata.modified()
        .map_err(|e| e.to_string())?
        .into();

    // Check cache
    let mut cache = HASH_CACHE.lock().unwrap();
    if let Some((cached_time, cached_hash)) = cache.get(path) {
        // If file hasn't been modified, return cached hash
        if cached_time == &modified {
            return Ok(cached_hash.clone());
        }
    }

    // Calculate hash (cache miss or file modified)
    let content = fs::read(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    let hash = format!("{:x}", hasher.finalize());

    // Update cache
    cache.insert(path.to_path_buf(), (modified, hash.clone()));

    Ok(hash)
}

/// Extract metadata from a file
pub fn extract_file_metadata(path: &Path) -> Result<FileMetadata, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let mime_type = from_path(path).first_or_octet_stream().to_string();

    let created_at = metadata.created()
        .map_err(|e| e.to_string())?
        .into();

    let modified_at = metadata.modified()
        .map_err(|e| e.to_string())?
        .into();

    // Extract image dimensions if it's an image
    let dimensions = if classify_media_type(path) == MediaType::Image {
        extract_image_dimensions(path).ok()
    } else {
        None
    };

    // EXIF data extraction disabled (requires additional dependencies)
    let exif_data = None;

    Ok(FileMetadata {
        file_name: path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        file_size: metadata.len(),
        mime_type,
        created_at,
        modified_at,
        dimensions,
        exif_data,
    })
}

/// Extract dimensions from an image file
pub fn extract_image_dimensions(path: &Path) -> Result<ImageDimensions, String> {
    let img = image::open(path).map_err(|e| e.to_string())?;
    let (width, height) = img.dimensions();

    Ok(ImageDimensions { width, height })
}

// EXIF extraction disabled - requires additional dependencies
// To enable EXIF extraction:
// 1. Add 'exif = "0.0.5"' to Cargo.toml
// 2. Uncomment the function below
/*
/// Extract EXIF data from an image
pub fn extract_exif_data(path: &Path) -> Result<HashMap<String, String>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut reader = std::io::BufReader::new(file);
    let exif_reader = exif::Reader::new();

    let exif_data = exif_reader.read_from_container(&mut reader)
        .map_err(|e| e.to_string())?;

    let mut result = HashMap::new();

    for field in exif_data.fields() {
        let tag_name = format!("{:?}", field.tag);
        let value = format!("{}", field.display_value());
        result.insert(tag_name, value);
    }

    Ok(result)
}
*/

/// Generate a thumbnail for an image
pub fn generate_image_thumbnail(
    input_path: &Path,
    output_dir: &Path,
    max_size: u32,
) -> Result<PathBuf, String> {
    let img = image::open(input_path).map_err(|e| e.to_string())?;

    // Calculate thumbnail dimensions maintaining aspect ratio
    let (orig_width, orig_height) = img.dimensions();
    let ratio = (max_size as f32) / orig_width.max(orig_height) as f32;

    if ratio < 1.0 {
        let new_width = (orig_width as f32 * ratio) as u32;
        let new_height = (orig_height as f32 * ratio) as u32;

        let thumbnail = img.resize(
            new_width,
            new_height,
            image::imageops::FilterType::Lanczos3,
        );

        // Generate output filename
        let hash = calculate_file_hash(input_path)?;
        let thumbnail_name = format!("thumb_{}.jpg", &hash[0..16]);
        let thumbnail_path = output_dir.join(thumbnail_name);

        // Save thumbnail as JPEG
        thumbnail.save(&thumbnail_path).map_err(|e| e.to_string())?;

        Ok(thumbnail_path)
    } else {
        // Image is already small enough
        Ok(input_path.to_path_buf())
    }
}

/// Process a multimedia file and extract all relevant information
pub async fn process_multimedia_file(
    path: &Path,
    workspace_root: &Path,
) -> Result<MultimediaFile, String> {
    let media_type = classify_media_type(path);
    let metadata = extract_file_metadata(path)?;
    let hash = calculate_file_hash(path)?;

    // Generate thumbnail for images
    let thumbnail_path = if media_type == MediaType::Image {
        let thumbnails_dir = workspace_root.join(".lokus").join("thumbnails");
        fs::create_dir_all(&thumbnails_dir).map_err(|e| e.to_string())?;

        Some(
            generate_image_thumbnail(path, &thumbnails_dir, 256)?
                .to_string_lossy()
                .to_string()
        )
    } else {
        None
    };

    // Extract content based on media type
    let extracted_content = match media_type {
        MediaType::Image => {
            // OCR will be implemented in the ocr module
            None
        }
        MediaType::Pdf => {
            // PDF extraction will be implemented in the pdf module
            None
        }
        MediaType::Markdown => {
            // Read markdown content directly
            let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
            Some(ExtractedContent {
                text,
                extraction_method: ExtractionMethod::Manual,
                confidence: 1.0,
                extracted_at: Utc::now(),
                language: Some("en".to_string()),
            })
        }
        _ => None,
    };

    Ok(MultimediaFile {
        id: hash.clone(),
        file_path: path.to_path_buf(),
        media_type,
        metadata,
        extracted_content,
        thumbnail_path,
        hash,
    })
}

/// Get or generate thumbnail for an image (with caching)
/// Uses async I/O to prevent blocking
pub async fn get_or_create_thumbnail(
    image_path: &Path,
    workspace_path: &Path,
) -> Result<String, String> {
    // Calculate hash to determine thumbnail filename
    let hash = calculate_file_hash(image_path)?;
    let thumbnail_name = format!("thumb_{}.jpg", &hash[0..16]);

    // Create thumbnails directory if it doesn't exist
    let thumbnails_dir = workspace_path.join(".lokus").join("thumbnails");
    tokio::fs::create_dir_all(&thumbnails_dir)
        .await
        .map_err(|e| e.to_string())?;

    let thumbnail_path = thumbnails_dir.join(&thumbnail_name);

    // Check if thumbnail already exists (cached)
    if tokio::fs::try_exists(&thumbnail_path).await.unwrap_or(false) {
        return Ok(thumbnail_path.to_string_lossy().to_string());
    }

    // Generate new thumbnail (spawn blocking since image processing is CPU-intensive)
    let image_path_owned = image_path.to_path_buf();
    let thumbnails_dir_owned = thumbnails_dir.clone();

    let generated_path = tokio::task::spawn_blocking(move || {
        generate_image_thumbnail(&image_path_owned, &thumbnails_dir_owned, 256)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(generated_path.to_string_lossy().to_string())
}

// ========== Tauri Commands ==========

#[tauri::command]
pub async fn classify_media(path: String) -> Result<MediaType, String> {
    let path = Path::new(&path);
    Ok(classify_media_type(path))
}

#[tauri::command]
pub async fn extract_metadata(path: String) -> Result<FileMetadata, String> {
    let path = Path::new(&path);
    extract_file_metadata(path)
}

#[tauri::command]
pub async fn process_media_file(
    path: String,
    workspace_path: String,
) -> Result<MultimediaFile, String> {
    let file_path = Path::new(&path);
    let workspace_path = Path::new(&workspace_path);

    process_multimedia_file(file_path, workspace_path).await
}

#[tauri::command]
pub async fn generate_thumbnail(
    input_path: String,
    output_dir: String,
    max_size: u32,
) -> Result<String, String> {
    let input = Path::new(&input_path);
    let output = Path::new(&output_dir);

    let thumbnail_path = generate_image_thumbnail(input, output, max_size)?;
    Ok(thumbnail_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn batch_process_media(
    paths: Vec<String>,
    workspace_path: String,
) -> Result<Vec<MultimediaFile>, String> {
    let workspace = Path::new(&workspace_path);
    let mut results = Vec::new();

    for path_str in paths {
        let path = Path::new(&path_str);
        match process_multimedia_file(path, workspace).await {
            Ok(file) => results.push(file),
            Err(e) => {
                eprintln!("Error processing {}: {}", path_str, e);
                // Continue processing other files
            }
        }
    }

    Ok(results)
}

/// Recursively scan workspace for images and PDFs
pub fn scan_workspace_for_media(workspace_path: &Path) -> Result<Vec<MultimediaFile>, String> {
    let mut media_files = Vec::new();

    // Supported media extensions
    let image_extensions = vec!["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
    let pdf_extensions = vec!["pdf"];
    let mut supported_extensions = image_extensions.clone();
    supported_extensions.extend(pdf_extensions);

    // Walk through directory recursively
    for entry in WalkDir::new(workspace_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Skip hidden directories and .lokus directory
        if path.is_dir() {
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.starts_with('.') {
                    continue;
                }
            }
        }

        // Check if it's a supported media file
        if path.is_file() {
            if let Some(extension) = path.extension() {
                let ext = extension.to_string_lossy().to_lowercase();
                if supported_extensions.contains(&ext.as_str()) {
                    // Classify and get basic metadata
                    let media_type = classify_media_type(path);

                    // Only process images and PDFs
                    if media_type == MediaType::Image || media_type == MediaType::Pdf {
                        if let Ok(metadata) = extract_file_metadata(path) {
                            if let Ok(hash) = calculate_file_hash(path) {
                                // Don't generate thumbnails during scan for performance
                                // They can be generated on-demand
                                media_files.push(MultimediaFile {
                                    id: hash.clone(),
                                    file_path: path.to_path_buf(),
                                    media_type,
                                    metadata,
                                    extracted_content: None,
                                    thumbnail_path: None,
                                    hash,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by modified date (newest first)
    media_files.sort_by(|a, b| {
        b.metadata.modified_at.cmp(&a.metadata.modified_at)
    });

    Ok(media_files)
}

#[tauri::command]
pub async fn scan_workspace_media(workspace_path: String) -> Result<Vec<MultimediaFile>, String> {
    let path = Path::new(&workspace_path);
    scan_workspace_for_media(path)
}

#[tauri::command]
pub async fn get_thumbnail(
    image_path: String,
    workspace_path: String,
) -> Result<String, String> {
    let image = Path::new(&image_path);
    let workspace = Path::new(&workspace_path);
    get_or_create_thumbnail(image, workspace).await
}

// ========== Tests ==========

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_classify_media_type() {
        assert_eq!(classify_media_type(Path::new("test.png")), MediaType::Image);
        assert_eq!(classify_media_type(Path::new("test.pdf")), MediaType::Pdf);
        assert_eq!(classify_media_type(Path::new("test.mp4")), MediaType::Video);
        assert_eq!(classify_media_type(Path::new("test.mp3")), MediaType::Audio);
        assert_eq!(classify_media_type(Path::new("test.md")), MediaType::Markdown);
        assert_eq!(classify_media_type(Path::new("test.txt")), MediaType::Unknown);
    }

    #[test]
    fn test_file_hash_calculation() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "Hello, World!").unwrap();

        let hash = calculate_file_hash(&file_path).unwrap();
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA256 produces 64 hex characters
    }
}
use serde::{Serialize, Deserialize};
use std::path::Path;
use std::fs;
use pdf_extract;
use lopdf::{Document, Object};
use chrono::{DateTime, Utc};

// ========== Data Structures ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDFContent {
    pub text: String,
    pub pages: Vec<PageContent>,
    pub metadata: PDFMetadata,
    pub structure: DocumentStructure,
    pub embedded_images: Vec<ExtractedImage>,
    pub links: Vec<PDFLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageContent {
    pub page_number: usize,
    pub text: String,
    pub has_images: bool,
    pub has_tables: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDFMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<DateTime<Utc>>,
    pub modification_date: Option<DateTime<Utc>>,
    pub page_count: usize,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentStructure {
    pub headings: Vec<Heading>,
    pub paragraphs: Vec<Paragraph>,
    pub lists: Vec<ListItem>,
    pub tables: Vec<Table>,
    pub citations: Vec<Citation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heading {
    pub level: u8,
    pub text: String,
    pub page: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paragraph {
    pub text: String,
    pub page: usize,
    pub is_indented: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListItem {
    pub text: String,
    pub page: usize,
    pub level: u8,
    pub list_type: ListType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ListType {
    Bullet,
    Numbered,
    Letter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub rows: Vec<Vec<String>>,
    pub page: usize,
    pub has_header: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    pub text: String,
    pub page: usize,
    pub citation_type: CitationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CitationType {
    Reference,
    Footnote,
    Endnote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedImage {
    pub page: usize,
    pub image_data: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDFLink {
    pub text: String,
    pub url: String,
    pub page: usize,
}

// ========== PDF Processor ==========

pub struct PDFProcessor {
    cache_enabled: bool,
    extract_images: bool,
    preserve_layout: bool,
}

impl PDFProcessor {
    pub fn new() -> Self {
        PDFProcessor {
            cache_enabled: true,
            extract_images: true,
            preserve_layout: true,
        }
    }

    pub fn with_options(
        cache_enabled: bool,
        extract_images: bool,
        preserve_layout: bool,
    ) -> Self {
        PDFProcessor {
            cache_enabled,
            extract_images,
            preserve_layout,
        }
    }

    /// Extract all content from a PDF file
    pub fn extract_content(&self, pdf_path: &Path) -> Result<PDFContent, String> {
        // Extract basic text
        let text = self.extract_text(pdf_path)?;

        // Parse document structure
        let document = Document::load(pdf_path)
            .map_err(|e| format!("Failed to load PDF: {}", e))?;

        // Extract metadata
        let metadata = self.extract_metadata(&document, pdf_path)?;

        // Extract pages
        let pages = self.extract_pages(&document)?;

        // Parse document structure
        let structure = self.parse_document_structure(&text, &pages);

        // Extract embedded images if enabled
        let embedded_images = if self.extract_images {
            self.extract_images_from_pdf(&document)?
        } else {
            Vec::new()
        };

        // Extract links
        let links = self.extract_links(&document)?;

        Ok(PDFContent {
            text,
            pages,
            metadata,
            structure,
            embedded_images,
            links,
        })
    }

    /// Extract plain text from PDF
    fn extract_text(&self, pdf_path: &Path) -> Result<String, String> {
        pdf_extract::extract_text(pdf_path)
            .map_err(|e| format!("Failed to extract text: {}", e))
    }

    /// Extract metadata from PDF
    fn extract_metadata(&self, doc: &Document, pdf_path: &Path) -> Result<PDFMetadata, String> {
        let page_count = doc.get_pages().len();

        let file_metadata = fs::metadata(pdf_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;

        let file_size = file_metadata.len();

        // Extract document info
        let info = doc.trailer.get(b"Info")
            .ok()
            .and_then(|info_obj| info_obj.as_reference().ok())
            .and_then(|reference| doc.get_object(reference).ok())
            .and_then(|obj| obj.as_dict().ok());

        let mut metadata = PDFMetadata {
            title: None,
            author: None,
            subject: None,
            keywords: None,
            creator: None,
            producer: None,
            creation_date: None,
            modification_date: None,
            page_count,
            file_size,
        };

        if let Some(info_dict) = info {
            metadata.title = extract_string_from_dict(&info_dict, b"Title");
            metadata.author = extract_string_from_dict(&info_dict, b"Author");
            metadata.subject = extract_string_from_dict(&info_dict, b"Subject");
            metadata.keywords = extract_string_from_dict(&info_dict, b"Keywords");
            metadata.creator = extract_string_from_dict(&info_dict, b"Creator");
            metadata.producer = extract_string_from_dict(&info_dict, b"Producer");
        }

        Ok(metadata)
    }

    /// Extract individual pages
    fn extract_pages(&self, doc: &Document) -> Result<Vec<PageContent>, String> {
        let mut pages = Vec::new();
        let page_numbers: Vec<_> = doc.get_pages().keys().cloned().collect();

        for (idx, page_num) in page_numbers.iter().enumerate() {
            let page_text = self.extract_page_text(doc, *page_num)?;
            let has_tables = detect_table_in_text(&page_text);

            pages.push(PageContent {
                page_number: idx + 1,
                text: page_text,
                has_images: false, // Would need to check for image objects
                has_tables,
            });
        }

        Ok(pages)
    }

    /// Extract text from a specific page
    fn extract_page_text(&self, doc: &Document, page_num: u32) -> Result<String, String> {
        // This is a simplified version - in production you'd use more sophisticated extraction
        Ok(format!("[Page {} content]", page_num))
    }

    /// Parse document structure from text
    fn parse_document_structure(&self, text: &str, pages: &[PageContent]) -> DocumentStructure {
        let headings = self.extract_headings(text, pages);
        let paragraphs = self.extract_paragraphs(text, pages);
        let lists = self.extract_lists(text, pages);
        let tables = self.extract_tables(text, pages);
        let citations = self.extract_citations(text, pages);

        DocumentStructure {
            headings,
            paragraphs,
            lists,
            tables,
            citations,
        }
    }

    /// Extract headings from text
    fn extract_headings(&self, text: &str, _pages: &[PageContent]) -> Vec<Heading> {
        let mut headings = Vec::new();

        for (line_num, line) in text.lines().enumerate() {
            let trimmed = line.trim();

            // Simple heuristics for heading detection
            if trimmed.len() > 0 && trimmed.len() < 100 {
                // Check for numbered headings like "1. Introduction"
                if trimmed.chars().next().unwrap_or(' ').is_digit(10) {
                    headings.push(Heading {
                        level: 1,
                        text: trimmed.to_string(),
                        page: (line_num / 50) + 1, // Rough page estimation
                    });
                }
                // Check for all-caps headings
                else if trimmed.chars().all(|c| c.is_uppercase() || !c.is_alphabetic()) {
                    headings.push(Heading {
                        level: 1,
                        text: trimmed.to_string(),
                        page: (line_num / 50) + 1,
                    });
                }
            }
        }

        headings
    }

    /// Extract paragraphs from text
    fn extract_paragraphs(&self, text: &str, _pages: &[PageContent]) -> Vec<Paragraph> {
        let mut paragraphs = Vec::new();
        let mut current_paragraph = String::new();
        let mut current_page = 1;

        for line in text.lines() {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                if !current_paragraph.is_empty() {
                    paragraphs.push(Paragraph {
                        text: current_paragraph.clone(),
                        page: current_page,
                        is_indented: line.starts_with("  ") || line.starts_with("\t"),
                    });
                    current_paragraph.clear();
                }
            } else {
                if !current_paragraph.is_empty() {
                    current_paragraph.push(' ');
                }
                current_paragraph.push_str(trimmed);
            }
        }

        // Don't forget the last paragraph
        if !current_paragraph.is_empty() {
            paragraphs.push(Paragraph {
                text: current_paragraph,
                page: current_page,
                is_indented: false,
            });
        }

        paragraphs
    }

    /// Extract lists from text
    fn extract_lists(&self, text: &str, _pages: &[PageContent]) -> Vec<ListItem> {
        let mut lists = Vec::new();

        for (line_num, line) in text.lines().enumerate() {
            let trimmed = line.trim();

            // Check for bullet points
            if trimmed.starts_with("•") || trimmed.starts_with("-") || trimmed.starts_with("*") {
                lists.push(ListItem {
                    text: trimmed[1..].trim().to_string(),
                    page: (line_num / 50) + 1,
                    level: 0,
                    list_type: ListType::Bullet,
                });
            }
            // Check for numbered lists
            else if let Some(dot_pos) = trimmed.find('.') {
                if dot_pos > 0 && trimmed[..dot_pos].chars().all(|c| c.is_digit(10)) {
                    lists.push(ListItem {
                        text: trimmed[dot_pos + 1..].trim().to_string(),
                        page: (line_num / 50) + 1,
                        level: 0,
                        list_type: ListType::Numbered,
                    });
                }
            }
        }

        lists
    }

    /// Extract tables (simplified)
    fn extract_tables(&self, _text: &str, pages: &[PageContent]) -> Vec<Table> {
        let mut tables = Vec::new();

        for (idx, page) in pages.iter().enumerate() {
            if page.has_tables {
                // Simplified table detection
                tables.push(Table {
                    rows: vec![vec!["Sample".to_string(), "Table".to_string()]],
                    page: idx + 1,
                    has_header: true,
                });
            }
        }

        tables
    }

    /// Extract citations and references
    fn extract_citations(&self, text: &str, _pages: &[PageContent]) -> Vec<Citation> {
        let mut citations = Vec::new();

        for (line_num, line) in text.lines().enumerate() {
            let trimmed = line.trim();

            // Look for citation patterns like [1], (Smith, 2020), etc.
            if trimmed.contains("[") && trimmed.contains("]") {
                citations.push(Citation {
                    text: trimmed.to_string(),
                    page: (line_num / 50) + 1,
                    citation_type: CitationType::Reference,
                });
            }
        }

        citations
    }

    /// Extract embedded images from PDF
    fn extract_images_from_pdf(&self, _doc: &Document) -> Result<Vec<ExtractedImage>, String> {
        // This would require parsing XObjects and image streams
        // For now, returning empty vector
        Ok(Vec::new())
    }

    /// Extract links from PDF
    fn extract_links(&self, _doc: &Document) -> Result<Vec<PDFLink>, String> {
        // This would require parsing annotation objects
        // For now, returning empty vector
        Ok(Vec::new())
    }
}

// ========== Helper Functions ==========

fn extract_string_from_dict(dict: &lopdf::Dictionary, key: &[u8]) -> Option<String> {
    dict.get(key)
        .ok()
        .and_then(|obj| match obj {
            Object::String(bytes, _) => Some(String::from_utf8_lossy(bytes).to_string()),
            Object::Name(bytes) => Some(String::from_utf8_lossy(bytes).to_string()),
            _ => None,
        })
}

fn detect_table_in_text(text: &str) -> bool {
    // Simple heuristic: look for patterns that might indicate a table
    let lines: Vec<&str> = text.lines().collect();

    for window in lines.windows(3) {
        let pipe_count: Vec<usize> = window.iter()
            .map(|line| line.matches('|').count())
            .collect();

        // If consecutive lines have similar pipe counts, might be a table
        if pipe_count.len() >= 2 &&
           pipe_count[0] > 1 &&
           pipe_count[0] == pipe_count[1] {
            return true;
        }
    }

    false
}

// ========== Tauri Commands ==========

#[tauri::command]
pub async fn extract_pdf_content(pdf_path: String) -> Result<PDFContent, String> {
    let processor = PDFProcessor::new();
    let path = Path::new(&pdf_path);

    processor.extract_content(path)
}

#[tauri::command]
pub async fn extract_pdf_text(pdf_path: String) -> Result<String, String> {
    let path = Path::new(&pdf_path);
    pdf_extract::extract_text(path)
        .map_err(|e| format!("Failed to extract text: {}", e))
}

#[tauri::command]
pub async fn extract_pdf_metadata(pdf_path: String) -> Result<PDFMetadata, String> {
    let processor = PDFProcessor::new();
    let path = Path::new(&pdf_path);

    let doc = Document::load(path)
        .map_err(|e| format!("Failed to load PDF: {}", e))?;

    processor.extract_metadata(&doc, path)
}

#[tauri::command]
pub async fn batch_extract_pdfs(pdf_paths: Vec<String>) -> Result<Vec<PDFContent>, String> {
    let processor = PDFProcessor::new();
    let mut results = Vec::new();

    for path_str in pdf_paths {
        let path = Path::new(&path_str);
        match processor.extract_content(path) {
            Ok(content) => results.push(content),
            Err(e) => eprintln!("Error processing PDF {}: {}", path_str, e),
        }
    }

    Ok(results)
}

// ========== Tests ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_table_in_text() {
        let text_with_table = "Header 1 | Header 2 | Header 3\n---|---|---\nRow 1 | Data | More";
        assert!(detect_table_in_text(text_with_table));

        let text_without_table = "This is just regular text\nWith no table structure";
        assert!(!detect_table_in_text(text_without_table));
    }

    #[test]
    fn test_processor_creation() {
        let processor = PDFProcessor::new();
        assert!(processor.cache_enabled);
        assert!(processor.extract_images);
        assert!(processor.preserve_layout);
    }
}
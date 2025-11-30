use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use regex::Regex;
use walkdir::WalkDir;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    #[serde(rename = "caseSensitive")]
    pub case_sensitive: Option<bool>,
    #[serde(rename = "wholeWord")]
    pub whole_word: Option<bool>,
    pub regex: Option<bool>,
    #[serde(rename = "fileTypes")]
    pub file_types: Option<Vec<String>>,
    #[serde(rename = "maxResults")]
    pub max_results: Option<usize>,
    #[serde(rename = "contextLines")]
    pub context_lines: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub line: usize,
    pub column: usize,
    pub text: String,
    #[serde(rename = "match")]
    pub match_text: String,
    pub context: Vec<ContextLine>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextLine {
    #[serde(rename = "lineNumber")]
    pub line_number: usize,
    pub text: String,
    #[serde(rename = "isMatch")]
    pub is_match: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub file: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub matches: Vec<SearchMatch>,
    #[serde(rename = "matchCount")]
    pub match_count: usize,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            case_sensitive: Some(false),
            whole_word: Some(false),
            regex: Some(false),
            file_types: Some(vec!["md".to_string(), "txt".to_string()]),
            max_results: Some(100),
            context_lines: Some(2),
        }
    }
}

/// Search for a query across multiple files in a directory
#[command]
pub async fn search_in_files(
    query: String,
    workspace_path: Option<String>,
    options: Option<SearchOptions>,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let opts = options.unwrap_or_default();
    let search_path = workspace_path.unwrap_or_else(|| ".".to_string());
    let path = Path::new(&search_path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", search_path));
    }

    let case_sensitive = opts.case_sensitive.unwrap_or(false);
    let whole_word = opts.whole_word.unwrap_or(false);
    let is_regex = opts.regex.unwrap_or(false);
    let file_types = opts.file_types.unwrap_or_else(|| vec!["md".to_string(), "txt".to_string()]);
    let max_results = opts.max_results.unwrap_or(100);
    let context_lines = opts.context_lines.unwrap_or(2);

    // Build regex pattern
    let pattern = if is_regex {
        query.clone()
    } else {
        let escaped = regex::escape(&query);
        if whole_word {
            format!(r"\b{}\b", escaped)
        } else {
            escaped
        }
    };

    let mut regex_builder = regex::RegexBuilder::new(&pattern);
    if !case_sensitive {
        regex_builder.case_insensitive(true);
    }

    let regex = regex_builder.build().map_err(|e| format!("Invalid regex pattern: {}", e))?;

    let mut results = Vec::new();
    let mut total_results = 0;

    // Walk through directory
    for entry in WalkDir::new(path)
        .follow_links(false)
        .max_depth(10)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if total_results >= max_results {
            break;
        }

        let file_path = entry.path();
        
        // Skip directories
        if file_path.is_dir() {
            continue;
        }

        // Skip build and cache directories
        let path_str = file_path.to_string_lossy();
        if path_str.contains("target/") || 
           path_str.contains("node_modules/") || 
           path_str.contains(".git/") ||
           path_str.contains("dist/") ||
           path_str.contains("build/") ||
           path_str.contains(".cache/") ||
           path_str.contains(".next/") ||
           path_str.contains(".vscode/") ||
           path_str.contains("__pycache__/") {
            continue;
        }

        // Check file extension
        if let Some(extension) = file_path.extension() {
            if let Some(ext_str) = extension.to_str() {
                if !file_types.contains(&ext_str.to_lowercase()) {
                    continue;
                }
            }
        } else {
            // Skip files without extensions unless txt is in allowed types
            if !file_types.contains(&"txt".to_string()) {
                continue;
            }
        }

        // Skip binary files and large files
        if let Ok(metadata) = file_path.metadata() {
            // Skip files larger than 10MB
            if metadata.len() > 10 * 1024 * 1024 {
                continue;
            }
        }

        // Search in file
        match search_in_single_file(file_path, &regex, &query, context_lines) {
            Ok(file_matches) => {
                if !file_matches.is_empty() {
                    let file_name = file_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    
                    let file_path_str = file_path.to_string_lossy().to_string();
                    
                    results.push(SearchResult {
                        file: file_path_str,
                        file_name,
                        match_count: file_matches.len(),
                        matches: file_matches,
                    });
                    
                    total_results += 1;
                }
            }
            Err(_e) => {
                // Continue with other files instead of failing completely
            }
        }
    }

    Ok(results)
}

/// Search within a single file
fn search_in_single_file(
    file_path: &Path,
    regex: &Regex,
    _query: &str,
    context_lines: usize,
) -> Result<Vec<SearchMatch>, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(file_path)?;
    let lines: Vec<&str> = content.lines().collect();
    let mut matches = Vec::new();

    for (line_index, line) in lines.iter().enumerate() {
        if let Some(regex_match) = regex.find(line) {
            let line_number = line_index + 1;
            let column = regex_match.start();
            let match_text = regex_match.as_str().to_string();
            
            // Get context lines
            let context = get_context_lines(&lines, line_index, context_lines);
            
            matches.push(SearchMatch {
                line: line_number,
                column,
                text: line.to_string(),
                match_text,
                context,
            });
        }
    }

    Ok(matches)
}

/// Get context lines around a match
fn get_context_lines(lines: &[&str], target_line: usize, context_lines: usize) -> Vec<ContextLine> {
    let start = target_line.saturating_sub(context_lines);
    let end = std::cmp::min(lines.len() - 1, target_line + context_lines);
    
    let mut context = Vec::new();
    
    for i in start..=end {
        if i < lines.len() {
            context.push(ContextLine {
                line_number: i + 1,
                text: lines[i].to_string(),
                is_match: i == target_line,
            });
        }
    }
    
    context
}

/// Search within a specific file (for single file search)
#[command]
pub async fn search_in_file(
    file_path: String,
    query: String,
    options: Option<SearchOptions>,
) -> Result<Vec<SearchMatch>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let opts = options.unwrap_or_default();
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let case_sensitive = opts.case_sensitive.unwrap_or(false);
    let whole_word = opts.whole_word.unwrap_or(false);
    let is_regex = opts.regex.unwrap_or(false);
    let context_lines = opts.context_lines.unwrap_or(2);

    // Build regex pattern
    let pattern = if is_regex {
        query.clone()
    } else {
        let escaped = regex::escape(&query);
        if whole_word {
            format!(r"\b{}\b", escaped)
        } else {
            escaped
        }
    };

    let mut regex_builder = regex::RegexBuilder::new(&pattern);
    if !case_sensitive {
        regex_builder.case_insensitive(true);
    }

    let regex = regex_builder.build().map_err(|e| format!("Invalid regex pattern: {}", e))?;

    search_in_single_file(path, &regex, &query, context_lines)
        .map_err(|e| format!("Error searching file: {}", e))
}

/// Get file content with line numbers (utility for editor integration)
#[command]
pub async fn get_file_content_with_lines(file_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    match fs::read_to_string(path) {
        Ok(content) => {
            let lines: Vec<String> = content.lines().map(|line| line.to_string()).collect();
            Ok(lines)
        }
        Err(e) => Err(format!("Error reading file: {}", e))
    }
}

/// Build search index for faster searching (future enhancement)
#[command]
pub async fn build_search_index(workspace_path: String) -> Result<String, String> {
    // This is a placeholder for future search indexing functionality
    // Could use libraries like tantivy for full-text search indexing
    Ok(format!("Search index built for workspace: {}", workspace_path))
}
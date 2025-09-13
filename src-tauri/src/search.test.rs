#[cfg(test)]
mod search_tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;
    use tokio_test;

    #[tokio::test]
    async fn test_search_in_files_basic() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "Hello world\nThis is a test\nHello again").unwrap();

        let results = search_in_files(
            "Hello".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            None,
        ).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_count, 2);
        assert_eq!(results[0].matches[0].line, 1);
        assert_eq!(results[0].matches[1].line, 3);
        assert_eq!(results[0].file_name, "test.md");
    }

    #[tokio::test]
    async fn test_search_with_case_sensitive() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "Hello\nhello\nHELLO").unwrap();

        let options = SearchOptions {
            case_sensitive: Some(true),
            ..Default::default()
        };

        let results = search_in_files(
            "Hello".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            Some(options),
        ).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_count, 1);
        assert_eq!(results[0].matches[0].line, 1);
    }

    #[tokio::test]
    async fn test_search_with_whole_word() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "test testing tests").unwrap();

        let options = SearchOptions {
            whole_word: Some(true),
            ..Default::default()
        };

        let results = search_in_files(
            "test".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            Some(options),
        ).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_count, 1); // Only exact "test", not "testing" or "tests"
    }

    #[tokio::test]
    async fn test_search_with_regex() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "email@example.com\nuser@test.org\ninvalid-email").unwrap();

        let options = SearchOptions {
            regex: Some(true),
            ..Default::default()
        };

        let results = search_in_files(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            Some(options),
        ).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_count, 2); // Should match valid emails only
    }

    #[tokio::test]
    async fn test_search_context_lines() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "line1\nline2\ntarget\nline4\nline5").unwrap();

        let options = SearchOptions {
            context_lines: Some(1),
            ..Default::default()
        };

        let results = search_in_files(
            "target".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            Some(options),
        ).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].matches[0].context.len(), 3); // 1 before + match + 1 after
        assert_eq!(results[0].matches[0].context[0].line_number, 2);
        assert_eq!(results[0].matches[0].context[1].line_number, 3);
        assert_eq!(results[0].matches[0].context[2].line_number, 4);
        assert!(results[0].matches[0].context[1].is_match);
    }

    #[tokio::test]
    async fn test_search_file_type_filtering() {
        let dir = tempdir().unwrap();
        
        // Create files with different extensions
        let md_file = dir.path().join("test.md");
        let txt_file = dir.path().join("test.txt");
        let js_file = dir.path().join("test.js");
        
        fs::write(&md_file, "Hello in markdown").unwrap();
        fs::write(&txt_file, "Hello in text").unwrap();
        fs::write(&js_file, "Hello in javascript").unwrap();

        let options = SearchOptions {
            file_types: Some(vec!["md".to_string()]),
            ..Default::default()
        };

        let results = search_in_files(
            "Hello".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            Some(options),
        ).await.unwrap();

        assert_eq!(results.len(), 1); // Should only find in .md file
        assert!(results[0].file_name.ends_with(".md"));
    }

    #[tokio::test]
    async fn test_search_max_results() {
        let dir = tempdir().unwrap();
        
        // Create multiple files with matches
        for i in 0..5 {
            let file_path = dir.path().join(format!("test{}.md", i));
            fs::write(&file_path, "target content").unwrap();
        }

        let options = SearchOptions {
            max_results: Some(3),
            ..Default::default()
        };

        let results = search_in_files(
            "target".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            Some(options),
        ).await.unwrap();

        assert!(results.len() <= 3); // Should respect max_results limit
    }

    #[tokio::test]
    async fn test_search_excludes_build_directories() {
        let dir = tempdir().unwrap();
        
        // Create file in main directory
        let main_file = dir.path().join("main.md");
        fs::write(&main_file, "target content").unwrap();
        
        // Create file in build directory
        let build_dir = dir.path().join("target");
        fs::create_dir(&build_dir).unwrap();
        let build_file = build_dir.join("build.md");
        fs::write(&build_file, "target content").unwrap();

        let results = search_in_files(
            "target".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            None,
        ).await.unwrap();

        // Should only find file in main directory, not in build directory
        assert_eq!(results.len(), 1);
        assert!(!results[0].file.contains("target/"));
    }

    #[tokio::test]
    async fn test_search_empty_query() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "Hello world").unwrap();

        let results = search_in_files(
            "".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            None,
        ).await.unwrap();

        assert_eq!(results.len(), 0); // Empty query should return no results
    }

    #[tokio::test]
    async fn test_search_nonexistent_path() {
        let result = search_in_files(
            "test".to_string(),
            Some("/nonexistent/path".to_string()),
            None,
        ).await;

        assert!(result.is_err()); // Should return error for nonexistent path
    }

    #[tokio::test]
    async fn test_search_in_single_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "Hello world\nHello again").unwrap();

        let results = search_in_file(
            file_path.to_string_lossy().to_string(),
            "Hello".to_string(),
            None,
        ).await.unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].line, 1);
        assert_eq!(results[1].line, 2);
    }

    #[tokio::test]
    async fn test_get_file_content_with_lines() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "line1\nline2\nline3").unwrap();

        let lines = get_file_content_with_lines(
            file_path.to_string_lossy().to_string()
        ).await.unwrap();

        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "line1");
        assert_eq!(lines[1], "line2");
        assert_eq!(lines[2], "line3");
    }

    #[tokio::test]
    async fn test_search_with_invalid_regex() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "Hello world").unwrap();

        let options = SearchOptions {
            regex: Some(true),
            ..Default::default()
        };

        let result = search_in_files(
            "[invalid".to_string(), // Invalid regex pattern
            Some(dir.path().to_string_lossy().to_string()),
            Some(options),
        ).await;

        assert!(result.is_err()); // Should return error for invalid regex
    }

    #[tokio::test]
    async fn test_search_large_file_exclusion() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("large.md");
        
        // Create a file larger than 10MB (should be excluded)
        let large_content = "x".repeat(11 * 1024 * 1024);
        fs::write(&file_path, large_content).unwrap();

        let results = search_in_files(
            "x".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            None,
        ).await.unwrap();

        assert_eq!(results.len(), 0); // Large file should be excluded
    }

    #[tokio::test]
    async fn test_search_special_characters() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "Special chars: $#@!%^&*()[]{}").unwrap();

        let results = search_in_files(
            "$#@".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            None,
        ).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_count, 1);
    }

    #[tokio::test]
    async fn test_search_unicode_content() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("unicode.md");
        fs::write(&file_path, "Unicode: 测试 こんにちは مرحبا").unwrap();

        let results = search_in_files(
            "测试".to_string(),
            Some(dir.path().to_string_lossy().to_string()),
            None,
        ).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_count, 1);
    }

    #[tokio::test]
    async fn test_build_search_index() {
        let result = build_search_index("/test/path".to_string()).await;
        
        assert!(result.is_ok());
        assert!(result.unwrap().contains("Search index built"));
    }
}
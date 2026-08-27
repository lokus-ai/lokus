use std::path::{Path, PathBuf};

use uuid::Uuid;

pub fn new_note_id() -> String {
    Uuid::now_v7().to_string()
}

pub fn normalized_path_key(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/").to_lowercase()
}

pub fn is_supported_note_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "txt"
            )
        })
}

pub fn rename_path_case_safe(path: &Path, new_name: &str) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err(format!(
            "File or folder '{}' does not exist",
            path.display()
        ));
    }
    let trimmed = new_name.trim();
    let requested = Path::new(trimmed);
    if trimmed.is_empty() || requested.file_name().and_then(|name| name.to_str()) != Some(trimmed) {
        return Err("New name must be one non-empty path component".to_string());
    }

    let destination = path.with_file_name(trimmed);
    if destination == path {
        return Ok(destination);
    }
    if destination.exists() {
        if !same_file(path, &destination)? {
            return Err(format!(
                "A file or folder named '{}' already exists",
                trimmed
            ));
        }

        let temporary = path.with_file_name(format!(".lokus-rename-{}.tmp", Uuid::new_v4()));
        std::fs::rename(path, &temporary)
            .map_err(|error| format!("Failed temporary rename: {error}"))?;
        if let Err(error) = std::fs::rename(&temporary, &destination) {
            let _ = std::fs::rename(&temporary, path);
            return Err(format!("Failed case-only rename: {error}"));
        }
        return Ok(destination);
    }

    std::fs::rename(path, &destination).map_err(|error| format!("Failed to rename: {error}"))?;
    Ok(destination)
}

#[cfg(unix)]
fn same_file(left: &Path, right: &Path) -> Result<bool, String> {
    use std::os::unix::fs::MetadataExt;
    let left_metadata = std::fs::metadata(left).map_err(|error| error.to_string())?;
    let right_metadata = std::fs::metadata(right).map_err(|error| error.to_string())?;
    Ok(left_metadata.dev() == right_metadata.dev() && left_metadata.ino() == right_metadata.ino())
}

#[cfg(not(unix))]
fn same_file(left: &Path, right: &Path) -> Result<bool, String> {
    let left = std::fs::canonicalize(left).map_err(|error| error.to_string())?;
    let right = std::fs::canonicalize(right).map_err(|error| error.to_string())?;
    Ok(left == right)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn note_ids_are_uuid_v7_and_unique() {
        let first = Uuid::parse_str(&new_note_id()).unwrap();
        let second = Uuid::parse_str(&new_note_id()).unwrap();

        assert_eq!(first.get_version_num(), 7);
        assert_eq!(second.get_version_num(), 7);
        assert_ne!(first, second);
    }

    #[test]
    fn normalized_keys_are_slash_normalized_and_case_folded() {
        assert_eq!(
            normalized_path_key(Path::new("Projects\\Launch/PLAN.MD")),
            "projects/launch/plan.md"
        );
    }

    #[test]
    fn supported_note_extensions_are_explicit() {
        assert!(is_supported_note_path(Path::new("note.md")));
        assert!(is_supported_note_path(Path::new("note.MARKDOWN")));
        assert!(is_supported_note_path(Path::new("note.txt")));
        assert!(!is_supported_note_path(Path::new("board.kanban")));
        assert!(!is_supported_note_path(Path::new("README")));
    }

    #[test]
    fn case_only_rename_preserves_content() {
        let directory = tempfile::tempdir().unwrap();
        let original = directory.path().join("Note.md");
        std::fs::write(&original, "content").unwrap();

        let renamed = rename_path_case_safe(&original, "note.md").unwrap();

        assert_eq!(renamed, directory.path().join("note.md"));
        assert_eq!(std::fs::read_to_string(&renamed).unwrap(), "content");
    }

    #[test]
    fn rename_refuses_a_different_existing_destination() {
        let directory = tempfile::tempdir().unwrap();
        let original = directory.path().join("one.md");
        let destination = directory.path().join("two.md");
        std::fs::write(&original, "one").unwrap();
        std::fs::write(&destination, "two").unwrap();

        assert!(rename_path_case_safe(&original, "two.md").is_err());
        assert_eq!(std::fs::read_to_string(&original).unwrap(), "one");
        assert_eq!(std::fs::read_to_string(&destination).unwrap(), "two");
    }
}

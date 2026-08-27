use std::io::Write;
use std::path::Path;

pub fn atomic_replace(path: &Path, payload: &[u8], op_id: &str) -> Result<(), String> {
    if !safe_operation_id(op_id) {
        return Err("invalid operation id".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "target has no parent directory".to_string())?;
    if !parent.is_dir() {
        return Err(format!(
            "target directory '{}' does not exist",
            parent.display()
        ));
    }

    let mut temporary = tempfile::Builder::new()
        .prefix(".lokus-note-write-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(|error| error.to_string())?;
    temporary
        .write_all(payload)
        .and_then(|_| temporary.as_file().sync_all())
        .map_err(|error| error.to_string())?;
    temporary
        .persist(path)
        .map_err(|error| error.error.to_string())?;
    sync_directory(parent)?;
    Ok(())
}

fn safe_operation_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

#[cfg(unix)]
pub(crate) fn sync_directory(path: &Path) -> Result<(), String> {
    std::fs::File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| error.to_string())
}

#[cfg(not(unix))]
pub(crate) fn sync_directory(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn atomic_replace_persists_complete_bytes_and_removes_temporary_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("note.md");
        fs::write(&path, "before").unwrap();

        atomic_replace(&path, b"after", "op-1").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"after");
        assert!(!directory.path().join(".note.md.op-1.tmp").exists());
    }

    #[test]
    fn atomic_replace_refuses_an_invalid_operation_id() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("note.md");

        assert!(atomic_replace(&path, b"content", "../escape").is_err());
    }
}

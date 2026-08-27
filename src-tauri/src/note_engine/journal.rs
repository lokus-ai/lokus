use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct JournalHeader {
    pub version: u8,
    pub op_id: String,
    pub note_id: String,
    pub mutation_kind: String,
    pub target_relative_path: String,
    pub expected_local_generation: Option<i64>,
    pub payload_len: u64,
    pub payload_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalRecord {
    pub header: JournalHeader,
    pub payload: Vec<u8>,
}

pub fn write_journal_record(
    metadata_dir: &Path,
    mut header: JournalHeader,
    payload: &[u8],
) -> Result<PathBuf, String> {
    if header.version != 1 || !safe_operation_id(&header.op_id) {
        return Err("invalid journal header".to_string());
    }
    header.payload_len = payload.len() as u64;
    header.payload_sha256 = sha256_hex(payload);
    let header_bytes = serde_json::to_vec(&header).map_err(|error| error.to_string())?;
    let header_len: u32 = header_bytes
        .len()
        .try_into()
        .map_err(|_| "journal header is too large".to_string())?;

    let journal_dir = metadata_dir.join("note-journal");
    fs::create_dir_all(&journal_dir).map_err(|error| error.to_string())?;
    let path = journal_dir.join(format!("{}.pending", header.op_id));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)
        .map_err(|error| error.to_string())?;
    file.write_all(&header_len.to_be_bytes())
        .and_then(|_| file.write_all(&header_bytes))
        .and_then(|_| file.write_all(payload))
        .and_then(|_| file.sync_all())
        .map_err(|error| error.to_string())?;
    sync_directory(&journal_dir)?;
    Ok(path)
}

pub fn read_journal_record(path: &Path) -> Result<JournalRecord, String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut length_bytes = [0_u8; 4];
    file.read_exact(&mut length_bytes)
        .map_err(|error| error.to_string())?;
    let header_len = u32::from_be_bytes(length_bytes) as usize;
    if header_len == 0 || header_len > 1024 * 1024 {
        return Err("invalid journal header length".to_string());
    }

    let mut header_bytes = vec![0_u8; header_len];
    file.read_exact(&mut header_bytes)
        .map_err(|error| error.to_string())?;
    let header: JournalHeader =
        serde_json::from_slice(&header_bytes).map_err(|error| error.to_string())?;
    if header.version != 1 || !safe_operation_id(&header.op_id) {
        return Err("invalid journal header".to_string());
    }

    let mut payload = Vec::new();
    file.read_to_end(&mut payload)
        .map_err(|error| error.to_string())?;
    if payload.len() as u64 != header.payload_len || sha256_hex(&payload) != header.payload_sha256 {
        return Err("journal payload checksum mismatch".to_string());
    }

    Ok(JournalRecord { header, payload })
}

fn safe_operation_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> Result<(), String> {
    fs::File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn header() -> JournalHeader {
        JournalHeader {
            version: 1,
            op_id: "op-1".to_string(),
            note_id: "note-1".to_string(),
            mutation_kind: "write".to_string(),
            target_relative_path: "notes/a.md".to_string(),
            expected_local_generation: Some(3),
            payload_len: 0,
            payload_sha256: String::new(),
        }
    }

    #[test]
    fn journal_round_trips_complete_self_describing_payload() {
        let directory = tempfile::tempdir().unwrap();
        let path = write_journal_record(directory.path(), header(), b"hello").unwrap();
        let record = read_journal_record(&path).unwrap();

        assert_eq!(record.payload, b"hello");
        assert_eq!(record.header.op_id, "op-1");
        assert_eq!(record.header.note_id, "note-1");
        assert_eq!(record.header.target_relative_path, "notes/a.md");
        assert_eq!(record.header.payload_len, 5);
        assert_eq!(record.header.payload_sha256.len(), 64);
    }

    #[test]
    fn journal_rejects_corrupted_payload() {
        let directory = tempfile::tempdir().unwrap();
        let path = write_journal_record(directory.path(), header(), b"hello").unwrap();
        let mut bytes = fs::read(&path).unwrap();
        *bytes.last_mut().unwrap() ^= 0xff;
        fs::write(&path, bytes).unwrap();

        assert!(read_journal_record(&path).is_err());
    }

    #[test]
    fn journal_never_overwrites_an_existing_operation() {
        let directory = tempfile::tempdir().unwrap();
        write_journal_record(directory.path(), header(), b"one").unwrap();

        assert!(write_journal_record(directory.path(), header(), b"two").is_err());
    }
}

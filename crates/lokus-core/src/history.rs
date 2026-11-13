//! @part-of core.history
//! Earlier versions of notes. When a note is about to be overwritten, its old
//! text is copied to `.lokus/history/<path>/<time>.md`, at most once every
//! few minutes per note, and the oldest copies are dropped. It is a safety
//! net, not a record of every keystroke.

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::error::{CoreError, Result};
use crate::vault::{Vault, META_DIR};

/// A version is kept only if the last one is at least this old.
const GAP_MS: u64 = 5 * 60 * 1000;
const KEEP: usize = 50;

#[derive(Debug, Serialize)]
pub struct Version {
    /// When the copy was taken, in milliseconds since 1970. Also its id.
    pub at: u64,
    pub size: u64,
}

fn dir(vault: &Vault, rel: &str) -> Result<PathBuf> {
    // `resolve` refuses paths that leave the vault.
    let abs = vault.resolve(rel)?;
    let inside = abs
        .strip_prefix(vault.root())
        .map_err(|_| CoreError::InvalidPath(rel.to_string()))?;
    Ok(vault.root().join(META_DIR).join("history").join(inside))
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Versions of a note, newest first.
pub fn list(vault: &Vault, rel: &str) -> Result<Vec<Version>> {
    let mut out: Vec<Version> = fs::read_dir(dir(vault, rel)?)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|item| {
            let name = item.file_name().to_string_lossy().into_owned();
            let at = name.strip_suffix(".md")?.parse().ok()?;
            Some(Version {
                at,
                size: item.metadata().ok()?.len(),
            })
        })
        .collect();
    out.sort_by_key(|v| std::cmp::Reverse(v.at));
    Ok(out)
}

pub fn read(vault: &Vault, rel: &str, at: u64) -> Result<Vec<u8>> {
    fs::read(dir(vault, rel)?.join(format!("{at}.md")))
        .map_err(|_| CoreError::NotFound(format!("{rel} at {at}")))
}

/// Keep `old` as a version of the note. Unless `force`, nothing is kept when
/// the newest version is recent.
pub fn keep(vault: &Vault, rel: &str, old: &[u8], force: bool) -> Result<()> {
    let existing = list(vault, rel)?;
    let stamp = now();
    if let Some(newest) = existing.first() {
        if !force && stamp.saturating_sub(newest.at) < GAP_MS {
            return Ok(());
        }
        if read(vault, rel, newest.at).is_ok_and(|bytes| bytes == old) {
            return Ok(());
        }
    }
    let dir = dir(vault, rel)?;
    fs::create_dir_all(&dir)?;
    fs::write(dir.join(format!("{stamp}.md")), old)?;
    for stale in existing.iter().skip(KEEP - 1) {
        let _ = fs::remove_file(dir.join(format!("{}.md", stale.at)));
    }
    Ok(())
}

/// Bring a version back as the note's text. What it replaces is kept as a
/// version first, so a restore can itself be undone.
pub fn restore(vault: &Vault, rel: &str, at: u64) -> Result<()> {
    let bytes = read(vault, rel, at)?;
    let abs = vault.resolve(rel)?;
    if let Ok(current) = fs::read(&abs) {
        if current == bytes {
            return Ok(());
        }
        keep(vault, rel, &current, true)?;
    }
    vault.write_file(rel, &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::Eol;

    #[test]
    fn an_overwritten_note_can_be_brought_back() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        vault.create("A.md", "first\r\n").unwrap();
        vault.write("A.md", "second\r\n", Eol::Lf, None).unwrap();
        // Within a few minutes only the first overwrite is kept.
        vault.write("A.md", "third\r\n", Eol::Lf, None).unwrap();
        let versions = list(&vault, "A.md").unwrap();
        assert_eq!(versions.len(), 1);
        assert_eq!(read(&vault, "A.md", versions[0].at).unwrap(), b"first\r\n");

        restore(&vault, "A.md", versions[0].at).unwrap();
        assert_eq!(fs::read(dir.path().join("A.md")).unwrap(), b"first\r\n");
        // What the restore replaced is itself a version now.
        let texts: Vec<Vec<u8>> = list(&vault, "A.md")
            .unwrap()
            .iter()
            .map(|v| read(&vault, "A.md", v.at).unwrap())
            .collect();
        assert!(texts.contains(&b"third\r\n".to_vec()));
        assert!(list(&vault, "../outside.md").is_err());
    }
}

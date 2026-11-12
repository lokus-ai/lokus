//! @part-of core.vault
//! A vault is a folder of plain files. The files on disk are the truth.
//!
//! Every path that enters this module is relative to the vault root and is
//! checked by [`Vault::resolve`] before the filesystem is touched.

use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};

/// Folder inside a vault that Lokus owns (trash, later the index).
pub const META_DIR: &str = ".lokus";
const TMP_MARKER: &str = ".lokus-tmp-";

#[derive(Debug, Clone)]
pub struct Vault {
    root: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Eol {
    #[default]
    Lf,
    Crlf,
    /// More than one kind of line ending in the same file.
    Mixed,
}

#[derive(Debug, Serialize)]
pub struct Note {
    pub path: String,
    /// Exactly what is on disk.
    pub text: String,
    pub eol: Eol,
    pub hash: String,
}

#[derive(Debug, Serialize)]
pub struct Written {
    pub path: String,
    pub hash: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Folder,
    Note,
    File,
}

#[derive(Debug, Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<Entry>,
}

#[derive(Debug, Serialize, Default)]
pub struct FidelityReport {
    pub checked: usize,
    /// Files that would not come back byte-identical from an unchanged save.
    pub mismatches: Vec<String>,
    /// Mixed line endings: untouched while unedited, unified on the first edit.
    pub mixed_eol: Vec<String>,
    /// Not UTF-8; Lokus opens these read-only.
    pub not_text: Vec<String>,
}

impl Vault {
    pub fn open(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref();
        if !root.is_dir() {
            return Err(CoreError::NotFound(root.display().to_string()));
        }
        Ok(Self {
            root: root.canonicalize()?,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn name(&self) -> String {
        self.root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default()
    }

    /// Turn a vault-relative path into an absolute one, refusing anything that
    /// could land outside the vault or inside `.lokus/`.
    pub fn resolve(&self, rel: &str) -> Result<PathBuf> {
        let bad = || CoreError::InvalidPath(rel.to_string());
        let rel_path = Path::new(rel);
        let mut clean = PathBuf::new();
        for part in rel_path.components() {
            match part {
                Component::Normal(p) => clean.push(p),
                Component::CurDir => {}
                _ => return Err(bad()),
            }
        }
        let first = clean.components().next().ok_or_else(bad)?;
        if first.as_os_str() == META_DIR {
            return Err(bad());
        }
        let abs = self.root.join(&clean);
        // A symlink inside the vault must not lead out of it. Check the nearest
        // ancestor that exists, since the target itself may not exist yet.
        let mut probe = abs.as_path();
        loop {
            if probe.exists() {
                if !probe.canonicalize()?.starts_with(&self.root) {
                    return Err(bad());
                }
                break;
            }
            probe = probe.parent().ok_or_else(bad)?;
        }
        Ok(abs)
    }

    pub fn relative(&self, abs: &Path) -> Option<String> {
        let rel = abs.strip_prefix(&self.root).ok()?;
        let parts: Vec<_> = rel
            .components()
            .map(|c| c.as_os_str().to_string_lossy())
            .collect();
        (!parts.is_empty()).then(|| parts.join("/"))
    }

    pub fn tree(&self) -> Result<Vec<Entry>> {
        self.read_dir(&self.root)
    }

    fn read_dir(&self, dir: &Path) -> Result<Vec<Entry>> {
        let mut out = Vec::new();
        for item in fs::read_dir(dir)? {
            let item = item?;
            let name = item.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            let path = item.path();
            let Some(rel) = self.relative(&path) else {
                continue;
            };
            // `metadata` follows symlinks; a dangling link is simply skipped.
            let Ok(meta) = fs::metadata(&path) else {
                continue;
            };
            if meta.is_dir() {
                let children = self.read_dir(&path)?;
                out.push(Entry {
                    name,
                    path: rel,
                    kind: EntryKind::Folder,
                    children,
                });
            } else {
                let kind = if is_note(&path) {
                    EntryKind::Note
                } else {
                    EntryKind::File
                };
                out.push(Entry {
                    name,
                    path: rel,
                    kind,
                    children: Vec::new(),
                });
            }
        }
        out.sort_by(|a, b| {
            (a.kind != EntryKind::Folder)
                .cmp(&(b.kind != EntryKind::Folder))
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(out)
    }

    pub fn read(&self, rel: &str) -> Result<Note> {
        let abs = self.resolve(rel)?;
        let bytes = read_existing(&abs, rel)?;
        let hash = hash(&bytes);
        let text = String::from_utf8(bytes).map_err(|_| CoreError::NotText(rel.to_string()))?;
        Ok(Note {
            path: rel.to_string(),
            eol: detect_eol(&text),
            text,
            hash,
        })
    }

    /// Save editor text. `text` uses `\n`; `eol` says what the file used when
    /// it was read. `expected_hash` guards against overwriting an outside edit.
    pub fn write(
        &self,
        rel: &str,
        text: &str,
        eol: Eol,
        expected_hash: Option<&str>,
    ) -> Result<Written> {
        let abs = self.resolve(rel)?;
        if let Some(expected) = expected_hash {
            let current = read_existing(&abs, rel)?;
            if hash(&current) != expected {
                return Err(CoreError::Conflict(rel.to_string()));
            }
        }
        let bytes = from_editor(text, eol).into_bytes();
        write_atomic(&abs, &bytes)?;
        Ok(Written {
            path: rel.to_string(),
            hash: hash(&bytes),
        })
    }

    pub fn create(&self, rel: &str, text: &str) -> Result<Written> {
        let abs = self.resolve(rel)?;
        if abs.exists() {
            return Err(CoreError::AlreadyExists(rel.to_string()));
        }
        if let Some(parent) = abs.parent() {
            fs::create_dir_all(parent)?;
        }
        write_atomic(&abs, text.as_bytes())?;
        Ok(Written {
            path: rel.to_string(),
            hash: hash(text.as_bytes()),
        })
    }

    pub fn create_folder(&self, rel: &str) -> Result<()> {
        let abs = self.resolve(rel)?;
        if abs.exists() {
            return Err(CoreError::AlreadyExists(rel.to_string()));
        }
        Ok(fs::create_dir_all(abs)?)
    }

    pub fn rename(&self, from: &str, to: &str) -> Result<()> {
        let src = self.resolve(from)?;
        let dst = self.resolve(to)?;
        if !src.exists() {
            return Err(CoreError::NotFound(from.to_string()));
        }
        // A case-only rename is the same file on macOS and Windows.
        let same_file = dst.exists() && src.canonicalize()? == dst.canonicalize()?;
        if dst.exists() && !same_file {
            return Err(CoreError::AlreadyExists(to.to_string()));
        }
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)?;
        }
        Ok(fs::rename(src, dst)?)
    }

    /// Soft delete: the file or folder moves to `.lokus/trash/<time>/`.
    pub fn delete(&self, rel: &str) -> Result<String> {
        let src = self.resolve(rel)?;
        if !src.exists() {
            return Err(CoreError::NotFound(rel.to_string()));
        }
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let clean: PathBuf = Path::new(rel)
            .components()
            .filter(|c| matches!(c, Component::Normal(_)))
            .collect();
        let dst = self
            .root
            .join(META_DIR)
            .join("trash")
            .join(stamp.to_string())
            .join(clean);
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(src, &dst)?;
        Ok(self.relative(&dst).unwrap_or_default())
    }

    /// Flat list of every note path, for the quick switcher.
    pub fn notes(&self) -> Result<Vec<String>> {
        fn walk(entries: &[Entry], out: &mut Vec<String>) {
            for e in entries {
                match e.kind {
                    EntryKind::Folder => walk(&e.children, out),
                    EntryKind::Note => out.push(e.path.clone()),
                    EntryKind::File => {}
                }
            }
        }
        let mut out = Vec::new();
        walk(&self.tree()?, &mut out);
        Ok(out)
    }

    /// Prove that opening a note and saving it unchanged is byte-identical,
    /// for every note in the vault. Nothing is written.
    pub fn fidelity(&self) -> Result<FidelityReport> {
        let mut report = FidelityReport::default();
        for rel in self.notes()? {
            report.checked += 1;
            let bytes = fs::read(self.resolve(&rel)?)?;
            let Ok(text) = String::from_utf8(bytes) else {
                report.not_text.push(rel);
                continue;
            };
            let eol = detect_eol(&text);
            if eol == Eol::Mixed {
                report.mixed_eol.push(rel);
            } else if from_editor(&to_editor(&text), eol) != text {
                report.mismatches.push(rel);
            }
        }
        Ok(report)
    }
}

pub fn is_note(path: &Path) -> bool {
    path.extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("md"))
}

pub fn is_temp_file(path: &Path) -> bool {
    path.file_name()
        .is_some_and(|n| n.to_string_lossy().contains(TMP_MARKER))
}

pub fn hash(bytes: &[u8]) -> String {
    blake3::hash(bytes).to_hex().to_string()
}

pub fn detect_eol(text: &str) -> Eol {
    let bytes = text.as_bytes();
    let (mut lf, mut crlf, mut cr) = (0usize, 0usize, 0usize);
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'\r' if bytes.get(i + 1) == Some(&b'\n') => {
                crlf += 1;
                i += 1;
            }
            b'\r' => cr += 1,
            b'\n' => lf += 1,
            _ => {}
        }
        i += 1;
    }
    match (lf, crlf, cr) {
        (_, 0, 0) => Eol::Lf,
        (0, _, 0) => Eol::Crlf,
        _ => Eol::Mixed,
    }
}

/// What the editor holds: every line break is `\n`.
pub fn to_editor(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

/// Back to what belongs on disk.
pub fn from_editor(text: &str, eol: Eol) -> String {
    match eol {
        Eol::Crlf => text.replace('\n', "\r\n"),
        Eol::Lf | Eol::Mixed => text.to_string(),
    }
}

fn read_existing(abs: &Path, rel: &str) -> Result<Vec<u8>> {
    match fs::read(abs) {
        Ok(bytes) => Ok(bytes),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Err(CoreError::NotFound(rel.to_string()))
        }
        Err(e) => Err(e.into()),
    }
}

/// Write to a sibling temp file, flush it to disk, then rename over the
/// target, so a crash never leaves a half-written note.
fn write_atomic(target: &Path, bytes: &[u8]) -> Result<()> {
    let dir = target
        .parent()
        .ok_or_else(|| CoreError::InvalidPath(target.display().to_string()))?;
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let tmp = dir.join(format!(".{name}{TMP_MARKER}{}-{nanos}", std::process::id()));
    let result = (|| -> Result<()> {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        if let Ok(meta) = fs::metadata(target) {
            fs::set_permissions(&tmp, meta.permissions())?;
        }
        fs::rename(&tmp, target)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vault() -> (tempfile::TempDir, Vault) {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        (dir, vault)
    }

    #[test]
    fn paths_cannot_leave_the_vault() {
        let (_dir, v) = vault();
        for bad in [
            "../x.md",
            "a/../../x.md",
            "/etc/passwd",
            "",
            ".",
            ".lokus/trash/x",
            "a/../.lokus/x",
        ] {
            assert!(
                matches!(v.resolve(bad), Err(CoreError::InvalidPath(_))),
                "{bad:?} was allowed"
            );
        }
        assert!(v.resolve("a/b.md").is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_cannot_leave_the_vault() {
        let (_dir, v) = vault();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), v.root().join("link")).unwrap();
        assert!(matches!(
            v.resolve("link/x.md"),
            Err(CoreError::InvalidPath(_))
        ));
    }

    #[test]
    fn crlf_survives_a_round_trip() {
        let (_dir, v) = vault();
        let raw = "---\r\ntitle: Hi\r\n---\r\n\r\ntext\r\n";
        fs::write(v.root().join("a.md"), raw).unwrap();
        let note = v.read("a.md").unwrap();
        assert_eq!(note.eol, Eol::Crlf);
        v.write("a.md", &to_editor(&note.text), note.eol, Some(&note.hash))
            .unwrap();
        assert_eq!(fs::read_to_string(v.root().join("a.md")).unwrap(), raw);
    }

    #[test]
    fn an_outside_edit_is_not_overwritten() {
        let (_dir, v) = vault();
        v.create("a.md", "one").unwrap();
        let note = v.read("a.md").unwrap();
        fs::write(v.root().join("a.md"), "changed elsewhere").unwrap();
        assert!(matches!(
            v.write("a.md", "mine", Eol::Lf, Some(&note.hash)),
            Err(CoreError::Conflict(_))
        ));
        assert_eq!(
            fs::read_to_string(v.root().join("a.md")).unwrap(),
            "changed elsewhere"
        );
    }

    #[test]
    fn delete_moves_to_trash_and_leaves_no_temp_files() {
        let (_dir, v) = vault();
        v.create("dir/a.md", "x").unwrap();
        let trashed = v.delete("dir/a.md").unwrap();
        assert!(trashed.starts_with(".lokus/trash/"));
        assert!(v.root().join(&trashed).exists());
        assert!(v.notes().unwrap().is_empty());
        let leftovers: Vec<_> = fs::read_dir(v.root().join("dir")).unwrap().collect();
        assert!(leftovers.is_empty());
    }
}

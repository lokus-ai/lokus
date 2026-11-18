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

/// A file in the vault's trash.
#[derive(Debug, Serialize)]
pub struct Trashed {
    /// What to pass to `trash.restore`.
    pub id: String,
    /// Where the file was.
    pub path: String,
    /// Milliseconds since 1970.
    pub deleted_at: u64,
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

/// Whether a failed link says the drive has no links at all, not that this one went wrong.
/// The standard library names only some of the ways a system says so: macOS answers 45 or 102,
/// Linux 95 or "not permitted", Windows "invalid function" (1) on FAT drives.
fn no_links(e: &std::io::Error) -> bool {
    use std::io::ErrorKind::{PermissionDenied, Unsupported};
    let code = e.raw_os_error();
    matches!(e.kind(), Unsupported | PermissionDenied)
        || (cfg!(unix) && matches!(code, Some(45 | 95 | 102)))
        || (cfg!(windows) && code == Some(1))
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

    /// What this folder is known by wherever it is moved or renamed to: a random id kept in
    /// `.lokus/id`, made the first time it is asked for. It is never synced, so each computer's
    /// copy of a shared folder has its own; a folder copied by hand takes its original's along.
    pub fn id(&self) -> Result<String> {
        let file = self.root.join(META_DIR).join("id");
        // Only what this app writes counts: 32 hex digits in a plain file. A folder that came
        // from somewhere else cannot name an id of its choosing, or point this at another file.
        let read = || {
            let plain = fs::symlink_metadata(&file).is_ok_and(|m| m.is_file());
            let text = plain.then(|| fs::read_to_string(&file).ok()).flatten()?;
            let id = text.trim();
            (id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit())).then(|| id.to_string())
        };
        if let Some(id) = read() {
            return Ok(id);
        }
        // One at a time inside this app, and whoever waited reads what the first one made.
        static MAKING: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _one = MAKING.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(id) = read() {
            return Ok(id);
        }
        fs::create_dir_all(self.root.join(META_DIR))?;
        let id = uuid::Uuid::new_v4().simple().to_string();
        // Against another app on the same folder: written whole beside it, then given its name
        // only if nothing has that name, so one lands, every other reads that one and nobody
        // sees a half-made file. Whatever else sits at that name is taken away itself, never
        // written through.
        let mine = self.root.join(META_DIR).join(format!("id.{id}"));
        fs::write(&mine, &id)?;
        let mut linked = true;
        let mut landed = Err(CoreError::NotFound(file.display().to_string()));
        for _ in 0..3 {
            let made = if linked {
                fs::hard_link(&mine, &file)
            } else {
                // A drive that cannot link (exFAT, FAT: "not supported", or "not permitted" on
                // Linux): the name is made only if it is not there, then filled.
                fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&file)
                    .and_then(|mut made| made.write_all(id.as_bytes()))
            };
            match made {
                Ok(()) => {
                    landed = Ok(id.clone());
                    break;
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                    // An empty one may be another app's, on a drive without links, about to be
                    // filled: give it a moment before it is taken for a broken one.
                    let mut theirs = read();
                    for _ in 0..100 {
                        if theirs.is_some() || fs::metadata(&file).map_or(true, |m| m.len() > 0) {
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(10));
                        theirs = read();
                    }
                    // Once more: it may have been filled between the two looks.
                    if let Some(theirs) = theirs.or_else(read) {
                        landed = Ok(theirs);
                        break;
                    }
                    // Its own file that cannot be read just now is still its id: fail rather
                    // than give the folder a new one and leave what was kept under the old.
                    let readable = !fs::symlink_metadata(&file).is_ok_and(|m| m.is_file())
                        || fs::read(&file).is_ok();
                    if !readable || fs::remove_file(&file).is_err() {
                        break;
                    }
                }
                Err(e) if linked && no_links(&e) => {
                    linked = false;
                }
                Err(e) => {
                    landed = Err(e.into());
                    break;
                }
            }
        }
        let _ = fs::remove_file(&mine);
        landed
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
        // Keep what is about to be replaced; failing to must not block the save.
        if let Ok(old) = fs::read(&abs) {
            if old != bytes {
                let _ = crate::history::keep(self, rel, &old, false);
            }
        }
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

    /// Everything in the trash, newest first.
    pub fn trash(&self) -> Result<Vec<Trashed>> {
        fn walk(dir: &Path, base: &Path, stamp: u64, out: &mut Vec<Trashed>) {
            for item in fs::read_dir(dir).into_iter().flatten().flatten() {
                let path = item.path();
                if path.is_dir() {
                    walk(&path, base, stamp, out);
                } else if let Ok(rel) = path.strip_prefix(base) {
                    let rel: Vec<_> = rel
                        .components()
                        .map(|c| c.as_os_str().to_string_lossy())
                        .collect();
                    let rel = rel.join("/");
                    out.push(Trashed {
                        id: format!("{stamp}/{rel}"),
                        path: rel,
                        deleted_at: stamp,
                    });
                }
            }
        }
        let mut out = Vec::new();
        let root = self.root.join(META_DIR).join("trash");
        for item in fs::read_dir(root).into_iter().flatten().flatten() {
            if let Ok(stamp) = item.file_name().to_string_lossy().parse::<u64>() {
                walk(&item.path(), &item.path(), stamp, &mut out);
            }
        }
        out.sort_by(|a, b| {
            b.deleted_at
                .cmp(&a.deleted_at)
                .then_with(|| a.path.cmp(&b.path))
        });
        Ok(out)
    }

    /// Put a trashed file back where it was. If something else is there now,
    /// it comes back beside it. Returns the path it was restored to.
    pub fn restore(&self, id: &str) -> Result<String> {
        let bad = || CoreError::InvalidPath(id.to_string());
        let (stamp, rel) = id.split_once('/').ok_or_else(bad)?;
        if stamp.parse::<u64>().is_err() {
            return Err(bad());
        }
        // `resolve` rejects anything that could leave the vault.
        self.resolve(rel)?;
        let src = self.root.join(META_DIR).join("trash").join(stamp).join(rel);
        if !src.is_file() {
            return Err(CoreError::NotFound(id.to_string()));
        }
        let (stem, ext) = match rel.rsplit_once('.') {
            Some((stem, ext)) if !ext.contains('/') => (stem.to_string(), format!(".{ext}")),
            _ => (rel.to_string(), String::new()),
        };
        let mut target = rel.to_string();
        let mut n = 1;
        while self.resolve(&target)?.exists() {
            target = if n == 1 {
                format!("{stem} (restored){ext}")
            } else {
                format!("{stem} (restored {n}){ext}")
            };
            n += 1;
        }
        let dst = self.resolve(&target)?;
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(src, dst)?;
        Ok(target)
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

    /// Flat list of every file that is not a note: images, PDFs and the like.
    pub fn attachments(&self) -> Result<Vec<String>> {
        fn walk(entries: &[Entry], out: &mut Vec<String>) {
            for e in entries {
                match e.kind {
                    EntryKind::Folder => walk(&e.children, out),
                    EntryKind::File => out.push(e.path.clone()),
                    EntryKind::Note => {}
                }
            }
        }
        let mut out = Vec::new();
        walk(&self.tree()?, &mut out);
        Ok(out)
    }

    /// Write a file that is not a note, atomically, creating its folder.
    pub fn write_file(&self, rel: &str, bytes: &[u8]) -> Result<()> {
        let abs = self.resolve(rel)?;
        if let Some(dir) = abs.parent() {
            fs::create_dir_all(dir)?;
        }
        write_atomic(&abs, bytes)
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
pub(crate) fn write_atomic(target: &Path, bytes: &[u8]) -> Result<()> {
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

    #[test]
    fn everyone_who_asks_a_new_folder_for_its_id_at_once_gets_the_same_one() {
        // Review of 2026-11-18: the first asker made the file empty and then filled it; one
        // who came between took the empty file away and made an id of its own.
        for _ in 0..200 {
            let dir = tempfile::tempdir().unwrap();
            let vault = Vault::open(dir.path()).unwrap();
            let ids: Vec<String> = std::thread::scope(|s| {
                let asked: Vec<_> = (0..8).map(|_| s.spawn(|| vault.id().unwrap())).collect();
                asked.into_iter().map(|a| a.join().unwrap()).collect()
            });
            let kept = vault.id().unwrap();
            assert!(ids.iter().all(|id| *id == kept), "{ids:?} then {kept}");
        }
    }

    #[test]
    fn a_folder_keeps_its_id_when_it_is_renamed() {
        let dir = tempfile::tempdir().unwrap();
        let (old, new) = (dir.path().join("School"), dir.path().join("Uni"));
        fs::create_dir(&old).unwrap();
        let id = Vault::open(&old).unwrap().id().unwrap();
        assert_eq!(Vault::open(&old).unwrap().id().unwrap(), id);
        fs::rename(&old, &new).unwrap();
        assert_eq!(Vault::open(&new).unwrap().id().unwrap(), id);
        fs::create_dir(&old).unwrap();
        assert_ne!(Vault::open(&old).unwrap().id().unwrap(), id);
        // A folder from elsewhere cannot pick its id, or have another file written through a link.
        let other = dir.path().join("other.txt");
        fs::write(&other, "mine").unwrap();
        fs::write(old.join(".lokus/id"), "-").unwrap();
        assert_eq!(Vault::open(&old).unwrap().id().unwrap().len(), 32);
        fs::write(old.join(".lokus/id"), [0xff, 0xfe]).unwrap();
        assert_eq!(Vault::open(&old).unwrap().id().unwrap().len(), 32);
        #[cfg(unix)]
        {
            fs::remove_file(old.join(".lokus/id")).unwrap();
            std::os::unix::fs::symlink(&other, old.join(".lokus/id")).unwrap();
            assert_eq!(Vault::open(&old).unwrap().id().unwrap().len(), 32);
            assert_eq!(fs::read_to_string(&other).unwrap(), "mine");
        }
    }

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

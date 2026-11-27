//! @part-of sync
//! The team a folder belongs to, kept in the folder itself (`.lokus/team.json`), so it goes
//! wherever the folder goes and is still there when the app's own storage is not. Only leaving
//! the team, or the relay saying this person is no longer in it, takes it away.

use std::path::{Path, PathBuf};

use lokus_core::vault::META_DIR;
use serde::{Deserialize, Serialize};

use crate::{Error, Result};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Team {
    pub server: String,
    pub workspace: String,
    /// The account that was last connected, so another account's list of teams decides nothing.
    #[serde(default)]
    pub user: Option<String>,
    /// What the team is called on the relay, as last heard. Only for showing: a folder can have
    /// any name, and an account that is not in the team cannot ask the relay what it is called.
    #[serde(default)]
    pub name: Option<String>,
}

/// Where it is kept, or nothing when `.lokus` is not a plain directory of this folder. A folder can
/// come from anyone, and one whose `.lokus` is a link would have this read and written somewhere else.
fn file(root: &Path) -> Option<PathBuf> {
    let dir = root.join(META_DIR);
    let plain = std::fs::symlink_metadata(&dir).is_ok_and(|m| m.is_dir());
    plain.then(|| dir.join("team.json"))
}

pub fn kept(root: &Path) -> Option<Team> {
    let file = file(root)?;
    // Only a plain file counts, as with the folder's id: a link is not followed out of the folder.
    let plain = std::fs::symlink_metadata(&file).is_ok_and(|m| m.is_file());
    serde_json::from_slice(&plain.then(|| std::fs::read(file).ok()).flatten()?).ok()
}

/// Remember the folder's team. A folder already in one team is not given to another: it has to
/// leave the first, so nothing typed for one team is ever sent to the next.
pub fn keep(root: &Path, team: &Team) -> Result<()> {
    if kept(root).is_some_and(|old| old.workspace != team.workspace) {
        return Err(Error::OtherTeam);
    }
    // Never makes the folder itself: one that was moved away is not brought back empty.
    if !root.is_dir() {
        return Err(std::io::Error::from(std::io::ErrorKind::NotFound).into());
    }
    let _ = std::fs::create_dir(root.join(META_DIR));
    let file = file(root).ok_or_else(|| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
    // The draft is made new, never opened: whatever a received folder left in its place, a link
    // to a file elsewhere included, is taken away rather than written through.
    let draft = file.with_extension("json.new");
    let _ = std::fs::remove_file(&draft);
    let mut new = std::fs::OpenOptions::new();
    let mut new = new.write(true).create_new(true).open(&draft)?;
    std::io::Write::write_all(&mut new, &serde_json::to_vec(team).unwrap_or_default())?;
    Ok(std::fs::rename(draft, file)?)
}

pub fn forget(root: &Path) {
    if let Some(file) = file(root) {
        let _ = std::fs::remove_file(file);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The morning of 2026-11-25: a team folder was shared again and became a second team's.
    #[test]
    fn a_folder_in_a_team_is_not_given_to_another() {
        let dir = tempfile::tempdir().unwrap();
        let team = |workspace: &str| Team {
            server: "s".into(),
            workspace: workspace.into(),
            user: None,
            name: None,
        };
        keep(dir.path(), &team("one")).unwrap();
        assert!(keep(dir.path(), &team("two")).is_err());
        assert_eq!(kept(dir.path()).unwrap().workspace, "one");
        forget(dir.path());
        keep(dir.path(), &team("two")).unwrap();
    }

    /// A folder from someone else, with links where this writes: nothing outside it is touched.
    #[cfg(unix)]
    #[test]
    fn a_link_in_a_received_folder_is_not_written_through() {
        use std::os::unix::fs::symlink;
        let (dir, outside) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        let victim = outside.path().join("victim");
        std::fs::write(&victim, "mine").unwrap();
        let team = Team {
            server: "s".into(),
            workspace: "one".into(),
            user: None,
            name: None,
        };
        let meta = dir.path().join(META_DIR);
        std::fs::create_dir(&meta).unwrap();
        symlink(&victim, meta.join("team.json.new")).unwrap();
        symlink(&victim, meta.join("team.json")).unwrap();
        keep(dir.path(), &team).unwrap();
        assert_eq!(std::fs::read_to_string(&victim).unwrap(), "mine");
        assert_eq!(kept(dir.path()).unwrap(), team);

        // `.lokus` itself a link to another folder's: that folder's team is neither replaced nor forgotten.
        let other = tempfile::tempdir().unwrap();
        symlink(&meta, other.path().join(META_DIR)).unwrap();
        assert!(kept(other.path()).is_none());
        assert!(keep(other.path(), &team).is_err());
        forget(other.path());
        assert_eq!(kept(dir.path()).unwrap(), team);
    }
}

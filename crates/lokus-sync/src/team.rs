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
    /// A sign-in typed by hand for someone's own server; `None` means the account's.
    pub token: Option<String>,
    /// The account that was last connected, so another account's list of teams decides nothing.
    #[serde(default)]
    pub user: Option<String>,
}

fn file(root: &Path) -> PathBuf {
    root.join(META_DIR).join("team.json")
}

pub fn kept(root: &Path) -> Option<Team> {
    serde_json::from_slice(&std::fs::read(file(root)).ok()?).ok()
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
    let file = file(root);
    std::fs::create_dir_all(root.join(META_DIR))?;
    let draft = file.with_extension("json.new");
    std::fs::write(&draft, serde_json::to_vec(team).unwrap_or_default())?;
    Ok(std::fs::rename(draft, file)?)
}

pub fn forget(root: &Path) {
    let _ = std::fs::remove_file(file(root));
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
            token: None,
            user: None,
        };
        keep(dir.path(), &team("one")).unwrap();
        assert!(keep(dir.path(), &team("two")).is_err());
        assert_eq!(kept(dir.path()).unwrap().workspace, "one");
        forget(dir.path());
        keep(dir.path(), &team("two")).unwrap();
    }
}

//! Workspace data models and structures

use serde::{Deserialize, Serialize};

/// Session state containing open tabs and expanded folders for a workspace
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionState {
    pub open_tabs: Vec<String>,
    pub expanded_folders: Vec<String>,
}

/// Workspace item metadata
#[derive(Serialize, Debug, Clone)]
pub struct WorkspaceItem {
    pub path: String,
    pub name: String,
}

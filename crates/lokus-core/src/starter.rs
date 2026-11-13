//! @part-of core.starter
//! A few example notes for an empty vault, so the first thing a person sees
//! is a working page, a board and a template rather than a blank window.

use crate::error::Result;
use crate::vault::Vault;

const CARD: &str = "---\nstatus: {status}\nowner: {owner}\n---\n\n{body}\n";

fn card(status: &str, owner: &str, body: &str) -> String {
    CARD.replace("{status}", status)
        .replace("{owner}", owner)
        .replace("{body}", body)
}

/// Write the example notes. Notes that already exist are left alone.
/// Returns the paths that were created.
pub fn seed(vault: &Vault) -> Result<Vec<String>> {
    let notes: Vec<(&str, String)> = vec![
        ("Welcome.md", include_str!("starter/welcome.md").into()),
        ("Shortcuts.md", include_str!("starter/shortcuts.md").into()),
        (
            "Projects/Roadmap.md",
            include_str!("starter/roadmap.md").into(),
        ),
        (
            "Projects/Invite the team.md",
            card("todo", "", "Sync with a team, then send an invite code."),
        ),
        (
            "Projects/Write the first real note.md",
            card("doing", "You", "Replace these examples with your own."),
        ),
        (
            "Projects/Open a folder as a vault.md",
            card("done", "You", "You are looking at it."),
        ),
        (
            "Templates/Daily.md",
            include_str!("starter/daily.md").into(),
        ),
        (
            "Templates/Meeting.md",
            include_str!("starter/meeting.md").into(),
        ),
    ];
    let mut created = Vec::new();
    for (path, text) in notes {
        if vault.resolve(path)?.exists() {
            continue;
        }
        vault.create(path, &text)?;
        created.push(path.to_string());
    }
    Ok(created)
}

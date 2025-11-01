use git2::{Repository, Signature, IndexAddOption, RemoteCallbacks, PushOptions, FetchOptions, Cred};
use serde::{Serialize, Deserialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncStatus {
    pub is_synced: bool,
    pub has_changes: bool,
    pub ahead: usize,
    pub behind: usize,
    pub conflicts: Vec<String>,
    pub last_commit: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GitCredentials {
    pub username: String,
    pub token: String,
}

/// Initialize a Git repository in the workspace
#[tauri::command]
pub fn git_init(workspace_path: String) -> Result<String, String> {
    println!("[Sync] Initializing Git repository at: {}", workspace_path);

    let path = Path::new(&workspace_path);

    // Check if already a Git repo
    if Repository::open(path).is_ok() {
        return Ok("Repository already exists".to_string());
    }

    // Initialize new repo
    let repo = Repository::init(path)
        .map_err(|e| format!("Failed to initialize Git: {}", e))?;

    // Create initial commit so the branch exists
    // This prevents the "src refspec does not match any existing object" error
    println!("[Sync] Creating initial commit...");

    let signature = Signature::now("Lokus", "noreply@lokus.app")
        .map_err(|e| format!("Failed to create signature: {}", e))?;

    // Create empty tree for initial commit
    let tree_id = {
        let mut index = repo.index()
            .map_err(|e| format!("Failed to get index: {}", e))?;

        // Write empty tree
        index.write_tree()
            .map_err(|e| format!("Failed to write tree: {}", e))?
    };

    let tree = repo.find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    // Create initial commit (no parents)
    repo.commit(
        Some("HEAD"),  // Update HEAD to point to new commit
        &signature,
        &signature,
        "Initial commit",
        &tree,
        &[],  // No parent commits for initial commit
    ).map_err(|e| format!("Failed to create initial commit: {}", e))?;

    println!("[Sync] ✅ Git repository initialized successfully with initial commit");
    Ok("Git repository initialized with initial commit".to_string())
}

/// Add a remote repository
#[tauri::command]
pub fn git_add_remote(
    workspace_path: String,
    remote_name: String,
    remote_url: String,
) -> Result<String, String> {
    println!("[Sync] Adding remote '{}': {}", remote_name, remote_url);

    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Check if remote already exists
    match repo.find_remote(&remote_name) {
        Ok(_) => {
            // Remove existing remote
            repo.remote_delete(&remote_name)
                .map_err(|e| format!("Failed to delete existing remote: {}", e))?;
        }
        Err(_) => {}
    }

    // Add new remote
    repo.remote(&remote_name, &remote_url)
        .map_err(|e| format!("Failed to add remote: {}", e))?;

    println!("[Sync] ✅ Remote added successfully");
    Ok(format!("Remote '{}' added", remote_name))
}

/// Commit all changes
#[tauri::command]
pub fn git_commit(
    workspace_path: String,
    message: String,
    author_name: String,
    author_email: String,
) -> Result<String, String> {
    println!("[Sync] Committing changes: {}", message);

    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Add all changes to staging
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    index.add_all(["."].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to add files: {}", e))?;

    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    // Create tree from index
    let tree_id = index.write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo.find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    // Get parent commit (if any)
    let parent_commit = match repo.head() {
        Ok(head) => {
            let commit = head.peel_to_commit()
                .map_err(|e| format!("Failed to get parent commit: {}", e))?;
            Some(commit)
        }
        Err(_) => None, // First commit
    };

    // Create signature
    let signature = Signature::now(&author_name, &author_email)
        .map_err(|e| format!("Failed to create signature: {}", e))?;

    // Create commit
    let commit_id = if let Some(parent) = parent_commit.as_ref() {
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            &[parent],
        ).map_err(|e| format!("Failed to create commit: {}", e))?
    } else {
        // First commit (no parents)
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            &[],
        ).map_err(|e| format!("Failed to create commit: {}", e))?
    };

    println!("[Sync] ✅ Committed: {}", commit_id);
    Ok(format!("Committed: {}", commit_id))
}

/// Push changes to remote
#[tauri::command]
pub fn git_push(
    workspace_path: String,
    remote_name: String,
    branch_name: String,
    username: String,
    token: String,
) -> Result<String, String> {
    println!("[Sync] Pushing to remote '{}'...", remote_name);

    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| format!("Failed to find remote: {}", e))?;

    // Clone credentials for the callback (credentials callback may be called multiple times)
    let username_clone = username.clone();
    let token_clone = token.clone();

    // Set up authentication callbacks
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
        // Clone again inside the callback since it may be called multiple times
        Cred::userpass_plaintext(&username_clone, &token_clone)
    });

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    // Push
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);
    remote.push(&[&refspec], Some(&mut push_options))
        .map_err(|e| format!("Failed to push: {}", e))?;

    println!("[Sync] ✅ Pushed successfully");
    Ok("Pushed successfully".to_string())
}

/// Pull changes from remote
#[tauri::command]
pub fn git_pull(
    workspace_path: String,
    remote_name: String,
    branch_name: String,
    username: String,
    token: String,
) -> Result<String, String> {
    println!("[Sync] Pull parameters: remote={}, branch={}, username={}, token_length={}",
        remote_name, branch_name, username, token.len());
    println!("[Sync] Pulling from remote '{}'...", remote_name);

    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Fetch
    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| format!("Failed to find remote: {}", e))?;

    // Clone credentials for the callback (credentials callback may be called multiple times)
    let username_clone = username.clone();
    let token_clone = token.clone();

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext(&username_clone, &token_clone)
    });

    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    remote.fetch(&[&branch_name], Some(&mut fetch_options), None)
        .map_err(|e| format!("Failed to fetch: {}", e))?;

    // Get the fetch head and merge
    let fetch_head = repo.find_reference("FETCH_HEAD")
        .map_err(|e| format!("Failed to find FETCH_HEAD: {}", e))?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)
        .map_err(|e| format!("Failed to get fetch commit: {}", e))?;

    // Perform merge analysis
    let analysis = repo.merge_analysis(&[&fetch_commit])
        .map_err(|e| format!("Failed to analyze merge: {}", e))?;

    if analysis.0.is_up_to_date() {
        println!("[Sync] ✅ Already up to date");
        return Ok("Already up to date".to_string());
    }

    if analysis.0.is_fast_forward() {
        println!("[Sync] Fast-forward merge possible");
        // Fast-forward merge
        let refname = format!("refs/heads/{}", branch_name);

        // Try to find existing reference, or create it if it doesn't exist
        let mut reference = match repo.find_reference(&refname) {
            Ok(r) => {
                println!("[Sync] Found existing local branch");
                r
            }
            Err(_) => {
                // Branch doesn't exist locally, create it
                println!("[Sync] Creating local branch '{}' for first pull", branch_name);
                repo.reference(
                    &refname,
                    fetch_commit.id(),
                    false,
                    "Create branch from remote on first pull"
                ).map_err(|e| format!("Failed to create local branch: {}", e))?
            }
        };

        reference.set_target(fetch_commit.id(), "Fast-forward merge")
            .map_err(|e| format!("Failed to fast-forward: {}", e))?;
        repo.set_head(&refname)
            .map_err(|e| format!("Failed to set HEAD: {}", e))?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| format!("Failed to checkout: {}", e))?;

        println!("[Sync] ✅ Fast-forward merge completed");
        Ok("Fast-forward merge completed".to_string())
    } else {
        println!("[Sync] ⚠️  Merge required - potential conflicts");
        Err("Merge required - please resolve conflicts manually".to_string())
    }
}

/// Get sync status
#[tauri::command]
pub fn git_status(workspace_path: String) -> Result<SyncStatus, String> {
    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Check for changes
    let statuses = repo.statuses(None)
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let has_changes = !statuses.is_empty();

    // Get ahead/behind counts
    let (ahead, behind) = match repo.head() {
        Ok(head) => {
            let local_oid = head.target().ok_or("No target")?;
            match repo.find_reference("refs/remotes/origin/main") {
                Ok(remote_ref) => {
                    let remote_oid = remote_ref.target().ok_or("No remote target")?;
                    repo.graph_ahead_behind(local_oid, remote_oid)
                        .unwrap_or((0, 0))
                }
                Err(_) => (0, 0),
            }
        }
        Err(_) => (0, 0),
    };

    // Check for conflicts
    let mut conflicts = Vec::new();
    for entry in statuses.iter() {
        if entry.status().is_conflicted() {
            if let Some(path) = entry.path() {
                conflicts.push(path.to_string());
            }
        }
    }

    // Get last commit
    let last_commit = match repo.head() {
        Ok(head) => {
            match head.peel_to_commit() {
                Ok(commit) => Some(commit.id().to_string()),
                Err(_) => None,
            }
        }
        Err(_) => None,
    };

    let is_synced = !has_changes && ahead == 0 && behind == 0 && conflicts.is_empty();

    Ok(SyncStatus {
        is_synced,
        has_changes,
        ahead,
        behind,
        conflicts,
        last_commit,
    })
}

/// Detect merge conflicts
#[tauri::command]
pub fn detect_conflicts(workspace_path: String) -> Result<Vec<String>, String> {
    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let statuses = repo.statuses(None)
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let mut conflicts = Vec::new();
    for entry in statuses.iter() {
        if entry.status().is_conflicted() {
            if let Some(path) = entry.path() {
                conflicts.push(path.to_string());
            }
        }
    }

    Ok(conflicts)
}

/// Get current branch name
#[tauri::command]
pub fn git_get_current_branch(workspace_path: String) -> Result<String, String> {
    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    if let Some(branch_name) = head.shorthand() {
        Ok(branch_name.to_string())
    } else {
        Ok("main".to_string()) // Default fallback
    }
}

/// Force push (overwrite remote) - USE WITH CAUTION
#[tauri::command]
pub fn git_force_push(
    workspace_path: String,
    remote_name: String,
    branch_name: String,
    username: String,
    token: String,
) -> Result<String, String> {
    println!("[Sync] ⚠️  Force pushing to remote '{}' (will overwrite remote changes!)...", remote_name);

    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| format!("Failed to find remote: {}", e))?;

    let username_clone = username.clone();
    let token_clone = token.clone();

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext(&username_clone, &token_clone)
    });

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    // Force push with + prefix
    let refspec = format!("+refs/heads/{}:refs/heads/{}", branch_name, branch_name);
    remote.push(&[&refspec], Some(&mut push_options))
        .map_err(|e| format!("Failed to force push: {}", e))?;

    println!("[Sync] ✅ Force pushed successfully (remote overwritten)");
    Ok("Force pushed successfully - remote changes overwritten".to_string())
}

/// Force pull (discard local changes) - USE WITH CAUTION
#[tauri::command]
pub fn git_force_pull(
    workspace_path: String,
    remote_name: String,
    branch_name: String,
    username: String,
    token: String,
) -> Result<String, String> {
    println!("[Sync] ⚠️  Force pulling from remote '{}' (will discard local changes!)...", remote_name);

    let repo = Repository::open(&workspace_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Fetch from remote
    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| format!("Failed to find remote: {}", e))?;

    let username_clone = username.clone();
    let token_clone = token.clone();

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext(&username_clone, &token_clone)
    });

    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    remote.fetch(&[&branch_name], Some(&mut fetch_options), None)
        .map_err(|e| format!("Failed to fetch: {}", e))?;

    // Get remote commit
    let fetch_head = repo.find_reference("FETCH_HEAD")
        .map_err(|e| format!("Failed to find FETCH_HEAD: {}", e))?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)
        .map_err(|e| format!("Failed to get fetch commit: {}", e))?;

    // Hard reset to remote commit (discards local changes)
    let remote_commit = repo.find_commit(fetch_commit.id())
        .map_err(|e| format!("Failed to find remote commit: {}", e))?;

    repo.reset(
        remote_commit.as_object(),
        git2::ResetType::Hard,
        Some(git2::build::CheckoutBuilder::default().force())
    ).map_err(|e| format!("Failed to reset: {}", e))?;

    // Update branch reference
    let refname = format!("refs/heads/{}", branch_name);
    let mut reference = repo.find_reference(&refname)
        .map_err(|e| format!("Failed to find reference: {}", e))?;
    reference.set_target(fetch_commit.id(), "Force pull - discard local changes")
        .map_err(|e| format!("Failed to update reference: {}", e))?;

    println!("[Sync] ✅ Force pulled successfully (local changes discarded)");
    Ok("Force pulled successfully - local changes discarded".to_string())
}

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

#[derive(Serialize, Deserialize, Debug)]
pub struct GitError {
    pub error_type: String,
    pub message: String,
    pub user_message: String,
    pub how_to_fix: String,
}

impl GitError {
    /// Categorize a git2::Error into a structured GitError with user-friendly messages
    pub fn from_git2_error(error: git2::Error, operation: &str) -> Self {
        let error_msg = error.message().to_lowercase();
        let error_class = error.class();

        // Categorize based on error message keywords
        let (error_type, user_message, how_to_fix) = if
            error_msg.contains("authentication") ||
            error_msg.contains("credentials") ||
            error_msg.contains("401") ||
            error_msg.contains("403") ||
            error_msg.contains("unauthorized") ||
            error_msg.contains("permission denied") ||
            format!("{:?}", error_class).contains("Auth")
        {
            (
                "auth".to_string(),
                "Your session has expired or authentication failed.".to_string(),
                "Click the sync icon and re-authenticate to continue syncing.".to_string()
            )
        } else if
            error_msg.contains("connection refused") ||
            error_msg.contains("timeout") ||
            error_msg.contains("network") ||
            error_msg.contains("could not resolve") ||
            error_msg.contains("failed to connect") ||
            error_msg.contains("unable to access")
        {
            (
                "network".to_string(),
                "Network connection failed.".to_string(),
                "Check your internet connection and try again.".to_string()
            )
        } else if
            error_msg.contains("conflict") ||
            error_msg.contains("merge") ||
            error_msg.contains("diverged")
        {
            (
                "conflict".to_string(),
                "Merge conflicts detected.".to_string(),
                "Use the conflict resolution options in the sync menu.".to_string()
            )
        } else {
            (
                "other".to_string(),
                format!("Failed to {}: {}", operation, error.message()),
                "Check the error details and try again. If the problem persists, check your repository configuration.".to_string()
            )
        };

        GitError {
            error_type,
            message: error.message().to_string(),
            user_message,
            how_to_fix,
        }
    }

    /// Convert to a JSON string for returning to frontend
    pub fn to_json_string(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            format!(r#"{{"error_type":"other","message":"{}","user_message":"{}","how_to_fix":"{}"}}"#,
                self.message, self.user_message, self.how_to_fix)
        })
    }
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
        .map_err(|e| GitError::from_git2_error(e, "open repository").to_json_string())?;

    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| GitError::from_git2_error(e, "find remote").to_json_string())?;

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
        .map_err(|e| GitError::from_git2_error(e, "push").to_json_string())?;

    println!("[Sync] ✅ Pushed successfully");
    Ok("Pushed successfully".to_string())
}

/// Pull changes from remote repository and merge them locally.
///
/// This command fetches changes from the remote and attempts a fast-forward merge.
/// Handles first-time pulls by automatically creating local branches if they don't exist.
///
/// # Parameters
/// * `workspace_path` - Absolute path to the workspace directory
/// * `remote_name` - Name of the remote (typically "origin")
/// * `branch_name` - Name of the branch to pull (e.g., "main")
/// * `username` - Git username for authentication
/// * `token` - Access token from AuthManager (unified token system)
///
/// # Auto-Create Local Branches on First Pull
/// When pulling for the first time, the local branch may not exist yet. This causes
/// a "src refspec does not match any existing object" error.
///
/// To fix this, we automatically create the local branch if it doesn't exist:
/// 1. Try to find existing local branch reference
/// 2. If not found, create it pointing to the fetched commit
/// 3. Continue with fast-forward merge
///
/// This allows seamless first-time sync without requiring manual branch creation.
///
/// # Returns
/// * `Ok(String)` - Success message (either "Already up to date" or "Fast-forward merge completed")
/// * `Err(String)` - Error message if pull fails or merge required
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
        .map_err(|e| GitError::from_git2_error(e, "open repository").to_json_string())?;

    // Fetch
    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| GitError::from_git2_error(e, "find remote").to_json_string())?;

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
        .map_err(|e| GitError::from_git2_error(e, "fetch").to_json_string())?;

    // Get the fetch head and merge
    let fetch_head = repo.find_reference("FETCH_HEAD")
        .map_err(|e| GitError::from_git2_error(e, "find FETCH_HEAD").to_json_string())?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)
        .map_err(|e| GitError::from_git2_error(e, "get fetch commit").to_json_string())?;

    // Perform merge analysis
    let analysis = repo.merge_analysis(&[&fetch_commit])
        .map_err(|e| GitError::from_git2_error(e, "analyze merge").to_json_string())?;

    if analysis.0.is_up_to_date() {
        println!("[Sync] ✅ Already up to date");
        return Ok("Already up to date".to_string());
    }

    if analysis.0.is_fast_forward() {
        println!("[Sync] Fast-forward merge possible");
        // Fast-forward merge
        let refname = format!("refs/heads/{}", branch_name);

        // Auto-create local branches on first pull
        // This is critical for first-time sync to work without errors.
        // Without this, pushing fails with "src refspec does not match any existing object"
        // because there's no local branch yet to track the remote.
        let mut reference = match repo.find_reference(&refname) {
            Ok(r) => {
                println!("[Sync] Found existing local branch");
                r
            }
            Err(_) => {
                // Branch doesn't exist locally, create it pointing to the fetched commit
                // This allows seamless first-time sync without manual branch creation
                println!("[Sync] Creating local branch '{}' for first pull", branch_name);
                repo.reference(
                    &refname,
                    fetch_commit.id(),
                    false,
                    "Create branch from remote on first pull"
                ).map_err(|e| GitError::from_git2_error(e, "create local branch").to_json_string())?
            }
        };

        reference.set_target(fetch_commit.id(), "Fast-forward merge")
            .map_err(|e| GitError::from_git2_error(e, "fast-forward").to_json_string())?;
        repo.set_head(&refname)
            .map_err(|e| GitError::from_git2_error(e, "set HEAD").to_json_string())?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| GitError::from_git2_error(e, "checkout").to_json_string())?;

        println!("[Sync] ✅ Fast-forward merge completed");
        Ok("Fast-forward merge completed".to_string())
    } else {
        println!("[Sync] ⚠️  Normal merge required - performing merge with conflict markers");

        // Perform a normal merge (not fast-forward)
        // This will leave conflict markers in files if there are conflicts
        repo.merge(&[&fetch_commit], None, None)
            .map_err(|e| GitError::from_git2_error(e, "merge").to_json_string())?;

        // Check if there are conflicts after merge
        let index = repo.index()
            .map_err(|e| format!("Failed to get index: {}", e))?;

        if index.has_conflicts() {
            // Conflicts exist - write them to working directory with conflict markers
            println!("[Sync] ⚠️  Conflicts detected during merge");

            // Checkout the conflicted files with conflict markers
            let mut checkout_builder = git2::build::CheckoutBuilder::new();
            checkout_builder.allow_conflicts(true);
            checkout_builder.conflict_style_merge(true); // Use standard conflict markers

            repo.checkout_index(Some(&mut index.clone()), Some(&mut checkout_builder))
                .map_err(|e| format!("Failed to checkout conflicts: {}", e))?;

            // Count conflicted files
            let mut conflict_count = 0;
            let conflicts = index.conflicts()
                .map_err(|e| format!("Failed to get conflicts: {}", e))?;

            for conflict in conflicts {
                conflict_count += 1;
                if let Ok(c) = conflict {
                    if let Some(our) = c.our {
                        if let Some(path) = std::str::from_utf8(&our.path).ok() {
                            println!("[Sync] Conflict in: {}", path);
                        }
                    }
                }
            }

            println!("[Sync] ✅ Merge completed with {} conflict(s)", conflict_count);
            Ok(format!(
                "Merged with {} conflict{}. Open the conflicted files to resolve them manually (look for <<<<<<< markers).",
                conflict_count,
                if conflict_count == 1 { "" } else { "s" }
            ))
        } else {
            // No conflicts - clean merge
            println!("[Sync] Creating merge commit...");

            // Get the current HEAD commit
            let head = repo.head()
                .map_err(|e| format!("Failed to get HEAD: {}", e))?;
            let head_commit = head.peel_to_commit()
                .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

            // Write the merged index as a tree
            let tree_id = index.write_tree()
                .map_err(|e| format!("Failed to write tree: {}", e))?;
            let tree = repo.find_tree(tree_id)
                .map_err(|e| format!("Failed to find tree: {}", e))?;

            // Get remote commit for merge commit
            let remote_commit = repo.find_commit(fetch_commit.id())
                .map_err(|e| format!("Failed to find remote commit: {}", e))?;

            // Create signature
            let signature = repo.signature()
                .map_err(|e| format!("Failed to create signature: {}", e))?;

            // Create merge commit
            repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                &format!("Merge remote-tracking branch '{}/{}'", remote_name, branch_name),
                &tree,
                &[&head_commit, &remote_commit],
            ).map_err(|e| format!("Failed to create merge commit: {}", e))?;

            // Cleanup merge state
            repo.cleanup_state()
                .map_err(|e| format!("Failed to cleanup state: {}", e))?;

            println!("[Sync] ✅ Merge completed successfully");
            Ok("Merge completed successfully".to_string())
        }
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

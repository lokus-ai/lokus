import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, GitBranch, CloudUpload, ArrowDownToLine, ChevronDown, AlertTriangle, Trash2, FileQuestion, LogIn, Users, Settings } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { readConfig } from '../../core/config/store';
import { confirm } from '@tauri-apps/plugin-dialog';
export default function SyncStatus() {
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, committing, pushing, pulling, fetching, syncing, success, error, auth_error
  const [gitStatus, setGitStatus] = useState(null);
  const [irohStatus, setIrohStatus] = useState(null);
  const [syncProvider, setSyncProvider] = useState('git'); // 'git' or 'iroh'
  const [isConfigured, setIsConfigured] = useState(false);
  const [workspacePath, setWorkspacePath] = useState('');
  const [syncSettings, setSyncSettings] = useState({});
  const [showMenu, setShowMenu] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState('');

  // Filter out technical/internal files from conflicts shown to users
  const filterUserContentConflicts = (conflicts) => {
    if (!conflicts || conflicts.length === 0) return [];

    // Technical patterns to hide from users (app internals they shouldn't touch)
    const technicalPatterns = [
      /^\.lokus\//,           // .lokus/ folder (app config, state, cache)
      /^\.git\//,             // .git/ folder (version control internals)
      /^node_modules\//,      // node_modules (dependencies)
      /^\.DS_Store$/,         // macOS metadata
      /^\.vscode\//,          // VS Code settings
      /^\.idea\//,            // IntelliJ settings
      /^package-lock\.json$/, // Lock files
      /^yarn\.lock$/,         // Lock files
    ];

    return conflicts.filter(file => {
      // Check if file matches any technical pattern
      const isTechnical = technicalPatterns.some(pattern => pattern.test(file));
      return !isTechnical; // Only show user content files
    });
  };

  // Load sync configuration on mount
  useEffect(() => {
    loadSyncConfig();
  }, []);

  // Listen to Tauri sync events
  useEffect(() => {
    const unlistenPromises = [];

    // Listen for sync status updates
    unlistenPromises.push(
      listen('sync_status_updated', (event) => {
        const { status } = event.payload;
        if (status.sync_type === 'iroh') {
          setIrohStatus(status);
          setSyncStatus('success');
          setLastSync(new Date());
        } else {
          setGitStatus(status);
        }
      })
    );

    // Listen for sync errors
    unlistenPromises.push(
      listen('sync_error', (event) => {
        const { message, error } = event.payload;
        setErrorMessage(message || error);
        setSyncStatus('error');
        setTimeout(() => {
          setSyncStatus('idle');
        }, 5000);
      })
    );

    // Listen for sync conflicts
    unlistenPromises.push(
      listen('sync_conflict', (event) => {
        const { conflicts } = event.payload;
        if (gitStatus) {
          setGitStatus({ ...gitStatus, conflicts });
        }
      })
    );

    // Cleanup listeners on unmount
    return () => {
      Promise.all(unlistenPromises).then(unlisteners => {
        unlisteners.forEach(unlisten => {
          if (typeof unlisten === 'function') unlisten();
        });
      }).catch(() => {});
    };
  }, []);

  // Check sync status periodically when configured
  useEffect(() => {
    if (!isConfigured || !workspacePath) return;

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isConfigured, workspacePath, syncProvider]);

  const loadSyncConfig = async () => {
    try {
      // Get workspace path from window opener or API
      let path = '';
      if (window.__WORKSPACE_PATH__) {
        path = window.__WORKSPACE_PATH__;
      } else {
        try {
          const currentWorkspace = await invoke('api_get_current_workspace');
          if (currentWorkspace) {
            path = currentWorkspace;
          }
        } catch(err) {
          console.log("Error:",err)
         }
      }

      if (!path) return;
      setWorkspacePath(path);

      // Load sync settings from config
      const cfg = await readConfig();
      if (cfg.sync) {
        setSyncSettings(cfg.sync);

        // Detect sync provider from config
        const provider = cfg.sync.provider || 'git';
        setSyncProvider(provider);

        // Check if configured based on provider
        let configured = false;
        if (provider === 'iroh') {
          // Iroh is configured if it has a document ID or ticket
          configured = !!(cfg.sync.irohDocumentId || cfg.sync.irohTicket);
        } else {
          // Git is configured if it has remote URL, username, and token
          configured = !!(cfg.sync.remoteUrl && cfg.sync.username && cfg.sync.token);
        }
        setIsConfigured(configured);
      }
    } catch (err){
          console.log("Error:",err)
     }
  };

  const checkSyncStatus = async () => {
    if (!workspacePath) return;

    try {
      if (syncProvider === 'iroh') {
        const status = await invoke('iroh_sync_status', { workspacePath: workspacePath });
        setIrohStatus(status);
      } else {
        const status = await invoke('git_status', { workspace_path: workspacePath });
        setGitStatus(status);
      }
    } catch (e) {
      // Ignore errors if not initialized
          console.log("Error:",e)
    }
  };

  // Helper to parse structured error from Rust
  const parseGitError = (error) => {
    try {
      // Try to parse as JSON structured error
      const errorObj = JSON.parse(error);
      if (errorObj.error_type && errorObj.user_message) {
        return {
          type: errorObj.error_type,
          message: errorObj.user_message,
          howToFix: errorObj.how_to_fix,
          raw: errorObj.message
        };
      }
    } catch (e) {
      // Not a structured error, return as-is
          console.log(e)
    }

    // Fallback: return error as string
    return {
      type: 'other',
      message: String(error),
      howToFix: 'Check the error details and try again.',
      raw: String(error)
    };
  };

  const commitAndPush = async () => {
    if (!isConfigured || !workspacePath) return;

    setShowMenu(false);
    setErrorMessage('');
    setErrorType('');

    try {
      // Use GitHub token from sync settings
      const token = syncSettings.token;
      if (!token) {
        throw new Error('GitHub token not configured. Please add your Personal Access Token in Preferences > Sync.');
      }

      // Commit
      setSyncStatus('committing');
      await invoke('git_commit', {
        workspace_path: workspacePath,
        message: 'Auto-sync workspace',
        author_name: syncSettings.authorName || syncSettings.username || 'Lokus',
        author_email: syncSettings.authorEmail || `${syncSettings.username}@users.noreply.github.com`
      });

      // Push
      setSyncStatus('pushing');
      const pushResult = await invoke('git_push', {
        workspace_path: workspacePath,
        remote_name: 'origin',
        branch_name: syncSettings.branch || 'main',
        username: syncSettings.username,
        token: token
      });

      setSyncStatus('success');
      setLastSync(new Date());

      // Show success message
      setErrorMessage('Push successful - workspace synced');
      setErrorType('success');

      await checkGitStatus();

      // Reset to idle after showing success
      setTimeout(() => {
        setSyncStatus('idle');
        setErrorMessage('');
        setErrorType('');
      }, 3000);
    } catch (err) {
        console.log("Error:",err)

      // Parse structured error
      const gitError = parseGitError(err);
      setErrorType(gitError.type);

      // Provide helpful error messages for common issues
      if (err.toString().includes('find remote')) {
        setErrorMessage('Git not initialized. Go to Preferences > Sync, expand "Git Configuration", then click "Initialize Git" and "Connect Remote"');
      } else if (err.toString().includes('not a git repository')) {
        setErrorMessage('Git not initialized in workspace. Go to Preferences > Sync, expand "Git Configuration", then click "Initialize Git"');
      } else {
        setErrorMessage(gitError.message);
      }

      // Set specific status for auth errors
      if (gitError.type === 'auth') {
        setSyncStatus('auth_error');
      } else {
        setSyncStatus('error');
      }

      // Reset to idle after showing error
      setTimeout(() => {
        setSyncStatus('idle');
      }, 5000);
    }
  };

  const pull = async () => {
    if (!isConfigured || !workspacePath) return;

    setShowMenu(false);
    setErrorMessage('');
    setErrorType('');

    try {
      // Use GitHub token from sync settings
      const token = syncSettings.token;
      if (!token) {
        throw new Error('GitHub token not configured. Please add your Personal Access Token in Preferences > Sync.');
      }

      setSyncStatus('pulling');
      const result = await invoke('git_pull', {
        workspace_path: workspacePath,
        workspace_id: workspacePath, // Using workspace path as ID for now
        remote_name: 'origin',
        branch_name: syncSettings.branch || 'main'
      });

      // Check if there are conflicts after merge
      if (result && result.includes('conflict')) {
        // Conflicts detected - files now have conflict markers
        setSyncStatus('success');
        setErrorMessage(result); // Shows: "Merged with X conflicts. Open files to resolve..."
        setErrorType('warning');

        // Refresh git status to show conflicted files
        await checkGitStatus();

        // Don't auto-clear this message - user needs to see it
      } else {
        // Clean merge - no conflicts
        setSyncStatus('success');
        setLastSync(new Date());

        // Show user-friendly message based on result
        if (result && result.includes('up to date')) {
          setErrorMessage('Already up to date - no new changes');
          setErrorType('info');
        } else if (result && result.includes('Fast-forward')) {
          setErrorMessage('Pull successful - workspace updated');
          setErrorType('success');
        } else if (result && result.includes('Merge completed successfully')) {
          setErrorMessage('Merge successful - workspace updated');
          setErrorType('success');
        }

        await checkGitStatus();

        setTimeout(() => {
          setSyncStatus('idle');
          setErrorMessage('');
          setErrorType('');
        }, 3000);
      }
    } catch (err) {
          console.log("Error:",err)

      // Parse structured error
      const gitError = parseGitError(err);
      setErrorType(gitError.type);

      // Provide helpful error messages for common issues
      if (err.toString().includes('find remote')) {
        setErrorMessage('Git not initialized. Go to Preferences > Sync, expand "Git Configuration", then click "Initialize Git" and "Connect Remote"');
      } else if (err.toString().includes('not a git repository')) {
        setErrorMessage('Git not initialized in workspace. Go to Preferences > Sync, expand "Git Configuration", then click "Initialize Git"');
      } else {
        setErrorMessage(gitError.message);
      }

      // Set specific status for auth errors
      if (gitError.type === 'auth') {
        setSyncStatus('auth_error');
      } else {
        setSyncStatus('error');
      }

      // Reset to idle after showing error
      setTimeout(() => {
        setSyncStatus('idle');
      }, 5000);
    }
  };

  const forcePush = async () => {
    if (!isConfigured || !workspacePath) return;

    // Safety confirmation
    const confirmed = await confirm(
      'Force Push will overwrite all remote changes with your local version. This cannot be undone. Continue?',
      { title: 'Confirm Force Push', kind: 'warning' }
    );

    if (!confirmed) return;

    setShowMenu(false);

    try {
      // Use GitHub token from sync settings
      const token = syncSettings.token;
      if (!token) {
        throw new Error('GitHub token not configured. Please add your Personal Access Token in Preferences > Sync.');
      }

      setSyncStatus('pushing');
      await invoke('git_force_push', {
        workspace_path: workspacePath,
        remote_name: 'origin',
        branch_name: syncSettings.branch || 'main',
        username: syncSettings.username,
        token: token
      });

      setSyncStatus('success');
      setLastSync(new Date());
      await checkGitStatus();

      setTimeout(() => {
        setSyncStatus('idle');
      }, 2000);
    } catch (err) {
          console.log("Error:",err)
      setSyncStatus('error');
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  };

  const forcePull = async () => {
    if (!isConfigured || !workspacePath) return;

    // Safety confirmation
    const confirmed = await confirm(
      'Force Pull will discard all local changes and use the remote version. This cannot be undone. Continue?',
      { title: 'Confirm Force Pull', kind: 'warning' }
    );

    if (!confirmed) return;

    setShowMenu(false);

    try {
      // Use GitHub token from sync settings
      const token = syncSettings.token;
      if (!token) {
        throw new Error('GitHub token not configured. Please add your Personal Access Token in Preferences > Sync.');
      }

      setSyncStatus('pulling');
      await invoke('git_force_pull', {
        workspace_path: workspacePath,
        remote_name: 'origin',
        branch_name: syncSettings.branch || 'main',
        username: syncSettings.username,
        token: token
      });

      setSyncStatus('success');
      setLastSync(new Date());
      await checkGitStatus();

      setTimeout(() => {
        setSyncStatus('idle');
      }, 2000);
    } catch (err) {
          console.log("Error:",err)
      setSyncStatus('error');
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  };

  const irohManualSync = async () => {
    if (!isConfigured || !workspacePath) return;

    setShowMenu(false);
    setErrorMessage('');
    setErrorType('');

    try {
      setSyncStatus('syncing');
      const result = await invoke('iroh_manual_sync', { workspacePath: workspacePath });

      setSyncStatus('success');
      setLastSync(new Date());
      setErrorMessage(result || 'Sync successful');
      setErrorType('success');

      await checkSyncStatus();

      setTimeout(() => {
        setSyncStatus('idle');
        setErrorMessage('');
        setErrorType('');
      }, 3000);
    } catch (err) {
          console.log("Error:",err)
      setErrorMessage(String(err));
      setSyncStatus('error');

      setTimeout(() => {
        setSyncStatus('idle');
      }, 5000);
    }
  };

  const isSyncing = () => {
    return ['committing', 'pushing', 'pulling', 'fetching', 'syncing'].includes(syncStatus);
  };

  const getStatusIcon = () => {
    if (!isConfigured) {
      return <CloudOff className="w-3.5 h-3.5 text-app-muted" />;
    }

    // For Iroh provider
    if (syncProvider === 'iroh') {
      switch (syncStatus) {
        case 'syncing':
          return <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
        case 'success':
          return <Check className="w-3.5 h-3.5 text-green-500" />;
        case 'error':
          return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
        default:
          if (irohStatus?.connected_peers > 0) {
            return <Cloud className="w-3.5 h-3.5 text-green-500" />;
          } else {
            return <CloudOff className="w-3.5 h-3.5 text-app-muted" />;
          }
      }
    }

    // For Git provider (existing logic)
    // Check for user-facing conflicts first
    const userConflicts = filterUserContentConflicts(gitStatus?.conflicts);
    if (userConflicts.length > 0) {
      return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
    }

    switch (syncStatus) {
      case 'committing':
      case 'pushing':
      case 'pulling':
      case 'fetching':
      case 'syncing':
        return <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case 'success':
        return <Check className="w-3.5 h-3.5 text-green-500" />;
      case 'auth_error':
        return <LogIn className="w-3.5 h-3.5 text-orange-500" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        if (gitStatus?.has_changes) {
          return <GitBranch className="w-3.5 h-3.5 text-yellow-500" />;
        }
        return <Cloud className="w-3.5 h-3.5 text-app-accent" />;
    }
  };

  const getStatusText = () => {
    if (!isConfigured) {
      return 'Not configured';
    }

    // For Iroh provider
    if (syncProvider === 'iroh') {
      switch (syncStatus) {
        case 'syncing':
          return 'Syncing...';
        case 'success':
          return errorMessage || 'Synced';
        case 'error':
          return 'Sync error';
        default:
          if (irohStatus) {
            const peerCount = irohStatus.connected_peers || 0;
            if (peerCount === 0) {
              return 'No peers connected';
            }
            return `Synced \u2022 ${peerCount} device${peerCount > 1 ? 's' : ''}`;
          }
          return lastSync ? formatTime(lastSync) : 'Ready';
      }
    }

    // For Git provider (existing logic)
    // Check for user-facing conflicts first
    const userConflicts = filterUserContentConflicts(gitStatus?.conflicts);
    if (userConflicts.length > 0) {
      return `${userConflicts.length} conflict${userConflicts.length > 1 ? 's' : ''}`;
    }

    switch (syncStatus) {
      case 'committing':
        return 'Committing...';
      case 'pushing':
        return 'Pushing...';
      case 'pulling':
        return 'Pulling...';
      case 'fetching':
        return 'Fetching...';
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return errorMessage || 'Synced';
      case 'auth_error':
        return errorMessage || 'Auth failed';
      case 'error':
        return errorMessage || 'Failed';
      default:
        if (gitStatus) {
          if (gitStatus.has_changes) {
            return 'Changes pending';
          }
          if (gitStatus.ahead > 0) {
            return `${gitStatus.ahead} to push`;
          }
          if (gitStatus.behind > 0) {
            return `${gitStatus.behind} to pull`;
          }
          return 'Synced';
        }
        return lastSync ? formatTime(lastSync) : 'Ready';
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
  };

  const getSyncHealth = () => {
    if (!isConfigured) return { status: 'unconfigured', icon: '⚙', text: 'Not configured' };
    if (errorType === 'auth') return { status: 'error', icon: '✗', text: 'Auth error', color: 'text-red-500' };
    if (syncStatus === 'error') return { status: 'error', icon: '✗', text: 'Error', color: 'text-red-500' };
    const userConflicts = filterUserContentConflicts(gitStatus?.conflicts);
    if (userConflicts.length > 0) return { status: 'warning', icon: '⚠', text: 'Needs attention', color: 'text-orange-500' };
    if (gitStatus?.has_changes || gitStatus?.ahead > 0) return { status: 'pending', icon: '⋯', text: 'Changes pending', color: 'text-yellow-500' };
    if (lastSync) return { status: 'healthy', icon: '✓', text: 'Healthy', color: 'text-green-500' };
    return { status: 'idle', icon: '○', text: 'Ready', color: 'text-app-muted' };
  };

  const getTooltip = () => {
    if (!isConfigured) {
      return 'Git sync not configured. Open Preferences → Sync to set up.';
    }

    // Check for user-facing conflicts first (priority tooltip)
    const userConflicts = filterUserContentConflicts(gitStatus?.conflicts);
    if (userConflicts.length > 0) {
      return `⚠️ ${userConflicts.length} merge conflict${userConflicts.length > 1 ? 's' : ''} detected - Click to resolve`;
    }

    switch (syncStatus) {
      case 'syncing':
        return 'Syncing changes...';
      case 'success':
        return 'All changes synced successfully';
      case 'auth_error':
        return errorMessage || 'Authentication failed. Click to sign in again.';
      case 'error':
        if (errorType === 'network') {
          return errorMessage || 'Network error. Check your connection.';
        } else if (errorType === 'conflict') {
          return errorMessage || '⚠️ Merge conflicts detected - Click to resolve';
        }
        return errorMessage || 'Sync failed. Click to retry.';
      default:
        if (gitStatus?.has_changes) {
          return 'You have uncommitted changes. Click to commit & push.';
        }
        return 'Click to sync, right-click for options';
    }
  };

  const handleClick = () => {
    if (!isConfigured) {
      // Open preferences to sync tab
      return;
    }

    if (syncProvider === 'iroh') {
      // For Iroh, just trigger manual sync
      irohManualSync();
    } else {
      // For Git
      // If there are user-facing conflicts, open the menu to show resolution options
      const userConflicts = filterUserContentConflicts(gitStatus?.conflicts);
      if (userConflicts.length > 0) {
        setShowMenu(true);
        return;
      }

      if (gitStatus?.has_changes || gitStatus?.ahead > 0) {
        commitAndPush();
      } else {
        checkSyncStatus();
      }
    }
  };

  const handleRightClick = (e) => {
    if (!isConfigured) return;
    e.preventDefault();
    setShowMenu(!showMenu);
  };

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 px-2 py-1 text-xs text-app-muted hover:text-app-text cursor-pointer transition-colors"
        onClick={handleClick}
        onContextMenu={handleRightClick}
        title={getTooltip()}
      >
        {getStatusIcon()}
        <span className="hidden sm:inline">
          {getStatusText()}
        </span>
        {isConfigured && (
          <ChevronDown className="w-3 h-3 opacity-50" />
        )}
      </div>

      {/* Dropdown Menu */}
      {showMenu && isConfigured && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute bottom-full right-0 mb-1 bg-app-panel border border-app-border rounded-md shadow-lg z-50 min-w-[150px]">
            {syncProvider === 'iroh' ? (
              <>
                {/* Iroh-specific menu options */}
                <button
                  onClick={irohManualSync}
                  disabled={isSyncing()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Now
                </button>

                <button
                  onClick={() => {
                    // TODO: Open peer list modal
                    setShowMenu(false);
                  }}
                  disabled={isSyncing()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Users className="w-3.5 h-3.5" />
                  View Peers
                </button>

                <div className="border-t border-app-border my-1" />

                <button
                  onClick={() => {
                    // TODO: Open settings
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </button>
              </>
            ) : (
              <>
                {/* Git-specific menu options */}
                <button
                  onClick={pull}
                  disabled={isSyncing()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Pull Changes
                </button>

                <button
                  onClick={commitAndPush}
                  disabled={isSyncing()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  Commit & Push
                </button>

                <div className="border-t border-app-border my-1" />

                <button
                  onClick={async () => {
                    await checkSyncStatus();
                    setShowMenu(false);
                  }}
                  disabled={isSyncing()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Check Status
                </button>
              </>
            )}

            {/* Conflict Resolution Section */}
            {(() => {
              const userConflicts = filterUserContentConflicts(gitStatus?.conflicts);
              return userConflicts.length > 0 && (
              <>
                <div className="border-t border-app-border my-1" />
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-orange-500 font-medium mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {userConflicts.length} Conflict{userConflicts.length > 1 ? 's' : ''} Detected
                  </div>

                  {/* Explanatory text */}
                  <div className="text-xs text-app-muted mb-3 p-2 bg-orange-500/5 rounded border border-orange-500/20">
                    <div className="font-medium text-orange-500 mb-1">⚠️ Conflicting Changes Detected</div>
                    <p className="mb-2">Files below contain conflict markers. Open them to see:</p>
                    <div className="font-mono text-[10px] bg-app-bg p-1 rounded mb-2">
                      <div>{'<<<<<<< Your Changes'}</div>
                      <div className="text-blue-500">Your content here</div>
                      <div>=======</div>
                      <div className="text-orange-500">Remote content here</div>
                      <div>{'>>>>>>> Remote'}</div>
                    </div>
                    <p>Edit the files manually, remove the markers, and commit your resolution.</p>
                  </div>

                  {/* Per-file conflict list */}
                  <div className="text-xs mb-3 max-h-32 overflow-y-auto space-y-1">
                    {userConflicts.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-orange-500/5 rounded border border-orange-500/10"
                      >
                        <FileQuestion className="w-3 h-3 flex-shrink-0 text-orange-500" />
                        <span className="flex-1 truncate text-app-text font-mono" title={file}>
                          {file}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* How to resolve */}
                  <div className="space-y-2 mb-3">
                    <div className="text-xs font-medium text-app-text mb-1">
                      📝 How to Resolve:
                    </div>
                    <ol className="text-xs text-app-muted space-y-1 list-decimal list-inside">
                      <li>Open each conflicted file in the editor</li>
                      <li>Find the conflict markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt; and &gt;&gt;&gt;&gt;&gt;&gt;&gt;)</li>
                      <li>Keep the content you want, delete the rest</li>
                      <li>Remove all conflict markers</li>
                      <li>Save the file</li>
                      <li>Commit your changes using "Commit & Push"</li>
                    </ol>
                  </div>

                  {/* Advanced: Force resolution */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-app-muted hover:text-app-text font-medium mb-2">
                      Advanced: Force Resolution (All or Nothing)
                    </summary>
                    <div className="space-y-2 pl-2 pt-2">
                      <button
                        onClick={forcePush}
                        disabled={isSyncing()}
                        className="w-full px-3 py-2 text-xs text-app-text bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/20 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CloudUpload className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-medium">Keep My Local Changes</span>
                        </div>
                        <div className="text-[10px] text-app-muted ml-5">
                          ⚠️ Overwrites remote - your local files will replace everything
                        </div>
                      </button>
                      <button
                        onClick={forcePull}
                        disabled={isSyncing()}
                        className="w-full px-3 py-2 text-xs text-app-text bg-orange-500/10 hover:bg-orange-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-orange-500/20 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowDownToLine className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-medium">Use Remote Changes</span>
                        </div>
                        <div className="text-[10px] text-app-muted ml-5">
                          ⚠️ Discards local - remote files will replace everything
                        </div>
                      </button>
                    </div>
                  </details>
                </div>
              </>
            );
            })()}

            {(syncProvider === 'iroh' ? irohStatus : gitStatus) && (
              <>
                <div className="border-t border-app-border my-1" />
                <div className="px-3 py-2 text-xs">
                  {syncProvider === 'iroh' ? (
                    <>
                      {/* Iroh Status */}
                      <div className="flex justify-between items-center mb-2 pb-2 border-b border-app-border/50">
                        <span className="text-app-muted">Status:</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium ${irohStatus?.connected_peers > 0 ? 'text-green-500' : 'text-app-muted'}`}>
                            {irohStatus?.connected_peers > 0 ? '✓ Connected' : '○ Offline'}
                          </span>
                        </div>
                      </div>

                      {/* Last Sync Time */}
                      {lastSync && (
                        <div className="flex justify-between mb-2">
                          <span className="text-app-muted">Last synced:</span>
                          <span className="text-app-text font-medium">{formatTime(lastSync)}</span>
                        </div>
                      )}

                      <div className="flex justify-between mt-1">
                        <span className="text-app-muted">Connected peers:</span>
                        <span className="text-app-text">{irohStatus?.connected_peers || 0}</span>
                      </div>
                      {irohStatus?.document_id && (
                        <div className="flex justify-between mt-1">
                          <span className="text-app-muted">Document:</span>
                          <span className="text-app-text font-mono text-[10px]" title={irohStatus.document_id}>
                            {irohStatus.document_id.substring(0, 8)}...
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Git Status */}
                      <div className="flex justify-between items-center mb-2 pb-2 border-b border-app-border/50">
                        <span className="text-app-muted">Status:</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium ${getSyncHealth().color || 'text-app-text'}`}>
                            {getSyncHealth().icon} {getSyncHealth().text}
                          </span>
                        </div>
                      </div>

                      {/* Last Sync Time */}
                      {lastSync && (
                        <div className="flex justify-between mb-2">
                          <span className="text-app-muted">Last synced:</span>
                          <span className="text-app-text font-medium">{formatTime(lastSync)}</span>
                        </div>
                      )}

                      <div className="flex justify-between mt-1">
                        <span className="text-app-muted">Branch:</span>
                        <span className="text-app-text">{syncSettings.branch || 'main'}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-app-muted">Changes:</span>
                        <span className={gitStatus.has_changes ? 'text-yellow-500' : 'text-green-500'}>
                          {gitStatus.has_changes ? 'Yes' : 'No'}
                        </span>
                      </div>
                      {gitStatus.ahead > 0 && (
                        <div className="flex justify-between mt-1">
                          <span className="text-app-muted">Ahead:</span>
                          <span className="text-app-text">{gitStatus.ahead}</span>
                        </div>
                      )}
                      {gitStatus.behind > 0 && (
                        <div className="flex justify-between mt-1">
                          <span className="text-app-muted">Behind:</span>
                          <span className="text-app-text">{gitStatus.behind}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

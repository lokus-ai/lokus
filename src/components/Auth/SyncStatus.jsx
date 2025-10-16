import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, GitBranch, CloudUpload, ArrowDownToLine, ChevronDown, AlertTriangle, Trash2, FileQuestion } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { readConfig } from '../../core/config/store';
import { confirm } from '@tauri-apps/plugin-dialog';

export default function SyncStatus() {
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [gitStatus, setGitStatus] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [workspacePath, setWorkspacePath] = useState('');
  const [syncSettings, setSyncSettings] = useState({});
  const [token, setToken] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Load sync configuration on mount
  useEffect(() => {
    loadSyncConfig();
  }, []);

  // Check git status periodically when configured
  useEffect(() => {
    if (!isConfigured || !workspacePath) return;

    checkGitStatus();
    const interval = setInterval(checkGitStatus, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isConfigured, workspacePath]);

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
        } catch (e) {
          console.log('[SyncStatus] No workspace path available');
        }
      }

      if (!path) return;
      setWorkspacePath(path);

      // Load sync settings from config
      const cfg = await readConfig();
      if (cfg.sync) {
        setSyncSettings(cfg.sync);

        // Check if configured
        const configured = !!(cfg.sync.remoteUrl && cfg.sync.username);
        setIsConfigured(configured);

        // Load token from secure storage
        if (configured) {
          try {
            const storedToken = await invoke('retrieve_sync_token');
            if (storedToken) {
              setToken(storedToken);
            }
          } catch (e) {
            console.error('[SyncStatus] Failed to load token:', e);
          }
        }
      }
    } catch (e) {
      console.error('[SyncStatus] Failed to load config:', e);
    }
  };

  const checkGitStatus = async () => {
    if (!workspacePath) return;

    try {
      const status = await invoke('git_status', { workspacePath });
      setGitStatus(status);
    } catch (e) {
      // Ignore errors if Git not initialized
      console.log('[SyncStatus] Git status check failed:', e);
    }
  };

  const commitAndPush = async () => {
    if (!isConfigured || !workspacePath || !token) return;

    setSyncStatus('syncing');
    setShowMenu(false);

    try {
      // Commit
      await invoke('git_commit', {
        workspacePath,
        message: 'Auto-sync workspace',
        authorName: syncSettings.authorName || 'Lokus',
        authorEmail: syncSettings.authorEmail || 'noreply@lokus.app'
      });

      // Push
      await invoke('git_push', {
        workspacePath,
        remoteName: 'origin',
        branchName: syncSettings.branch || 'main',
        username: syncSettings.username,
        token: token
      });

      setSyncStatus('success');
      setLastSync(new Date());
      await checkGitStatus();

      // Reset to idle after showing success
      setTimeout(() => {
        setSyncStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('[SyncStatus] Sync failed:', err);
      setSyncStatus('error');
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  };

  const pull = async () => {
    if (!isConfigured || !workspacePath || !token) return;

    setSyncStatus('syncing');
    setShowMenu(false);

    try {
      await invoke('git_pull', {
        workspacePath,
        remoteName: 'origin',
        branchName: syncSettings.branch || 'main',
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
      console.error('[SyncStatus] Pull failed:', err);
      setSyncStatus('error');
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  };

  const forcePush = async () => {
    if (!isConfigured || !workspacePath || !token) return;

    // Safety confirmation
    const confirmed = await confirm(
      'Force Push will overwrite all remote changes with your local version. This cannot be undone. Continue?',
      { title: 'Confirm Force Push', kind: 'warning' }
    );

    if (!confirmed) return;

    setSyncStatus('syncing');
    setShowMenu(false);

    try {
      await invoke('git_force_push', {
        workspacePath,
        remoteName: 'origin',
        branchName: syncSettings.branch || 'main',
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
      console.error('[SyncStatus] Force push failed:', err);
      setSyncStatus('error');
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  };

  const forcePull = async () => {
    if (!isConfigured || !workspacePath || !token) return;

    // Safety confirmation
    const confirmed = await confirm(
      'Force Pull will discard all local changes and use the remote version. This cannot be undone. Continue?',
      { title: 'Confirm Force Pull', kind: 'warning' }
    );

    if (!confirmed) return;

    setSyncStatus('syncing');
    setShowMenu(false);

    try {
      await invoke('git_force_pull', {
        workspacePath,
        remoteName: 'origin',
        branchName: syncSettings.branch || 'main',
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
      console.error('[SyncStatus] Force pull failed:', err);
      setSyncStatus('error');
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  };

  const getStatusIcon = () => {
    if (!isConfigured) {
      return <CloudOff className="w-3.5 h-3.5 text-app-muted" />;
    }

    // Check for conflicts first
    if (gitStatus?.conflicts && gitStatus.conflicts.length > 0) {
      return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
    }

    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case 'success':
        return <Check className="w-3.5 h-3.5 text-green-500" />;
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

    // Check for conflicts first
    if (gitStatus?.conflicts && gitStatus.conflicts.length > 0) {
      return `${gitStatus.conflicts.length} conflict${gitStatus.conflicts.length > 1 ? 's' : ''}`;
    }

    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Synced';
      case 'error':
        return 'Failed';
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

  const getTooltip = () => {
    if (!isConfigured) {
      return 'Git sync not configured. Open Preferences → Sync to set up.';
    }

    switch (syncStatus) {
      case 'syncing':
        return 'Syncing changes...';
      case 'success':
        return 'All changes synced successfully';
      case 'error':
        return 'Sync failed. Click to retry.';
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

    if (gitStatus?.has_changes || gitStatus?.ahead > 0) {
      commitAndPush();
    } else {
      checkGitStatus();
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
            <button
              onClick={pull}
              disabled={syncStatus === 'syncing'}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Pull Changes
            </button>

            <button
              onClick={commitAndPush}
              disabled={syncStatus === 'syncing'}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Commit & Push
            </button>

            <div className="border-t border-app-border my-1" />

            <button
              onClick={async () => {
                await checkGitStatus();
                setShowMenu(false);
              }}
              disabled={syncStatus === 'syncing'}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Status
            </button>

            {/* Conflict Resolution Section */}
            {gitStatus?.conflicts && gitStatus.conflicts.length > 0 && (
              <>
                <div className="border-t border-app-border my-1" />
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-orange-500 font-medium mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Conflicts Detected
                  </div>
                  <div className="text-xs text-app-muted mb-2 max-h-20 overflow-y-auto">
                    {gitStatus.conflicts.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-1 py-0.5">
                        <FileQuestion className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{file}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-app-muted mb-2">
                    Choose how to resolve:
                  </div>
                  <button
                    onClick={forcePush}
                    disabled={syncStatus === 'syncing'}
                    className="w-full flex items-center gap-2 px-2 py-1.5 mb-1 text-xs text-app-text bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    Force Push (Keep Local)
                  </button>
                  <button
                    onClick={forcePull}
                    disabled={syncStatus === 'syncing'}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-app-text bg-orange-500/10 hover:bg-orange-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Force Pull (Use Remote)
                  </button>
                </div>
              </>
            )}

            {gitStatus && (
              <>
                <div className="border-t border-app-border my-1" />
                <div className="px-3 py-2 text-xs text-app-muted">
                  <div className="flex justify-between">
                    <span>Branch:</span>
                    <span className="text-app-text">{syncSettings.branch || 'main'}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Changes:</span>
                    <span className={gitStatus.has_changes ? 'text-yellow-500' : 'text-green-500'}>
                      {gitStatus.has_changes ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {gitStatus.ahead > 0 && (
                    <div className="flex justify-between mt-1">
                      <span>Ahead:</span>
                      <span className="text-app-text">{gitStatus.ahead}</span>
                    </div>
                  )}
                  {gitStatus.behind > 0 && (
                    <div className="flex justify-between mt-1">
                      <span>Behind:</span>
                      <span className="text-app-text">{gitStatus.behind}</span>
                    </div>
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

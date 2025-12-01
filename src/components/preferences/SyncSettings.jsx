import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GitBranch, RefreshCw, CloudUpload, CloudOff } from "lucide-react";
import { readConfig, updateConfig } from "../../core/config/store.js";

export default function SyncSettings({ workspacePath }) {
    const [syncRemoteUrl, setSyncRemoteUrl] = useState('');
    const [syncUsername, setSyncUsername] = useState('');
    const [syncToken, setSyncToken] = useState('');
    const [syncBranch, setSyncBranch] = useState('');
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncSaving, setSyncSaving] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [syncStatus, setSyncStatus] = useState(null);
    const [syncConfigExpanded, setSyncConfigExpanded] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const cfg = await readConfig();
                if (cfg.sync) {
                    setSyncRemoteUrl(cfg.sync.remoteUrl || '');
                    setSyncUsername(cfg.sync.username || '');
                    setSyncToken(cfg.sync.token || '');
                    setSyncBranch(cfg.sync.branch || '');
                }
            } catch (e) {
                console.error('Failed to load sync settings:', e);
            }
        }
        loadData();
    }, []);

    // Save sync settings when changed
    useEffect(() => {
        const saveSyncSettings = async () => {
            if (!syncRemoteUrl && !syncUsername && !syncToken) return;

            setSyncSaving(true);
            try {
                await updateConfig({
                    sync: {
                        remoteUrl: syncRemoteUrl,
                        username: syncUsername,
                        token: syncToken,
                        branch: syncBranch
                    }
                });
            } catch (e) {
                console.error('Failed to save sync settings:', e);
            } finally {
                setTimeout(() => setSyncSaving(false), 500);
            }
        };

        const debounce = setTimeout(saveSyncSettings, 1000);
        return () => clearTimeout(debounce);
    }, [syncRemoteUrl, syncUsername, syncToken, syncBranch]);

    const formatErrorMessage = (err) => {
        if (typeof err === 'string') return err;
        if (err.message) return err.message;
        return JSON.stringify(err);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-lg font-semibold mb-2 text-app-text">Git Sync</h2>
                <p className="text-sm text-app-muted mb-6">
                    Sync your workspace across devices using Git (GitHub, GitLab, etc.). Free forever!
                </p>
            </div>

            {/* Check if sync is configured */}
            {(!syncRemoteUrl || !syncUsername || !syncToken) ? (
                /* Setup Mode - Show when not configured */
                <>
                    <section className="p-4 bg-app-panel border border-app-border rounded-md">
                        <h3 className="text-sm font-medium text-app-text mb-2">Setup Instructions</h3>
                        <ol className="text-xs text-app-muted space-y-2 list-decimal list-inside mb-4">
                            <li>Create a private repository on GitHub or GitLab</li>
                            <li>Generate a Personal Access Token with repo permissions</li>
                            <li>Click "Initialize Git" below, then fill in your repository details</li>
                        </ol>

                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!workspacePath) {
                                        alert('Workspace path not available. Please reopen Preferences from the workspace.');
                                        return;
                                    }
                                    setSyncLoading(true);
                                    try {
                                        const result = await invoke('git_init', { workspacePath });
                                        alert(result);
                                    } catch (err) {
                                        alert('Git init failed: ' + err);
                                    }
                                    setSyncLoading(false);
                                }}
                                disabled={syncLoading || !workspacePath}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-app-accent text-app-accent-fg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-opacity"
                            >
                                <GitBranch className="w-4 h-4" />
                                Initialize Git
                            </button>
                        </div>
                    </section>

                    {/* Saving Indicator */}
                    {syncSaving && (
                        <div className="flex items-center gap-2 text-xs text-app-muted">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                        </div>
                    )}

                    {/* Configuration Form */}
                    <section className="space-y-4">
                        {/* Repository Section */}
                        <div className="p-4 bg-app-panel border border-app-border rounded-md">
                            <h4 className="text-sm font-semibold mb-3">Repository</h4>
                            <div>
                                <label className="block text-sm text-app-muted mb-2">
                                    Remote URL <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={syncRemoteUrl}
                                    onChange={(e) => setSyncRemoteUrl(e.target.value)}
                                    placeholder="https://github.com/username/repo.git"
                                    className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                                />
                                <p className="text-xs text-app-muted mt-1">Example: https://github.com/username/repo.git</p>
                                {!syncRemoteUrl && (
                                    <p className="text-xs text-red-500 mt-1">Remote URL is required</p>
                                )}
                            </div>
                        </div>

                        {/* Authentication Section */}
                        <div className="p-4 bg-app-panel border border-app-border rounded-md">
                            <h4 className="text-sm font-semibold mb-3">Authentication</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-app-muted mb-2">
                                        Username <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={syncUsername}
                                        onChange={(e) => setSyncUsername(e.target.value)}
                                        placeholder="github-username"
                                        className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                                    />
                                    <p className="text-xs text-app-muted mt-2">Your GitHub/GitLab username (not display name)</p>
                                    {!syncUsername && (
                                        <p className="text-xs text-red-500 mt-1">Username is required</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm text-app-muted mb-2">
                                        Personal Access Token <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={syncToken}
                                        onChange={(e) => setSyncToken(e.target.value)}
                                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                        className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent font-mono text-sm"
                                    />
                                    <p className="text-xs text-app-muted mt-2">
                                        GitHub: Settings → Developer settings → Personal access tokens → Generate new token (classic)<br />
                                        Required scopes: <code className="bg-app-bg px-1 py-0.5 rounded">repo</code>
                                    </p>
                                    {!syncToken && (
                                        <p className="text-xs text-red-500 mt-1">Token is required for Git operations</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Branch Section */}
                        <div className="p-4 bg-app-panel border border-app-border rounded-md">
                            <h4 className="text-sm font-semibold mb-3">Branch</h4>
                            <div>
                                <label className="block text-sm text-app-muted mb-2">Branch Name</label>
                                <input
                                    type="text"
                                    value={syncBranch}
                                    onChange={(e) => setSyncBranch(e.target.value)}
                                    placeholder="main"
                                    className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                                />
                                <p className="text-xs text-app-muted mt-1">Auto-detected from Git repository</p>
                            </div>
                        </div>

                        <button
                            onClick={async () => {
                                if (!workspacePath) {
                                    alert('Workspace path not available. Please reopen Preferences from the workspace.');
                                    return;
                                }
                                if (!syncRemoteUrl) {
                                    alert('Please enter a remote URL first.');
                                    return;
                                }
                                setSyncLoading(true);
                                try {
                                    const result = await invoke('git_add_remote', {
                                        workspacePath,
                                        remoteName: 'origin',
                                        remoteUrl: syncRemoteUrl
                                    });
                                    alert(result);
                                } catch (err) {
                                    alert('Add remote failed: ' + err);
                                }
                                setSyncLoading(false);
                            }}
                            disabled={syncLoading || !workspacePath || !syncRemoteUrl}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-app-accent text-app-accent-fg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-opacity"
                        >
                            <CloudUpload className="w-4 h-4" />
                            Connect Remote Repository
                        </button>
                    </section>
                </>
            ) : (
                /* Configured Mode - Show cards */
                <>
                    {/* Configuration Card */}
                    <section className="bg-app-panel border border-app-border rounded-lg overflow-hidden">
                        <button
                            onClick={() => setSyncConfigExpanded(!syncConfigExpanded)}
                            className="w-full flex items-center justify-between p-4 hover:bg-app-bg transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                <GitBranch className="w-5 h-5 text-app-accent" />
                                <div>
                                    <h3 className="text-sm font-medium text-app-text">Git Configuration</h3>
                                    <p className="text-xs text-app-muted mt-0.5">
                                        {syncRemoteUrl.replace('https://', '').replace('.git', '')} • {syncBranch}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-app-muted">{syncConfigExpanded ? 'Collapse' : 'Expand'}</span>
                                <svg
                                    className={`w-4 h-4 text-app-muted transition-transform ${syncConfigExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {syncConfigExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-app-border pt-4">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-app-muted">Username:</span>
                                        <span className="ml-2 text-app-text">{syncUsername}</span>
                                    </div>
                                    <div>
                                        <span className="text-app-muted">Remote URL:</span>
                                        <span className="ml-2 text-app-text text-xs truncate">{syncRemoteUrl}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-app-muted">Access Token:</span>
                                        <span className="ml-2 text-app-text text-xs font-mono">
                                            {syncToken ? `${syncToken.substring(0, 4)}${'•'.repeat(20)}` : 'Not set'}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-app-muted">Author Info:</span>
                                        <span className="ml-2 text-app-text text-xs">
                                            {syncUsername || 'Lokus'} &lt;{syncUsername || 'lokus'}@users.noreply.github.com&gt;
                                        </span>
                                        <p className="text-xs text-app-muted mt-1">Auto-generated from username</p>
                                    </div>
                                </div>

                                <div className="pt-2 space-y-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                if (!workspacePath) {
                                                    alert('Workspace path not available. Please reopen Preferences from the workspace.');
                                                    return;
                                                }
                                                setSyncLoading(true);
                                                try {
                                                    const result = await invoke('git_init', { workspacePath });
                                                    alert(result);
                                                } catch (err) {
                                                    alert('Git init failed: ' + err);
                                                }
                                                setSyncLoading(false);
                                            }}
                                            disabled={syncLoading || !workspacePath}
                                            className="flex-1 px-3 py-1.5 text-sm bg-app-accent text-app-accent-fg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-opacity"
                                        >
                                            Initialize Git
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!workspacePath) {
                                                    alert('Workspace path not available. Please reopen Preferences from the workspace.');
                                                    return;
                                                }
                                                if (!syncRemoteUrl) {
                                                    alert('Please enter a remote URL first.');
                                                    return;
                                                }
                                                setSyncLoading(true);
                                                try {
                                                    const result = await invoke('git_add_remote', {
                                                        workspacePath,
                                                        remoteName: 'origin',
                                                        remoteUrl: syncRemoteUrl
                                                    });
                                                    alert(result);
                                                } catch (err) {
                                                    alert('Add remote failed: ' + err);
                                                }
                                                setSyncLoading(false);
                                            }}
                                            disabled={syncLoading || !workspacePath || !syncRemoteUrl}
                                            className="flex-1 px-3 py-1.5 text-sm bg-app-accent text-app-accent-fg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-opacity"
                                        >
                                            Connect Remote
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => {
                                            // Clear all sync settings
                                            setSyncRemoteUrl('');
                                            setSyncUsername('');
                                            setSyncToken('');
                                            setSyncConfigExpanded(false);
                                        }}
                                        className="w-full px-3 py-1.5 text-sm bg-app-bg border border-app-border hover:border-red-500 hover:text-red-500 rounded-md text-app-text transition-colors"
                                    >
                                        Delete Configuration
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Quick Sync Card */}
                    <section className="space-y-4 bg-app-panel border border-app-border rounded-lg p-4">
                        <div className="flex items-center gap-2">
                            <CloudUpload className="w-5 h-5 text-app-accent" />
                            <h3 className="text-sm font-medium text-app-text">Sync Workspace</h3>
                        </div>

                        <div>
                            <label className="block text-sm text-app-muted mb-2">Commit Message</label>
                            <input
                                type="text"
                                value={syncMessage}
                                onChange={(e) => setSyncMessage(e.target.value)}
                                placeholder="Update workspace"
                                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!workspacePath) {
                                        alert('Workspace path not available. Please reopen Preferences from the workspace.');
                                        return;
                                    }
                                    if (!syncToken) {
                                        alert('Please enter your GitHub Personal Access Token in the sync configuration.');
                                        return;
                                    }
                                    setSyncLoading(true);
                                    try {
                                        await invoke('git_pull', {
                                            workspacePath,
                                            remoteName: 'origin',
                                            branchName: syncBranch || 'main',
                                            username: syncUsername,
                                            token: syncToken
                                        });
                                        alert('Pulled successfully!');
                                    } catch (err) {
                                        const errorMessage = formatErrorMessage(err);
                                        alert(`Pull failed:\n\n${errorMessage}`);
                                    }
                                    setSyncLoading(false);
                                }}
                                disabled={syncLoading || !workspacePath || !syncToken}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-app-bg border border-app-border hover:bg-app-panel disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-app-text transition-colors"
                            >
                                <CloudOff className="w-4 h-4" />
                                Pull
                            </button>

                            <button
                                onClick={async () => {
                                    if (!workspacePath) {
                                        alert('Workspace path not available. Please reopen Preferences from the workspace.');
                                        return;
                                    }
                                    if (!syncToken) {
                                        alert('Please enter your GitHub Personal Access Token in the sync configuration.');
                                        return;
                                    }
                                    setSyncLoading(true);
                                    try {
                                        // First commit - auto-generate author info from username
                                        await invoke('git_commit', {
                                            workspacePath,
                                            message: syncMessage || 'Update workspace',
                                            authorName: syncUsername || 'Lokus',
                                            authorEmail: `${syncUsername || 'lokus'}@users.noreply.github.com`
                                        });
                                        // Then push
                                        await invoke('git_push', {
                                            workspacePath,
                                            remoteName: 'origin',
                                            branchName: syncBranch || 'main',
                                            username: syncUsername,
                                            token: syncToken
                                        });
                                        alert('Pushed successfully!');
                                        setSyncMessage('');
                                    } catch (err) {
                                        const errorMessage = formatErrorMessage(err);
                                        alert(`Push failed:\n\n${errorMessage}`);
                                    }
                                    setSyncLoading(false);
                                }}
                                disabled={syncLoading || !syncMessage || !workspacePath || !syncToken}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-app-accent text-app-accent-fg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-opacity"
                            >
                                <CloudUpload className="w-4 h-4" />
                                Commit & Push
                            </button>

                            <button
                                onClick={async () => {
                                    if (!workspacePath) {
                                        alert('Workspace path not available. Please reopen Preferences from the workspace.');
                                        return;
                                    }
                                    setSyncLoading(true);
                                    try {
                                        const status = await invoke('git_status', {
                                            workspacePath
                                        });
                                        setSyncStatus(status);
                                    } catch (err) {
                                        alert('Status check failed: ' + err);
                                    }
                                    setSyncLoading(false);
                                }}
                                disabled={syncLoading || !workspacePath}
                                className="px-4 py-2 bg-app-bg border border-app-border hover:bg-app-panel disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-app-text transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {syncStatus && (
                            <div className="p-3 bg-app-bg border border-app-border rounded-md text-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <GitBranch className="w-4 h-4 text-app-accent" />
                                    <span className="font-medium text-app-text">Status</span>
                                </div>
                                <div className="space-y-1 text-app-muted">
                                    <div>Synced: {syncStatus.is_synced ? '✓' : '✗'}</div>
                                    <div>Changes: {syncStatus.has_changes ? 'Yes' : 'No'}</div>
                                    <div>Ahead: {syncStatus.ahead} | Behind: {syncStatus.behind}</div>
                                    {syncStatus.conflicts.length > 0 && (
                                        <div className="text-red-500">Conflicts: {syncStatus.conflicts.join(', ')}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

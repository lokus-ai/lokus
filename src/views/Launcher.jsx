import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readRecents, addRecent, removeRecent, shortenPath } from "../lib/recents.js";
import { WorkspaceManager } from "../core/workspace/manager.js";
import { readGlobalVisuals, setGlobalActiveTheme } from "../core/theme/manager.js";
import LokusLogo from "../components/LokusLogo.jsx";
import { useToast } from "../components/Toast.jsx";
import { isMobile, isDesktop } from "../platform/index.js";

// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// --- Main Launcher Component ---
async function openWorkspace(path) {
  // Ensure current theme is saved globally before opening workspace
  // This fixes the issue where new workspace windows don't inherit the theme
  try {
    const visuals = await readGlobalVisuals();
    if (visuals && visuals.theme) {
      await setGlobalActiveTheme(visuals.theme);
    }
  } catch { }

  // In test mode or browser mode, transition current window to workspace
  const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
  const isTauri = typeof window !== 'undefined' && (
    (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') ||
    window.__TAURI_METADATA__ ||
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
  );

  // On mobile or in test/browser mode, use URL-based workspace transition
  if (isTestMode || !isTauri || isMobile()) {
    // For test mode, browser mode, or mobile, update URL to include workspace path
    const url = new URL(window.location);
    url.searchParams.set('workspacePath', encodeURIComponent(path));
    // Keep test mode parameter if it exists
    if (isTestMode) {
      url.searchParams.set('testMode', 'true');
    }
    window.history.replaceState({}, '', url.toString());
    // Trigger a page reload to activate workspace mode
    window.location.reload();
  } else {
    // Desktop Tauri mode - replace current window with workspace (VSCode-style)
    // This prevents duplicate windows and follows industry standard UX
    await invoke("open_workspace_window", { workspacePath: path });
  }
}

export default function Launcher() {
  const [recents, setRecents] = useState([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [reauthWorkspace, setReauthWorkspace] = useState(null); // { path, name } of workspace needing re-auth
  const toast = useToast();

  useEffect(() => {
    // The ThemeProvider now handles initial theme loading.
    setRecents(readRecents());

    // Listen for open workspace menu events
    const isTauri = typeof window !== 'undefined' && (
      (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') ||
      window.__TAURI_METADATA__ ||
      (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
    );

    const unlistenPromise = isTauri
      ? listen("lokus:open-workspace", () => {
          // Already showing the launcher/welcome screen, so just log
        })
      : Promise.resolve(() => {});

    return () => {
      unlistenPromise.then(unlisten => {
        if (typeof unlisten === 'function') unlisten();
      }).catch(() => {});
    };
  }, []);

  const handleSelectWorkspace = async () => {
    // On mobile, we can't use native file dialogs - create workspace in app documents
    if (isMobile()) {
      await handleCreateMobileWorkspace();
      return;
    }

    // Desktop: use native file dialog
    const p = await open({ directory: true, defaultPath: await homeDir() });
    if (p) {
      // Validate workspace before proceeding
      const isValid = await WorkspaceManager.validatePath(p);
      if (isValid) {
        addRecent(p);
        setRecents(readRecents());
        await WorkspaceManager.saveWorkspacePath(p);
        await openWorkspace(p);
      } else {
        toast.error("The selected folder cannot be used as a workspace. Please check permissions and try again.");
      }
    }
  };

  const handleCreateMobileWorkspace = async () => {
    try {
      // On mobile, create a default workspace in app's document directory
      const { appDataDir } = await import("@tauri-apps/api/path");
      const { mkdir, exists } = await import("@tauri-apps/plugin-fs");

      const appDir = await appDataDir();
      const workspaceName = `Notes-${Date.now()}`;
      const workspacePath = `${appDir}workspaces/${workspaceName}`;

      // Create the workspace directory
      const workspacesDir = `${appDir}workspaces`;
      if (!(await exists(workspacesDir))) {
        await mkdir(workspacesDir, { recursive: true });
      }
      await mkdir(workspacePath, { recursive: true });

      // Create a welcome note
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(`${workspacePath}/Welcome.md`, `# Welcome to Lokus

This is your new mobile workspace. Start taking notes!

## Getting Started

- Tap the **+** button to create new notes
- Use **markdown** formatting for rich text
- Your notes are stored locally on your device
`);

      addRecent(workspacePath);
      setRecents(readRecents());
      await WorkspaceManager.saveWorkspacePath(workspacePath);
      await openWorkspace(workspacePath);
    } catch (error) {
      console.error("Failed to create mobile workspace:", error);
      toast.error("Failed to create workspace. Please try again.");
    }
  };

  const handleOpenExistingMobileWorkspace = async () => {
    // On mobile, show list of existing workspaces in app directory
    if (recents.length > 0) {
      // If there are recent workspaces, open the most recent one
      await onRecent(recents[0].path);
    } else {
      toast.info("No existing workspaces found. Create a new one to get started!");
    }
  };

  const onRecent = async (path) => {
    // Validate recent workspace before opening
    const isValid = await WorkspaceManager.validatePath(path);
    if (isValid) {
      addRecent(path);
      setRecents(readRecents());
      await WorkspaceManager.saveWorkspacePath(path);
      await openWorkspace(path);
    } else {
      // Check if this is a permission issue (needs re-auth) vs actually deleted
      const needsReauth = await WorkspaceManager.checkNeedsReauth(path);
      if (needsReauth) {
        // Workspace exists but permission lost (e.g., after app update)
        const name = path.split('/').pop() || 'Workspace';
        setReauthWorkspace({ path, name });
      } else {
        // Actually deleted or moved
        toast.error("This workspace is no longer accessible. It may have been moved or deleted.");
        removeRecent(path);
        setRecents(readRecents());
      }
    }
  };

  const handleReauthorize = async () => {
    if (!reauthWorkspace) return;

    // Open folder picker - user needs to re-select the folder to grant permission
    const selected = await open({
      directory: true,
      defaultPath: reauthWorkspace.path,
      title: `Re-authorize access to "${reauthWorkspace.name}"`
    });

    if (selected) {
      // User selected a folder - this grants new permission
      const isValid = await WorkspaceManager.validatePath(selected);
      if (isValid) {
        addRecent(selected);
        setRecents(readRecents());
        await WorkspaceManager.saveWorkspacePath(selected);
        setReauthWorkspace(null);
        await openWorkspace(selected);
      } else {
        toast.error("The selected folder cannot be used as a workspace.");
      }
    }
  };

  const handleCancelReauth = () => {
    setReauthWorkspace(null);
  };

  const handleRemoveStaleWorkspace = () => {
    if (reauthWorkspace) {
      removeRecent(reauthWorkspace.path);
      setRecents(readRecents());
      setReauthWorkspace(null);
    }
  };

  const onRemoveRecent = (e, path) => {
    e.stopPropagation();
    removeRecent(path);
    setRecents(readRecents());
  };

  // Mobile-specific layout
  if (isMobile()) {
    return (
      <div className="h-full bg-app-bg text-app-text flex flex-col safe-area-inset transition-colors duration-300">
        {/* Mobile Header */}
        <div className="flex flex-col items-center pt-12 pb-6 px-6">
          <LokusLogo className="w-16 h-16 mb-3" />
          <h1 className="text-3xl font-bold tracking-tight">Lokus</h1>
          <p className="text-sm text-app-muted mt-1">Your local-first notes</p>
        </div>

        {/* Mobile Action Buttons */}
        <div className="px-4 space-y-3">
          <button
            onClick={handleCreateMobileWorkspace}
            className="w-full p-4 flex items-center gap-4 rounded-2xl bg-app-accent text-app-accent-fg active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-app-accent-fg/20 flex items-center justify-center">
              <Icon path="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-base">Create New Workspace</div>
              <div className="text-xs opacity-80 mt-0.5">Start fresh with a new notes folder</div>
            </div>
            <Icon path="M8.25 4.5l7.5 7.5-7.5 7.5" className="w-5 h-5 opacity-60" />
          </button>

          {recents.length > 0 && (
            <button
              onClick={handleOpenExistingMobileWorkspace}
              className="w-full p-4 flex items-center gap-4 rounded-2xl bg-app-panel border border-app-border active:scale-[0.98] transition-transform"
            >
              <div className="w-11 h-11 rounded-xl bg-app-accent/10 flex items-center justify-center">
                <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-5 h-5 text-app-accent" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-base text-app-text">Open Recent</div>
                <div className="text-xs text-app-muted mt-0.5">Continue where you left off</div>
              </div>
              <Icon path="M8.25 4.5l7.5 7.5-7.5 7.5" className="w-5 h-5 text-app-muted" />
            </button>
          )}
        </div>

        {/* Mobile Recent Workspaces List */}
        {recents.length > 0 && (
          <div className="flex-1 mt-6 px-4 overflow-auto">
            <h2 className="text-sm font-medium text-app-muted mb-3 px-1">Recent Workspaces</h2>
            <div className="space-y-2">
              {recents.map((r) => (
                <div
                  key={r.path}
                  onClick={() => onRecent(r.path)}
                  className="p-4 rounded-xl bg-app-panel/50 border border-app-border active:bg-app-panel transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-app-accent/10 flex items-center justify-center flex-shrink-0">
                      <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-5 h-5 text-app-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-app-text truncate">{r.name}</div>
                      <div className="text-xs text-app-muted truncate mt-0.5">
                        {shortenPath(r.path, 40)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => onRemoveRecent(e, r.path)}
                      className="p-2 rounded-lg active:bg-red-500/20 text-app-muted"
                    >
                      <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for no recents */}
        {recents.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-app-accent/10 flex items-center justify-center mb-4">
              <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="w-10 h-10 text-app-muted" />
            </div>
            <div className="text-app-muted font-medium">No workspaces yet</div>
            <div className="text-app-muted/70 text-sm mt-1">Create your first workspace to start taking notes</div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout (original)
  return (
    <div className="h-full bg-app-bg text-app-text flex items-center justify-center p-8 transition-colors duration-300">
      {/* Test Mode Indicator */}
      {isTestMode && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-md text-sm font-medium z-50">
          Test Mode Active
        </div>
      )}

      {/* Re-authorization Dialog */}
      {reauthWorkspace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-app-panel border border-app-border rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-app-text">Re-authorize Workspace</h3>
                <p className="text-sm text-app-muted mt-1">
                  Access to <span className="font-medium text-app-text">"{reauthWorkspace.name}"</span> has been lost, possibly due to an app update.
                </p>
                <p className="text-sm text-app-muted mt-2">
                  Please re-select the folder to restore access.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReauthorize}
                className="flex-1 px-4 py-2.5 bg-app-accent text-app-accent-fg rounded-lg hover:bg-app-accent/90 transition-colors font-medium"
              >
                Re-select Folder
              </button>
              <button
                onClick={handleRemoveStaleWorkspace}
                className="px-4 py-2.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Remove
              </button>
              <button
                onClick={handleCancelReauth}
                className="px-4 py-2.5 bg-app-bg border border-app-border rounded-lg hover:bg-app-panel transition-colors text-app-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-app-text mb-4">Recently Opened</h2>
          <div className="bg-app-panel/50 border border-app-border rounded-xl p-3 space-y-2 flex-1 min-h-[300px]">
            {recents.length > 0 ? (
              recents.map((r) => (
                <div
                  key={r.path}
                  onClick={() => onRecent(r.path)}
                  className="w-full text-left p-4 rounded-lg hover:bg-app-bg hover:border-app-accent border border-transparent transition-all duration-200 group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-app-accent/10 flex items-center justify-center flex-shrink-0">
                      <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-4 h-4 text-app-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-app-text group-hover:text-app-text truncate">{r.name}</div>
                      <div className="text-xs text-app-muted group-hover:text-app-text/70 transition-colors truncate">
                        {shortenPath(r.path, 50)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => onRemoveRecent(e, r.path)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-500 transition-all duration-200"
                      title="Remove from recents"
                    >
                      <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-app-accent/10 flex items-center justify-center mb-4">
                  <Icon path="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" className="w-8 h-8 text-app-muted" />
                </div>
                <div className="text-app-muted text-sm">No recent workspaces</div>
                <div className="text-app-muted/70 text-xs mt-1">Create or open a workspace to get started</div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-center md:text-left">
            <div className="mb-4">
              <LokusLogo className="w-20 h-20 mx-auto md:mx-0" />
            </div>
            <h1 className="text-6xl font-bold tracking-tighter">Lokus</h1>
            <p className="mt-2 text-app-muted">Your local-first notes workspace.</p>
          </div>
          <div className="mt-8 space-y-4">
            <button
              onClick={handleSelectWorkspace}
              className="w-full text-left p-5 flex items-center gap-4 rounded-xl bg-app-panel hover:bg-app-accent hover:text-app-accent-fg border border-app-border hover:border-app-accent transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-lg bg-app-accent/10 group-hover:bg-app-accent-fg/20 flex items-center justify-center transition-colors">
                <Icon path="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg group-hover:text-app-accent-fg">Create New Workspace</div>
                <div className="text-sm text-app-muted group-hover:text-app-accent-fg/80 mt-1">Start fresh with a new folder for your notes and ideas</div>
              </div>
            </button>

            <button
              onClick={handleSelectWorkspace}
              className="w-full text-left p-5 flex items-center gap-4 rounded-xl bg-app-panel hover:bg-app-accent hover:text-app-accent-fg border border-app-border hover:border-app-accent transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-lg bg-app-accent/10 group-hover:bg-app-accent-fg/20 flex items-center justify-center transition-colors">
                <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg group-hover:text-app-accent-fg">Open Existing Workspace</div>
                <div className="text-sm text-app-muted group-hover:text-app-accent-fg/80 mt-1">Continue working with an existing folder of notes</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
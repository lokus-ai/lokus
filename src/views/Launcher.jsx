import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readRecents, addRecent, removeRecent, shortenPath } from "../lib/recents.js";
import { WorkspaceManager } from "../core/workspace/manager.js";
import LokusLogo from "../components/LokusLogo.jsx";

// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// --- Main Launcher Component ---
async function openWorkspace(path) {
  // In test mode or browser mode, transition current window to workspace
  const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
  const isTauri = typeof window !== 'undefined' && (
    (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') ||
    window.__TAURI_METADATA__ ||
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
  );
  
  if (isTestMode || !isTauri) {
    // For test mode or browser mode, update URL to include workspace path
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
    // Normal Tauri mode - open new window
    await invoke("open_workspace_window", { workspacePath: path });
  }
}

export default function Launcher() {
  const [recents, setRecents] = useState([]);
  const [isTestMode, setIsTestMode] = useState(false);

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
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []);

  const handleSelectWorkspace = async () => {
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
        // Could show user error message here
        alert("The selected folder cannot be used as a workspace. Please check permissions and try again.");
      }
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
      // Could show user message and remove from recents
      alert("This workspace is no longer accessible. It may have been moved or deleted.");
      // Optionally remove from recents here
    }
  };

  const onRemoveRecent = (e, path) => {
    e.stopPropagation();
    removeRecent(path);
    setRecents(readRecents());
  };

  return (
    <div className="h-screen bg-app-bg text-app-text flex items-center justify-center p-8 transition-colors duration-300">
      {/* Test Mode Indicator */}
      {isTestMode && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-md text-sm font-medium z-50">
          🧪 Test Mode Active
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
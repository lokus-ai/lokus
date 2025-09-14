import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { readRecents, addRecent, shortenPath } from "../lib/recents.js";
import { testWorkspaceManager } from "../utils/test-workspace.js";

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
    
    // Check for test mode and auto-create workspace
    const initializeTestMode = async () => {
      if (testWorkspaceManager.detectTestMode()) {
        setIsTestMode(true);
        console.log('🧪 Test mode activated');
        
        try {
          // Create test workspace with files
          const testWorkspacePath = await testWorkspaceManager.createTestWorkspace();
          
          if (testWorkspacePath) {
            console.log('📁 Test workspace created, opening...');
            
            // Add to recents for consistency
            addRecent(testWorkspacePath);
            setRecents(readRecents());
            
            // Open the test workspace
            await openWorkspace(testWorkspacePath);
          }
        } catch (error) {
          console.error('❌ Failed to create test workspace:', error);
          console.log('This is normal in web mode - continuing with mock setup');
        }
      }
    };
    
    // Small delay to ensure app is ready
    setTimeout(initializeTestMode, 500);
  }, []);

  const handleSelectWorkspace = async () => {
    const p = await open({ directory: true, defaultPath: await homeDir() });
    if (p) {
      addRecent(p);
      setRecents(readRecents());
      await openWorkspace(p);
    }
  };

  const onRecent = async (path) => {
    addRecent(path);
    setRecents(readRecents());
    await openWorkspace(path);
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
          <h2 className="text-sm font-semibold text-app-muted px-3">Recently Opened</h2>
          <div className="mt-3 bg-app-panel/50 border border-app-border rounded-lg p-2 space-y-1 flex-1">
            {recents.length > 0 ? (
              recents.map((r) => (
                <button
                  key={r.path}
                  onClick={() => onRecent(r.path)}
                  className="w-full text-left p-3 rounded-md hover:bg-app-bg transition-colors group"
                >
                  <div className="font-medium text-app-text">{r.name}</div>
                  <div className="text-xs text-app-muted group-hover:text-app-text/80 transition-colors">
                    {shortenPath(r.path, 40)}
                  </div>
                </button>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-app-muted">
                No recent workspaces
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-center md:text-left">
            <h1 className="text-6xl font-bold tracking-tighter">Lokus</h1>
            <p className="mt-2 text-app-muted">Your local-first notes workspace.</p>
          </div>
          <div className="mt-8 space-y-3">
            <button
              onClick={handleSelectWorkspace}
              className="w-full text-left p-4 flex items-center gap-4 rounded-lg bg-app-panel hover:bg-app-accent hover:text-app-accent-fg border border-app-border transition-colors"
            >
              <Icon path="M12 4.5v15m7.5-7.5h-15" />
              <div>
                <div className="font-semibold">Create Workspace</div>
                <div className="text-sm text-app-muted">Create a new folder for your notes.</div>
              </div>
            </button>
            <button
              onClick={handleSelectWorkspace}
              className="w-full text-left p-4 flex items-center gap-4 rounded-lg bg-app-panel hover:bg-app-accent hover:text-app-accent-fg border border-app-border transition-colors"
            >
              <Icon path="M3.75 9.75h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5M2.25 19.5h19.5M2.25 4.5h19.5" />
              <div>
                <div className="font-semibold">Open Workspace</div>
                <div className="text-sm text-app-muted">Open an existing folder of notes.</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

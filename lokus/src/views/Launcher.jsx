import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { readRecents, addRecent, shortenPath } from "../lib/recents.js";

// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// --- Main Launcher Component ---
async function openWorkspace(path) {
  await invoke("open_workspace_window", { workspacePath: path });
}

export default function Launcher() {
  const [recents, setRecents] = useState([]);

  useEffect(() => {
    // The ThemeProvider now handles initial theme loading.
    setRecents(readRecents());
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

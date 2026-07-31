import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import platformService from "../services/platform/PlatformService.js";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { isLauncherWindow } from "../core/window/context.js";
import { readRecents, addRecent, removeRecent, shortenPath } from "../lib/recents.js";
import { WorkspaceManager } from "../core/workspace/manager.js";
import { readGlobalVisuals, setGlobalActiveTheme } from "../core/theme/manager.js";
import LokusLogo from "../components/LokusLogo.jsx";
import { toast } from "sonner";
import { isMobile, isDesktop } from "../platform/index.js";
import { useAuth } from "../core/auth/AuthContext.jsx";
import { syncEngine } from "../core/sync/SyncEngine.js";

// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// --- Main Launcher Component ---
export async function openWorkspace(path) {
  // Ensure current theme is saved globally before opening workspace
  // This fixes the issue where new workspace windows don't inherit the theme
  try {
    const visuals = await readGlobalVisuals();
    if (visuals && visuals.theme) {
      await setGlobalActiveTheme(visuals.theme);
    }
  } catch (err) {
    console.error('Launcher: Failed to read global visuals', err);
  }

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
    // Desktop Tauri mode - open the workspace in its own real window.
    // A launcher window has served its purpose once the open succeeds, so it
    // closes itself (the close path flushes then destroys it; ExitRequested
    // keeps the app alive even if it was the last window). On invoke error we
    // stay open so the launcher remains usable.
    try {
      await invoke("open_workspace_window", { workspacePath: path });
    } catch (err) {
      // Every pick path funnels through here, so one toast covers them all.
      // Rethrow so callers (and tests) still see the failure.
      toast.error(`Failed to open workspace: ${err}`);
      throw err;
    }
    // The dedup path resolves here too (Rust focuses the existing window), so
    // the launcher closes either way.
    if (isLauncherWindow()) {
      // A rejected close (e.g. a missing core:window:allow-close capability)
      // must never be swallowed silently — an unclosed launcher leaks a window.
      try { await getCurrentWindow().close(); } catch (err) { console.error('Launcher: failed to close window after opening workspace', err); }
    }
  }
}

export default function Launcher() {
  const [recents, setRecents] = useState([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [reauthWorkspace, setReauthWorkspace] = useState(null); // { path, name } of workspace needing re-auth
  const [syncedWorkspace, setSyncedWorkspace] = useState(null); // { workspace_id, name } from cloud
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(null); // { current, total }
  const { isAuthenticated, user, isGuest } = useAuth();

  // A path is the identity of a local workspace — two folders called "Notes"
  // are only told apart by where they live. So we show it in full, just
  // collapsed against $HOME the way a shell would.
  const [home, setHome] = useState("");
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState(0);
  const filterRef = useRef(null);
  const rowRefs = useRef([]);
  const listRef = useRef(null);
  const [clipped, setClipped] = useState(false);
  const mod = platformService.getModifierSymbol();

  useEffect(() => {
    homeDir().then((h) => setHome(h.replace(/\/$/, ""))).catch(() => {});
  }, []);

  const tildify = (p) => (home && p.startsWith(home) ? "~" + p.slice(home.length) : p);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return recents;
    return recents.filter(
      (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
    );
  }, [recents, filter]);

  // Keep the cursor inside the list as it filters.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  // A row sliced through the middle of its path reads as a rendering fault, so
  // the list fades at the bottom edge — but only while it actually overflows,
  // otherwise the fade would dim a perfectly visible last row.
  useEffect(() => {
    const el = listRef.current;
    if (!el) { setClipped(false); return; }
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible.length]);

  // Check if user has a synced workspace in the cloud
  useEffect(() => {
    if (!isAuthenticated || isGuest || !user?.id) {
      setSyncedWorkspace(null);
      return;
    }
    syncEngine.getSyncedWorkspace(user.id).then(ws => {
      setSyncedWorkspace(ws);
    }).catch(() => setSyncedWorkspace(null));
  }, [isAuthenticated, isGuest, user?.id]);

  const handlePullWorkspace = async () => {
    if (!syncedWorkspace || !user?.id) return;

    const targetPath = await open({
      directory: true,
      defaultPath: await homeDir(),
      title: `Choose folder for "${syncedWorkspace.name}"`,
    });
    if (!targetPath) return;

    setPulling(true);
    try {
      await syncEngine.pullWorkspace(targetPath, user.id, (current, total) => {
        setPullProgress({ current, total });
      });
      addRecent(targetPath);
      setRecents(readRecents());
      await WorkspaceManager.saveWorkspacePath(targetPath);
      toast.success(`Pulled "${syncedWorkspace.name}" successfully!`);
      await openWorkspace(targetPath);
    } catch (err) {
      console.error('[Sync] Pull failed:', err);
      toast.error(`Failed to pull workspace: ${err.message}`);
    } finally {
      setPulling(false);
      setPullProgress(null);
    }
  };

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
      : Promise.resolve(() => { });

    return () => {
      unlistenPromise.then(unlisten => {
        if (typeof unlisten === 'function') unlisten();
      }).catch((err) => {
        console.error('Launcher: Failed to unlisten', err);
      });
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

  // The launcher is a keyboard surface: the list is ordered by recency, so the
  // number beside a row is both its rank and the chord that opens it.
  useEffect(() => {
    if (isMobile()) return;
    const onKey = (e) => {
      const accel = e.metaKey || e.ctrlKey;

      if (accel && e.key.toLowerCase() === "n") { e.preventDefault(); handleSelectWorkspace(); return; }
      if (accel && e.key.toLowerCase() === "o") { e.preventDefault(); handleSelectWorkspace(); return; }

      if (accel && /^[1-9]$/.test(e.key)) {
        const hit = visible[Number(e.key) - 1];
        if (hit) { e.preventDefault(); onRecent(hit.path); }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (visible.length === 0) return;
        e.preventDefault();
        setCursor((c) => {
          const next = e.key === "ArrowDown" ? c + 1 : c - 1;
          const wrapped = (next + visible.length) % visible.length;
          rowRefs.current[wrapped]?.focus();
          return wrapped;
        });
        return;
      }

      if (e.key === "Enter" && visible[cursor] && document.activeElement === filterRef.current) {
        e.preventDefault();
        onRecent(visible[cursor].path);
        return;
      }

      if (e.key === "Escape" && filter) { setFilter(""); return; }

      // Any bare printable key starts filtering, so you never have to aim at
      // the field first.
      if (!accel && !e.altKey && e.key.length === 1 && document.activeElement !== filterRef.current) {
        filterRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, cursor, filter]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Desktop layout
  return (
    // Height is pinned to the window rather than inherited: `h-full` depends on
    // every ancestor having a definite height, and the provider stack between
    // .app-content and here does not guarantee it. .app-root is 100vh and the
    // titlebar is a fixed 40px, so this is exact — and it's what lets the list
    // scroll internally while the header and actions stay pinned.
    <div className="h-[calc(100vh-40px)] overflow-hidden bg-app-bg text-app-text flex justify-center transition-colors duration-300">
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

      {/* Header and actions are pinned; only the list scrolls. The window is
          800x600 by default and a long recents list must never push the
          headline or the actions out of view. */}
      <div className="w-full max-w-[600px] px-10 py-9 flex flex-col h-full">
        {/* Identity as an eyebrow, not a hero — you already know which app you
            launched. The headline spends its weight on the actual job. */}
        <div className="flex-none">
          <div className="flex items-center gap-2 mb-7 text-app-muted">
            <LokusLogo className="w-[13px] h-[13px]" />
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase">Lokus</span>
          </div>

          <h1 className={`font-display text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-app-text ${recents.length ? "mb-6" : "mb-2"}`}>
            Open a workspace
          </h1>
          {/* Only worth saying on first run. Once you have workspaces you know
              what they are, and the line costs a row of the list. */}
          {recents.length === 0 && (
            <p className="text-[14px] leading-[1.6] text-app-text-secondary mb-6">
              A workspace is a folder on this machine. Nothing gets copied anywhere.
            </p>
          )}
        </div>

        {recents.length > 6 && (
          <input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or path"
            aria-label="Filter workspaces"
            className="w-full mb-5 bg-transparent border-b border-app-border focus:border-app-accent
                       outline-none py-2 text-[15px] text-app-text placeholder:text-app-muted
                       transition-colors motion-reduce:transition-none"
          />
        )}

        {visible.length > 0 ? (
          // Shrinks and scrolls when the list is long, but never grows — a
          // grown list strands the actions at the window's bottom edge with a
          // void in between.
          <ul
            ref={listRef}
            className={`min-h-0 overflow-y-auto -ml-4 pl-4 -mr-2 pr-2 ${
              clipped ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]" : ""
            }`}
          >
            {visible.map((r, i) => (
              <li key={r.path} className="border-b border-app-border/60 last:border-b-0">
                <div className="group relative flex items-center">
                  <button
                    ref={(el) => (rowRefs.current[i] = el)}
                    onClick={() => onRecent(r.path)}
                    onFocus={() => setCursor(i)}
                    className="flex-1 min-w-0 text-left py-[11px] pl-4 -ml-4 pr-16 border-l-2 border-transparent
                               hover:border-app-accent focus-visible:border-app-accent focus-visible:outline-none
                               transition-colors motion-reduce:transition-none"
                  >
                    <div className="font-display text-[15px] leading-[1.3] font-semibold text-app-text truncate">
                      {r.name}
                    </div>
                    {/* The path is code, so it's set as code. */}
                    <div className="font-mono text-[11px] leading-[1.5] text-app-muted group-hover:text-app-text-secondary
                                    truncate mt-[2px] transition-colors motion-reduce:transition-none">
                      {tildify(r.path)}
                    </div>
                  </button>

                  {/* Always visible, just quiet — a shortcut nobody discovers
                      isn't a shortcut. It brightens on hover rather than
                      appearing from nothing. */}
                  {i < 9 && (
                    <kbd className="absolute right-7 pointer-events-none select-none font-mono text-[10px]
                                    text-app-muted/45 group-hover:text-app-muted group-focus-within:text-app-muted
                                    transition-colors motion-reduce:transition-none">
                      {mod}{i + 1}
                    </kbd>
                  )}
                  <button
                    onClick={(e) => onRemoveRecent(e, r.path)}
                    aria-label={`Remove ${r.name} from this list`}
                    title="Remove from this list"
                    className="absolute right-0 p-1.5 rounded text-app-muted opacity-0
                               group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none
                               focus-visible:ring-1 focus-visible:ring-app-accent
                               hover:text-app-text transition-opacity motion-reduce:transition-none"
                  >
                    <Icon path="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] leading-[1.7] text-app-text-secondary">
            {filter
              ? <>Nothing matches “{filter}”. <button onClick={() => setFilter("")} className="text-app-accent hover:underline">Clear the filter</button> to see everything.</>
              : <>No workspaces yet. Pick any folder below — an empty one to start fresh, or one that already holds your markdown.</>}
          </p>
        )}

        {/* Actions are a footer rule, not the main event: you do this twice a
            year and open a recent workspace every other time. */}
        <div className="flex-none mt-6 pt-5 border-t border-app-border flex flex-col">
          <ActionRow onClick={handleSelectWorkspace} label="New workspace" hint={`${mod}N`}
            detail="Choose an empty folder to start in" />
          <ActionRow onClick={handleSelectWorkspace} label="Open folder…" hint={`${mod}O`}
            detail="Point Lokus at markdown you already have" />
          {syncedWorkspace && (
            <ActionRow
              onClick={handlePullWorkspace}
              disabled={pulling}
              label={pulling
                ? (pullProgress ? `Downloading ${pullProgress.current} of ${pullProgress.total} files` : "Downloading…")
                : `Download “${syncedWorkspace.name}”`}
              detail="Copy your synced workspace onto this machine"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** One action in the footer rule: label, quiet detail, optional chord. */
function ActionRow({ onClick, label, detail, hint, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group text-left py-[9px] pl-4 -ml-4 pr-2 border-l-2 border-transparent
                 hover:border-app-accent focus-visible:border-app-accent focus-visible:outline-none
                 disabled:opacity-50 disabled:hover:border-transparent
                 transition-colors motion-reduce:transition-none"
    >
      <div className="flex items-baseline gap-2.5">
        <span className="text-[14px] text-app-text">{label}</span>
        {hint && (
          <span className="font-mono text-[10px] text-app-muted/45 group-hover:text-app-muted
                           group-focus-visible:text-app-muted transition-colors motion-reduce:transition-none">
            {hint}
          </span>
        )}
      </div>
      <div className="text-[12.5px] leading-[1.5] text-app-muted mt-[1px]">{detail}</div>
    </button>
  );
}

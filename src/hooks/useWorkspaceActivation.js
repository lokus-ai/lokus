import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { WorkspaceManager } from "../core/workspace/manager.js";

/**
 * For `ws-*` windows, this hook is responsible for determining the workspace path.
 *
 * It uses a robust, multi-part strategy:
 * 1. On initial load, it immediately checks the window's URL for a `workspacePath`
 *    query parameter and validates it (URL param is primary).
 * 2. A `?forceWelcome=true` window (launcher) ALWAYS boots to the picker — it
 *    never auto-activates the saved workspace and it ignores `workspace:activate`
 *    events. forceWelcome beats the saved-path fallback.
 * 3. Only if neither URL param decides, it falls back to the saved workspace
 *    (this is how the bootstrap `main` window restores the last workspace).
 * 4. It ALSO listens for `workspace:activate` events for subsequent activations.
 * 5. All workspace paths are validated before being used.
 */
export function useWorkspaceActivation() {
  const [path, setPath] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeWorkspace = async () => {
      console.log('[WorkspaceActivation] Starting workspace initialization');

      // Try multiple times with increasing delays
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        console.log(`[WorkspaceActivation] Attempt ${attempt + 1} of 3`);

        // Strategy 1: Check URL on initial load
        const params = new URLSearchParams(window.location.search);
        const forceWelcome = params.get("forceWelcome");
        const workspacePath = params.get("workspacePath");

        console.log('[WorkspaceActivation] URL params:', { forceWelcome, workspacePath });

        // An explicit workspacePath in the URL always wins (URL param primary).
        if (workspacePath) {
          const decodedPath = decodeURIComponent(workspacePath);
          console.log('[WorkspaceActivation] Validating URL workspace path:', decodedPath);
          // Validate the URL parameter workspace path
          const isValid = await WorkspaceManager.validatePath(decodedPath);
          console.log('[WorkspaceActivation] URL path validation result:', isValid);
          if (isValid) {
            setPath(decodedPath);
            // Save for refresh recovery
            WorkspaceManager.saveWorkspacePath(decodedPath);
            setIsInitialized(true);
            console.log('[WorkspaceActivation] Using URL workspace path:', decodedPath);
            return;
          } else {
            // Invalid workspace path - clear URL param to prevent loops
            console.log('[WorkspaceActivation] Invalid workspace path, clearing URL param');
            const url = new URL(window.location);
            url.searchParams.delete('workspacePath');
            window.history.replaceState({}, '', url.toString());
            // Fall through: forceWelcome (if set) or the saved-path fallback decide next
          }
        }

        // forceWelcome beats the saved-path fallback: a launcher window always
        // boots to the picker and never auto-activates the last saved workspace.
        if (forceWelcome === "true") {
          console.log('[WorkspaceActivation] forceWelcome=true, showing launcher');
          setPath(null);
          setIsInitialized(true);
          return;
        }
      }

      // Strategy 2: Check for saved workspace if no URL parameter
      console.log('[WorkspaceActivation] No URL path, checking saved workspace');
      try {
        const validPath = await WorkspaceManager.getValidatedWorkspacePath();
        console.log('[WorkspaceActivation] Saved workspace path:', validPath);
        if (validPath) {
          setPath(validPath);
          setIsInitialized(true);
          return;
        }
      } catch (err) {
        console.error('[WorkspaceActivation] Error getting saved workspace:', err);
      }

      // Strategy 3: No valid workspace found, path remains null (shows launcher)
      console.log('[WorkspaceActivation] No valid workspace found, showing launcher');
      setIsInitialized(true);
    };

    initializeWorkspace();

    // Strategy 4: Listen for activation events (including initial ones from window creation)
    let isTauri = false; 
    try {
      const w = window;
      isTauri = !!(
        (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
        w.__TAURI_METADATA__ ||
        (navigator?.userAgent || '').includes('Tauri')
      );
    } catch {}
    
    // Listen for workspace activation and force welcome events
    const unlistenWorkspacePromise = isTauri
      ? listen("workspace:activate", async (event) => {
          // A forced-launcher window (?forceWelcome=true with no explicit
          // workspacePath) must never auto-activate a workspace, even if a
          // broadcast `workspace:activate` event reaches it.
          const params = new URLSearchParams(window.location.search);
          if (params.get("forceWelcome") === "true" && !params.get("workspacePath")) {
            console.log('[WorkspaceActivation] Ignoring workspace:activate on a forceWelcome window');
            return;
          }
          const p = event.payload;
          if (typeof p === 'string' && p) {
            // Validate the activated workspace path
            const isValid = await WorkspaceManager.validatePath(p);
            if (isValid) {
              setPath(p);
              // Save for refresh recovery
              WorkspaceManager.saveWorkspacePath(p);
              setIsInitialized(true);
            }
          }
        })
      : Promise.resolve(() => {});

    const unlistenForceWelcomePromise = isTauri
      ? listen("lokus:force-welcome", () => {
          setPath(null);
          setIsInitialized(true);
        })
      : Promise.resolve(() => {});

    return () => {
      unlistenWorkspacePromise.then(unlisten => {
        if (typeof unlisten === 'function') unlisten();
      }).catch(() => {});
      unlistenForceWelcomePromise.then(unlisten => {
        if (typeof unlisten === 'function') unlisten();
      }).catch(() => {});
    };
  }, []); // Runs once on component mount.

  return path;
}
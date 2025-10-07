import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { WorkspaceManager } from "../core/workspace/manager.js";

/**
 * For `ws-*` windows, this hook is responsible for determining the workspace path.
 *
 * It uses a robust, multi-part strategy:
 * 1. On initial load, it immediately checks the window's URL for a `workspacePath`
 *    query parameter and validates it.
 * 2. If no URL parameter, checks for a saved workspace and validates it.
 * 3. It ALSO listens for `workspace:activate` events for subsequent activations.
 * 4. All workspace paths are validated before being used.
 */
export function useWorkspaceActivation() {
  const [path, setPath] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeWorkspace = async () => {
      // Try multiple times with increasing delays
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        
        // Strategy 1: Check URL on initial load
        const params = new URLSearchParams(window.location.search);
        const forceWelcome = params.get("forceWelcome");
        const workspacePath = params.get("workspacePath");

        // If forceWelcome is set, skip workspace loading and show launcher
        if (forceWelcome === "true") {
          setPath(null);
          setIsInitialized(true);
          return;
        }

        if (workspacePath) {
          const decodedPath = decodeURIComponent(workspacePath);
          // Validate the URL parameter workspace path
          const isValid = await WorkspaceManager.validatePath(decodedPath);
          if (isValid) {
            setPath(decodedPath);
            setIsInitialized(true);
            return;
          }
        }
      }

      // Strategy 2: Check for saved workspace if no URL parameter
      try {
        const validPath = await WorkspaceManager.getValidatedWorkspacePath();
        if (validPath) {
          setPath(validPath);
          setIsInitialized(true);
          return;
        }
      } catch (error) {
      }

      // Strategy 3: No valid workspace found, path remains null (shows launcher)
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
          const p = event.payload;
          if (typeof p === 'string' && p) {
            // Validate the activated workspace path
            const isValid = await WorkspaceManager.validatePath(p);
            if (isValid) {
              setPath(p);
              setIsInitialized(true);
            } else {
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
      unlistenWorkspacePromise.then(unlisten => unlisten());
      unlistenForceWelcomePromise.then(unlisten => unlisten());
    };
  }, []); // Runs once on component mount.

  return path;
}
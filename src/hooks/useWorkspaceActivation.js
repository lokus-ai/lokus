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

  useEffect(() => {
    const initializeWorkspace = async () => {
      // Strategy 1: Check URL on initial load
      const params = new URLSearchParams(window.location.search);
      const workspacePath = params.get("workspacePath");
      
      if (workspacePath) {
        const decodedPath = decodeURIComponent(workspacePath);
        // Validate the URL parameter workspace path
        const isValid = await WorkspaceManager.validatePath(decodedPath);
        if (isValid) {
          setPath(decodedPath);
          return;
        } else {
          console.warn("Invalid workspace path from URL parameter:", decodedPath);
        }
      }

      // Strategy 2: Check for saved workspace if no URL parameter
      try {
        const validPath = await WorkspaceManager.getValidatedWorkspacePath();
        if (validPath) {
          setPath(validPath);
          return;
        }
      } catch (error) {
        console.error("Failed to get validated workspace path:", error);
      }

      // Strategy 3: No valid workspace found, path remains null (shows launcher)
      console.log("No valid workspace found, launcher will be shown");
    };

    initializeWorkspace();

    // Strategy 4: Listen for subsequent activation events
    let isTauri = false; 
    try {
      const w = window;
      isTauri = !!(
        (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
        w.__TAURI_METADATA__ ||
        (navigator?.userAgent || '').includes('Tauri')
      );
    } catch {}
    
    const unlistenPromise = isTauri
      ? listen("workspace:activate", async (event) => {
          const p = event.payload;
          if (typeof p === 'string' && p) {
            // Validate the activated workspace path
            const isValid = await WorkspaceManager.validatePath(p);
            if (isValid) {
              setPath(p);
            } else {
              console.warn("Invalid workspace path from activation event:", p);
            }
          }
        })
      : Promise.resolve(() => {});

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []); // Runs once on component mount.

  return path;
}

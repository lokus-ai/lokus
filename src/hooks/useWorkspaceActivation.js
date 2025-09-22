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
        
        // Debug: Check current URL
        console.log(`[Attempt ${attempt + 1}] Current URL:`, window.location.href);
        console.log(`[Attempt ${attempt + 1}] Current search:`, window.location.search);
        
        // Strategy 1: Check URL on initial load
        const params = new URLSearchParams(window.location.search);
        const workspacePath = params.get("workspacePath");
        console.log(`[Attempt ${attempt + 1}] Workspace path from URL:`, workspacePath);
      
        if (workspacePath) {
          const decodedPath = decodeURIComponent(workspacePath);
          console.log("Decoded path:", decodedPath);
          // Validate the URL parameter workspace path
          const isValid = await WorkspaceManager.validatePath(decodedPath);
          console.log("Is valid:", isValid);
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
        console.log("Error getting validated workspace path:", error);
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
    
    const unlistenPromise = isTauri
      ? listen("workspace:activate", async (event) => {
          console.log("Received workspace:activate event:", event);
          const p = event.payload;
          if (typeof p === 'string' && p) {
            // Validate the activated workspace path
            const isValid = await WorkspaceManager.validatePath(p);
            if (isValid) {
              console.log("Setting path from workspace:activate event:", p);
              setPath(p);
              setIsInitialized(true);
            } else {
              console.log("Invalid path from workspace:activate event:", p);
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
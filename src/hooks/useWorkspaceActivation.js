import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * For `ws-*` windows, this hook is responsible for determining the workspace path.
 *
 * It uses a robust, two-part strategy:
 * 1. On initial load, it immediately checks the window's URL for a `workspacePath`
 *    query parameter. This is the reliable way to get the path when the window is first created.
 * 2. It ALSO listens for `workspace:activate` events. This is for the case where the
 *    window is already open and the user tries to open the same workspace again,
 *    in which case we just want to focus the existing window and ensure it has the path.
 */
export function useWorkspaceActivation() {
  const [path, setPath] = useState(null);

  useEffect(() => {
    // Strategy 1: Check URL on initial load.
    const params = new URLSearchParams(window.location.search);
    const workspacePath = params.get("workspacePath");
    if (workspacePath) {
      setPath(decodeURIComponent(workspacePath));
    }

    // Strategy 2: Listen for subsequent activation events.
    let isTauri = false; try {
      const w = window;
      isTauri = !!(
        (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
        w.__TAURI_METADATA__ ||
        (navigator?.userAgent || '').includes('Tauri')
      );
    } catch {}
    const unlistenPromise = isTauri
      ? listen("workspace:activate", (event) => {
          const p = event.payload;
          if (typeof p === 'string' && p) setPath(p);
        })
      : Promise.resolve(() => {});

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []); // Runs once on component mount.

  return path;
}

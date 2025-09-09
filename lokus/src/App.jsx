import { useEffect } from "react";
import Launcher from "./views/Launcher";
import Workspace from "./views/Workspace";
import Preferences from "./views/Preferences";
import { usePreferenceActivation } from "./hooks/usePreferenceActivation";
import { useWorkspaceActivation } from "./hooks/useWorkspaceActivation";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
// Guard window access in non-Tauri environments
import { emit } from "@tauri-apps/api/event";

function App() {
  // Use the hooks' values directly (no setter param expected)
  const { isPrefsOpen, setPrefsOpen } = usePreferenceActivation();
  const activePath = useWorkspaceActivation();

  useEffect(() => {
    let isSubscribed = true;
    const setupShortcuts = async () => {
      try {
        // Skip if not running inside Tauri (e.g., vite preview)
        const isTauri = typeof window !== 'undefined' && (
          // v2
          (window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__)
        );
        if (!isTauri) return;

        // Access current window lazily via global provided by Tauri v2
        // Avoid importing plugin-window alpha API to reduce coupling
        const { getCurrent } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrent();

        const registerAppShortcuts = async () => {
          await unregisterAll();
          await register("CommandOrControl+S", () => emit("lokus:save-file"));
          await register("CommandOrControl+W", () => emit("lokus:close-tab"));
        };

        const unlistenFocus = await currentWindow.listen("tauri://focus", () => {
          if (isSubscribed) registerAppShortcuts();
        });
        const unlistenBlur = await currentWindow.listen("tauri://blur", () => {
          if (isSubscribed) unregisterAll();
        });

        if (await currentWindow.isFocused()) {
          registerAppShortcuts();
        }
        
        return () => {
          unlistenFocus();
          unlistenBlur();
        };
      } catch (e) {
        console.error("Failed to initialize shortcuts:", e);
      }
    };

    const unlistenPromise = setupShortcuts();

    return () => {
      isSubscribed = false;
      unregisterAll();
      unlistenPromise.then(unlisten => {
        if (typeof unlisten === 'function') unlisten();
      });
    };
  }, []);

  if (isPrefsOpen) {
    return <Preferences onClose={() => setPrefsOpen(false)} />;
  }

  if (activePath) {
    return <Workspace initialPath={activePath} />;
  }

  return <Launcher />;
}

export default App;

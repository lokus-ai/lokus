import { useEffect } from "react";
import Launcher from "./views/Launcher";
import Workspace from "./views/Workspace";
import Preferences from "./views/Preferences";
import { usePreferenceActivation } from "./hooks/usePreferenceActivation";
import { useWorkspaceActivation } from "./hooks/useWorkspaceActivation";
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from "./core/shortcuts/registry.js";
import { PluginProvider } from "./hooks/usePlugins.jsx";
// Import workspace manager to expose developer utilities
import "./core/workspace/manager.js";
// Guard window access in non-Tauri environments
import { emit } from "@tauri-apps/api/event";

function App() {
  // Use the hooks' values directly (no setter param expected)
  const { isPrefsWindow } = usePreferenceActivation();
  const activePath = useWorkspaceActivation();

  useEffect(() => {
    let isSubscribed = true;
    const setupShortcuts = async () => {
      try {
        // Skip if not running inside Tauri (e.g., vite preview)
        const isTauri = typeof window !== 'undefined' && (
          (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') ||
          window.__TAURI_METADATA__ ||
          (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
        );
        if (!isTauri) return;

        const registerAppShortcuts = async () => {
          await registerGlobalShortcuts();
        };

        const onFocus = () => { if (isSubscribed) registerAppShortcuts(); };
        const onBlur = () => { if (isSubscribed) unregisterGlobalShortcuts(); };
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);

        if (document.hasFocus()) {
          registerAppShortcuts();
        }
        
        return () => {
          window.removeEventListener('focus', onFocus);
          window.removeEventListener('blur', onBlur);
        };
      } catch (e) {
      }
    };

    const unlistenPromise = setupShortcuts();

    return () => {
      isSubscribed = false;
      unregisterGlobalShortcuts();
      unlistenPromise.then(unlisten => {
        if (typeof unlisten === 'function') unlisten();
      });
    };
  }, []);

  return (
    <PluginProvider>
      {isPrefsWindow ? (
        <Preferences />
      ) : activePath ? (
        <Workspace initialPath={activePath} />
      ) : (
        <Launcher />
      )}
    </PluginProvider>
  );
}

export default App;
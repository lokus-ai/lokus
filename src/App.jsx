import { useEffect } from "react";
import Launcher from "./views/Launcher";
import Workspace from "./views/Workspace";
import Preferences from "./views/Preferences";
import { usePreferenceActivation } from "./hooks/usePreferenceActivation";
import { useWorkspaceActivation } from "./hooks/useWorkspaceActivation";
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from "./core/shortcuts/registry.js";
import { PluginProvider } from "./hooks/usePlugins.jsx";
import { AuthProvider } from "./core/auth/AuthContext.jsx";
import platformService from "./services/platform/PlatformService.js";
import { GmailProvider } from "./contexts/GmailContext.jsx";
// Import workspace manager to expose developer utilities
import "./core/workspace/manager.js";
// Import MCP client for stdio-based connections
import mcpClient from "./core/mcp/client.js";
// Guard window access in non-Tauri environments
import { emit } from "@tauri-apps/api/event";

function App() {
  // Use the hooks' values directly (no setter param expected)
  const { isPrefsWindow } = usePreferenceActivation();
  const activePath = useWorkspaceActivation();

  useEffect(() => {
    // Add platform class to document body
    if (platformService.isWindows()) {
      document.body.classList.add('windows');
      // Check if Windows 11 for additional styling
      if (navigator.userAgent.includes('Windows NT 10.0')) {
        document.body.classList.add('windows-11');
      }
    } else if (platformService.isMacOS()) {
      document.body.classList.add('macos');
    } else if (platformService.isLinux()) {
      document.body.classList.add('linux');
    }
  }, []);

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

        // MCP client is ready for configuration instructions (no server management needed)
        
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
    <AuthProvider>
      <GmailProvider>
        <PluginProvider>
          {isPrefsWindow ? (
            <Preferences />
          ) : activePath ? (
            <Workspace initialPath={activePath} />
          ) : (
            <Launcher />
          )}
        </PluginProvider>
      </GmailProvider>
    </AuthProvider>
  );
}

export default App;
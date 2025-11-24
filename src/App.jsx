import { useEffect } from "react";
import Launcher from "./views/Launcher";
import Workspace from "./views/Workspace";
import Preferences from "./views/Preferences";
import UpdateChecker from "./components/UpdateChecker";
import { usePreferenceActivation } from "./hooks/usePreferenceActivation";
import { useWorkspaceActivation } from "./hooks/useWorkspaceActivation";
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from "./core/shortcuts/registry.js";
import { PluginProvider } from "./hooks/usePlugins.jsx";
import { AuthProvider } from "./core/auth/AuthContext.jsx";
import platformService from "./services/platform/PlatformService.js";
// import { GmailProvider } from "./contexts/GmailContext.jsx"; // DISABLED: Slowing down app startup
import markdownSyntaxConfig from "./core/markdown/syntax-config.js";
import editorConfigCache from "./core/editor/config-cache.js";
// Import workspace manager to expose developer utilities
import "./core/workspace/manager.js";
// Import MCP client for stdio-based connections
import mcpClient from "./core/mcp/client.js";
// Guard window access in non-Tauri environments
import { emit } from "@tauri-apps/api/event";
import * as Sentry from "@sentry/react";

function App() {
  // Use the hooks' values directly (no setter param expected)
  const { isPrefsWindow } = usePreferenceActivation();
  const activePath = useWorkspaceActivation();
  
  console.log('🎯 App.jsx rendering');
  console.log('🎯 isPrefsWindow:', isPrefsWindow);
  console.log('🎯 activePath:', activePath);
  console.log('🎯 URL search params:', window.location.search);

  // Track view navigation with breadcrumbs
  useEffect(() => {
    if (isPrefsWindow) {
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: 'Navigated to Preferences',
        level: 'info',
      });
    } else if (activePath) {
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: 'Navigated to Workspace',
        level: 'info',
        data: { path: activePath },
      });
    } else {
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: 'Navigated to Launcher',
        level: 'info',
      });
    }
  }, [isPrefsWindow, activePath]);

  // Initialize markdown syntax config and editor config cache on app startup
  useEffect(() => {
    markdownSyntaxConfig.init();
    editorConfigCache.init(); // Pre-load editor config to eliminate "Loading editor..." delay

    // Check for updates 3 seconds after startup
    const updateTimer = setTimeout(() => {
      window.dispatchEvent(new Event('check-for-update'));
    }, 3000);

    return () => clearTimeout(updateTimer);
  }, []);

  useEffect(() => {
    // Add platform class to document body
    if (platformService.isWindows()) {
      document.body.classList.add('windows');
      // Check if Windows 11 for additional styling
      if (navigator.userAgent.includes('Windows NT 10.0')) {
        document.body.classList.add('windows-11');
      }
      Sentry.addBreadcrumb({
        category: 'platform',
        message: 'Windows platform detected',
        level: 'info',
      });
    } else if (platformService.isMacOS()) {
      document.body.classList.add('macos');
      Sentry.addBreadcrumb({
        category: 'platform',
        message: 'macOS platform detected',
        level: 'info',
      });
    } else if (platformService.isLinux()) {
      document.body.classList.add('linux');
      Sentry.addBreadcrumb({
        category: 'platform',
        message: 'Linux platform detected',
        level: 'info',
      });
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
    <div className="app-root">
      {/* Titlebar only for Workspace - Preferences and Launcher don't need it */}
      {!isPrefsWindow && activePath && (
        <div className="app-titlebar" data-tauri-drag-region></div>
      )}

      <div className="app-content">
        <AuthProvider>
          {/* GmailProvider disabled to improve startup performance */}
          {/* <GmailProvider> */}
            <PluginProvider>
              {isPrefsWindow ? (
                <Preferences />
              ) : activePath ? (
                <Workspace initialPath={activePath} />
              ) : (
                <Launcher />
              )}
            </PluginProvider>
          {/* </GmailProvider> */}
        </AuthProvider>
        <UpdateChecker />
      </div>
    </div>
  );
}

export default App;
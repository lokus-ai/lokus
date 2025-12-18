import { useEffect, lazy, Suspense } from "react";
import Launcher from "./views/Launcher";
// Lazy load heavy views
const Workspace = lazy(() => import("./views/Workspace"));
const Preferences = lazy(() => import("./views/Preferences"));

import UpdateChecker from "./components/UpdateChecker";
import { RemoteAnnouncement } from "./components/RemoteAnnouncement";
import WhatsNew from "./components/WhatsNew";
import TipOfTheDay from "./components/TipOfTheDay";
import { Toaster } from "./components/ui/toaster";
import { PluginDialogContainer } from "./components/PluginDialogContainer";
import { ProgressIndicatorContainer } from "./components/ProgressIndicator";
import { usePluginProgress } from "./hooks/usePluginProgress";
import { usePreferenceActivation } from "./hooks/usePreferenceActivation";
import { useWorkspaceActivation } from "./hooks/useWorkspaceActivation";
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from "./core/shortcuts/registry.js";
import { PluginProvider } from "./hooks/usePlugins.jsx";
import pluginStateAdapter from "./core/plugins/PluginStateAdapter.js";
import { AuthProvider } from "./core/auth/AuthContext.jsx";
import platformService from "./services/platform/PlatformService.js";
import { ToastProvider } from "./components/Toast.jsx";
import markdownSyntaxConfig from "./core/markdown/syntax-config.js";
import editorConfigCache from "./core/editor/config-cache.js";
// Import workspace manager to expose developer utilities
import "./core/workspace/manager.js";
// Import MCP client for stdio-based connections
import mcpClient from "./core/mcp/client.js";
// Guard window access in non-Tauri environments
import { emit } from "@tauri-apps/api/event";
import * as Sentry from "@sentry/react";

// Simple loading spinner for Suspense fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-app-bg text-app-text select-none">
    <div className="flex flex-col items-center gap-2 animate-pulse">
      <div className="text-4xl font-bold tracking-tight text-app-accent">Lokus</div>
    </div>
  </div>
);

function App() {
  // Use the hooks' values directly (no setter param expected)
  const { isPrefsWindow } = usePreferenceActivation();
  const activePath = useWorkspaceActivation();
  const progressItems = usePluginProgress();

  useEffect(() => {
    if (activePath) {
      pluginStateAdapter.setWorkspacePath(activePath);
    }
  }, [activePath]);

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
      } catch { }
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
      {/* Titlebar for Workspace and Launcher - enables window dragging */}
      {!isPrefsWindow && (
        <div className="app-titlebar" data-tauri-drag-region></div>
      )}

      <div className="app-content">
        <ToastProvider>
          <AuthProvider>
            <PluginProvider>
              <Suspense fallback={<LoadingFallback />}>
                {isPrefsWindow ? (
                  <Preferences />
                ) : activePath ? (
                  <Workspace initialPath={activePath} />
                ) : (
                  <Launcher />
                )}
              </Suspense>
            </PluginProvider>
          </AuthProvider>
          <UpdateChecker />
        </ToastProvider>
        <RemoteAnnouncement />
        <WhatsNew />
        {activePath && <TipOfTheDay />}
        <Toaster />
        <PluginDialogContainer />
        <ProgressIndicatorContainer progressItems={progressItems} />
      </div>
    </div>
  );
}

export default App;
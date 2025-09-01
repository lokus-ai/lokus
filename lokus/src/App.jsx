import { useEffect, useState } from "react";
import Launcher from "./views/Launcher.jsx";
import Workspace from "./views/Workspace.jsx";
import Preferences from "./views/Preferences.jsx";
import { useWorkspaceActivation } from "./hooks/useWorkspaceActivation.js";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { installDefaultThemes } from "./core/theme/manager.js";

export default function App() {
  // Install themes on first launch
  useEffect(() => {
    installDefaultThemes();
  }, []);

  const current = getCurrentWebviewWindow();
  const label = current?.label || "main";
  const activatedPath = useWorkspaceActivation(); // This hook listens for the path

  if (label === "prefs") {
    return <Preferences />;
  }

  if (label.startsWith("ws-")) {
    // CRITICAL FIX: Do not render the workspace until the path is available.
    // Render a simple loading state instead.
    if (!activatedPath) {
      return <div className="h-screen bg-app-bg text-app-text flex items-center justify-center">Loading Workspace...</div>;
    }
    return <Workspace initialPath={activatedPath} />;
  }

  // Fallback to the launcher window
  return <Launcher />;
}
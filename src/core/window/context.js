// Per-window context, resolved once at boot and cached afterwards.
// No framework dependencies — usable from any module.
//
// Every window is exactly one of:
//   - "prefs":     the singleton preferences window (label "prefs" or ?view=prefs)
//   - "workspace": a real workspace window (?workspacePath=… or a ws-* label; the
//                  path may also arrive later via the `workspace:activate` event)
//   - "launcher":  everything else (launcher-* windows, ?forceWelcome=true, and
//                  the "main" bootstrap window while it shows the welcome route)
import { getCurrentWindow } from "@tauri-apps/api/window";

let cached = null;

function resolveLabel() {
  try {
    return getCurrentWindow().label || "main";
  } catch {
    // Outside Tauri (browser / tests) there is no native window.
    return "main";
  }
}

function resolve() {
  const label = resolveLabel();

  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    params = new URLSearchParams();
  }

  const rawPath = params.get("workspacePath");
  let workspacePath = null;
  if (rawPath) {
    try {
      workspacePath = decodeURIComponent(rawPath);
    } catch {
      workspacePath = rawPath;
    }
  }

  let kind;
  if (label === "prefs" || params.get("view") === "prefs") {
    kind = "prefs";
  } else if (workspacePath || label.startsWith("ws-")) {
    kind = "workspace";
  } else {
    kind = "launcher";
  }

  return { label, kind, workspacePath };
}

export function getWindowContext() {
  if (!cached) {
    cached = resolve();
  }
  return cached;
}

export function isWorkspaceWindow() {
  return getWindowContext().kind === "workspace";
}

export function isLauncherWindow() {
  return getWindowContext().kind === "launcher";
}

export function isPrefsWindow() {
  return getWindowContext().kind === "prefs";
}

// Test-only: drop the cached context so the next getWindowContext() re-resolves.
export function __resetWindowContext() {
  cached = null;
}

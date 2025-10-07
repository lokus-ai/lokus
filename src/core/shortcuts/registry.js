import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { readConfig, updateConfig } from "../config/store.js";
import platformService from "../../services/platform/PlatformService.js";

let isTauri = false; try {
  const w = typeof window !== 'undefined' ? window : undefined;
  isTauri = !!(
    w && (
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
      w.__TAURI_METADATA__ ||
      (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
    )
  );
} catch {}

// Debug mode for shortcuts - set to false to disable verbose logging
const DEBUG_SHORTCUTS = false;

// In development, disable global shortcuts to avoid conflicts
const DISABLE_GLOBAL_SHORTCUTS_IN_DEV = false;

// CRITICAL: System shortcuts that should NEVER be registered globally
// These are essential macOS/Windows system functions
const DANGEROUS_GLOBAL_SHORTCUTS = [
  'CommandOrControl+C',  // Copy - system critical
  'CommandOrControl+V',  // Paste - system critical
  'CommandOrControl+A',  // Select All - system critical
  'CommandOrControl+X',  // Cut - system critical
  'CommandOrControl+Z',  // Undo - system critical
  'CommandOrControl+Shift+Z', // Redo - system critical
];

// Action IDs that should not be registered as global shortcuts
const NON_GLOBAL_ACTIONS = [
  'copy', 'paste', 'cut', 'select-all', 'undo', 'redo'
];

// Action catalog: add here as you grow
export const ACTIONS = [
  { id: "save-file",        name: "Save File",           event: "lokus:save-file",        default: "CommandOrControl+S" },
  { id: "new-file",         name: "New File",            event: "lokus:new-file",         default: "CommandOrControl+N" },
  { id: "new-folder",       name: "New Folder",          event: "lokus:new-folder",       default: "CommandOrControl+Shift+N" },
  { id: "toggle-sidebar",   name: "Toggle Sidebar",       event: "lokus:toggle-sidebar",   default: "CommandOrControl+B" },
  { id: "open-preferences", name: "Open Preferences",     event: "preferences:open",       default: "CommandOrControl+," },
  { id: "in-file-search",   name: "Find in Note",        event: "lokus:in-file-search",   default: "CommandOrControl+F" },
  { id: "global-search",    name: "Global Search",       event: "lokus:global-search",    default: "CommandOrControl+Shift+F" },
  { id: "command-palette",  name: "Command Palette",     event: "lokus:command-palette",  default: "CommandOrControl+K" },
  { id: "wikilink-modal",   name: "Insert WikiLink",     event: "lokus:wikilink-modal",   default: "CommandOrControl+L" },
  { id: "next-tab",         name: "Next Tab",            event: "lokus:next-tab",         default: "CommandOrControl+Alt+Right" },
  { id: "prev-tab",         name: "Previous Tab",        event: "lokus:prev-tab",         default: "CommandOrControl+Alt+Left" },
  { id: "close-tab",        name: "Close Current Tab",   event: "lokus:close-tab",        default: "CommandOrControl+W" },
  { id: "reopen-closed-tab", name: "Reopen Closed Tab",  event: "lokus:reopen-closed-tab", default: "CommandOrControl+Shift+T" },
  { id: "graph-view",       name: "Open Graph View",     event: "lokus:graph-view",       default: "CommandOrControl+Shift+G" },
  { id: "shortcut-help",    name: "Show Keyboard Shortcuts", event: "lokus:shortcut-help", default: "F1" },
  { id: "refresh-files",    name: "Refresh File Tree",   event: "lokus:refresh-files",    default: "F5" },
  { id: "new-canvas",       name: "New Canvas",          event: "lokus:new-canvas",       default: "CommandOrControl+Shift+C" },
  { id: "open-kanban",      name: "Open Kanban Board",   event: "lokus:open-kanban",      default: "CommandOrControl+Shift+K" },
  { id: "toggle-split-view", name: "Toggle Split View",   event: "lokus:toggle-split-view", default: "CommandOrControl+\\" },
  { id: "toggle-split-direction", name: "Toggle Split Direction", event: "lokus:toggle-split-direction", default: "CommandOrControl+Shift+\\" },
  { id: "reset-pane-size",  name: "Reset Pane Size",     event: "lokus:reset-pane-size",  default: "CommandOrControl+Alt+\\" },
  { id: "toggle-sync-scrolling", name: "Toggle Sync Scrolling", event: "lokus:toggle-sync-scrolling", default: "CommandOrControl+Alt+S" },
  
  // Edit menu shortcuts
  { id: "undo", name: "Undo", event: "lokus:edit-undo", default: "CommandOrControl+Z" },
  { id: "redo", name: "Redo", event: "lokus:edit-redo", default: "CommandOrControl+Shift+Z" },
  { id: "cut", name: "Cut", event: "lokus:edit-cut", default: "CommandOrControl+X" },
  { id: "copy", name: "Copy", event: "lokus:edit-copy", default: "CommandOrControl+C" },
  { id: "paste", name: "Paste", event: "lokus:edit-paste", default: "CommandOrControl+V" },
  { id: "select-all", name: "Select All", event: "lokus:edit-select-all", default: "CommandOrControl+A" },
  { id: "find-replace", name: "Find and Replace", event: "lokus:find-replace", default: "CommandOrControl+H" },
  
  // View menu shortcuts
  { id: "zoom-in", name: "Zoom In", event: "lokus:zoom-in", default: "CommandOrControl+Plus" },
  { id: "zoom-out", name: "Zoom Out", event: "lokus:zoom-out", default: "CommandOrControl+-" },
  { id: "actual-size", name: "Actual Size", event: "lokus:actual-size", default: "CommandOrControl+0" },
  { id: "toggle-fullscreen", name: "Toggle Fullscreen", event: "lokus:toggle-fullscreen", default: "F11" },
  
  // Format menu shortcuts
  { id: "format-bold", name: "Bold", event: "lokus:format-bold", default: "CommandOrControl+B" },
  { id: "format-italic", name: "Italic", event: "lokus:format-italic", default: "CommandOrControl+I" },
  { id: "format-underline", name: "Underline", event: "lokus:format-underline", default: "CommandOrControl+U" },
  { id: "format-strikethrough", name: "Strikethrough", event: "lokus:format-strikethrough", default: "CommandOrControl+Shift+X" },
  { id: "format-code", name: "Inline Code", event: "lokus:format-code", default: "CommandOrControl+E" },
  { id: "format-highlight", name: "Highlight", event: "lokus:format-highlight", default: "CommandOrControl+Shift+H" },
  
  // Insert menu shortcuts
  { id: "insert-math-inline", name: "Insert Inline Math", event: "lokus:insert-math-inline", default: "CommandOrControl+M" },
  { id: "insert-math-block", name: "Insert Math Block", event: "lokus:insert-math-block", default: "CommandOrControl+Shift+M" },
  { id: "insert-table", name: "Insert Table", event: "lokus:insert-table", default: "CommandOrControl+Shift+T" },
  { id: "insert-code-block", name: "Insert Code Block", event: "lokus:insert-code-block", default: "CommandOrControl+Shift+C" },
  
  // File menu shortcuts
  { id: "print", name: "Print", event: "lokus:print", default: "CommandOrControl+P" },
];

export function listActions() { return ACTIONS.map(a => ({ id: a.id, name: a.name })); }

export async function getActiveShortcuts() {
  const cfg = await readConfig();
  const overrides = cfg.shortcuts || {};
  const map = {};
  
  // Get platform-specific shortcuts
  const platformShortcuts = await platformService.getShortcuts();
  
  for (const a of ACTIONS) {
    // Check for user override first
    if (overrides[a.id]) {
      map[a.id] = overrides[a.id];
    } else {
      // Check if platform has specific shortcut for this action
      const platformKey = a.id.replace(/-/g, '');
      if (platformShortcuts && platformShortcuts[platformKey]) {
        // Convert platform-specific shortcut to generic format
        map[a.id] = convertPlatformShortcut(platformShortcuts[platformKey]);
      } else {
        // Use default shortcut
        map[a.id] = a.default;
      }
    }
  }
  return map;
}

// Convert platform-specific shortcuts to generic CommandOrControl format
function convertPlatformShortcut(shortcut) {
  if (platformService.isWindows()) {
    // Windows shortcuts are already in Ctrl format
    return shortcut.replace(/Ctrl/g, 'CommandOrControl');
  } else if (platformService.isMacOS()) {
    // Convert Cmd to CommandOrControl
    return shortcut.replace(/Cmd/g, 'CommandOrControl');
  }
  return shortcut;
}

export async function setShortcut(actionId, accelerator) {
  const cfg = await readConfig();
  const shortcuts = { ...(cfg.shortcuts || {}), [actionId]: accelerator };
  await updateConfig({ shortcuts });
  if (isTauri) {
    try { await emit('shortcuts:updated', { actionId, accelerator }); } catch (e) {}
  } else {
    try { window.dispatchEvent(new CustomEvent('shortcuts:updated', { detail: { actionId, accelerator } })); } catch (e) {}
  }
}

export async function resetShortcuts() {
  const cfg = await readConfig();
  if (cfg.shortcuts) {
    delete cfg.shortcuts;
    await updateConfig(cfg);
  }
  if (isTauri) {
    try { await emit('shortcuts:updated', { reset: true }); } catch (e) {}
  } else {
    try { window.dispatchEvent(new CustomEvent('shortcuts:updated', { detail: { reset: true } })); } catch (e) {}
  }
}

export async function registerGlobalShortcuts() {
  if (!isTauri) {
    return; // no-op in browser
  }

  // Skip global shortcuts in development to avoid conflicts
  if (DISABLE_GLOBAL_SHORTCUTS_IN_DEV && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return;
  }

  await unregisterAll();
  const map = await getActiveShortcuts();

  let registeredCount = 0;
  let skippedCount = 0;

  for (const a of ACTIONS) {
    const accel = map[a.id];
    if (!accel) {
      skippedCount++;
      continue;
    }

    // CRITICAL SAFETY CHECK: Skip dangerous system shortcuts
    if (DANGEROUS_GLOBAL_SHORTCUTS.includes(accel) || NON_GLOBAL_ACTIONS.includes(a.id)) {
      skippedCount++;
      continue;
    }

    try {
      await register(accel, async () => {
        if (a.id === 'open-preferences') {
          try { await invoke('open_preferences_window'); } catch (e) { console.error('Failed to open preferences:', e); }
        } else {
          // Use Tauri events in Tauri environment, DOM events otherwise
          if (isTauri) {
            try {
              await emit(a.event);
            } catch (e) {}
          } else {
            try {
              window.dispatchEvent(new CustomEvent(a.event));
            } catch (e) {}
          }
        }
      });
      registeredCount++;
    } catch (e) {
      console.error(`[Shortcuts] Failed to register ${a.id} (${accel}):`, e);
      skippedCount++;
    }
  }
}

export async function unregisterGlobalShortcuts() {
  if (!isTauri) return;
  try { await unregisterAll(); } catch {}
}

// Utilities for capturing accelerators
export function eventToAccelerator(e) {
  const parts = [];
  // Normalize primary modifier to CommandOrControl for cross‑platform
  if (e.metaKey || e.ctrlKey) parts.push("CommandOrControl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  const key = normalizeKey(e.key);
  if (key) parts.push(key);
  return parts.join("+");
}

function normalizeKey(k) {
  if (!k) return null;
  const key = k.length === 1 ? k.toUpperCase() : k;
  const map = { ",": "Comma", ".": "Period", ";": "Semicolon", "'": "Quote", "/": "Slash", "\\": "Backslash", " `": "Backtick" };
  if (map[k]) return map[k];
  if (/^[a-zA-Z0-9]$/.test(key)) return key.toUpperCase();
  // Common named keys already fine (F1, Escape, Enter, ArrowLeft, etc.)
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Pretty print accelerator for UI, using platform-aware symbols
export function formatAccelerator(accel) {
  if (!accel) return "";
  
  // Use platform service for accurate detection
  const isMac = platformService.isMacOS();
  const isWin = platformService.isWindows();
  
  const parts = accel.split('+');
  const out = [];
  
  for (const p of parts) {
    if (p === 'CommandOrControl') {
      out.push(isMac ? '⌘' : 'Ctrl');
    } else if (p === 'Control') {
      out.push(isMac ? '⌃' : 'Ctrl');
    } else if (p === 'Shift') {
      out.push(isMac ? '⇧' : 'Shift');
    } else if (p === 'Alt' || p === 'Option') {
      out.push(isMac ? '⌥' : 'Alt');
    } else if (p === 'Cmd') {
      out.push(isMac ? '⌘' : 'Win');
    } else if (p === 'Win' || p === 'Super') {
      out.push(isWin ? '⊞' : 'Super');
    } else if (p === 'Comma') {
      out.push(',');
    } else if (p === 'Plus') {
      out.push('+');
    } else if (p === 'Minus') {
      out.push('-');
    } else {
      out.push(p);
    }
  }
  
  return isMac ? out.join('') : out.join('+');
}
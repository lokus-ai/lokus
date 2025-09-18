import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { readConfig, updateConfig } from "../config/store.js";
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
  { id: "next-tab",         name: "Next Tab",            event: "lokus:next-tab",         default: "CommandOrControl+Tab" },
  { id: "prev-tab",         name: "Previous Tab",        event: "lokus:prev-tab",         default: "CommandOrControl+Shift+Tab" },
  { id: "close-tab",        name: "Close Current Tab",   event: "lokus:close-tab",        default: "CommandOrControl+W" },
  { id: "graph-view",       name: "Open Graph View",     event: "lokus:graph-view",       default: "CommandOrControl+Shift+G" },
];

export function listActions() { return ACTIONS.map(a => ({ id: a.id, name: a.name })); }

export async function getActiveShortcuts() {
  const cfg = await readConfig();
  const overrides = cfg.shortcuts || {};
  const map = {};
  for (const a of ACTIONS) {
    map[a.id] = overrides[a.id] || a.default;
  }
  return map;
}

export async function setShortcut(actionId, accelerator) {
  const cfg = await readConfig();
  const shortcuts = { ...(cfg.shortcuts || {}), [actionId]: accelerator };
  await updateConfig({ shortcuts });
  if (isTauri) {
    try { await emit('shortcuts:updated', { actionId, accelerator }); } catch (e) { console.warn('Failed to emit shortcuts:updated:', e); }
  } else {
    try { window.dispatchEvent(new CustomEvent('shortcuts:updated', { detail: { actionId, accelerator } })); } catch (e) { console.warn('Failed to dispatch shortcuts:updated:', e); }
  }
}

export async function resetShortcuts() {
  const cfg = await readConfig();
  if (cfg.shortcuts) {
    delete cfg.shortcuts;
    await updateConfig(cfg);
  }
  if (isTauri) {
    try { await emit('shortcuts:updated', { reset: true }); } catch (e) { console.warn('Failed to emit shortcuts:updated:', e); }
  } else {
    try { window.dispatchEvent(new CustomEvent('shortcuts:updated', { detail: { reset: true } })); } catch (e) { console.warn('Failed to dispatch shortcuts:updated:', e); }
  }
}

export async function registerGlobalShortcuts() {
  if (!isTauri) return; // no-op in browser
  await unregisterAll();
  const map = await getActiveShortcuts();
  for (const a of ACTIONS) {
    const accel = map[a.id];
    if (!accel) continue;
    try {
      await register(accel, async () => {
        if (a.id === 'open-preferences') {
          try { await invoke('open_preferences_window'); } catch (e) { }
        } else {
          // Use Tauri events in Tauri environment, DOM events otherwise
          if (isTauri) {
            try { await emit(a.event); } catch (e) { console.warn('Failed to emit Tauri event:', e); }
          } else {
            try { window.dispatchEvent(new CustomEvent(a.event)); } catch (e) { console.warn('Failed to dispatch DOM event:', e); }
          }
        }
      });
    } catch (e) {
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

// Pretty print accelerator for UI, using mac symbols when appropriate
export function formatAccelerator(accel) {
  if (!accel) return "";
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || "");
  const parts = accel.split('+');
  const out = [];
  for (const p of parts) {
    if (p === 'CommandOrControl') out.push(isMac ? '⌘' : 'Ctrl');
    else if (p === 'Control') out.push(isMac ? '⌃' : 'Ctrl');
    else if (p === 'Shift') out.push(isMac ? '⇧' : 'Shift');
    else if (p === 'Alt' || p === 'Option') out.push(isMac ? '⌥' : 'Alt');
    else if (p === 'Comma') out.push(',');
    else out.push(p);
  }
  return isMac ? out.join('') : out.join('+');
}
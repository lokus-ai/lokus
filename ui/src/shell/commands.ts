/** @part-of ui.shell */
import { track } from "../bridge/analytics";
import { runCore } from "../bridge/core";

/**
 * Every feature is a named command. The palette, shortcuts, menus, the dev
 * channel (`lokus app <id>`) and later plugins and AI tools all go through
 * `runCommand`. An id that is not registered here is a core command.
 */
export interface Command {
  id: string;
  title: string;
  /** e.g. "Mod-b", "Mod-Shift-p". Mod is Cmd on macOS, Ctrl elsewhere. */
  keys?: string;
  /** Hidden commands exist for scripts and tests, not for people. */
  hidden?: boolean;
  run(args: Record<string, unknown>): unknown;
}

const registry = new Map<string, Command>();

export function registerCommands(commands: Command[]): void {
  for (const c of commands) registry.set(c.id, c);
}

export function unregisterCommands(ids: string[]): void {
  for (const id of ids) registry.delete(id);
}

export function listCommands(): Command[] {
  return [...registry.values()];
}

export async function runCommand(id: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const command = registry.get(id);
  if (!command) return runCore(id, args);
  if (!command.hidden) track("command_run", { id });
  return command.run(args);
}

const isMac = navigator.platform.toLowerCase().includes("mac");

function chord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  return parts.join("-");
}

export function formatKeys(keys: string): string {
  return keys
    .split("-")
    .map((k) => (k === "Mod" ? (isMac ? "⌘" : "Ctrl") : k === "Shift" ? "⇧" : k === "Alt" ? "⌥" : k.toUpperCase()))
    .join(isMac ? "" : "+");
}

/** App-wide shortcuts. Editor shortcuts live in the editor's own keymap. */
export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const pressed = chord(e);
    for (const c of registry.values()) {
      if (c.keys === pressed && !c.id.startsWith("editor.")) {
        e.preventDefault();
        void runCommand(c.id);
        return;
      }
    }
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
}

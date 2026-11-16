/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface NativeCommand {
  id: string;
  scope: "app" | "workspace" | "note" | "editor" | "tabs";
}

export function nativeCommands(): Promise<NativeCommand[]> {
  return invoke("menu_commands");
}

export function enableNativeCommands(enabled: string[]): Promise<void> {
  return invoke("menu_enabled", { enabled });
}

export function onNativeCommand(run: (id: string) => void): Promise<() => void> {
  return getCurrentWindow().listen<string>("menu:command", (event) => run(event.payload));
}

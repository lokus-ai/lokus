/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Whether Lokus stays in the menu bar, running, after its window is closed. */
export const staysInMenuBar = () => invoke<boolean>("background_get");
export const setStaysInMenuBar = (on: boolean) => invoke<void>("background_set", { on });

/** The number shown beside the mark in the menu bar: how many things need the person. */
export function showInMenuBar(count: number): void {
  void invoke("background_count", { count }).catch(() => {});
}

/**
 * Once a minute, whether the window is showing or not. A hidden window's own timers can be
 * slowed or stopped by the system; this is what keeps scheduled work on time.
 */
export function onMinute(handler: () => void): void {
  void getCurrentWindow().listen("background:tick", handler);
}

/** "Look Now" was chosen from the menu bar. */
export function onLookAsked(handler: () => void): void {
  void getCurrentWindow().listen("background:look", handler);
}

/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Where this copy of the app asks for new versions and news. Empty: it does not ask. */
export const UPDATE_SERVER = ((import.meta.env.VITE_LOKUS_UPDATES as string | undefined) ?? (import.meta.env.VITE_LOKUS_RELAY as string | undefined) ?? "").replace(/\/+$/, "");
/** Where someone can fetch the app by hand when updating from inside it will not work. */
export const DOWNLOAD_PAGE = (import.meta.env.VITE_LOKUS_DOWNLOAD as string | undefined) ?? "https://github.com/lokus-ai/lokus/releases";

export interface Offer {
  current: string;
  /** The newer version there is for this computer; null when this is the newest. */
  version: string | null;
  notes?: string;
  /** Why this copy cannot replace itself where it is, in words that say what to do. */
  blocked?: string | null;
  /** Already installed and waiting for a restart. */
  installed?: boolean;
}

export interface Progress {
  received?: number;
  total?: number | null;
  installing?: boolean;
}

/** A release note or an announcement, as published on the server. */
export interface Post {
  id: string;
  title: string;
  summary: string;
  body: string;
  /** The version this is about; empty for an announcement. */
  version: string;
  video: string;
  image: string;
  link: string;
  link_label: string;
  show: "popup" | "quiet";
  /** Seconds since 1970. */
  at: number;
}

const told = (raw: unknown) => new Error((raw as { message?: string })?.message ?? String(raw));

export async function checkForUpdate(): Promise<Offer> {
  try {
    return await invoke<Offer>("update_check", { server: UPDATE_SERVER });
  } catch (raw) {
    throw told(raw);
  }
}

/** Download and install what the last check found. The new version runs after a restart. */
export async function installUpdate(onProgress: (progress: Progress) => void): Promise<void> {
  const stop = await listen<Progress>("update:progress", (e) => onProgress(e.payload));
  try {
    await invoke("update_install");
  } catch (raw) {
    throw told(raw);
  } finally {
    stop();
  }
}

export function restartApp(): void {
  void invoke("update_restart");
}

export function aboutApp(): Promise<{ version: string; platform: string; arch: string }> {
  return invoke("app_about");
}

export async function fetchNews(): Promise<Post[]> {
  if (!UPDATE_SERVER) return [];
  const got = await invoke<{ posts?: Post[] }>("relay_call", { server: UPDATE_SERVER, token: "", method: "GET", path: "/v1/app/news", body: null });
  return got.posts ?? [];
}

/** Open a web page in the person's browser. */
export function openWeb(url: string): void {
  void invoke("open_web", { url });
}

/** Why this copy should be moved before it is used, or null when it is where it belongs. */
export async function misplaced(): Promise<string | null> {
  return (await invoke<{ misplaced: string | null }>("app_place")).misplaced;
}

export function quitApp(): void {
  void invoke("app_quit");
}

/** @part-of ui.bridge */
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

/** An error from the Rust core. Switch on `code`, show `message`. */
export class CoreError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function toCoreError(raw: unknown): CoreError {
  const e = raw as { code?: string; message?: string } | string;
  if (typeof e === "string") return new CoreError("unknown", e);
  return new CoreError(e?.code ?? "unknown", e?.message ?? "Something went wrong");
}

export interface VaultInfo {
  name: string;
  root: string;
}

let windowRoot: string | undefined;

/** The shell names the folder this window shows; a core call that names none is held to it. */
export function setWindowRoot(root: string | undefined): void {
  windowRoot = root;
}

/**
 * Run a core command against this window's vault. Rust refuses it when another folder is the
 * one open, so a window left on its folder never reads or writes the folder another window opened.
 */
export async function runCore<T = unknown>(name: string, args?: Record<string, unknown>, root?: string): Promise<T> {
  try {
    return await invoke<T>("core_run", { name, args: args ?? null, root: root ?? windowRoot });
  } catch (raw) {
    throw toCoreError(raw);
  }
}

export async function openVault(path: string, root?: string): Promise<VaultInfo> {
  try {
    return await invoke<VaultInfo>("vault_open", { path, root });
  } catch (raw) {
    throw toCoreError(raw);
  }
}

export function currentVault(): Promise<VaultInfo | null> {
  return invoke<VaultInfo | null>("vault_current");
}

export async function pickFolder(): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title: "Open a folder as a vault" });
  return typeof picked === "string" ? picked : null;
}

/** Files changed on disk, by Lokus or by anything else. */
export function onVaultChanged(handler: (paths: string[]) => void): () => void {
  const stop = listen<string[]>("vault:changed", (e) => handler(e.payload));
  return () => void stop.then((off) => off());
}

/** Every workspace on this computer: the folders this person has opened in Lokus. */
export function listVaults(): Promise<VaultInfo[]> {
  return invoke<VaultInfo[]>("vault_list");
}

/** Take a workspace off the list. Its folder stays where it is. */
export function forgetVault(root: string): Promise<void> {
  return invoke("vault_forget", { root });
}

export function onVaultOpened(handler: (vault: VaultInfo) => void): () => void {
  const stop = listen<VaultInfo>("vault:opened", (e) => handler(e.payload));
  return () => void stop.then((off) => off());
}

/** A folder was closed for good (its workspace was left or deleted); every window is told. */
export function onVaultClosed(handler: (root: string) => void): () => void {
  const stop = listen<string>("vault:closed", (e) => handler(e.payload));
  return () => void stop.then((off) => off());
}

export interface Entry {
  name: string;
  path: string;
  kind: "folder" | "note" | "file";
  children?: Entry[];
}

export type Eol = "lf" | "crlf" | "mixed";

export interface Note {
  path: string;
  text: string;
  eol: Eol;
  hash: string;
}

/** A URL the window can load for a file inside the open vault. */
export function vaultFileUrl(root: string, relative: string): string {
  return convertFileSrc(`${root}/${relative}`);
}

export function closeWindow(): void {
  void getCurrentWindow().close();
}

/** The index has caught up with the files after opening a vault. */
export function onIndexReady(handler: () => void): () => void {
  const stop = listen("index:ready", handler);
  return () => void stop.then((off) => off());
}

export interface SearchHit {
  path: string;
  title: string;
  /** Matches are wrapped in `[[[` and `]]]`. */
  snippet: string;
}

export interface Mention {
  path: string;
  title: string;
  line: number;
  context: string;
}

export interface GraphData {
  nodes: { path: string; title: string; degree: number }[];
  edges: [number, number][];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  activation: string[];
  contributes: {
    commands: { id: string; title: string; keys?: string }[];
    views: { id: string; title: string; page: string }[];
    settings: { key: string; title: string; type: "text" | "number" | "toggle" | "select"; default: unknown; options?: string[] }[];
    snippets: { label: string; detail: string; insert: string }[];
    mcpServers: { name: string; url: string }[];
  };
}

export interface InstalledPlugin {
  id: string;
  enabled: boolean;
  manifest?: PluginManifest;
  error?: string;
}

const pluginOrigin = /Windows|Android/i.test(navigator.userAgent) ? "http://lokus-plugin.localhost" : "lokus-plugin://localhost";

/** The address of a plugin's page; no page means its background page. */
export function pluginUrl(id: string, page = ""): string {
  return `${pluginOrigin}/${id}/${page}`;
}

/** Open another window on the same workspace, with its own tabs. */
export async function newWindow(): Promise<void> {
  try {
    await invoke("window_new");
  } catch (raw) {
    throw toCoreError(raw);
  }
}

/** Whether this is the first window, the one the app opened with. */
export const isMainWindow = () => getCurrentWindow().label === "main";

/**
 * Where notes go when someone does not pick a folder: Documents, Lokus. With a `name`, a folder
 * of that name in Documents instead, which is where a team's workspace is put. Asked without
 * opening it, `free` says whether it is not there yet or holds nothing.
 */
export async function defaultVault(open: boolean, name?: string): Promise<VaultInfo & { free?: boolean }> {
  try {
    const found = await invoke<{ root: string; name?: string; free?: boolean }>("vault_default", { open, name: name ?? null });
    return { name: found.name ?? name ?? "Lokus", root: found.root, free: found.free };
  } catch (raw) {
    throw toCoreError(raw);
  }
}

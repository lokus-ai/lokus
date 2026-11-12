/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

function toCoreError(raw: unknown): CoreError {
  const e = raw as { code?: string; message?: string } | string;
  if (typeof e === "string") return new CoreError("unknown", e);
  return new CoreError(e?.code ?? "unknown", e?.message ?? "Something went wrong");
}

export interface VaultInfo {
  name: string;
  root: string;
}

/** Run a core command against the open vault. */
export async function runCore<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>("core_run", { name, args: args ?? null });
  } catch (raw) {
    throw toCoreError(raw);
  }
}

export async function openVault(path: string): Promise<VaultInfo> {
  try {
    return await invoke<VaultInfo>("vault_open", { path });
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

export function onVaultOpened(handler: (vault: VaultInfo) => void): () => void {
  const stop = listen<VaultInfo>("vault:opened", (e) => handler(e.payload));
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

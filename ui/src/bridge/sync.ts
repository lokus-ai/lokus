/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toCoreError } from "./core";

const toB64 = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** What the sync connection reports. */
export type SyncEvent = { root: string } & (
  | { event: "online"; role: "owner" | "editor" | "viewer"; user: string; conn: number }
  | { event: "role"; role: "owner" | "editor" | "viewer" }
  | { event: "skipped"; path: string }
  | { event: "offline"; reason: string }
  | { event: "refused"; reason: string }
  | { event: "pulled"; edits: number }
  | { event: "published" | "wrote" | "trashed"; path: string }
  | { event: "renamed"; from: string; to: string }
  | { event: "kept_both"; path: string; moved_to: string }
  | { event: "remote" | "ingested"; doc: string; data: Uint8Array }
  | { event: "presence"; conn: number; left: boolean; doc?: string; user?: string; email?: string; data?: Uint8Array });

export function onSyncEvent(handler: (event: SyncEvent) => void): () => void {
  const stop = listen<Record<string, unknown>>("sync:event", ({ payload }) => {
    if (typeof payload.root !== "string") return;
    if (payload.event === "remote" || payload.event === "ingested") {
      handler({ event: payload.event, root: payload.root, doc: String(payload.doc), data: fromB64(String(payload.data)) });
    } else if (payload.event === "presence") {
      const m = payload.message as Record<string, unknown>;
      handler({
        event: "presence",
        root: payload.root,
        conn: Number(m.conn),
        left: m.t === "bye",
        doc: m.doc as string | undefined,
        user: m.user as string | undefined,
        email: (m.email as string | null) ?? undefined,
        data: typeof m.data === "string" ? fromB64(m.data) : undefined,
      });
    } else {
      handler(payload as unknown as SyncEvent);
    }
  });
  return () => void stop.then((off) => off());
}

export function syncConnect(server: string, workspace: string, token: string, root: string): Promise<void> {
  return invoke("sync_connect", { server, workspace, token, root });
}

/** Hand the running connection a fresh sign-in, so it outlives the one it started with. */
export function syncToken(token: string): Promise<void> {
  return invoke("sync_token", { token });
}

export function syncDisconnect(): Promise<void> {
  return invoke("sync_disconnect");
}

export function syncStatus(): Promise<{ running: boolean; server?: string; workspace?: string }> {
  return invoke("sync_status");
}

/** The team workspace a folder last synced with, or null for one that never did. */
export function syncBound(root: string): Promise<string | null> {
  return invoke<string | null>("sync_bound", { root }).catch(() => null);
}

/** The shared document behind a note, or null if the note is not synced. */
export async function syncDoc(path: string): Promise<{ id: string; state: Uint8Array; root: string } | null> {
  const found = await invoke<{ id: string; state: string; root: string } | null>("sync_doc", { path });
  return found ? { id: found.id, state: fromB64(found.state), root: found.root } : null;
}

export async function syncLocal(id: string, update: Uint8Array, root: string): Promise<void> {
  try {
    await invoke("sync_local", { id, update: toB64(update), root });
  } catch (raw) {
    throw toCoreError(raw);
  }
}

/**
 * Rename a note or a folder in a shared vault, so the note keeps its shared document. Gives
 * false when the vault is not shared; the caller then renames it the ordinary way.
 */
export async function syncRename(from: string, to: string, root: string): Promise<boolean> {
  try {
    return await invoke<boolean>("sync_rename", { from, to, root });
  } catch (raw) {
    throw toCoreError(raw);
  }
}

export function syncAwareness(id: string, data: Uint8Array, root: string): void {
  void invoke("sync_awareness", { id, data: toB64(data), root }).catch(() => {});
}

/** One request to the relay's HTTP side. */
export async function relay<T>(server: string, token: string, method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  try {
    return await invoke<T>("relay_call", { server, token, method, path, body: body ?? null });
  } catch (raw) {
    throw new Error((raw as { message?: string })?.message ?? "The relay did not answer");
  }
}

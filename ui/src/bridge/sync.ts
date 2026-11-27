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
  | { event: "signin"; reason: string }
  | { event: "renew" }
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

/** The team a folder belongs to: which relay, which workspace, a sign-in typed by hand (null: the account's), and the account last connected. */
export interface Team {
  server: string;
  workspace: string;
  token: string | null;
  user?: string | null;
  /** What the team is called on the relay, as last heard. */
  name?: string | null;
  /** This computer connected the folder to this relay itself. A folder can come from anyone and name any relay. */
  known?: boolean;
}

/** The relay built into this app, where an account's teams are. */
export const HOME = ((import.meta.env.VITE_LOKUS_RELAY as string | undefined) ?? "").replace(/\/+$/, "");

/**
 * The team a folder belongs to, connected or not. It is kept in the folder. What an earlier
 * version kept in the window's own storage is moved into the folder the first time it is asked
 * for, and removed from here.
 */
export async function teamOf(root: string): Promise<Team | null> {
  const key = `lokus.sync:${root}`;
  const old = localStorage.getItem(key);
  let team = await invoke<Team | null>("sync_team", { root }).catch(() => null);
  if (old === null) return team;
  if (!team) {
    try {
      const { server, workspace, token } = JSON.parse(old) as Team;
      team = { server, workspace, token: token ?? null };
      await keepTeam(root, team);
    } catch (e) {
      // The folder cannot be written to right now: left here for the next time. One that is gone, or unreadable words, is dropped.
      // It is still this folder's team meanwhile.
      if (!(e instanceof Gone || e instanceof SyntaxError)) return team;
      team = null;
    }
  }
  localStorage.removeItem(key);
  return team;
}

/** What an earlier version kept in this window's storage for every folder goes to the folders. */
export async function moveTeams(): Promise<void> {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("lokus.sync:")) await teamOf(key.slice("lokus.sync:".length));
  }
}

class Gone extends Error {}

/** Remember the team a folder belongs to. Refused for a folder that is already another team's. */
export async function keepTeam(root: string, team: Team): Promise<void> {
  let kept: boolean;
  try {
    kept = await invoke<boolean>("sync_keep", { root, team: { user: null, ...team } });
  } catch (raw) {
    throw new Error((raw as { message?: string })?.message ?? "Could not remember this folder's team");
  }
  if (!kept) throw new Gone("That folder is not there any more");
}

/** The folder is no longer a team's: the member left, or the relay says they are not in it. */
export function forgetTeam(root: string): Promise<void> {
  return invoke("sync_forget", { root });
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

/** @part-of ui.shell */
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import * as Y from "yjs";

import { onSyncEvent, syncAwareness, syncDoc, syncLocal } from "../bridge/sync";

/**
 * Open notes that are shared. The editor works on a Yjs document; the Rust
 * sync engine holds the same document, writes the file and talks to the
 * relay. This module only passes updates between the two.
 */
export interface Shared {
  id: string;
  ydoc: Y.Doc;
  text: Y.Text;
  awareness: Awareness;
}

export interface Peer {
  name: string;
  color: string;
}

const open = new Map<string, Shared>();
/** Which awareness ids arrived over which connection, so a dropped connection clears its cursors. */
const byConn = new Map<number, { doc: string; ids: Set<number> }>();
const sending = new Map<string, Promise<void>>();
let me: Peer = { name: "You", color: "#2f6fed" };
let changed: () => void = () => {};

const COLORS = ["#e5484d", "#f76b15", "#ffb224", "#30a46c", "#12a594", "#0091ff", "#6e56cf", "#d6409f"];

export function setIdentity(name: string): void {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  me = { name, color: COLORS[hash % COLORS.length] };
  for (const shared of open.values()) shared.awareness.setLocalStateField("user", { ...me, colorLight: `${me.color}33` });
}

export function startCollab(onPresenceChange: () => void): void {
  changed = onPresenceChange;
  onSyncEvent((event) => {
    if (event.event === "remote" || event.event === "ingested") {
      const shared = open.get(event.doc);
      if (shared) Y.applyUpdate(shared.ydoc, event.data, "remote");
    } else if (event.event === "presence") {
      const known = byConn.get(event.conn);
      if (event.left) {
        const shared = known && open.get(known.doc);
        if (shared && known) removeAwarenessStates(shared.awareness, [...known.ids], "remote");
        byConn.delete(event.conn);
        return;
      }
      const shared = event.doc ? open.get(event.doc) : undefined;
      if (!shared || !event.data) return;
      const before = new Set(shared.awareness.getStates().keys());
      applyAwarenessUpdate(shared.awareness, event.data, "remote");
      const entry = known ?? { doc: shared.id, ids: new Set<number>() };
      for (const id of shared.awareness.getStates().keys()) if (!before.has(id)) entry.ids.add(id);
      byConn.set(event.conn, entry);
      // Someone new: make sure they see our cursor too.
      if (!known) syncAwareness(shared.id, encodeAwarenessUpdate(shared.awareness, [shared.ydoc.clientID]));
    }
  });
}

/** The shared document behind a note, or null when the note is not synced. */
export async function openShared(path: string): Promise<Shared | null> {
  const found = await syncDoc(path).catch(() => null);
  if (!found) return null;
  const existing = open.get(found.id);
  if (existing) return existing;

  const ydoc = new Y.Doc();
  const awareness = new Awareness(ydoc);
  const shared: Shared = { id: found.id, ydoc, text: ydoc.getText("content"), awareness };
  Y.applyUpdate(ydoc, found.state, "remote");
  open.set(found.id, shared);
  // Anything that arrived between the first read and registering above.
  const again = await syncDoc(path).catch(() => null);
  if (again) Y.applyUpdate(ydoc, again.state, "remote");

  ydoc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    // One at a time, in order, so the engine never sees an edit before the one it builds on.
    const previous = sending.get(shared.id) ?? Promise.resolve();
    sending.set(
      shared.id,
      previous.then(() => syncLocal(shared.id, update)).catch(() => {}),
    );
  });
  awareness.on("update", (change: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === "local") {
      syncAwareness(shared.id, encodeAwarenessUpdate(awareness, [...change.added, ...change.updated, ...change.removed]));
    }
    changed();
  });
  // Set after listening, so our name reaches people who already have the note open.
  awareness.setLocalStateField("user", { ...me, colorLight: `${me.color}33` });
  return shared;
}

export function closeShared(shared: Shared): void {
  removeAwarenessStates(shared.awareness, [shared.ydoc.clientID], "local");
  shared.awareness.destroy();
  shared.ydoc.destroy();
  open.delete(shared.id);
  sending.delete(shared.id);
}

/** Other people with this note open. */
export function peersOf(shared: Shared | undefined): Peer[] {
  if (!shared) return [];
  const peers: Peer[] = [];
  shared.awareness.getStates().forEach((state, id) => {
    const user = (state as { user?: Peer }).user;
    if (id !== shared.ydoc.clientID && user) peers.push({ name: user.name, color: user.color });
  });
  return peers;
}

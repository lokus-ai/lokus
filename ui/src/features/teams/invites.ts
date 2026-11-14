/** @part-of ui.teams */
import { track } from "../../bridge/analytics";
import { accessToken } from "../../bridge/auth";
import { defaultVault } from "../../bridge/core";
import { relay } from "../../bridge/sync";
import { createStore } from "../../shell/store";
import { allNotes, app, connectSync, notify, setVault } from "../../shell/workspace";

/**
 * Invitations, from both ends.
 *
 * An owner names someone by their email address and the relay writes to them. The person
 * invited signs in to Lokus with that address and the invitation is found waiting: this file
 * asks for it when they sign in and when they come back to the window, and joins them.
 */

/** The relay this build syncs through; empty when the build has none. */
export const HOME = ((import.meta.env.VITE_LOKUS_RELAY as string | undefined) ?? "").replace(/\/+$/, "");

export type Role = "owner" | "editor" | "viewer";

/** An invitation waiting for the person signed in. */
export interface Waiting {
  code: string;
  /** The workspace's id, and its name. */
  workspace: string;
  name: string;
  role: Role;
  /** The owner who sent it: their address and the name they go by. */
  from: string | null;
  from_name: string | null;
  expires_at: number;
}

/** What the relay says about an invite just made or sent again. */
export interface Made {
  code: string;
  role: Role;
  email: string | null;
  /** Whether the email went out; null for an invite that is only a link. */
  sent: boolean | null;
}

const LATER = "lokus.invites.later";
const AGAIN = 60_000;
/** The pages setup makes. A folder holding only these has nothing of the person's own in it. */
const STARTER = ["Customers.md", "Tasks.md", "Assistant.md"];

function put(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(LATER) ?? "null") as string[] | null) ?? [];
  } catch {
    return [];
  }
}

export const invited = createStore<{ waiting: Waiting[]; later: string[]; joining: string }>({ waiting: [], later: put(), joining: "" });

export const whoSent = (w: Waiting) => w.from_name || w.from || "Someone";
export const asWhat = (role: Role) => (role === "owner" ? "an owner" : role === "editor" ? "an editor" : "a viewer");
/** The page an invite's link opens. */
export const joinLink = (server: string, code: string) => `${server.replace(/\/+$/, "")}/join/${code}`;

let asked = 0;

/** Ask the relay what is waiting for whoever is signed in. Quiet when there is nobody, or no relay. */
export async function lookForInvites(): Promise<Waiting[]> {
  asked = Date.now();
  const token = HOME && app.get().account ? await accessToken().catch(() => null) : null;
  const waiting = token ? await relay<Waiting[]>(HOME, token, "GET", "/v1/invites/mine").catch(() => invited.get().waiting) : [];
  invited.set({ waiting });
  return waiting;
}

/** Put an invitation away. It stays under Settings, Team until it is used or runs out. */
export function notNow(code: string): void {
  const later = [...invited.get().later.filter((c) => invited.get().waiting.some((w) => w.code === c)), code];
  localStorage.setItem(LATER, JSON.stringify(later));
  invited.set({ later });
}

/** Whether the open folder holds notes of the person's own, which joining there would share. */
export function ownNotes(): number {
  return allNotes().filter((path) => !STARTER.includes(path)).length;
}

/** Whether the open folder is already shared with a workspace, so another cannot be joined in it. */
export function sharedAlready(): boolean {
  return ["connecting", "online", "offline"].includes(app.get().sync.status);
}

/**
 * Accept an invitation and start syncing: in the folder that is open, or in a new folder in
 * Documents named after the workspace.
 */
export async function join(w: Waiting, where: "here" | "new"): Promise<void> {
  const token = await accessToken();
  if (!token) throw new Error("Sign in first");
  invited.set({ joining: w.code });
  try {
    await relay<{ workspace: string }>(HOME, token, "POST", `/v1/invites/${w.code}/accept`);
    if (where === "new" || !app.get().vault) await setVault((await defaultVault(true, w.name)).root);
    await connectSync(HOME, w.workspace, null);
    track("action", { feature: "team", action: "invite_accepted", where, role: w.role });
    notify(`You joined ${w.name}`);
    invited.set((s) => ({ waiting: s.waiting.filter((x) => x.code !== w.code) }));
  } finally {
    invited.set({ joining: "" });
  }
}

/** Ask when someone signs in, and again when they come back to the window after a while. */
export function watchInvites(): void {
  if (!HOME) return;
  let who = app.get().account?.id ?? null;
  void lookForInvites();
  app.subscribe(() => {
    const now = app.get().account?.id ?? null;
    if (now === who) return;
    who = now;
    void lookForInvites();
  });
  window.addEventListener("focus", () => {
    if (Date.now() - asked > AGAIN) void lookForInvites();
  });
}

/** @part-of ui.teams */
import { track } from "../../bridge/analytics";
import { accessToken } from "../../bridge/auth";
import { defaultVault, listVaults } from "../../bridge/core";
import { relay, syncBound } from "../../bridge/sync";
import { createStore } from "../../shell/store";
import { allNotes, app, connectSync, dropWorkspace, keepSync, notify, resumeSync, saveAll, setVault, syncedWith, unsaved } from "../../shell/workspace";

/**
 * Invitations, from both ends.
 *
 * An owner names someone by their email address and the relay writes to them. The person
 * invited signs in to Lokus with that address and the invitation is found waiting: this file
 * asks for it when they sign in and when they come back to the window, and joins them. One
 * they already said yes to, on the page its email opens, is joined without asking again.
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
  /** When they pressed Join on the invitation's page in a browser; null when they have not. */
  agreed_at: number | null;
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
/** Coming back to the window asks again after this long: someone who pressed Join on the invitation page is not kept waiting. */
const AGAIN = 10_000;
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

let looking: Promise<Waiting[]> | null = null;

/**
 * Ask the relay what is waiting for whoever is signed in. Quiet when there is nobody, or no
 * relay. One look at a time: a second asker is given the first one's answer, so an invitation
 * is never used twice.
 */
export function lookForInvites(): Promise<Waiting[]> {
  return (looking ??= find().finally(() => (looking = null)));
}

async function find(): Promise<Waiting[]> {
  asked = Date.now();
  const token = HOME && app.get().account ? await accessToken().catch(() => null) : null;
  let waiting = token ? await relay<Waiting[]>(HOME, token, "GET", "/v1/invites/mine").catch(() => invited.get().waiting) : [];
  // Said yes to on its page: joined here and now, and `bringTeams` gives it a folder. First-run
  // setup keeps it instead, to make it the person's first folder. One that could not be joined
  // right now stays waiting, with its Join button.
  if (token && !settingUp()) {
    for (const w of waiting.filter((w) => w.agreed_at)) {
      const joined = await relay(HOME, token, "POST", `/v1/invites/${w.code}/accept`).then(
        () => true,
        () => false,
      );
      if (!joined) continue;
      track("action", { feature: "team", action: "invite_accepted", where: "page", role: w.role });
      waiting = waiting.filter((x) => x.code !== w.code);
    }
  }
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
  // The folder open when it was pressed, not one opened while the relay answered.
  let root = where === "here" ? app.get().vault?.root : undefined;
  const token = await accessToken();
  if (!token) throw new Error("Sign in first");
  invited.set({ joining: w.code });
  try {
    await relay<{ workspace: string }>(HOME, token, "POST", `/v1/invites/${w.code}/accept`);
    if (!root) {
      // Found first; made and opened only after this window has saved and the assistant has kept its reply.
      const at = await defaultVault(false, w.name);
      root = at.root;
      await setVault(at.root, async () => {
        const made = await defaultVault(true, w.name);
        root = made.root;
        return made;
      });
      if (app.get().vault?.root !== root) throw new Error("Changes could not be saved. Retry before opening the team's folder.");
    }
    await connectSync(HOME, w.workspace, null, root);
    track("action", { feature: "team", action: "invite_accepted", where, role: w.role });
    notify(`You joined ${w.name}`);
    invited.set((s) => ({ waiting: s.waiting.filter((x) => x.code !== w.code) }));
  } finally {
    invited.set({ joining: "" });
  }
}

/** Whether first-run setup is on screen. It decides the first folder itself, so nothing is brought under it. */
let settingUp: () => boolean = () => false;
let bringing = false;

/**
 * A team this person is in always syncs on this computer; nobody is asked, and nothing turns
 * it off: being in the team is the answer.
 * - A folder here that synced with the team before (its sync state says which) is connected
 *   again: at once when it is the one open, otherwise when it is next opened.
 * - A team with no folder here gets one in Documents, never a folder of the person's notes.
 * - A folder kept for a team this person is no longer in (deleted, or removed while this
 *   computer was away) is taken off the workspace list; its notes stay on disk.
 */
export async function bringTeams(): Promise<void> {
  if (!HOME || bringing || settingUp() || invited.get().joining || !app.get().ready || !app.get().account) return;
  bringing = true;
  try {
    const token = await accessToken();
    if (!token) return;
    const mine = await relay<{ id: string; name: string }[]>(HOME, token, "GET", "/v1/workspaces");
    const member = (id: string | null) => id !== null && mine.some((w) => w.id === id);
    /** The team a folder belongs to: the one it is set to sync with, else the one its sync state was made for. */
    const teamOf = async (root: string) => syncedWith(root) ?? (await syncBound(root));
    const here = new Set<string>();
    const before = stoppedBefore();
    for (const v of await listVaults()) {
      const open = v.root === app.get().vault?.root;
      const kept = syncedWith(v.root);
      const team = kept ?? (await syncBound(v.root));
      if (member(team) && team) {
        here.add(team);
        if (kept) continue;
        // Its syncing was stopped here once, or its setting was lost: put back with nobody asked.
        if (open && !sharedAlready()) await connectSync(HOME, team, null, v.root);
        else if (!open) keepSync(v.root, HOME, team);
      } else if (kept && !open && savedHome(v.root)) {
        // The open folder is told by its own connection being refused; the others are told here.
        await dropWorkspace(v.root, `${v.name} was deleted, or you were removed from it. Its notes stay on this computer.`);
      } else if (!kept && team && before.includes(team)) {
        // Left or deleted under an earlier version, which ended the connection and kept the folder on the list.
        keepSync(v.root, HOME, team);
        await dropWorkspace(v.root, `${v.name} is no longer one of your teams. Its notes stay on this computer.`);
      }
    }
    // What the earlier version remembered as stopped has been acted on: reconnected or taken off the list.
    localStorage.removeItem("lokus.sync.stopped");
    // Last to first, so the first team is the one left on screen.
    for (const w of mine.filter((w) => !here.has(w.id)).reverse()) {
      try {
        // The folder it had here before, when this computer still knows it; otherwise the first
        // of "name", "name 2", ... that holds nothing and is no other team's.
        let name = w.name;
        let at = await defaultVault(false, name);
        for (let n = 2; (await teamOf(at.root)) !== w.id && ((await teamOf(at.root)) || !at.free); n++) {
          at = await defaultVault(false, (name = `${w.name} ${n}`));
        }
        const had = syncedWith(at.root) === w.id;
        // The folder on screen is about to change: what was typed there is written first.
        await saveAll();
        // A note that could not be written keeps its folder on screen; the teams wait for the next look.
        if (unsaved()) return;
        let root = at.root;
        await setVault(at.root, async () => {
          const made = await defaultVault(true, name);
          root = made.root;
          return made;
        });
        if (app.get().vault?.root !== root) return;
        if (!had) await connectSync(HOME, w.id, null, root);
        track("action", { feature: "team", action: "team_brought" });
        notify(`${w.name} is on this computer now`);
      } catch {
        // this team is tried again at the next look; the others still come
      }
    }
  } catch {
    // no relay or no sign-in right now: asked again when the window is next returned to
  } finally {
    bringing = false;
  }
}

/** The teams an earlier version remembered as stopped, left or deleted on this computer. Read once more, then forgotten. */
function stoppedBefore(): string[] {
  try {
    return (JSON.parse(localStorage.getItem("lokus.sync.stopped") ?? "null") as string[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Whether a folder's saved connection is to the built-in relay with the account's sign-in, which is what `bringTeams` asked about. */
function savedHome(root: string): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(`lokus.sync:${root}`) ?? "null") as { server?: string; token?: string | null } | null;
    return saved?.server === HOME && saved.token === null;
  } catch {
    return false;
  }
}

/** Everything a look is: what is waiting, then the teams with no folder here. In this order: an invitation joined by the first is a team the second brings. */
export const lookForTeams = () => void lookForInvites().finally(() => void bringTeams());

/** Ask when someone signs in, and again when they come back to the window after a while. */
export function watchInvites(setup: () => boolean): void {
  if (!HOME) return;
  settingUp = setup;
  let who = app.get().account?.id ?? null;
  let folder = app.get().vault?.root ?? null;
  lookForTeams();
  app.subscribe(() => {
    const now = app.get().account?.id ?? null;
    const opened = app.get().vault?.root ?? null;
    // Another folder was opened: if it is a team's, it connects without a press.
    if (opened !== folder) {
      folder = opened;
      if (now === who) return lookForTeams();
    }
    if (now === who) return;
    who = now;
    // A team folder opened while signed out was refused: the sign-in is what it was waiting for.
    if (now && app.get().sync.status === "refused") void resumeSync();
    lookForTeams();
  });
  let due = 0;
  window.addEventListener("focus", () => {
    // Asked a moment ago: asked again when the moment is over, not dropped.
    const wait = asked + AGAIN - Date.now();
    if (wait <= 0) lookForTeams();
    else if (!due) due = window.setTimeout(() => ((due = 0), lookForTeams()), wait);
  });
}

/** @part-of ui.teams */
import { track } from "../../bridge/analytics";
import { accessToken } from "../../bridge/auth";
import { defaultVault, listVaults, makeVault } from "../../bridge/core";
import { keepTeam, relay, syncBound, teamOf } from "../../bridge/sync";
import { createStore } from "../../shell/store";
import { allNotes, app, connectSync, notify, setVault, teamGone, wakeSync } from "../../shell/workspace";

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
 * - A folder here that synced with the team before (the folder says which) is connected
 *   again: at once when it is the one open, otherwise when it is next opened.
 * - A team with no folder here gets one in Documents, never a folder of the person's notes.
 *   It is added to the workspace list; the folder on screen stays the one the person chose,
 *   and is only opened for someone who has none open.
 * - A folder kept for a team this person is no longer in (deleted, or removed while this
 *   computer was away) stops being the team's; it stays on the list with its notes.
 */
/** A team is being made for the open folder right now: until the folder is its own, a look would give it a second one. */
let making = false;
export async function whileMaking<T>(work: () => Promise<T>): Promise<T> {
  making = true;
  try {
    return await work();
  } finally {
    making = false;
  }
}

export async function bringTeams(): Promise<void> {
  const me = app.get().account?.id;
  if (!HOME || bringing || making || settingUp() || invited.get().joining || !app.get().ready || !me) return;
  bringing = true;
  try {
    const token = await accessToken();
    if (!token) return;
    const mine = await relay<{ id: string; name: string }[]>(HOME, token, "GET", "/v1/workspaces");
    if (app.get().account?.id !== me) return;
    const member = (id: string | null) => id !== null && mine.some((w) => w.id === id);
    /** The team a folder belongs to: the one it keeps, else the one its sync state was made for. */
    const teamAt = async (root: string) => (await teamOf(root))?.workspace ?? (await syncBound(root));
    const here = new Set<string>();
    for (const v of await listVaults()) {
      const open = v.root === app.get().vault?.root;
      const kept = await teamOf(v.root);
      const team = kept?.workspace ?? (await syncBound(v.root));
      if (member(team) && team) {
        here.add(team);
        if (kept) continue;
        // Its setting was lost: put back with nobody asked.
        if (open && !sharedAlready()) await connectSync(HOME, team, null, v.root);
        else if (!open) await keepTeam(v.root, { server: HOME, workspace: team, token: null, user: me }).catch(() => {});
      } else if (kept && !open && kept.server === HOME && kept.token === null && (!kept.user || kept.user === me)) {
        // The open folder is told by its own connection being refused; the others are told here.
        // Only the list of the account the folder was connected with says so: another account's says nothing.
        await teamGone(v.root, `${v.name} was deleted, or you were removed from it. Its notes stay on this computer.`);
      }
    }
    // What an earlier version remembered as stopped means nothing now: a folder says for itself whose it is.
    localStorage.removeItem("lokus.sync.stopped");
    // Last to first, so the first team is the one a person with nothing open is shown.
    for (const w of mine.filter((w) => !here.has(w.id)).reverse()) {
      try {
        // The folder it had here before, when this computer still knows it; otherwise the first
        // of "name", "name 2", ... that holds nothing and is no other team's.
        let name = w.name;
        let at = await defaultVault(false, name);
        for (let n = 2; (await teamAt(at.root)) !== w.id && ((await teamAt(at.root)) || !at.free); n++) {
          at = await defaultVault(false, (name = `${w.name} ${n}`));
        }
        if (app.get().vault) {
          // Someone is working in a folder: the team's is made beside it and waits in the list.
          await makeVault(at.root);
          await keepTeam(at.root, { server: HOME, workspace: w.id, token: null, user: me });
          notify(`${w.name} is in your workspaces now`);
        } else {
          let root = at.root;
          await setVault(at.root, async () => {
            const made = await defaultVault(true, name);
            root = made.root;
            return made;
          });
          if (app.get().vault?.root !== root) return;
          await connectSync(HOME, w.id, null, root);
          notify(`${w.name} is on this computer now`);
        }
        track("action", { feature: "team", action: "team_brought" });
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
    // A team folder opened while signed out is waiting for exactly this.
    if (now) void wakeSync();
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

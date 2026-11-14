/** @part-of ui.updates */
import { aboutApp, checkForUpdate, fetchNews, installUpdate, type Post, restartApp, UPDATE_SERVER } from "../../bridge/updates";
import { createStore } from "../../shell/store";
import { notify, saveAll } from "../../shell/workspace";

/**
 * Updates and news, as one small state machine the whole app reads.
 *
 * An update goes: available, downloading, installing, ready (installed, waiting for a restart),
 * restarting. News is the list of posts the server publishes; which ones this person has seen
 * is remembered on this device.
 */
export type Phase = "idle" | "checking" | "available" | "downloading" | "installing" | "ready" | "restarting" | "failed";

export interface UpdateState {
  phase: Phase;
  /** The version running now. */
  current: string;
  /** The version on offer or just installed. */
  version: string;
  blocked: string;
  /** How much of the download has arrived, 0 to 1; null when the size is not known. */
  fraction: number | null;
  error: string;
  /** Whether the pop-up is showing. Put away with "Later", it comes back from the sidebar. */
  card: boolean;
  /** What the last check by hand found, for Settings to say. */
  said: string;
  posts: Post[];
  seen: string[];
  /** The post showing in "What's new": a post's id, "all" for the list, or null. */
  reading: string | null;
}

const SEEN = "lokus.news.seen";
const RAN = "lokus.version.ran";
const LATER = "lokus.update.later";
const EVERY = 30 * 60 * 1000;
const SNOOZE = 24 * 60 * 60 * 1000;

function read<T>(key: string, otherwise: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? otherwise;
  } catch {
    return otherwise;
  }
}

export const updates = createStore<UpdateState>({
  phase: "idle",
  current: "",
  version: "",
  blocked: "",
  fraction: null,
  error: "",
  card: false,
  said: "",
  posts: [],
  seen: read<string[]>(SEEN, []),
  reading: null,
});

/** Is version `a` newer than `b`? Understands test versions: 2.0.0-alpha.2 comes before 2.0.0. */
export function newer(a: string, b: string): boolean {
  const parse = (v: string) => {
    const [main, pre = ""] = v.replace(/^v/, "").split("+")[0].split("-", 2);
    return { main: main.split(".").map(Number), pre: pre ? pre.split(".") : [] };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.main[i] || 0) - (y.main[i] || 0);
    if (d) return d > 0;
  }
  if (!x.pre.length || !y.pre.length) return !x.pre.length && y.pre.length > 0;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined || q === undefined) return q === undefined;
    if (p === q) continue;
    const numeric = /^\d+$/.test(p) && /^\d+$/.test(q);
    return numeric ? Number(p) > Number(q) : p > q;
  }
  return false;
}

/** A post is about this copy when it names no version, or one this copy already has. */
export const applies = (post: Post, current: string) => !post.version || !current || !newer(post.version, current);

function markSeen(ids: string[]): void {
  const seen = [...new Set([...updates.get().seen, ...ids])].slice(-400);
  updates.set({ seen });
  localStorage.setItem(SEEN, JSON.stringify(seen));
}

/** Open "What's new" on one post, or on the list of them. */
export function readNews(id: string | null): void {
  updates.set({ reading: id });
  if (id && id !== "all") markSeen([id]);
}

/** Closing "What's new" counts as having seen what it listed. */
export function closeNews(): void {
  markSeen(updates.get().posts.map((p) => p.id));
  updates.set({ reading: null });
}

/**
 * Ask whether there is a newer version. `byHand` is someone pressing the button in Settings:
 * they are told the answer either way, and the pop-up comes back even if they put it off.
 */
export async function check(byHand = false): Promise<void> {
  const state = updates.get();
  if (!UPDATE_SERVER) {
    if (byHand) updates.set({ said: "This copy of Lokus does not check for updates." });
    return;
  }
  if (["checking", "downloading", "installing", "restarting"].includes(state.phase)) return;
  if (state.phase === "ready") return void (byHand && updates.set({ card: true }));
  if (byHand) updates.set({ phase: "checking", said: "" });
  try {
    const offer = await checkForUpdate();
    if (offer.installed && offer.version) {
      updates.set({ phase: "ready", current: offer.current, version: offer.version, card: true });
    } else if (offer.version) {
      const later = read<{ version: string; until: number } | null>(LATER, null);
      const putOff = !byHand && later?.version === offer.version && later.until > Date.now();
      // Do not pop up again over someone who already has the pop-up, or who put it away this session.
      const already = state.phase === "available" && state.version === offer.version;
      // What the new version brings may have been written since news was last read.
      if (!state.posts.some((p) => p.version === offer.version)) void loadNews(false);
      updates.set({ phase: "available", current: offer.current, version: offer.version, blocked: offer.blocked ?? "", error: "", card: byHand || (already ? state.card : !putOff), said: `Version ${offer.version} is ready to install.` });
    } else {
      updates.set({ phase: "idle", current: offer.current, version: "", card: false, said: "You have the newest version." });
    }
  } catch (e) {
    // A check nobody asked for fails quietly: no internet is not news.
    updates.set({ phase: state.phase === "checking" ? "idle" : state.phase, said: byHand ? (e instanceof Error ? e.message : String(e)) : state.said });
  }
}

/** "Update now": fetch it and put it in place. Ends at "ready" or "failed". */
export async function install(): Promise<void> {
  if (updates.get().phase !== "available" && updates.get().phase !== "failed") return;
  updates.set({ phase: "downloading", fraction: 0, error: "", card: true });
  try {
    await installUpdate((p) => {
      if (p.installing) updates.set({ phase: "installing" });
      else updates.set({ fraction: p.total ? Math.min(1, (p.received ?? 0) / p.total) : null });
    });
    updates.set({ phase: "ready", card: true });
  } catch (e) {
    updates.set({ phase: "failed", error: e instanceof Error ? e.message : String(e), card: true });
  }
}

/** "Restart now": save what is open, then close and come back as the new version. */
export async function restart(): Promise<void> {
  updates.set({ phase: "restarting", card: true });
  await saveAll().catch(() => {});
  restartApp();
}

/** "Later": put the pop-up away. For a version not yet installed it stays away for a day. */
export function later(): void {
  const { phase, version } = updates.get();
  if (phase === "available") localStorage.setItem(LATER, JSON.stringify({ version, until: Date.now() + SNOOZE }));
  updates.set({ card: false });
}

async function loadNews(firstLook: boolean): Promise<void> {
  const posts = await fetchNews().catch(() => null);
  if (!posts) return;
  const { current, seen, reading } = updates.get();
  updates.set({ posts });
  if (reading) return;
  const fresh = localStorage.getItem(SEEN) === null;
  const before = firstLook ? localStorage.getItem(RAN) : current;
  if (firstLook && current) localStorage.setItem(RAN, current);
  // Just updated: open on what this version brought, whatever else is waiting.
  const mine = firstLook && before && before !== current ? posts.find((p) => p.version === current) : undefined;
  if (mine) notify(`Lokus is now on version ${current}`);
  const next = mine ?? posts.find((p) => p.show === "popup" && !seen.includes(p.id) && applies(p, current));
  // Someone opening Lokus for the first time gets the newest one, not a queue of old ones.
  if (fresh) markSeen(posts.filter((p) => p.id !== next?.id && applies(p, current)).map((p) => p.id));
  if (next) readNews(next.id);
}

let started = false;
let last = 0;

/** Begin looking for updates and news: shortly after opening, then every half hour. */
export function startUpdates(): void {
  if (started) return;
  started = true;
  let first = true;
  const look = async () => {
    last = Date.now();
    if (!updates.get().current) await aboutApp().then((about) => updates.set({ current: about.version }), () => {});
    await check();
    await loadNews(first);
    first = false;
  };
  window.setTimeout(() => void look(), 2500);
  window.setInterval(() => void look(), EVERY);
  // A laptop that slept through the half hour asks when it is next looked at.
  window.addEventListener("focus", () => Date.now() - last > EVERY && void look());
}

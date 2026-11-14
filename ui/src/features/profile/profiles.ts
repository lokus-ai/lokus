/** @part-of ui.profile */
import { track } from "../../bridge/analytics";
import { useEffect } from "react";

import { rememberName } from "../../bridge/auth";
import { runCore } from "../../bridge/core";
import { createStore, useStore } from "../../shell/store";
import { app, refreshTree } from "../../shell/workspace";

/**
 * How someone on the team appears: the name they chose, what they do, and their picture.
 *
 * Where it lives, and why there are three places:
 * - **In the workspace**, as a note in `team/` marked `type: member` with the picture as a file
 *   beside it. This is what teammates see; it syncs like any note.
 * - **On this device**, a copy of your own profile. A workspace you have not been in before has
 *   no note for you, so the first time you open one your profile is written into it from here.
 * - **With your account**, the name only, so a new device greets you by it before anything syncs.
 */
export interface Profile {
  email: string;
  name: string;
  /** What they do: "Founder", "Support". Empty when not said. */
  role: string;
  /** A picture in the vault or on the web; empty when they have none. */
  picture: string;
  path: string;
}

const FOLDER = "team";
const store = createStore<{ byEmail: Record<string, Profile>; version: number }>({ byEmail: {}, version: -1 });

interface Row {
  path: string;
  props: Record<string, unknown>;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const slug = (email: string) => email.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "me";

/** A readable name from an email address, for someone who has not chosen one: "Pratham Patel". */
export const fromEmail = (email: string) =>
  email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\d+$/, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || email;

/** Your own profile as this device last knew it: enough to write it into a workspace afresh. */
interface Mine {
  name: string;
  role: string;
  /** The cropped picture itself, small, as a data address. */
  image: string;
}
const mineKey = (email: string) => `lokus.profile.${email.toLowerCase()}`;
function readMine(email: string): Mine | null {
  try {
    return JSON.parse(localStorage.getItem(mineKey(email)) ?? "null") as Mine | null;
  } catch {
    return null;
  }
}
function keepMine(email: string, change: Partial<Mine>): void {
  const now = { name: "", role: "", image: "", ...readMine(email), ...change };
  try {
    localStorage.setItem(mineKey(email), JSON.stringify(now));
  } catch {
    // No room for the picture: the name and role are still worth keeping.
    localStorage.setItem(mineKey(email), JSON.stringify({ ...now, image: "" }));
  }
}

/** Vaults already checked for a missing profile of mine this session, so it is offered once. */
const published = new Set<string>();

async function load(version: number): Promise<void> {
  const rows = await runCore<Row[]>("props.rows", { folder: FOLDER }).catch(() => [] as Row[]);
  const byEmail: Record<string, Profile> = {};
  for (const row of rows) {
    const email = text(row.props.email).toLowerCase();
    if (row.props.type !== "member" || !email) continue;
    byEmail[email] = { email, name: text(row.props.name) || fromEmail(email), role: text(row.props.role), picture: text(row.props.icon), path: row.path };
  }
  store.set({ byEmail, version });
  void follow(byEmail);
}

/**
 * Keep your profile with you. In a workspace that has none for you, write it from this device's
 * copy; in one that has, take it as this device's copy if the device has none (a new computer).
 */
async function follow(byEmail: Record<string, Profile>): Promise<void> {
  const { account, vault } = app.get();
  if (!account || !vault) return;
  const email = account.email.toLowerCase();
  const here = byEmail[email];
  const mine = readMine(email);
  if (here) {
    if (!mine) keepMine(email, { name: here.name, role: here.role });
    return;
  }
  const mark = `${vault.root}|${email}`;
  if (!mine || published.has(mark)) return;
  published.add(mark);
  let picture: string | undefined;
  if (mine.image.startsWith("data:image/")) picture = await writePicture(email, mine.image).catch(() => undefined);
  await saveProfile(email, { name: mine.name, role: mine.role, ...(picture ? { picture } : {}) }, false).catch(() => {});
}

/** Everyone's profile, by email. Kept up to date as notes change. */
export function useProfiles(): Record<string, Profile> {
  const version = useStore(app, (s) => s.version);
  const known = useStore(store, (s) => s.byEmail);
  useEffect(() => {
    if (store.get().version !== version) void load(version);
  }, [version]);
  return known;
}

export interface Me {
  email: string;
  name: string;
  role: string;
  picture: string;
  /** How they signed in: "google" or "email". */
  provider: string;
}

/**
 * The person signed in, as they should appear: what they chose here, else what their sign-in
 * provider says (a Google name and photo), else a name made from their email.
 */
export function useMe(): Me | null {
  const account = useStore(app, (s) => s.account);
  const profiles = useProfiles();
  if (!account) return null;
  const mine = profiles[account.email.toLowerCase()];
  return {
    email: account.email,
    name: mine?.name || account.name || fromEmail(account.email),
    role: mine?.role ?? "",
    picture: mine?.picture || account.picture || "",
    provider: account.provider,
  };
}

/** The profile that goes by this name, for showing a picture beside a name. */
export function profileNamed(profiles: Record<string, Profile>, name: string): Profile | undefined {
  const wanted = name.trim().toLowerCase();
  return Object.values(profiles).find((p) => p.name.toLowerCase() === wanted);
}

/** Change how someone appears. Makes their profile note the first time. */
export async function saveProfile(email: string, change: { name?: string; role?: string; picture?: string | null }, remember = true): Promise<void> {
  if (remember) track("action", { feature: "profile", action: "saved", fields: Object.keys(change).join(",") });
  const key = email.toLowerCase();
  const existing = store.get().byEmail[key];
  const path = existing?.path ?? `${FOLDER}/${slug(email)}.md`;
  const set = (name: string, value: string | null) => runCore("props.set", { path, key: name, value });
  if (!existing) {
    await runCore("note.create", { path, text: `---\ntype: member\nemail: ${key}\n---\n` });
    await set("name", change.name?.trim() || app.get().account?.name || fromEmail(email));
  } else if (change.name !== undefined) {
    await set("name", change.name.trim() || null);
  }
  if (change.role !== undefined) await set("role", change.role.trim() || null);
  if (change.picture !== undefined) {
    await set("icon", change.picture || null);
    // The picture it replaces is no longer shown anywhere; do not leave it to pile up.
    const old = existing?.picture;
    if (old && old !== change.picture && old.startsWith(`${FOLDER}/pictures/`)) await runCore("note.delete", { path: old }).catch(() => {});
  }
  if (remember && key === app.get().account?.email.toLowerCase()) {
    keepMine(email, { ...(change.name !== undefined ? { name: change.name.trim() } : {}), ...(change.role !== undefined ? { role: change.role.trim() } : {}), ...(change.picture === null ? { image: "" } : {}) });
    if (change.name?.trim()) void rememberName(change.name.trim()).catch(() => {});
  }
  await refreshTree();
  await load(store.get().version);
}

/** Write a picture given as a data address into the vault, and say where it went. */
async function writePicture(email: string, image: string): Promise<string> {
  const [head, base64] = image.split(",");
  const extension = /image\/(\w+)/.exec(head)?.[1].replace("jpeg", "jpg") ?? "png";
  // A new name each time, so everyone's app shows the new picture instead of one it remembered.
  const path = `${FOLDER}/pictures/${slug(email)}-${Date.now().toString(36)}.${extension}`;
  await runCore("file.write", { path, base64 });
  return path;
}

/**
 * Keep a cropped picture as your own: in the workspace, where the team gets it, and on this
 * device, so it can be written into the next workspace you open.
 */
export async function savePicture(email: string, image: string): Promise<void> {
  track("action", { feature: "profile", action: "picture_set" });
  const path = await writePicture(email, image);
  keepMine(email, { image });
  await saveProfile(email, { picture: path });
}

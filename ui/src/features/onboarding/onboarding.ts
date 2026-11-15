/** @part-of ui.onboarding */
import { aiSettings, type Connector, mcpLogin, saveAiConfig } from "../../bridge/ai";
import { track } from "../../bridge/analytics";
import { defaultVault, runCore } from "../../bridge/core";
import type { IconName } from "../../shell/Icon";
import { type Preferences, setPreference } from "../../shell/preferences";
import { createStore } from "../../shell/store";
import { app, applyLayout, openCustomers, openTasks, refreshTree, setVault } from "../../shell/workspace";
import { join, type Waiting } from "../teams/invites";

/**
 * The first-run setup: a few questions, and a workspace made from the answers.
 *
 * What is asked is what changes what Lokus does next: which pages to make, which services to
 * offer to connect, what the assistant is told this workspace is for. The answers stay on this
 * device and, when usage sharing is on, are sent to us so we learn who Lokus is for. Notes are
 * never part of that.
 */
export interface Answers {
  uses: string[];
  aim: string;
  /** Their own words, when none of the offered aims fit. */
  aimText: string;
  team: string;
  /** How they like their screen: calm, balanced or dense. */
  look: string;
  tools: string[];
  heard: string;
  heardText: string;
  /** Where notes will live when no folder is open yet; empty means Documents, Lokus. */
  folder: string;
}

export const EMPTY: Answers = { uses: [], aim: "", aimText: "", team: "", look: "", tools: [], heard: "", heardText: "", folder: "" };

export interface Option {
  id: string;
  label: string;
  hint?: string;
  icon?: IconName;
}

export const USES: Option[] = [
  { id: "customers", label: "Keeping up with customers", hint: "Who wrote in, who is waiting, who is at risk", icon: "customers" },
  { id: "tasks", label: "Running our tasks", hint: "One board the whole team works from", icon: "board" },
  { id: "notes", label: "Notes and docs", hint: "Specs, plans, things worth writing down", icon: "note" },
  { id: "meetings", label: "Meeting notes", hint: "What was said and what was promised", icon: "calendar" },
  { id: "wiki", label: "A team wiki", hint: "How we do things, in one place", icon: "layers" },
  { id: "personal", label: "My own thinking", hint: "A private place to think and remember", icon: "person" },
];

export const AIMS: Option[] = [
  { id: "no-customer-dropped", label: "No customer goes unanswered" },
  { id: "everyone-knows", label: "Everyone knows what to work on" },
  { id: "find-anything", label: "I can find anything in seconds" },
  { id: "fewer-tools", label: "Fewer tools open all day" },
  { id: "other", label: "Something else" },
];

export const TEAMS: Option[] = [
  { id: "solo", label: "Just me", icon: "person" },
  { id: "small", label: "A few of us", hint: "2 to 10 people", icon: "team" },
  { id: "large", label: "A bigger team", hint: "More than 10", icon: "customers" },
];

/** One choice that sets spacing, detail and layout together; each can be changed alone in Settings. */
export const LOOKS: (Option & { density: Preferences["density"]; detail: Preferences["detail"]; layout: Preferences["layout"] })[] = [
  { id: "calm", label: "Calm", hint: "Lots of room, only what matters", density: "roomy", detail: "essentials", layout: "standard" },
  { id: "balanced", label: "Balanced", hint: "The useful details, comfortably spaced", density: "regular", detail: "balanced", layout: "standard" },
  { id: "dense", label: "Everything at once", hint: "Tight rows, every detail, assistant open", density: "compact", detail: "everything", layout: "everything" },
];

/** Take a look on: the app behind the setup changes straight away. */
export function wear(look: string): void {
  const found = LOOKS.find((l) => l.id === look);
  if (!found) return;
  setPreference("density", found.density);
  setPreference("detail", found.detail);
  setPreference("layout", found.layout);
}

export const HEARD: Option[] = [
  { id: "friend", label: "A friend or colleague" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "search", label: "Google" },
  { id: "ai", label: "An AI assistant" },
  { id: "hn-reddit", label: "Hacker News or Reddit" },
  { id: "product-hunt", label: "Product Hunt" },
  { id: "other", label: "Somewhere else" },
];

const DONE = "lokus.onboarded";
const KEPT = "lokus.onboarding";

export const onboarding = createStore<{ open: boolean }>({ open: false });

/** What they answered last time, for the pages that read it (the start page, the assistant). */
export function keptAnswers(): Answers | null {
  try {
    return JSON.parse(localStorage.getItem(KEPT) ?? "null") as Answers | null;
  } catch {
    return null;
  }
}

/** Show the setup to someone who has never been through it. */
export function startOnboarding(): void {
  if (localStorage.getItem(DONE) === null) onboarding.set({ open: true });
}

export function leaveOnboarding(skipped: boolean, at = ""): void {
  localStorage.setItem(DONE, new Date().toISOString());
  if (skipped) track("onboarding_skipped", { at });
  onboarding.set({ open: false });
}

/** Sign in to a service in the browser and keep it among the assistant's connections. */
export async function connectService(c: Connector): Promise<void> {
  const server = { name: c.id, url: c.url, enabled: true };
  try {
    await mcpLogin(server);
  } catch (e) {
    track("connection_failed", { service: c.id, from: "setup" });
    throw e;
  }
  track("connection_added", { service: c.id, from: "setup" });
  const { config } = await aiSettings();
  if (!config.mcp.some((s) => s.name === c.id)) await saveAiConfig({ ...config, mcp: [...config.mcp, server] });
}

const label = (options: Option[], id: string) => options.find((o) => o.id === id)?.label ?? id;

export function aimInWords(a: Answers): string {
  if (a.aim === "other") return a.aimText.trim();
  return a.aim ? label(AIMS, a.aim) : "";
}

/** One line of the set-up: what it says while it happens, and the work behind it. */
export interface Job {
  id: string;
  says: string;
  run(): Promise<void>;
}

/**
 * What the answers turn into, in the order it is shown being done. Someone joining a team gets
 * a folder and the team's workspace in it; the pages are the team's, so none are made here.
 */
export function jobs(a: Answers, joining: Waiting | null = null): Job[] {
  const list: Job[] = [];
  if (!app.get().vault) {
    list.push({
      id: "folder",
      says: a.folder ? "Opening the folder you chose" : joining ? `Making a folder for ${joining.name} in Documents` : "Making a home for your notes in Documents",
      run: async () => setVault(a.folder || (await defaultVault(true, joining?.name)).root),
    });
  }
  if (joining) {
    list.push({ id: "join", says: `Joining ${joining.name}`, run: () => join(joining, "here") });
    list.push({ id: "arrive", says: "Bringing the team’s notes to this computer", run: async () => {} });
    return list;
  }
  const has = (path: string) => runCore("note.read", { path }).then(
    () => true,
    () => false,
  );
  if (a.uses.includes("customers")) {
    list.push({
      id: "customers",
      says: "Setting up your customer list",
      run: async () => {
        if (!(await has("Customers.md"))) await runCore("note.create", { path: "Customers.md", text: "---\nview: customers\nsource: customers\n---\n" });
      },
    });
  }
  if (a.uses.includes("tasks")) {
    list.push({
      id: "tasks",
      says: "Setting up your task board",
      run: async () => {
        if (!(await has("Tasks.md"))) await runCore("note.create", { path: "Tasks.md", text: "---\nview: tasks\n---\n" });
      },
    });
  }
  list.push({
    id: "assistant",
    says: "Telling the assistant what you are here for",
    run: async () => {
      const lines = [
        a.uses.length ? `- Lokus is used here for: ${a.uses.map((u) => label(USES, u).toLowerCase()).join(", ")}.` : "",
        aimInWords(a) ? `- What would make it worth it: ${aimInWords(a)}.` : "",
        a.team ? `- Who uses it: ${label(TEAMS, a.team).toLowerCase()}.` : "",
        a.tools.length ? `- Other tools the team uses: ${a.tools.join(", ")}.` : "",
      ].filter(Boolean);
      if (!lines.length) return;
      const section = `## About this workspace\n\n${lines.join("\n")}\n`;
      const existing = await runCore<{ text: string }>("note.read", { path: "Assistant.md" }).then(
        (n) => n.text,
        () => null,
      );
      if (existing === null) await runCore("note.create", { path: "Assistant.md", text: `${section}` });
      else if (!existing.includes("## About this workspace")) await runCore("note.write", { path: "Assistant.md", text: `${existing.trimEnd()}\n\n${section}` });
    },
  });
  return list;
}

/** Keep the answers, tell us (when sharing is on), and open what was made. */
export async function finish(a: Answers, joined = false): Promise<void> {
  localStorage.setItem(KEPT, JSON.stringify(a));
  track("onboarding_done", {
    joined,
    uses: a.uses.join(","),
    aim: aimInWords(a).slice(0, 200),
    team: a.team,
    look: a.look,
    tools: a.tools.join(","),
    heard: a.heard === "other" ? a.heardText.trim().slice(0, 120) || "other" : a.heard,
  });
  leaveOnboarding(false);
  applyLayout();
  await refreshTree().catch(() => {});
  if (a.uses.includes("tasks")) await openTasks();
  if (a.uses.includes("customers")) await openCustomers();
}

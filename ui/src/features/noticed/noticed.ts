/** @part-of ui.noticed */
import { aiActDone, aiApprove, aiSend, onAiAct, onAiEvent } from "../../bridge/ai";
import { track, traceChat } from "../../bridge/analytics";
import { aiSettings } from "../../bridge/ai";
import { runCore } from "../../bridge/core";
import { onSyncEvent } from "../../bridge/sync";
import { createStore } from "../../shell/store";
import { app, getEditor, notify, openNote, refreshTree } from "../../shell/workspace";
import { ask, brief, newChat } from "../ai/chat";

/**
 * The assistant working without being asked.
 *
 * It wakes up on a timer, and when a customer fact arrives from the team's own systems. Each
 * time it looks over the workspace and the connected services and leaves what it finds in the
 * Noticed list: a finding with what it recommends, or a suggestion for a note. It changes
 * nothing while doing this; anything that would change something is refused, and waits for the
 * person to say "Do it". What they choose is remembered and recommended next time.
 */
export interface Evidence {
  text: string;
  source: string;
  link?: string;
}

export interface Noticed {
  id: string;
  kind: "finding" | "suggestion";
  state: "new" | "done" | "dismissed";
  /** Seconds since 1970. */
  created: number;
  // A finding
  title?: string;
  summary?: string;
  evidence?: Evidence[];
  recommend?: string;
  /** The one number that makes it matter: "3 days waiting". */
  metric?: string;
  action?: string;
  situation?: string;
  follows?: string;
  customer?: string;
  urgency?: "now" | "soon" | "fyi";
  // A suggestion for a note
  path?: string;
  text?: string;
  after?: string;
  why?: string;
  link?: string;
}

export interface NoticedState {
  items: Noticed[];
  /** Whether the list is showing. */
  open: boolean;
  checking: boolean;
  /** When it last looked, in milliseconds; 0 when never on this device. */
  checked: number;
  /** Why the last look did not finish, in the assistant's own words; empty when it did. */
  problem: string;
}

const EVERY = "lokus.watch.every";
const CHECKED = "lokus.watch.checked";
const DUE = "lokus.watch.due";

export const noticed = createStore<NoticedState>({ items: [], open: false, checking: false, checked: Number(localStorage.getItem(CHECKED)) || 0, problem: "" });

/** How often it looks on its own, in minutes. 0: never. */
export const watchEvery = () => {
  const kept = localStorage.getItem(EVERY);
  // Hourly unless chosen otherwise: one look over a busy workspace read about as much as fifty questions.
  return kept === null ? 60 : Number(kept) || 0;
};
export function setWatchEvery(minutes: number): void {
  localStorage.setItem(EVERY, String(minutes));
  track("preference_changed", { key: "watch_every", value: String(minutes) });
  schedule();
}

export async function loadNoticed(): Promise<void> {
  if (!app.get().vault) return;
  const items = await runCore<Noticed[]>("noticed.list").catch(() => [] as Noticed[]);
  noticed.set({ items });
}

export const waiting = (items: Noticed[]) => items.filter((i) => i.state === "new");

/** A watch the person wrote: a note in `watches/` saying what to look for, and how often. */
interface Watch {
  path: string;
  name: string;
  every: number;
  text: string;
}

async function watchesDue(now: number): Promise<Watch[]> {
  const rows = await runCore<{ path: string; props: Record<string, unknown> }[]>("props.rows", { folder: "watches" }).catch(() => []);
  const last = JSON.parse(localStorage.getItem(DUE) ?? "{}") as Record<string, number>;
  const due: Watch[] = [];
  for (const row of rows) {
    if (row.props.type !== "watch" || row.props.off === true) continue;
    const every = Math.max(5, Number(row.props.every) || 60);
    if (now - (last[row.path] ?? 0) < every * 60_000 - 30_000) continue;
    const note = await runCore<{ text: string }>("note.read", { path: row.path }).catch(() => null);
    const text = (note?.text ?? "").replace(/^---[\s\S]*?---\s*/, "").trim().slice(0, 1500);
    if (text) due.push({ path: row.path, name: row.path.replace(/^watches\//, "").replace(/\.md$/, ""), every, text });
  }
  return due;
}

function request(since: string, known: Noticed[], watches: Watch[], reason: string): string {
  const already = known.slice(0, 40).map((i) => `- ${i.kind === "finding" ? i.title : `suggestion for ${i.path}`} [${i.state}]`);
  return [
    "You have woken up on your own; nobody asked you anything. Look over the workspace and the connected services for things the user would want to know, and leave each one with report_finding (use suggest_note_change for a note that is missing something or says something no longer true).",
    "",
    "You cannot change anything right now: any tool that changes something will be refused. Put what you would do into the finding's `action` so it can be done when the user says go.",
    "",
    "Look for, in this order:",
    "1. A customer waiting on us: start with list_customers, then the message services that are connected. Someone who wrote in and got no answer is the most important thing you can find.",
    "2. Before recommending a reply or a fix, check whether it is already handled: look at list_tasks and at issues, pull requests and deploys in the connected services. If the thing they complain about was already fixed or shipped, the finding is \"this is already fixed; tell them\", never an apology.",
    "3. Something you could put right yourself through a connected service (a setting, an account state): say what you would change and why.",
    "4. A note that says something a service, a task or a newer note contradicts, or that is missing what you found: suggest_note_change with the wording.",
    "5. Work nobody owns, or that is overdue.",
    "6. Notes that are plainly in the wrong place: one finding listing the moves you would make.",
    ...watches.flatMap((w) => ["", `The user also asked you to check this each time ("${w.name}"):`, w.text]),
    "",
    "Follow what is written under \"How we handle things\" in your notes: if the user chose something for this kind of situation before, recommend the same and quote that line in `follows`.",
    "",
    already.length ? `Already on the user's list, with what they did about it. Do not report these again:\n${already.join("\n")}` : "Nothing is on the user's list yet.",
    "",
    `You last looked ${since}. ${reason}`,
    "",
    "Report at most 5 things, the most important first, and only what you read evidence for just now. Finding nothing is a fine result: then report nothing. When you are done, reply with one line saying how many things you left.",
  ].join("\n");
}

let listening = false;
let current = "";

/** Look now. Ends with the Noticed list brought up to date; says so if something new is on it. */
export async function check(reason = "This is a routine look."): Promise<void> {
  const state = noticed.get();
  if (state.checking || !app.get().vault) return;
  if (!listening) {
    listening = true;
    // In the background nothing may be changed: whatever asks to is told no, at once.
    onAiEvent((id, event) => {
      if (id === current && event.type === "tool" && event.asks) void aiApprove(event.id, false);
    });
    onAiAct((id, call) => {
      if (id === current) void aiActDone(call, false, "There is no window to do this in while checking in the background. Say what you would do in the finding's action instead.");
    });
  }
  const before = new Set(waiting(state.items).map((i) => i.id));
  const now = Date.now();
  const id = `watch-${now.toString(36)}`;
  current = id;
  noticed.set({ checking: true, problem: "" });
  const watches = await watchesDue(now);
  const since = state.checked ? new Date(state.checked).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "never before on this device, so look at the last few days";
  let problem = "";
  try {
    const briefing = await brief();
    const outcome = await aiSend(id, [{ role: "user", content: request(since, state.items, watches, reason) }], briefing);
    const { config } = await aiSettings();
    traceChat({ trace: id, provider: config.provider, model: outcome.model, seconds: (Date.now() - now) / 1000, rounds: outcome.rounds, inputTokens: outcome.input_tokens, outputTokens: outcome.output_tokens, tools: outcome.tools, stop: outcome.stop, error: "", made: { background: 1 }, question: "", answer: "" });
    const due = JSON.parse(localStorage.getItem(DUE) ?? "{}") as Record<string, number>;
    for (const w of watches) due[w.path] = now;
    localStorage.setItem(DUE, JSON.stringify(due));
    localStorage.setItem(CHECKED, String(now));
  } catch (e) {
    problem = (e as { message?: string })?.message ?? String(e);
  }
  await loadNoticed();
  const fresh = waiting(noticed.get().items).filter((i) => !before.has(i.id));
  noticed.set({ checking: false, checked: problem ? state.checked : now, problem });
  track("action", { feature: "watch", action: problem ? "failed" : "looked", found: fresh.length, watches: watches.length });
  if (fresh.length && !noticed.get().open) notify(fresh.length === 1 ? `Noticed: ${fresh[0].title ?? "a suggestion for a note"}` : `The assistant noticed ${fresh.length} things`);
}

/** "Do it": hand what the finding proposed to the assistant, in the open, where each change is asked about. */
export async function act(item: Noticed, learn: boolean): Promise<void> {
  track("action", { feature: "noticed", action: "do_it", learn });
  await resolve(item, "done", learn);
  noticed.set({ open: false });
  newChat();
  app.set({ panel: { kind: "ai" } });
  await ask(`Do this, which you proposed after noticing it on your own:\n\n${item.action || item.recommend}\n\nWhat you noticed: ${item.title}. ${item.summary ?? ""}`);
}

export async function resolve(item: Noticed, state: "done" | "dismissed", learn: boolean): Promise<void> {
  if (state === "dismissed") track("action", { feature: "noticed", action: "dismissed", kind: item.kind, learn });
  const result = await runCore<{ learned: string | null }>("noticed.resolve", { id: item.id, state, learn }).catch(() => ({ learned: null }));
  if (result.learned) notify("Remembered for next time");
  await loadNoticed();
}

/** Add a suggested piece of text to its note: under the heading it named, or at the end. */
export async function addToNote(item: Noticed): Promise<void> {
  if (!item.path || !item.text) return;
  if (app.get().active !== item.path) await openNote(item.path);
  const editor = getEditor();
  if (!editor) return;
  const text = editor.text;
  const lines = text.split("\n");
  const wanted = (item.after ?? "").replace(/^#+\s*/, "").trim().toLowerCase();
  let at = lines.length;
  if (wanted) {
    const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, "").trim().toLowerCase() === wanted);
    if (start >= 0) {
      const next = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l));
      at = next >= 0 ? next : lines.length;
    }
  }
  while (at > 0 && lines[at - 1].trim() === "") at--;
  const added = [...lines.slice(0, at), "", item.text.trim(), ...(at < lines.length ? ["", ...lines.slice(at).filter((l, i) => i > 0 || l.trim() !== "")] : [""])];
  editor.replaceText(added.join("\n"));
  track("action", { feature: "noticed", action: "suggestion_added" });
  await resolve(item, "done", false);
}

const KINDS = "lokus.data.kinds";

/**
 * The first time a kind of thing arrives from the team's systems, say so, and offer what a
 * person would otherwise do by hand: read a few, give the fields readable names, and choose
 * which ones the list shows.
 */
async function newKind(kind: string): Promise<void> {
  if (!kind || kind.includes(".")) return;
  const known = JSON.parse(localStorage.getItem(KINDS) ?? "[]") as string[];
  if (known.includes(kind)) return;
  localStorage.setItem(KINDS, JSON.stringify([...known, kind]));
  const label = kind.replace(/_/g, " ");
  await runCore("noticed.report", {
    key: `new kind ${kind}`,
    item: {
      kind: "finding",
      urgency: "fyi",
      title: `Your systems started sending ${label} records`,
      summary: `They are in **data/${kind}**, with whatever fields were sent. Nothing says yet what each field means.`,
      recommend: "Let me read a few and set up the list",
      situation: "a new kind of data starts arriving from the team's own systems",
      action: `A new kind of record, "${kind}", has started arriving in the folder data/${kind}/ (list note: data/${label.replace(/^./, (c) => c.toUpperCase())} list.md). Read up to 8 of them. Then tell me, as a table: each field, what you think it means, its type and unit, and whether it belongs in the list. Say which fields you are unsure about. Name the 5 fields that matter most day to day and why. Do not change any notes yet; ask me before setting anything.`,
    },
  }).catch(() => {});
  await loadNoticed();
}

let timer = 0;
let soon = 0;
let reload = 0;

/** Keep the list current in this window: when the assistant finishes a step (it may have left something), and when the window is looked at again. */
export function followNoticed(): void {
  void loadNoticed();
  onAiEvent((_, event) => {
    if (event.type !== "tool_done") return;
    window.clearTimeout(reload);
    reload = window.setTimeout(() => void loadNoticed(), 400);
  });
  window.addEventListener("focus", () => void loadNoticed());
}

function schedule(): void {
  window.clearInterval(timer);
  const minutes = watchEvery();
  if (minutes > 0) timer = window.setInterval(() => void check(), minutes * 60_000);
}

/** Begin: look shortly after opening if it is due, then on the timer, and when a customer fact arrives. */
export function startWatching(): void {
  followNoticed();
  schedule();
  window.setTimeout(() => {
    void loadNoticed();
    const minutes = watchEvery();
    if (minutes > 0 && Date.now() - noticed.get().checked > minutes * 60_000) void check("The app has just been opened.");
  }, 45_000);
  // Something pushed in from the team's own systems is a reason to look, once things settle.
  onSyncEvent((event) => {
    const fact = event as { event: string; path?: string };
    if (fact.event === "fact" && fact.path?.startsWith("data/")) void newKind(fact.path.split("/")[1] ?? "");
    if (fact.event !== "fact" || watchEvery() === 0) return;
    window.clearTimeout(soon);
    soon = window.setTimeout(() => void check("New customer information has just arrived from the team's own systems; start with what changed."), 90_000);
  });
}

/** Make a watch for the person to change into their own, and open it. */
export async function exampleWatch(): Promise<void> {
  const path = "watches/Example watch.md";
  await runCore("note.create", {
    path,
    text: "---\ntype: watch\nevery: 60\n---\nCheck whether any customer has mentioned cancelling, pausing or a competitor since you last looked. If one has, tell me who, what they said and where.\n",
  }).catch(() => {});
  await refreshTree();
  app.set({ settings: null });
  await openNote(path);
}

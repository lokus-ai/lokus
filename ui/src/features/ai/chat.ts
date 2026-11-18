/** @part-of ui.ai */
import { aiActDone, type AiOutcome, aiApprove, type AiEvent, aiSend, aiSettings, aiStop, onAiAct, onAiEvent } from "../../bridge/ai";
import { type Entry, type Note, runCore } from "../../bridge/core";
import { traceChat, track } from "../../bridge/analytics";
import { createStore, type Store } from "../../shell/store";
import { allFiles, app, getEditor, isSwitchingVault, notify, openNote, refreshTree, registerChatFlush, showGraph } from "../../shell/workspace";

/** One thing shown in the conversation. */
export type Item =
  | { kind: "user"; text: string; note?: string; files?: string[] }
  | { kind: "assistant"; text: string; live: boolean }
  | { kind: "tool"; id: string; name: string; input: Record<string, unknown>; status: "asking" | "running" | "ok" | "failed"; result?: string }
  | { kind: "question"; id: string; question: string; options: string[]; multiple: boolean; answer?: string }
  | { kind: "notice"; text: string; error?: boolean; code?: string };

/** A note or folder explicitly chosen with @, rather than inferred from its display name. */
export interface Target {
  path: string;
  name: string;
}
interface Draft {
  text: string;
  mentions: Target[];
  files: string[];
  importing: number;
}
const emptyDraft = (): Draft => ({ text: "", mentions: [], files: [], importing: 0 });
const freshId = () => `chat-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let chatId = freshId();
let vaultRoot = app.get().vault?.root;
let requestId: string | null = null;
let opening = 0;
/** Only this window's unsent drafts; no disk, sync or settings store. */
const drafts = new Map<string, Map<string, Store<Draft>>>();
function vaultDrafts(root = vaultRoot): Map<string, Store<Draft>> {
  const key = root ?? "";
  if (!drafts.has(key)) drafts.set(key, new Map());
  return drafts.get(key)!;
}
function draftFor(id: string): Store<Draft> {
  const all = vaultDrafts();
  if (!all.has(id)) all.set(id, createStore(emptyDraft()));
  return all.get(id)!;
}

export const chat = createStore<{ items: Item[]; busy: boolean; history: boolean; draft: Store<Draft> }>({ items: [], busy: false, history: false, draft: draftFor(chatId) });

/** Send this exact draft; a refused/failed send or edits made while waiting keep it intact. */
export async function sendDraft(): Promise<void> {
  const store = chat.get().draft;
  const draft = store.get();
  if (draft.importing) return;
  const sent = await ask(draft.text, draft.mentions.filter((m) => draft.text.includes(`@${m.name}`)).map((m) => m.path), draft.files);
  if (sent && store.get() === draft) store.set(emptyDraft());
}

/** The largest file that can be attached; the same limit the vault puts on any file. */
const MAX_ATTACHMENT = 25 * 1024 * 1024;

/** Put a file already in the vault with the next message, and show the assistant. */
export function attachToChat(path: string): void {
  chat.get().draft.set((s) => ({ files: s.files.includes(path) ? s.files : [...s.files, path] }));
  if (app.get().panel?.kind !== "ai") app.set({ panel: { kind: "ai" } });
}

export function detach(path: string): void {
  chat.get().draft.set((s) => ({ files: s.files.filter((f) => f !== path) }));
}

/**
 * Take a file from the person's computer (picked, dropped or pasted), keep it in the vault's
 * attachments folder, and put it with the next message. Kept in the vault so the conversation
 * can be reopened later, and so a teammate carrying it on has the file too.
 */
export async function attachFile(file: File): Promise<void> {
  if (file.size > MAX_ATTACHMENT) return notify(`${file.name} is larger than 25 MB`);
  const root = vaultRoot;
  if (!root) return;
  const id = chatId;
  const store = chat.get().draft;
  const alive = () => vaultDrafts(root).get(id) === store;
  const taken = new Set([...allFiles(), ...reserved].map((p) => p.toLowerCase()));
  const dot = file.name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [file.name.slice(0, dot), file.name.slice(dot)] : [file.name || "Pasted", ""];
  let path = `attachments/${stem}${ext || ".png"}`;
  for (let n = 2; taken.has(path.toLowerCase()); n++) path = `attachments/${stem} ${n}${ext || ".png"}`;
  reserved.add(path);
  store.set((s) => ({ importing: s.importing + 1 }));
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (!alive()) return;
    await runCore("file.write", { path, base64 }, root);
    if (!alive()) return;
    store.set((s) => ({ files: [...s.files, path] }));
    if (root === vaultRoot) await refreshTree().catch(() => {});
  } catch (e) {
    if (alive()) notify(e instanceof Error ? e.message : String(e));
  } finally {
    reserved.delete(path);
    store.set((s) => ({ importing: s.importing - 1 }));
  }
}
const reserved = new Set<string>();

/** A conversation kept on this device, as the list shows it. */
export interface Kept {
  id: string;
  title: string;
  updated: number;
}

/** The open note's text is attached when it is this short; longer ones the assistant reads in parts. */
const ATTACH_LIMIT = 24_000;
const SELECTION_LIMIT = 4_000;
/** A note pointed at with @ is attached when it is this short, up to this much in one message. */
const MENTION_LIMIT = 12_000;
const MENTIONS_TOTAL = 30_000;
const INSTRUCTIONS_LIMIT = 24_000;
/** Where the person keeps standing instructions for the assistant. */
const INSTRUCTIONS = "Assistant.md";

/** The conversation as the provider needs it back. Never shown, never edited: only added to. */
let history: unknown[] = [];
let listening = false;
/** This conversation's standing context, written once when it starts and sent unchanged after. */
let briefing: string | null = null;
/** A shared conversation this one carries on from: its transcript, given to the assistant once. */
let carried: string | null = null;
/**
 * Kinds of change the person has said need not be asked about again for the request in hand.
 * It lasts until that request is finished or stopped; the next one asks afresh.
 */
/**
 * Kinds of change the person said yes to with "Allow all like this". They hold for the rest of
 * the conversation and no longer: a new chat asks again. Nothing here is saved or shared.
 */
const allowed = new Set<string>();
/** The open note as the assistant last saw it, so it is only sent again when it has changed. */
let seen: { path: string; text: string } | null = null;

/** What the assistant is told once, at the start: the date, the shape of the vault, the person's instructions. */
export async function brief(): Promise<string> {
  const { vault, tree } = app.get();
  const count = (entries: Entry[]): number => entries.reduce((n, e) => n + (e.kind === "folder" ? count(e.children ?? []) : e.kind === "note" ? 1 : 0), 0);
  const folders = tree.filter((e) => e.kind === "folder").map((e) => `${e.name}/ (${count(e.children ?? [])} notes)`);
  const loose = tree.filter((e) => e.kind === "note").length;
  const lines = [`Today is ${new Date().toLocaleDateString("en-CA")}.`];
  const me = app.get().account?.email;
  if (me) lines.push(`The user is signed in as ${me}. In messages and issues from connected services, that is "us", not a customer.`);
  if (vault) lines.push(`The vault is called "${vault.name}" and holds ${count(tree)} notes. At its top: ${[...folders, `${loose} notes`].join(", ")}.`);
  const own = await runCore<Note>("note.read", { path: INSTRUCTIONS }, vault?.root).then(
    (note) => note.text.trim().slice(0, INSTRUCTIONS_LIMIT),
    () => "",
  );
  // Which services are connected, so it reaches for them without being told their names.
  const connected = await aiSettings().then(
    // Only this workspace's: another one opened meanwhile has its own.
    (s) => (s.config.root === (vault?.root ?? "") ? [...s.config.mcp.filter((m) => m.enabled), ...s.plugin_servers].map((m) => m.name) : []),
    () => [] as string[],
  );
  if (connected.length) {
    lines.push(
      `The user has connected these services: ${connected.join(", ")}. Each one's tools are named mcp__<service>__<tool>. Use them when a question is about what lives in that service (issues, meetings, documents), and say which service an answer came from.`,
    );
  }
  // What they were working on lately, so "that thing from yesterday" means something.
  const recent = (await runCore<Kept[]>("chats.list", undefined, vault?.root).catch(() => [] as Kept[])).filter((c) => c.id !== chatId).slice(0, 6);
  if (recent.length) {
    lines.push(`The user's recent conversations with you, newest first (titles only): ${recent.map((c) => JSON.stringify(c.title.slice(0, 90))).join("; ")}.`);
  }
  lines.push(
    own
      ? `The note ${INSTRUCTIONS} holds the user's standing instructions for you and what you have been asked to remember. Follow it:\n<assistant_notes>\n${own}\n</assistant_notes>`
      : `The user can keep standing instructions for you in a note called ${INSTRUCTIONS} at the top of the vault. There is none yet; if they ask you to remember how they like things done, offer to create it.`,
  );
  return lines.join("\n");
}

/**
 * Where the person is right now. The open note's text rides along only when it is new or has
 * changed; `attached` is what to remember as seen once the message has actually been sent.
 */
async function appState(mentions: string[]): Promise<{ text: string; attached: typeof seen }> {
  const root = vaultRoot;
  const note = app.get().active;
  const editor = getEditor();
  const lines = ["<app_state>", `open_note: ${note ?? "none"}`];
  const selection = editor?.selection.trim() ?? "";
  if (note && selection) lines.push(`selected_text: ${JSON.stringify(selection.slice(0, SELECTION_LIMIT))}`);
  const text = note ? editor?.text : undefined;
  let attach = "";
  let attached = seen;
  if (note && text !== undefined) {
    if (seen?.path === note && seen.text === text) lines.push("open_note_text: unchanged since it was last attached in this conversation");
    else if (text.length > ATTACH_LIMIT) lines.push(`open_note_text: not attached (${text.split("\n").length} lines); read it with read_note`);
    else {
      lines.push("open_note_text: attached below");
      attach = `\n<open_note path=${JSON.stringify(note)}>\n${text}\n</open_note>`;
      attached = { path: note, text };
    }
  }
  // Notes and folders the person pointed at with @. Short notes ride along; the rest are named.
  if (mentions.length) lines.push(`mentioned: ${mentions.map((m) => JSON.stringify(m)).join(", ")}`);
  let room = MENTIONS_TOTAL;
  for (const path of mentions) {
    if (path === note || path.endsWith("/")) continue;
    const body = await runCore<Note>("note.read", { path }, root).then(
      (n) => n.text,
      () => null,
    );
    if (body === null || body.length > MENTION_LIMIT || body.length > room) continue;
    room -= body.length;
    attach += `\n<note path=${JSON.stringify(path)}>\n${body}\n</note>`;
  }
  return { text: `${lines.join("\n")}\n</app_state>${attach}\n\n`, attached };
}

/** Questions the assistant has asked that the person has not answered yet, by the question's id. */
const asked = new Map<string, (answer: string) => void>();

/** Keep the question and visible progress when a reply stops before its provider history arrives. */
function interrupted(message: { role: string; content: unknown }, why: string): void {
  const items = chat.get().items;
  const since = items.slice(items.map((i) => i.kind).lastIndexOf("user") + 1);
  const said = since.filter((i) => i.kind === "assistant").map((i) => (i.kind === "assistant" ? i.text : "")).join("\n").trim();
  history = [...history, message, { role: "assistant", content: [{ type: "text", text: `${said ? `${said}\n\n` : ""}(${why} The request above still stands unless they say otherwise.)` }] }];
}

/** The person's answer to a question the assistant asked. */
export function reply(id: string, text: string): void {
  track("action", { feature: "assistant", action: "question_answered" });
  const said = text.trim();
  if (!said) return;
  update((items) => items.map((i) => (i.kind === "question" && i.id === id ? { ...i, answer: said } : i)));
  asked.get(id)?.(said);
  asked.delete(id);
}

/** Carry out a tool that acts on the app's window and say what happened. */
async function act(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "ask_user") {
    // The question is already on screen (it arrived as this tool's event); wait for the answer.
    const waiting = [...chat.get().items].reverse().find((i) => i.kind === "question" && !i.answer);
    if (!waiting || waiting.kind !== "question") throw new Error("the question could not be shown");
    return new Promise<string>((resolve) => asked.set(waiting.id, (said) => resolve(`The user answered: ${said}`)));
  }
  if (name === "show_graph") {
    showGraph();
    return "the graph is showing";
  }
  if (name === "open_note") {
    const path = String(input.path ?? "");
    if (!allFiles().includes(path)) throw new Error(`there is no note at ${path}; find its path with search_notes or list_folder`);
    await openNote(path);
    const heading = typeof input.heading === "string" ? input.heading.trim() : "";
    if (heading && !getEditor()?.reveal(`#${heading}`)) return `opened ${path}, but it has no heading called "${heading}"`;
    return `opened ${path}`;
  }
  throw new Error(`the app cannot do ${name}`);
}

const update = (change: (items: Item[]) => Item[]) => chat.set((s) => ({ items: change(s.items) }));

function onEvent(event: AiEvent): void {
  update((items) => {
    const last = items[items.length - 1];
    switch (event.type) {
      case "text":
        if (last?.kind === "assistant" && last.live) return [...items.slice(0, -1), { ...last, text: last.text + event.delta }];
        return [...items, { kind: "assistant", text: event.delta, live: true }];
      case "tool":
        if (event.name === "ask_user") {
          const options = Array.isArray(event.input.options) ? event.input.options.map(String).slice(0, 8) : [];
          return [...settle(items), { kind: "question", id: event.id, question: String(event.input.question ?? ""), options, multiple: event.input.multiple === true }];
        }
        if (event.asks && allowed.has(event.name)) {
          // Already allowed in this conversation: say yes without stopping to ask.
          void aiApprove(event.id, true);
          return [...settle(items), { kind: "tool", id: event.id, name: event.name, input: event.input, status: "running" }];
        }
        return [...settle(items), { kind: "tool", id: event.id, name: event.name, input: event.input, status: event.asks ? "asking" : "running" }];
      case "tool_done":
        keepSoon();
        return items.map((i) => (i.kind === "tool" && i.id === event.id ? { ...i, status: event.ok ? "ok" : "failed", result: event.result } : i));
      case "notice":
        return [...items, { kind: "notice", text: event.message }];
    }
  });
}

/** Nothing is streaming any more. */
const settle = (items: Item[]): Item[] =>
  items.map((i) => (i.kind === "assistant" && i.live ? { ...i, live: false } : i.kind === "tool" && (i.status === "asking" || i.status === "running") ? { ...i, status: "failed" } : i));

const STOPPED: Record<string, string> = {
  refusal: "The model declined to answer this.",
  max_tokens: "The answer was cut off because it reached the length limit.",
  step_limit: "Paused after 120 steps, so a long job cannot run away. Nothing is lost: say “keep going” and it carries on from here.",
};

/** A request's parts as flat numbers: characters of instructions, briefing, conversation and each tool source. */
function made(outcome: AiOutcome | null): Record<string, number> {
  const c = outcome?.context;
  if (!c) return {};
  const sources = Object.entries(c.tools ?? {});
  return {
    chars_instructions: c.instructions,
    chars_briefing: c.briefing,
    chars_conversation: c.conversation,
    chars_tools: sources.reduce((n, [, t]) => n + t.chars, 0),
    tools_offered: sources.reduce((n, [, t]) => n + t.count, 0),
    ...Object.fromEntries(sources.flatMap(([name, t]) => [[`chars_tools_${name}`, t.chars], [`tools_offered_${name}`, t.count]])),
  };
}

/** Tell us how a request to the assistant went: how long, which model, which tools, whether it failed. */
function traced(id: string, began: number, question: string, outcome: AiOutcome | null, error: string): void {
  const items = chat.get().items;
  const since = items.slice(items.map((i) => i.kind).lastIndexOf("user") + 1);
  void aiSettings().then(
    ({ config }) =>
      traceChat({
        trace: `${id}-${began}`,
        provider: config.provider,
        model: outcome?.model || config.model || "default",
        seconds: (Date.now() - began) / 1000,
        rounds: outcome?.rounds ?? 0,
        inputTokens: outcome?.input_tokens ?? 0,
        outputTokens: outcome?.output_tokens ?? 0,
        tools: outcome?.tools ?? since.flatMap((i) => (i.kind === "tool" ? [i.name] : [])),
        stop: outcome?.stop ?? "error",
        made: made(outcome),
        error,
        question,
        answer: since.map((i) => (i.kind === "assistant" ? i.text : "")).join("\n").trim(),
      }),
    () => {},
  );
}

/** Ask a question. `mentions` are the paths of notes (or folders, ending in "/") picked with @. */
export async function ask(text: string, mentions: string[] = [], files: string[] = []): Promise<boolean> {
  // A file sent with no words is still a question: what is this?
  const question = text.trim() || (files.length ? (files.length === 1 ? "Take a look at this file." : "Take a look at these files.") : "");
  if (!question || chat.get().busy || !vaultRoot || isSwitchingVault() || deleting.has(JSON.stringify([vaultRoot, chatId]))) return false;
  if (!listening) {
    listening = true;
    onAiEvent((id, event) => id === requestId && onEvent(event));
    onAiAct((id, call, name, input) => {
      if (id !== requestId) return;
      void act(name, input).then(
        (done) => aiActDone(call, true, done),
        (e) => aiActDone(call, false, e instanceof Error ? e.message : String(e)),
      );
    });
  }
  const note = app.get().active;
  chat.set((s) => ({ busy: true, items: [...s.items, { kind: "user", text: text.trim(), note: note ?? undefined, files: files.length ? files : undefined }] }));
  const sending = freshId();
  // The workspace the question is asked in: its notes and its connections answer it, or nothing does.
  const from = vaultRoot;
  requestId = sending;
  let pending: { role: string; content: unknown } | null = null;
  let began = 0;
  track("assistant_asked", { files: files.length, mentions: mentions.length, turn: chat.get().items.filter((i) => i.kind === "user").length });
  try {
    const state = await appState(mentions);
    if (sending !== requestId) return false;
    // A file goes as its place in the vault; what it holds is put in when the request is made.
    const said = state.text + question;
    const message = { role: "user", content: files.length ? [{ type: "text", text: said }, ...files.map((path) => ({ type: "attachment", path }))] : said };
    pending = message;
    unanswered = message;
    // Kept at once, before the first step: a reply cut off early is still found again.
    keep();
    const context = briefing ?? (await brief()) + (carried ? `\n\nThe user is carrying on a conversation that was shared with their workspace. What was said in it, for you to build on:\n<shared_conversation>\n${carried}\n</shared_conversation>` : "");
    if (sending !== requestId) return false;
    briefing = context;
    began = Date.now();
    const outcome = await aiSend(sending, [...history, message], briefing, from);
    if (sending !== requestId) return false;
    traced(sending, began, question, outcome, "");
    history = [...history, message, ...outcome.messages];
    pending = null;
    seen = state.attached;
    update((items) => (STOPPED[outcome.stop] ? [...settle(items), { kind: "notice", text: STOPPED[outcome.stop] }] : settle(items)));
    return outcome.stop !== "refusal";
  } catch (e) {
    if (sending !== requestId) return false;
    const failed = e as { code?: string; message?: string };
    if (began) traced(sending, began, question, null, failed.code === "stopped" ? "stopped" : (failed.message ?? String(e)));
    const err = e as { code?: string; message?: string };
    // The question is kept even though no answer came back, with whatever had been said so far.
    // Without this the next message ("continue") reached a model that had never seen the question.
    if (pending) {
      const why = err.code === "stopped" ? "The user stopped this reply before it was finished." : "This reply failed before it was finished.";
      interrupted(pending, why);
    }
    update((items) => [...settle(items), { kind: "notice", text: err.code === "stopped" ? "Stopped." : (err.message ?? String(e)), error: err.code !== "stopped", code: err.code }]);
    return false;
  } finally {
    if (sending === requestId) {
      window.clearTimeout(keeping);
      requestId = null;
      unanswered = null;
      chat.set({ busy: false });
      keep();
    }
  }
}

/**
 * Keep this conversation on this device, so it can be found and continued later. It goes in the
 * folder that is never synced: a conversation is the person's own until they choose to share it.
 */
function keep(): Promise<unknown> {
  if (deleting.has(JSON.stringify([vaultRoot, chatId]))) return saving;
  const items = settle(chat.get().items);
  const first = items.find((i) => i.kind === "user");
  if (!first || first.kind !== "user") return saving;
  // While a reply is still being worked on, the request it answers is kept beside it, so a
  // conversation cut off by the app closing can be told apart from a finished one and resumed.
  const root = vaultRoot;
  const saved = { id: chatId, title: first.text, updated: Date.now(), body: { items, history, ...(unanswered ? { unanswered } : {}) } };
  const persisted = saving.then(() => runCore("chats.save", saved, root));
  // Drain failed writes too; only the caller requiring this snapshot must refuse on its error.
  saving = persisted.catch((e) => {
    if (root === vaultRoot) notify(e instanceof Error ? e.message : String(e));
  });
  return persisted;
}

/** The request being answered right now; null between replies. */
let unanswered: { role: string; content: unknown } | null = null;
let keeping = 0;
/** Saves finish in order; loading or deleting waits for already captured writes. */
let saving: Promise<unknown> = Promise.resolve();
const deleting = new Set<string>();
const DELETING = "Wait for this conversation to finish deleting.";

/** Keep recoverable progress active until deletion succeeds or fails. External root changes already happened. */
function canLeaveChat(): boolean {
  if (app.get().vault?.root !== vaultRoot || !deleting.has(JSON.stringify([vaultRoot, chatId]))) return true;
  notify(DELETING);
  return false;
}

/** Save as it goes, a moment after each step, so little is lost if the app closes mid-reply. */
function keepSoon(): void {
  window.clearTimeout(keeping);
  keeping = window.setTimeout(keep, 500);
}

export async function keptChats(): Promise<Kept[]> {
  const root = vaultRoot;
  const kept = await runCore<Kept[]>("chats.list", undefined, root).catch(() => [] as Kept[]);
  // A message not sent yet has no transcript on disk, but must still be reachable after New.
  for (const [id, store] of vaultDrafts(root)) {
    const draft = store.get();
    if (!kept.some((c) => c.id === id) && (draft.text || draft.files.length || draft.importing)) {
      kept.unshift({ id, title: draft.text.trim() || draft.files[0]?.split("/").pop() || "Draft", updated: Date.now() });
    }
  }
  return kept;
}

/** Bring a kept conversation back, ready to be continued. */
export async function openChat(id: string): Promise<void> {
  track("action", { feature: "assistant", action: "chat_reopened" });
  const ticket = ++opening;
  const root = vaultRoot;
  if (!canLeaveChat()) return;
  if (deleting.has(JSON.stringify([root, id]))) return;
  if (id === chatId) {
    chat.set({ history: false });
    return;
  }
  let kept: { body: { items?: Item[]; history?: unknown[]; unanswered?: { role: string; content: string } } };
  try {
    await saving;
    if (ticket !== opening || root !== vaultRoot) return;
    kept = await runCore<typeof kept>("chats.load", { id }, root);
  } catch (e) {
    if (ticket !== opening || root !== vaultRoot) return;
    if ((e as { code?: string }).code === "not_found" && vaultDrafts(root).has(id)) kept = { body: {} };
    else {
      notify(e instanceof Error ? e.message : String(e));
      return;
    }
  }
  if (ticket !== opening || root !== vaultRoot) return;
  if (!canLeaveChat()) return;
  leaveChat();
  asked.clear();
  chatId = id;
  allowed.clear();
  history = kept.body.history ?? [];
  let items = kept.body.items ?? [];
  const cut = kept.body.unanswered;
  if (cut) {
    // The reply was interrupted. Tell the model what had been asked and how
    // far it got, and tell the person, so "keep going" picks up where it left off.
    const since = items.slice(items.map((i) => i.kind).lastIndexOf("user") + 1);
    const steps = since.flatMap((i) => (i.kind === "tool" && i.status === "ok" ? [i.name] : []));
    const said = since.map((i) => (i.kind === "assistant" ? i.text : "")).join("\n").trim();
    history = [...history, cut, { role: "assistant", content: [{ type: "text", text: `${said ? `${said}\n\n` : ""}(This reply was interrupted before it finished. Steps that had completed: ${steps.length ? steps.join(", ") : "none"}. Check what is already done before doing it again. The request above still stands.)` }] }];
    items = [...items.map((i) => (i.kind === "tool" && (i.status === "running" || i.status === "asking") ? { ...i, status: "failed" as const, result: "The reply was interrupted before this finished" } : i)), { kind: "notice", text: "This reply was cut off before it finished. Say “keep going” and it carries on from here." }];
  }
  briefing = null;
  carried = null;
  seen = null;
  chat.set({ items, busy: false, history: false, draft: draftFor(id) });
}

export async function forgetChat(id: string): Promise<void> {
  track("action", { feature: "assistant", action: "chat_deleted" });
  const root = vaultRoot;
  const key = JSON.stringify([root, id]);
  if (deleting.has(key)) return;
  deleting.add(key);
  ++opening;
  if (id === chatId) {
    leaveChat(false);
    chat.set((s) => ({ busy: false, items: settle(s.items) }));
  }
  try {
    await saving;
    await runCore("chats.delete", { id }, root);
  } catch (e) {
    deleting.delete(key);
    if (root === vaultRoot && id === chatId) keep();
    notify(e instanceof Error ? e.message : String(e));
    return;
  }
  deleting.delete(key);
  vaultDrafts(root).delete(id);
  if (root === vaultRoot && id === chatId) newChat();
}

/** Where shared conversations are kept in the vault, and how much of one is handed on. */
const SHARED_FOLDER = "chats";
const CARRY_LIMIT = 60_000;

const placeOf = (name: string): string => {
  const [, id] = name.match(/^mcp__(.+?)__/) ?? [];
  return id ? id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase()) : "the notes";
};

/** A conversation as a note anyone can read: who said what, and where the assistant looked. */
function transcript(items: Item[]): string {
  const out: string[] = [];
  let looked: string[] = [];
  const flush = () => {
    if (looked.length) out.push(`> Looked in ${[...new Set(looked)].join(", ")}.`);
    looked = [];
  };
  for (const item of items) {
    if (item.kind === "tool") {
      looked.push(placeOf(item.name));
      continue;
    }
    flush();
    if (item.kind === "user") out.push(`**You:** ${item.text}`);
    else if (item.kind === "assistant" && item.text.trim()) out.push(item.text.trim());
    else if (item.kind === "question" && item.answer) out.push(`> Asked: ${item.question}\n> Answered: ${item.answer}`);
  }
  flush();
  return out.join("\n\n");
}

/**
 * Share this conversation with the workspace: it becomes a note in `chats/`, which syncs like
 * any other. Until someone does this, a conversation stays on the device it happened on.
 */
export async function shareChat(): Promise<void> {
  track("action", { feature: "assistant", action: "chat_shared" });
  const items = settle(chat.get().items);
  const first = items.find((i) => i.kind === "user");
  if (!first || first.kind !== "user") return;
  const title = first.text.replace(/[\\/:*?"<>|#^[\]\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70).replace(/[.\s]+$/, "") || "Conversation";
  const taken = new Set(allFiles());
  let path = `${SHARED_FOLDER}/${title}.md`;
  for (let n = 2; taken.has(path); n++) path = `${SHARED_FOLDER}/${title} ${n}.md`;
  const by = app.get().account?.email ?? "";
  const head = ["---", "type: chat", ...(by ? [`shared_by: ${by}`] : []), `shared_at: ${new Date().toISOString().slice(0, 10)}`, "---", ""].join("\n");
  try {
    await runCore("note.create", { path, text: `${head}${transcript(items)}\n` });
    await refreshTree();
    notify("Shared with the workspace");
    await openNote(path);
  } catch (e) {
    notify(e instanceof Error ? e.message : String(e));
  }
}

/** Start a new conversation that carries on from a shared one. */
export async function continueShared(path: string): Promise<void> {
  if (!canLeaveChat()) return;
  track("action", { feature: "assistant", action: "shared_chat_continued" });
  const root = vaultRoot;
  const ticket = ++opening;
  const note = await runCore<Note>("note.read", { path }, root);
  if (root !== vaultRoot || ticket !== opening) return;
  const body = note.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
  if (!newChat()) return;
  carried = body.length > CARRY_LIMIT ? body.slice(body.length - CARRY_LIMIT) : body;
  const name = path.split("/").pop()!.replace(/\.md$/i, "");
  chat.set({ items: [{ kind: "notice", text: `Carrying on from “${name}”. The assistant has read it; ask your next question.` }] });
  app.set({ panel: { kind: "ai" } });
}

export function stop(): void {
  // A handoff may still be preparing, before there is a provider request to stop.
  if (!requestId) ++opening;
  stopReply(true);
}

function stopReply(preserve: boolean): Promise<unknown> {
  if (!requestId) return saving;
  track("action", { feature: "assistant", action: "stopped" });
  void aiStop(requestId);
  requestId = null;
  window.clearTimeout(keeping);
  if (unanswered) interrupted(unanswered, "The user stopped this reply before it was finished.");
  unanswered = null;
  chat.set((s) => ({ busy: false, items: [...settle(s.items), { kind: "notice", text: "Stopped." }] }));
  return preserve ? keep() : saving;
}

/** Allow this change and every further change of the same kind until the current request is done. */
export function answerAll(id: string): void {
  track("action", { feature: "assistant", action: "allowed_all" });
  const item = chat.get().items.find((i) => i.kind === "tool" && i.id === id);
  if (item?.kind === "tool") allowed.add(item.name);
  answer(id, true);
}

export function answer(id: string, allow: boolean): void {
  track("action", { feature: "assistant", action: allow ? "change_allowed" : "change_declined" });
  update((items) => items.map((i) => (i.kind === "tool" && i.id === id && i.status === "asking" ? { ...i, status: "running" } : i)));
  void aiApprove(id, allow);
}

function leaveChat(preserve = true): void {
  if (chat.get().busy) stopReply(preserve);
  requestId = null;
  window.clearTimeout(keeping);
  unanswered = null;
}

/** A delayed handoff may act only in the conversation it prepared, without replacing newer work. */
export function captureChat(): { root: string | undefined; current(): boolean } {
  const root = vaultRoot, id = chatId, ticket = opening;
  const { draft, items } = chat.get();
  return {
    root,
    current: () => {
      const state = chat.get();
      return root === vaultRoot && root === app.get().vault?.root && id === chatId && ticket === opening && state.draft === draft && state.items === items && !state.busy && !isSwitchingVault();
    },
  };
}

export function newChat(): boolean {
  if (!canLeaveChat()) return false;
  track("action", { feature: "assistant", action: "new_chat" });
  ++opening;
  leaveChat();
  vaultRoot = app.get().vault?.root;
  asked.clear();
  chatId = freshId();
  allowed.clear();
  history = [];
  briefing = null;
  carried = null;
  seen = null;
  chat.set({ items: [], busy: false, history: false, draft: draftFor(chatId) });
  return true;
}

registerChatFlush(async () => {
  if (!canLeaveChat()) throw new Error(DELETING);
  ++opening;
  await (chat.get().busy ? stopReply(true) : keep());
});

// Panels may unmount freely; a different workspace must never inherit this conversation.
app.subscribe(() => {
  const root = app.get().vault?.root;
  if (root === vaultRoot) return;
  newChat();
});

/** @part-of ui.shell */
import type { EditorState } from "@codemirror/state";

import { identify, track } from "../bridge/analytics";
import { type Account, currentAccount } from "../bridge/auth";
import {
  closeWindow,
  CoreError,
  currentVault,
  type Entry,
  type Eol,
  type Note,
  onCloseTab,
  onIndexReady,
  onVaultChanged,
  openVault,
  pickFolder,
  runCore,
  vaultFileUrl,
  type VaultInfo,
} from "../bridge/core";
import { Editor } from "../editor/editor";
import { createStore } from "./store";

/** Everything the screens render from. Notes themselves live in the editor. */
export interface AppState {
  ready: boolean;
  vault: VaultInfo | null;
  tree: Entry[];
  tabs: string[];
  active: string | null;
  dirty: Record<string, boolean>;
  /** Frontmatter of the active note (icon, cover, …). */
  properties: Record<string, string>;
  /** A note that changed on disk while it had unsaved edits here. */
  conflict: string | null;
  palette: "commands" | "notes" | "search" | null;
  /** What the main area shows. */
  view: "note" | "graph";
  /** Goes up whenever files or the index change; panels refetch on it. */
  version: number;
  sidebar: boolean;
  sidebarWidth: number;
  /** The window is too narrow to keep the sidebar beside the note. */
  narrow: boolean;
  account: Account | null;
  accountDialog: boolean;
  notice: string | null;
}

export const app = createStore<AppState>({
  ready: false,
  vault: null,
  tree: [],
  tabs: [],
  active: null,
  dirty: {},
  properties: {},
  conflict: null,
  palette: null,
  view: "note",
  version: 0,
  sidebar: true,
  sidebarWidth: Number(localStorage.getItem("lokus.sidebarWidth")) || 248,
  narrow: false,
  account: null,
  accountDialog: false,
  notice: null,
});

interface Session {
  state: EditorState;
  /** Editor text at the last read or save. */
  saved: string;
  eol: Eol;
  hash: string;
}

const SAVE_DELAY = 600;
const sessions = new Map<string, Session>();
const saveTimers = new Map<string, number>();
let editor: Editor | null = null;

export function getEditor(): Editor | null {
  return app.get().active ? editor : null;
}

const toEditor = (text: string) => text.replace(/\r\n?/g, "\n");

function allFiles(entries: Entry[] = app.get().tree, out: string[] = []): string[] {
  for (const e of entries) {
    if (e.kind === "folder") allFiles(e.children ?? [], out);
    else out.push(e.path);
  }
  return out;
}

/** Web images load as they are; vault images are looked up beside the note, then anywhere. */
function resolveImage(src: string): string | null {
  if (/^(https?:|data:)/i.test(src)) return src;
  const { vault, active } = app.get();
  if (!vault || /^[a-z]+:/i.test(src)) return null;
  let wanted = src;
  try {
    wanted = decodeURI(src);
  } catch {
    // keep the raw text
  }
  wanted = wanted.replace(/^\.\//, "");
  const folder = active?.includes("/") ? active.slice(0, active.lastIndexOf("/") + 1) : "";
  const files = allFiles();
  const lower = wanted.toLowerCase();
  const found =
    files.find((f) => f === folder + wanted) ??
    files.find((f) => f === wanted) ??
    files.find((f) => f.toLowerCase().endsWith(`/${lower}`) || f.toLowerCase() === lower);
  return found ? vaultFileUrl(vault.root, found) : null;
}

export function notify(message: string): void {
  app.set({ notice: message });
  window.setTimeout(() => app.get().notice === message && app.set({ notice: null }), 4000);
}

function report(e: unknown): void {
  notify(e instanceof Error ? e.message : String(e));
}

export function attachEditor(parent: HTMLElement): void {
  if (editor) return;
  editor = new Editor(parent, {
    onChange(text) {
      const path = app.get().active;
      const session = path ? sessions.get(path) : undefined;
      if (!path || !session) return;
      setDirty(path, text !== session.saved);
      syncProperties();
      if (text !== session.saved) scheduleSave(path);
    },
    onOpenLink: (target) => void openLink(target),
    resolveImage,
    loadNote,
    notePaths: () => allNotes(),
  });
}

function setDirty(path: string, dirty: boolean): void {
  if (Boolean(app.get().dirty[path]) !== dirty) app.set((s) => ({ dirty: { ...s.dirty, [path]: dirty } }));
}

function syncProperties(): void {
  const next = getEditor()?.properties() ?? {};
  if (JSON.stringify(next) !== JSON.stringify(app.get().properties)) app.set({ properties: next });
}

function textOf(path: string): string | null {
  if (path === app.get().active && editor) return editor.text;
  return sessions.get(path)?.state.doc.toString() ?? null;
}

function scheduleSave(path: string): void {
  window.clearTimeout(saveTimers.get(path));
  saveTimers.set(
    path,
    window.setTimeout(() => void save(path), SAVE_DELAY),
  );
}

/** Write a note if it has changes. `force` overwrites an outside edit. */
export async function save(path: string, force = false): Promise<void> {
  window.clearTimeout(saveTimers.get(path));
  const session = sessions.get(path);
  const text = textOf(path);
  if (!session || text === null || (text === session.saved && !force)) return;
  try {
    const written = await runCore<{ hash: string }>("note.write", {
      path,
      text,
      eol: session.eol,
      expected_hash: force ? null : session.hash,
    });
    session.hash = written.hash;
    session.saved = text;
    setDirty(path, textOf(path) !== text);
    if (app.get().conflict === path) app.set({ conflict: null });
  } catch (e) {
    if (e instanceof CoreError && e.code === "conflict") app.set({ conflict: path });
    else report(e);
  }
}

export async function saveAll(): Promise<void> {
  await Promise.all([...sessions.keys()].map((p) => save(p)));
}

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 420;
const NARROW = "(max-width: 760px)";

export function setSidebarWidth(width: number): void {
  const clamped = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)));
  localStorage.setItem("lokus.sidebarWidth", String(clamped));
  app.set({ sidebarWidth: clamped });
}

/** On a narrow window the sidebar closes and opens as an overlay instead. */
function watchWidth(): void {
  const query = window.matchMedia(NARROW);
  const apply = () => app.set({ narrow: query.matches, sidebar: !query.matches });
  query.addEventListener("change", apply);
  apply();
}

export async function boot(): Promise<void> {
  watchWidth();
  onVaultChanged((paths) => void onDiskChange(paths));
  onIndexReady(() => app.set((s) => ({ version: s.version + 1 })));
  onCloseTab(() => {
    const { active } = app.get();
    if (active) void closeTab(active);
    else closeWindow();
  });
  const [vault, account] = await Promise.all([currentVault(), currentAccount().catch(() => null)]);
  identify(account?.id ?? null);
  app.set({ vault, account, ready: true });
  track("app_opened");
  if (vault) await refreshTree();
}

export async function setVault(path: string): Promise<void> {
  await saveAll();
  const vault = await openVault(path);
  sessions.clear();
  app.set({ vault, tabs: [], active: null, dirty: {}, properties: {}, conflict: null });
  track("vault_opened");
  await refreshTree();
}

export async function chooseVault(): Promise<void> {
  const path = await pickFolder();
  if (path) await setVault(path).catch(report);
}

export async function refreshTree(): Promise<void> {
  app.set({ tree: await runCore<Entry[]>("vault.tree") });
}

export function allNotes(entries: Entry[] = app.get().tree, out: string[] = []): string[] {
  for (const e of entries) {
    if (e.kind === "folder") allNotes(e.children ?? [], out);
    else if (e.kind === "note") out.push(e.path);
  }
  return out;
}

function show(path: string): void {
  const next = sessions.get(path);
  if (!editor || !next) return;
  const previous = app.get().active;
  const leaving = editor.swap(next.state);
  const old = previous ? sessions.get(previous) : undefined;
  if (old && previous !== path) old.state = leaving;
  app.set((s) => ({ active: path, view: "note", tabs: s.tabs.includes(path) ? s.tabs : [...s.tabs, path] }));
  syncProperties();
  editor.view.focus();
}

export async function openNote(path: string): Promise<void> {
  // The editor mounts with the first render after a vault opens.
  for (let i = 0; !editor && i < 50; i++) await new Promise((r) => window.setTimeout(r, 20));
  if (!editor) return;
  try {
    if (!sessions.has(path)) {
      const note = await runCore<Note>("note.read", { path });
      const text = toEditor(note.text);
      sessions.set(path, { state: editor.createState(text), saved: text, eol: note.eol, hash: note.hash });
      track("note_opened");
    }
    show(path);
  } catch (e) {
    report(e);
  }
}

export async function closeTab(path: string): Promise<void> {
  await save(path);
  const { tabs, active } = app.get();
  const index = tabs.indexOf(path);
  const rest = tabs.filter((t) => t !== path);
  sessions.delete(path);
  if (active !== path) {
    app.set({ tabs: rest });
    return;
  }
  const next = rest[Math.min(index, rest.length - 1)] ?? null;
  app.set({ tabs: rest, active: null, properties: {} });
  if (next) show(next);
}

function uniquePath(folder: string, base: string): string {
  const taken = new Set(allNotes().map((p) => p.toLowerCase()));
  const prefix = folder ? `${folder}/` : "";
  for (let n = 0; ; n++) {
    const candidate = `${prefix}${base}${n ? ` ${n + 1}` : ""}.md`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export async function createNote(name?: string): Promise<void> {
  const active = app.get().active;
  const folder = !name && active?.includes("/") ? active.slice(0, active.lastIndexOf("/")) : "";
  const path = name ? `${name.replace(/\.md$/i, "")}.md` : uniquePath(folder, "Untitled");
  try {
    await runCore("note.create", { path, text: "" });
    track("note_created");
    await refreshTree();
    await openNote(path);
  } catch (e) {
    report(e);
  }
}

const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/** Rename or move a note or a folder; open tabs follow it. */
export async function renameEntry(from: string, to: string): Promise<void> {
  if (from === to) return;
  try {
    await saveAll();
    await runCore("note.rename", { from, to });
    const moved = (p: string) => (under(p, from) ? to + p.slice(from.length) : p);
    for (const [path, session] of [...sessions]) {
      if (!under(path, from)) continue;
      sessions.delete(path);
      sessions.set(moved(path), session);
    }
    app.set((s) => ({
      tabs: s.tabs.map(moved),
      active: s.active ? moved(s.active) : null,
      dirty: Object.fromEntries(Object.entries(s.dirty).map(([path, d]) => [moved(path), d])),
    }));
    await refreshTree();
  } catch (e) {
    report(e);
  }
}

/** Move a note or a folder to the vault trash; its tabs close. */
export async function deleteEntry(path: string): Promise<void> {
  try {
    for (const open of [...sessions.keys()].filter((p) => under(p, path))) {
      window.clearTimeout(saveTimers.get(open));
      sessions.delete(open);
    }
    const { tabs, active } = app.get();
    const rest = tabs.filter((t) => !under(t, path));
    const lostActive = Boolean(active && under(active, path));
    await runCore("note.delete", { path });
    app.set({ tabs: rest, ...(lostActive ? { active: null, properties: {} } : {}) });
    if (lostActive && rest.length) show(rest[rest.length - 1]);
    await refreshTree();
    notify("Moved to the vault trash");
  } catch (e) {
    report(e);
  }
}

export async function createFolder(path: string): Promise<void> {
  try {
    await runCore("folder.create", { path });
    await refreshTree();
  } catch (e) {
    report(e);
  }
}

export async function createNoteIn(folder: string): Promise<void> {
  const path = uniquePath(folder, "Untitled");
  try {
    await runCore("note.create", { path, text: "" });
    track("note_created");
    await refreshTree();
    await openNote(path);
  } catch (e) {
    report(e);
  }
}

/** The note a link's text points at: a full path wins, then the closest note with that name. */
function resolveNote(target: string): string | null {
  const wanted = target.replace(/[#^].*$/, "").replace(/\.md$/i, "").trim().toLowerCase();
  if (!wanted) return null;
  const strip = (p: string) => p.replace(/\.md$/i, "").toLowerCase();
  const notes = [...allNotes()].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  return notes.find((p) => strip(p) === wanted) ?? notes.find((p) => strip(p).split("/").pop() === wanted) ?? null;
}

/** Follow a `[[wiki link]]`; a link to a note that does not exist creates it. */
export async function openLink(target: string): Promise<void> {
  const match = resolveNote(target);
  if (match) await openNote(match);
  else await createNote(target.replace(/[#^].*$/, "").trim());
}

async function loadNote(target: string): Promise<string | null> {
  const path = resolveNote(target);
  if (!path) return null;
  if (sessions.has(path)) return textOf(path);
  try {
    return toEditor((await runCore<Note>("note.read", { path })).text);
  } catch {
    return null;
  }
}

async function onDiskChange(paths: string[]): Promise<void> {
  void refreshTree().catch(() => {});
  app.set((s) => ({ version: s.version + 1 }));
  for (const path of paths) {
    const session = sessions.get(path);
    if (!session) continue;
    let note: Note;
    try {
      note = await runCore<Note>("note.read", { path });
    } catch {
      continue; // removed or unreadable; the tab keeps what it has
    }
    if (note.hash === session.hash) continue; // our own save
    if (textOf(path) !== session.saved) {
      app.set({ conflict: path });
      continue;
    }
    const text = toEditor(note.text);
    Object.assign(session, { saved: text, eol: note.eol, hash: note.hash });
    if (path === app.get().active && editor) {
      editor.replaceText(text);
    } else if (editor) {
      session.state = editor.createState(text);
    }
  }
}

/** Throw away local edits and take what is on disk. */
export async function reloadFromDisk(path: string): Promise<void> {
  const session = sessions.get(path);
  if (!session || !editor) return;
  const note = await runCore<Note>("note.read", { path });
  const text = toEditor(note.text);
  Object.assign(session, { saved: text, eol: note.eol, hash: note.hash });
  if (path === app.get().active) editor.replaceText(text);
  else session.state = editor.createState(text);
  setDirty(path, false);
  app.set({ conflict: null });
}

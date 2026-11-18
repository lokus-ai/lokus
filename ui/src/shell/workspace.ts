/** @part-of ui.shell */
import type { EditorState } from "@codemirror/state";

import { identify, track, reportError } from "../bridge/analytics";
import { accessToken, type Account, currentAccount, onAccessToken } from "../bridge/auth";
import {
  closeWindow,
  CoreError,
  currentVault,
  type Entry,
  type InstalledPlugin,
  isMainWindow,
  type Eol,
  type Note,
  onCloseTab,
  onIndexReady,
  onVaultChanged,
  onVaultOpened,
  openVault,
  pickFolder,
  runCore,
  vaultFileUrl,
  type VaultInfo,
} from "../bridge/core";
import { openWeb } from "../bridge/updates";
import { syncRename, onSyncEvent, syncConnect, syncDisconnect, syncToken } from "../bridge/sync";
import { Editor, previewMarkdown } from "../editor/editor";
import { closeShared, openShared, type Peer, peersOf, setIdentity, type Shared, startCollab } from "./collab";
import { createStore } from "./store";
import { preferences } from "./preferences";

export interface SyncState {
  status: "off" | "connecting" | "online" | "offline" | "refused";
  server?: string;
  workspace?: string;
  role?: "owner" | "editor" | "viewer";
  /** Who this device is signed in as on the relay. */
  user?: string;
  reason?: string;
}

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
  palette: "commands" | "notes" | "search" | "headings" | "templates" | "trash" | "history" | null;
  /** What the main area shows. */
  /** Which tab is showing: a note, or the graph (which sits in `tabs` as `GRAPH_TAB`). */
  view: "note" | "graph" | "file";
  /** The file showing when `view` is "file": a picture, a PDF, a CSV. It sits in `tabs` by its path. */
  file: string | null;
  /** The settings dialog, and which of its pages is showing; null when it is closed. */
  settings: string | null;
  /** What the panel on the right shows, if it is open. */
  panel: { kind: "ai" } | { kind: "plugin"; plugin: string; view: string; title: string; page: string } | null;
  plugins: InstalledPlugin[];
  /** Goes up whenever files or the index change; panels refetch on it. */
  version: number;
  sidebar: boolean;
  sidebarWidth: number;
  /** Width of the panel on the right. */
  panelWidth: number;
  /** The window is too narrow to keep the sidebar beside the note. */
  narrow: boolean;
  account: Account | null;
  accountDialog: boolean;
  sync: SyncState;
  /** Other people with the active note open. */
  peers: Peer[];
  notice: string | null;
}

/** The graph's place in the tab strip, beside the notes. It is not a file. */
export const GRAPH_TAB = "lokus:graph";

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
  file: null,
  settings: null,
  panel: null,
  plugins: [],
  version: 0,
  sidebar: true,
  sidebarWidth: Number(localStorage.getItem("lokus.sidebarWidth")) || 248,
  panelWidth: Number(localStorage.getItem("lokus.panelWidth")) || 360,
  narrow: false,
  account: null,
  accountDialog: false,
  sync: { status: "off" },
  peers: [],
  notice: null,
});

interface Session {
  state: EditorState;
  /** Editor text at the last read or save. */
  saved: string;
  eol: Eol;
  hash: string;
  /** Set while the note is edited through its shared document. */
  shared?: Shared;
}

const SAVE_DELAY = 600;
const sessions = new Map<string, Session>();
const saveTimers = new Map<string, number>();
let editor: Editor | null = null;

export function getEditor(): Editor | null {
  return app.get().active ? editor : null;
}

const toEditor = (text: string) => text.replace(/\r\n?/g, "\n");

export function allFiles(entries: Entry[] = app.get().tree, out: string[] = []): string[] {
  for (const e of entries) {
    if (e.kind === "folder") allFiles(e.children ?? [], out);
    else out.push(e.path);
  }
  return out;
}

/** Web images load as they are; vault images are looked up beside the note, then anywhere. */
export function resolveImage(src: string): string | null {
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

const MAX_ATTACHMENT = 25 * 1024 * 1024;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Save a pasted or dropped file in an `attachments` folder beside the open note. */
export async function saveFile(file: File): Promise<string | null> {
  const { active } = app.get();
  if (!active) return null;
  if (file.size > MAX_ATTACHMENT) {
    notify(`${file.name || "That file"} is larger than 25 MB`);
    return null;
  }
  const folder = active.includes("/") ? active.slice(0, active.lastIndexOf("/") + 1) : "";
  const now = new Date();
  const stamp = `${today().replace(/-/g, "")}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const extension = /\.[a-z0-9]+$/i.exec(file.name)?.[0] ?? `.${file.type.split("/")[1] ?? "bin"}`;
  // A pasted screenshot arrives as "image.png"; give it a name that says when.
  const base = !file.name || /^image\.[a-z]+$/i.test(file.name) ? `Pasted image ${stamp}` : file.name.slice(0, file.name.length - extension.length).replace(/[\\/:*?"<>|#^[\]]/g, "-");
  const taken = new Set(allFiles());
  let name = `${base}${extension}`;
  for (let n = 2; taken.has(`${folder}attachments/${name}`); n++) name = `${base} ${n}${extension}`;
  try {
    await runCore("file.write", { path: `${folder}attachments/${name}`, base64: await toBase64(file) });
    await refreshTree();
    return encodeURI(`attachments/${name}`);
  } catch (e) {
    report(e);
    return null;
  }
}

export function notify(message: string): void {
  app.set({ notice: message });
  window.setTimeout(() => app.get().notice === message && app.set({ notice: null }), 4000);
}

function report(e: unknown): void {
  reportError(e, "shown");
  notify(e instanceof Error ? e.message : String(e));
}

/** The kind of page a path is, for counting which parts of Lokus get used. Never the name. */
function pageKind(path: string): string {
  if (path === "Customers.md") return "customer_list";
  if (path === "Tasks.md") return "task_board";
  if (path === "Assistant.md") return "assistant_notes";
  if (path.startsWith("customers/")) return path.split("/").length > 2 ? "customer_item" : "customer";
  if (path.startsWith("people/")) return "person";
  if (path.startsWith("tasks/")) return "task";
  if (path.startsWith("chats/")) return "shared_chat";
  if (path.startsWith("daily/")) return "daily_note";
  return "note";
}

/** Draw markdown read-only, the way a note looks, whether or not a note is open. */
export function renderMarkdown(parent: HTMLElement, text: string): () => void {
  return previewMarkdown(parent, text, { onOpenLink: (target, newTab) => void openLink(target, newTab), resolveImage });
}

export function attachEditor(parent: HTMLElement): void {
  if (editor) return;
  editor = new Editor(parent, {
    onChange(text) {
      const path = app.get().active;
      const session = path ? sessions.get(path) : undefined;
      if (!path || !session) return;
      if (session.shared) {
        // The sync engine writes the file; nothing to save from here.
        syncProperties();
        return;
      }
      setDirty(path, text !== session.saved);
      syncProperties();
      if (text !== session.saved) scheduleSave(path);
    },
    onOpenLink: (target, newTab) => void openLink(target, newTab),
    resolveImage,
    loadNote,
    notePaths: () => allNotes(),
    saveFile,
    snippets: () => app.get().plugins.flatMap((p) => (p.enabled ? (p.manifest?.contributes.snippets ?? []) : [])),
    menuContext() {
      const { active: path, vault } = app.get();
      if (!path || !vault) return null;
      return {
        path,
        valid: () => {
          const now = app.get();
          return now.active === path && now.vault?.root === vault.root && now.view === "note" && !now.settings && !now.palette && !now.accountDialog;
        },
        subscribe: app.subscribe,
      };
    },
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
  if (!session || session.shared || text === null || (text === session.saved && !force)) return;
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

/** Whether an open note holds text that is not on disk. */
export function unsaved(): boolean {
  return [...sessions].some(([path, session]) => !session.shared && textOf(path) !== session.saved);
}

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 420;
const NARROW = "(max-width: 760px)";

export function setPanelWidth(width: number): void {
  const clamped = Math.round(Math.min(760, Math.max(300, width)));
  localStorage.setItem("lokus.panelWidth", String(clamped));
  app.set({ panelWidth: clamped });
}

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

/** Move an open note onto its shared document once the note is synced. */
async function share(path: string): Promise<void> {
  const session = sessions.get(path);
  if (!session || session.shared || !editor) return;
  await save(path);
  const shared = await openShared(path);
  if (!shared || sessions.get(path) !== session) return;
  session.shared = shared;
  session.state = editor.createSharedState(shared.text, shared.awareness);
  session.saved = shared.text.toString();
  if (app.get().active === path) {
    editor.swap(session.state);
    syncProperties();
    syncPeers();
  }
  setDirty(path, false);
}

/** Back to plain files, when sync stops. */
async function unshareAll(): Promise<void> {
  for (const [path, session] of sessions) {
    if (!session.shared || !editor) continue;
    const text = session.shared.text.toString();
    closeShared(session.shared);
    session.shared = undefined;
    session.state = editor.createState(text);
    session.saved = text;
    const note = await runCore<Note>("note.read", { path }).catch(() => null);
    if (note) Object.assign(session, { eol: note.eol, hash: note.hash });
    if (app.get().active === path) editor.swap(session.state);
  }
  app.set({ peers: [] });
}

const syncKey = () => `lokus.sync:${app.get().vault?.root ?? ""}`;

/** The team workspace a folder syncs with, if it does. */
export function syncedWith(root: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(`lokus.sync:${root}`) ?? "null") as { workspace?: string } | null)?.workspace ?? null;
  } catch {
    return null;
  }
}

const STOPPED = "lokus.sync.stopped";

/** The teams whose syncing this person stopped on this computer. Those are not started again for them. */
export function stoppedSync(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(STOPPED) ?? "null") as string[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Start syncing this vault with a team workspace. */
/** The sign-in the connection was last given, and how to stop feeding it fresh ones. */
let syncSignIn: string | null = null;
let stopSignIns: (() => void) | null = null;
/** Whether a refusal has already been answered with one fresh sign-in. */
let retriedSignIn = false;
/** The latest request to connect, so a retry for an older one does nothing. */
let lastAsk = "";

export async function connectSync(server: string, workspace: string, token: string | null, root = app.get().vault?.root ?? ""): Promise<void> {
  const useToken = token ?? (await accessToken());
  if (!useToken) {
    app.set({ sync: { status: "refused", reason: "Sign in first" } });
    return;
  }
  await saveAll();
  // An account token is fetched fresh each time; only a token typed by hand is remembered.
  localStorage.setItem(`lokus.sync:${root}`, JSON.stringify({ server, workspace, token }));
  localStorage.setItem(STOPPED, JSON.stringify(stoppedSync().filter((w) => w !== workspace)));
  // Another folder was opened while this waited: this one starts when it is opened again.
  if ((app.get().vault?.root ?? "") !== root) return;
  app.set({ sync: { status: "connecting", server, workspace } });
  syncSignIn = useToken;
  stopSignIns?.();
  stopSignIns = null;
  // An account sign-in lasts about an hour. Each new one is handed to the connection as it arrives.
  // Not waited for: the connection must be asked for whatever the account service is doing.
  if (token === null) {
    void onAccessToken((fresh) => {
      if (fresh === syncSignIn) return;
      syncSignIn = fresh;
      void syncToken(fresh);
    }).then(
      (stop) => (stopSignIns = stop),
      () => {},
    );
  }
  // Asked for but never answered: say so and try again, where it used to say "Connecting" for good.
  const asking = `${server}|${workspace}|${Date.now()}`;
  lastAsk = asking;
  window.setTimeout(() => {
    if (lastAsk !== asking || app.get().sync.status !== "connecting") return;
    reportError(new Error("sync stayed at connecting for 30 seconds"), "sync");
    void connectSync(server, workspace, token, root);
  }, 30_000);
  await syncConnect(server, workspace, useToken, root).catch((e) => {
    // Refused because another folder was opened meanwhile: that folder is not the one to say so.
    if ((app.get().vault?.root ?? "") === root) app.set({ sync: { status: "refused", reason: String(e?.message ?? e) } });
  });
}

export async function disconnectSync(): Promise<void> {
  const was = savedSync()?.workspace;
  if (was) localStorage.setItem(STOPPED, JSON.stringify([...stoppedSync().filter((w) => w !== was), was]));
  localStorage.removeItem(syncKey());
  stopSignIns?.();
  stopSignIns = null;
  await syncDisconnect();
  await unshareAll();
  app.set({ sync: { status: "off" } });
}

function watchSync(): void {
  startCollab(syncPeers);
  // Teammates see who is signed in on this cursor from the moment of signing in, wherever it happens.
  let named = "You";
  app.subscribe(() => {
    const name = app.get().account?.email ?? "You";
    if (name !== named) setIdentity((named = name));
  });
  onSyncEvent((event) => {
    const { sync } = app.get();
    if (event.event === "online") {
      if (app.get().sync.status !== "online") track("sync_connected", { role: event.role });
      if (event.role === "viewer" && sync.role !== "viewer") notify("You can read this workspace. Changes you make stay on this device.");
      retriedSignIn = false;
      app.set({ sync: { ...sync, status: "online", role: event.role, user: event.user, reason: undefined } });
    } else if (event.event === "role") {
      notify(event.role === "viewer" ? "An owner made you a viewer here. Changes you make now stay on this device." : `You are now ${event.role === "owner" ? "an owner" : "an editor"} of this workspace.`);
      app.set({ sync: { ...sync, role: event.role } });
    } else if (event.event === "skipped") notify(`Did not write “${event.path}”: another device named a place outside this vault.`);
    else if (event.event === "offline" && sync.status !== "off") app.set({ sync: { ...sync, status: "offline", reason: event.reason } });
    else if (event.event === "refused") {
      void (async () => {
        // A sign-in that ran out while the computer slept is answered once with a fresh one.
        const saved = savedSync();
        const root = app.get().vault?.root;
        const fresh = saved?.token === null && !retriedSignIn ? await accessToken().catch(() => null) : null;
        if (saved && fresh && fresh !== syncSignIn) {
          retriedSignIn = true;
          await connectSync(saved.server, saved.workspace, null, root);
          return;
        }
        void unshareAll();
        app.set({ sync: { status: "refused", reason: event.reason } });
      })();
    } else if (event.event === "pulled") for (const path of sessions.keys()) void share(path);
    else if (event.event === "published" || event.event === "wrote") void share(event.path);
    // Sync moved a file (a teammate renamed it, or another note took its name): its tab goes with it.
    else if (event.event === "renamed") moveOpen(event.from, event.to);
    else if (event.event === "kept_both") {
      moveOpen(event.path, event.moved_to);
      notify(`Kept your copy as “${event.moved_to}”`);
    } else if (event.event === "trashed") closeGone(event.path);
  });
}

/** The connection this vault was last told to keep; a null token means "use the account's". */
function savedSync(): { server: string; workspace: string; token: string | null } | null {
  try {
    return JSON.parse(localStorage.getItem(syncKey()) ?? "null");
  } catch {
    // a broken saved entry just means sync stays off
    return null;
  }
}

/** Connect the open folder to the team it was last told to keep, if it has one. */
export async function resumeSync(): Promise<void> {
  const saved = savedSync();
  if (saved) await connectSync(saved.server, saved.workspace, saved.token);
}

export async function boot(): Promise<void> {
  watchWidth();
  watchSync();
  onVaultChanged((paths) => void onDiskChange(paths));
  onIndexReady(() => app.set((s) => ({ version: s.version + 1 })));
  onCloseTab(() => {
    // Cmd+W closes the tab showing and nothing more. With no tab left it closes an extra
    // window, but never the last one: that would quit Lokus, which is what Cmd+Q is for.
    const { active, view, file } = app.get();
    if (view === "graph") closeGraph();
    else if (view === "file" && file) void closeTab(file);
    else if (active) void closeTab(active);
    else if (!isMainWindow()) closeWindow();
  });
  // Every window shows the same folder: when another window opens a different one, follow it.
  onVaultOpened((vault) => {
    if (!switching && app.get().ready && app.get().vault?.root !== vault.root) void enterVault(vault);
  });
  // Signing in or out in another window is noticed when this one is next looked at.
  window.addEventListener("focus", () => {
    void currentAccount().then((account) => {
      if ((account?.id ?? null) === (app.get().account?.id ?? null)) return;
      identify(account?.id ?? null);
      app.set({ account });
    }, () => {});
  });
  const [vault, account] = await Promise.all([currentVault(), currentAccount().catch(() => null)]);
  identify(account?.id ?? null);
  app.set({ vault, account, ready: true });
  applyLayout();
  track("app_opened");
  if (vault) {
    await refreshTree();
    await resumeSync();
  }
}

/** Put on screen what the chosen layout says should be there: the sidebar, the assistant. */
export function applyLayout(): void {
  const { layout } = preferences.get();
  if (app.get().narrow) return;
  const { panel } = app.get();
  app.set({ sidebar: layout !== "focused", panel: layout === "everything" ? (panel ?? { kind: "ai" }) : panel?.kind === "ai" && layout === "focused" ? null : panel });
}

/** This window is the one changing folder, so it does not also follow its own change. */
let switching = false;
export const isSwitchingVault = (): boolean => switching;
let flushChat: (() => Promise<void>) | undefined;

/** The assistant drains its existing writer before this window opens another vault. */
export function registerChatFlush(flush: () => Promise<void>): void {
  flushChat = flush;
}

async function enterVault(vault: VaultInfo): Promise<void> {
  for (const session of sessions.values()) if (session.shared) closeShared(session.shared);
  sessions.clear();
  app.set({ vault, tabs: [], view: "note", active: null, dirty: {}, properties: {}, conflict: null, sync: { status: "off" }, peers: [] });
  await refreshTree();
  await resumeSync();
}

export async function setVault(path: string): Promise<void> {
  if (switching) return;
  await saveAll();
  if (switching) return;
  switching = true;
  try {
    await flushChat?.();
    await enterVault(await openVault(path));
    track("vault_opened");
  } finally {
    switching = false;
  }
}

export async function chooseVault(): Promise<void> {
  const path = await pickFolder();
  if (path) await setVault(path).catch(report);
}

export async function refreshTree(): Promise<void> {
  // What the assistant noticed is kept in a folder of its own; it is shown under Noticed, not as files.
  const tree = await runCore<Entry[]>("vault.tree");
  app.set({ tree: tree.filter((e) => !(e.kind === "folder" && e.path === "noticed")) });
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
  const { active: previous, view } = app.get();
  // The note already on screen keeps what was typed in it. One coming forward shows what a
  // teammate typed while its tab was behind another.
  if (previous !== path) {
    if (next.shared) next.state = editor.caughtUp(next.state, next.shared.text.toString());
    const leaving = editor.swap(next.state);
    const old = previous ? sessions.get(previous) : undefined;
    if (old) old.state = leaving;
  }
  app.set((s) => ({ active: path, view: "note", tabs: s.tabs.includes(path) ? s.tabs : [...s.tabs, path] }));
  syncProperties();
  syncPeers();
  editor.view.focus();
  // Behind the graph or a file the page was hidden, and a hidden page cannot take the keyboard.
  if (view !== "note") enterNote();
}

function syncPeers(): void {
  const { active } = app.get();
  const next = peersOf(active ? sessions.get(active)?.shared : undefined);
  if (JSON.stringify(next) !== JSON.stringify(app.get().peers)) app.set({ peers: next });
}

/** Whether a path is a note; anything else in a vault is a file to look at, not to edit. */
export const isNotePath = (path: string) => /\.md$/i.test(path);

/** With the graph or a file in front, keys do not go on into the note underneath. */
function leaveNote(): void {
  const page = editor?.view.dom.closest(".page");
  const at = document.activeElement;
  if (at instanceof HTMLElement && page?.contains(at)) at.blur();
  // A click on a button leaves the cursor in the note, and keys follow the cursor.
  const cursor = window.getSelection();
  if (cursor?.anchorNode && page?.contains(cursor.anchorNode)) cursor.removeAllRanges();
}

/** A note back in front takes the keyboard again, once its page is showing. */
function enterNote(): void {
  const note = app.get().active;
  requestAnimationFrame(() => {
    // A note a teammate deleted meanwhile does not hand the keyboard to its neighbour.
    if (app.get().view !== "note" || !note || app.get().active !== note) return;
    // Someone typing in a field elsewhere (a rename, the palette) keeps it.
    const at = document.activeElement;
    if (at instanceof HTMLElement && (at.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at.tagName))) return;
    editor?.view.focus();
  });
}

/** Show a file that is not a note (a picture, a PDF, a CSV) in its own tab. */
export function openFile(path: string): void {
  app.set((s) => ({ view: "file", file: path, tabs: s.tabs.includes(path) ? s.tabs : [...s.tabs, path] }));
  leaveNote();
  track("page_opened", { kind: "file" });
}

/** Bring a tab forward, whatever it holds. */
function go(tab: string): void {
  if (tab === GRAPH_TAB) showGraph();
  else if (isNotePath(tab)) show(tab);
  else openFile(tab);
}

export async function openNote(path: string): Promise<void> {
  if (!isNotePath(path)) return openFile(path);
  // The editor mounts with the first render after a vault opens.
  for (let i = 0; !editor && i < 50; i++) await new Promise((r) => window.setTimeout(r, 20));
  if (!editor) return;
  try {
    if (!sessions.has(path)) {
      const note = await runCore<Note>("note.read", { path });
      const text = toEditor(note.text);
      const shared = app.get().sync.status === "off" ? null : await openShared(path);
      const state = shared ? editor.createSharedState(shared.text, shared.awareness) : editor.createState(text);
      sessions.set(path, { state, saved: text, eol: note.eol, hash: note.hash, shared: shared ?? undefined });
      track("note_opened");
      track("page_opened", { kind: pageKind(path) });
    }
    show(path);
  } catch (e) {
    report(e);
  }
}

export async function closeTab(path: string): Promise<void> {
  if (!isNotePath(path)) {
    const { tabs, file, view, active } = app.get();
    const rest = tabs.filter((t) => t !== path);
    if (view !== "file" || file !== path) return app.set({ tabs: rest });
    const next = rest[Math.min(tabs.indexOf(path), rest.length - 1)];
    app.set({ tabs: rest, file: null, view: "note" });
    // The note underneath is still loaded; any other tab is brought forward.
    if (next && next !== active) go(next);
    enterNote();
    return;
  }
  await save(path);
  const { tabs, active, view, file } = app.get();
  const rest = tabs.filter((t) => t !== path);
  const closing = sessions.get(path)?.shared;
  if (closing) closeShared(closing);
  sessions.delete(path);
  if (active !== path) {
    app.set({ tabs: rest });
    return;
  }
  // Under the graph or a file in front, the tab that takes the note's place is another note.
  const among = view === "note" ? tabs : tabs.filter(isNotePath);
  const from = among.filter((t) => t !== path);
  const next = from[Math.min(among.indexOf(path), from.length - 1)] ?? null;
  app.set({ tabs: rest, active: null, properties: {} });
  if (next) go(next);
  // The graph or a file in front of the note stays in front.
  if (view !== "note") {
    app.set({ view, file });
    leaveNote();
  }
}

/** Go to the tab after the one showing (or before it), wrapping round at the ends. */
export function stepTab(by: 1 | -1): void {
  const { tabs, active, view } = app.get();
  if (tabs.length < 2) return;
  const at = tabs.indexOf(view === "graph" ? GRAPH_TAB : view === "file" ? (app.get().file ?? "") : (active ?? ""));
  const next = tabs[(at + by + tabs.length) % tabs.length];
  if (next === GRAPH_TAB) showGraph();
  else void openNote(next);
}

/** Open the graph as a tab, or bring its tab forward. */
export function showGraph(): void {
  app.set((s) => ({ view: "graph", tabs: s.tabs.includes(GRAPH_TAB) ? s.tabs : [...s.tabs, GRAPH_TAB] }));
  leaveNote();
}

/** Close the graph's tab; the note that was open underneath shows again. */
export function closeGraph(): void {
  app.set((s) => ({ view: "note", tabs: s.tabs.filter((t) => t !== GRAPH_TAB) }));
  enterNote();
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

/** Open the customers list, making its note the first time. */
export async function openCustomers(): Promise<void> {
  const path = "Customers.md";
  try {
    if (!allFiles().includes(path)) {
      await runCore("note.create", { path, text: "---\nview: customers\nsource: customers\n---\n" });
      await refreshTree();
    }
    await openNote(path);
  } catch (e) {
    report(e);
  }
}

/** Open the task board, making its note the first time. */
export async function openTasks(): Promise<void> {
  const path = "Tasks.md";
  try {
    if (!allFiles().includes(path)) {
      await runCore("note.create", { path, text: "---\nview: tasks\n---\n" });
      await refreshTree();
    }
    await openNote(path);
  } catch (e) {
    report(e);
  }
}

const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/** Open tabs follow a note or a folder to its new path, with what is still to be saved. */
function moveOpen(from: string, to: string): void {
  const moved = (p: string) => (under(p, from) ? to + p.slice(from.length) : p);
  for (const [path, session] of [...sessions]) {
    if (!under(path, from)) continue;
    sessions.delete(path);
    sessions.set(moved(path), session);
    if (!saveTimers.has(path)) continue;
    window.clearTimeout(saveTimers.get(path));
    saveTimers.delete(path);
    scheduleSave(moved(path));
  }
  app.set((s) => ({
    tabs: s.tabs.map(moved),
    active: s.active ? moved(s.active) : null,
    file: s.file ? moved(s.file) : null,
    dirty: Object.fromEntries(Object.entries(s.dirty).map(([path, d]) => [moved(path), d])),
  }));
}

/** A note deleted on another computer leaves the screen, so nobody goes on typing into a note that is gone. */
function closeGone(path: string): void {
  if (!app.get().tabs.includes(path)) return;
  const session = sessions.get(path);
  // Words not yet in the file stay: saving them brings the note back for everyone.
  if (session && !session.shared && textOf(path) !== session.saved) return;
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  const { active, view } = app.get();
  void closeTab(path).then(() => {
    // Keys still coming for the note that left do not go into the one that came forward.
    if (active === path && view === "note") editor?.view.contentDOM.blur();
    notify(`“${name}” was deleted on another computer. It is in the vault trash`);
  });
}

/** Rename or move a note or a folder; open tabs follow it. */
export async function renameEntry(from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  try {
    await saveAll();
    // A shared vault renames through sync, which keeps each note's shared document with it.
    if (!(await syncRename(from, to))) await runCore("note.rename", { from, to });
    moveOpen(from, to);
    await refreshTree();
    return true;
  } catch (e) {
    report(e);
    return false;
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

/** A new note as a database row, optionally with one property set. It is not opened. */
export async function createRow(folder: string, key?: string, value?: string): Promise<string | null> {
  const path = uniquePath(folder, "Untitled");
  try {
    await runCore("note.create", { path, text: "" });
    if (key && value !== undefined) await runCore("props.set", { path, key, value });
    track("note_created");
    await refreshTree();
    return path;
  } catch (e) {
    report(e);
    return null;
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
/**
 * Follow a link to a note. It takes the place of the note being read, as a link does in a
 * browser; with `newTab` it opens beside it instead. A note that is already open in another tab
 * is simply brought forward.
 */
export async function openLink(target: string, newTab = false): Promise<void> {
  if (target.startsWith("https://")) return openWeb(target);
  const match = resolveNote(target);
  const ref = /[#^].*$/.exec(target)?.[0];
  if (!match) return createNote(target.replace(/[#^].*$/, "").trim());
  const { active: from, tabs, view } = app.get();
  const replaces = !newTab && view === "note" && from !== null && from !== match && !tabs.includes(match);
  await openNote(match);
  if (replaces && from && app.get().active === match) {
    // The note that was being read gives its place in the tab strip to the one it linked to.
    await save(from);
    const closing = sessions.get(from)?.shared;
    if (closing) closeShared(closing);
    sessions.delete(from);
    app.set((s) => ({ tabs: s.tabs.filter((t) => t !== match).map((t) => (t === from ? match : t)) }));
  }
  if (ref && app.get().active === match) editor?.reveal(ref);
}

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Where daily notes and templates live. */
export const DAILY_FOLDER = "Daily";
export const TEMPLATE_FOLDER = "Templates";

/** Fill in the few placeholders a template may use. */
function fillTemplate(text: string, title: string): string {
  const now = new Date();
  const values: Record<string, string> = { date: today(), time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, title };
  return text.replace(/\{\{\s*(date|time|title)\s*\}\}/g, (_, key: string) => values[key]);
}

async function templateText(path: string | null, title: string): Promise<string> {
  if (!path) return "";
  const note = await runCore<Note>("note.read", { path }).catch(() => null);
  return note ? fillTemplate(note.text, title) : "";
}

/** Open today's note, creating it (from `Templates/Daily.md` if there is one) on first use. */
export async function openDailyNote(): Promise<void> {
  const path = `${DAILY_FOLDER}/${today()}.md`;
  try {
    if (!allNotes().includes(path)) {
      const template = allNotes().find((p) => p.toLowerCase() === `${TEMPLATE_FOLDER}/daily.md`.toLowerCase()) ?? null;
      await runCore("note.create", { path, text: await templateText(template, today()) });
      track("note_created");
      await refreshTree();
    }
    await openNote(path);
  } catch (e) {
    report(e);
  }
}

export const templates = () => allNotes().filter((p) => p.startsWith(`${TEMPLATE_FOLDER}/`));

/** Start a new note with a template's text, beside the note that is open. */
export async function createFromTemplate(template: string): Promise<void> {
  const active = app.get().active;
  const folder = active?.includes("/") && !active.startsWith(`${TEMPLATE_FOLDER}/`) ? active.slice(0, active.lastIndexOf("/")) : "";
  const path = uniquePath(folder, "Untitled");
  try {
    await runCore("note.create", { path, text: await templateText(template, "Untitled") });
    track("note_created");
    await refreshTree();
    await openNote(path);
  } catch (e) {
    report(e);
  }
}

export interface NoteVersion {
  at: number;
  size: number;
}

/** Earlier versions of the open note, newest first. */
export async function versions(): Promise<NoteVersion[]> {
  const { active } = app.get();
  return active ? runCore<NoteVersion[]>("history.list", { path: active }) : [];
}

/** Bring back an earlier version of the open note. What it replaces becomes a version too. */
export async function restoreVersion(at: number): Promise<void> {
  const { active } = app.get();
  if (!active) return;
  try {
    await save(active);
    await runCore("history.restore", { path: active, at });
    notify("Restored. The text it replaced is in the history too.");
  } catch (e) {
    report(e);
  }
}

export interface TrashedFile {
  id: string;
  path: string;
  deleted_at: number;
}

export const trashed = () => runCore<TrashedFile[]>("trash.list");

export async function restoreFromTrash(id: string): Promise<void> {
  try {
    const { path } = await runCore<{ path: string }>("trash.restore", { id });
    await refreshTree();
    if (/\.md$/i.test(path)) await openNote(path);
    else notify(`Restored ${path}`);
  } catch (e) {
    report(e);
  }
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
    if (!session || session.shared) continue; // a shared note gets outside edits through its document
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

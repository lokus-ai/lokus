/** @part-of ui.shell */
import { newWindow } from "../bridge/core";
import { aiSettings, saveAiConfig } from "../bridge/ai";
import { identify } from "../bridge/analytics";
import { runCore } from "../bridge/core";
import { accountsAvailable, signOut } from "../bridge/auth";
import { answer, answerAll, ask, chat, newChat } from "../features/ai/chat";
import { analyticsCommands } from "../features/analytics/commands";
import { COVERS } from "../features/page-header/Cover";
import { ICONS } from "../features/page-header/PageHeader";
import { type Command, isMac, registerCommands } from "./commands";
import {
  app,
  chooseVault,
  closeGraph,
  closeTab,
  connectSync,
  createNote,
  deleteEntry,
  disconnectSync,
  getEditor,
  notify,
  openCustomers,
  openDailyNote,
  openTasks,
  openLink,
  openNote,
  refreshTree,
  save,
  setVault,
  showGraph,
  stepTab,
} from "./workspace";

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** Editor commands need an open note; say so instead of failing silently. */
function editor() {
  const e = getEditor();
  if (!e) throw Object.assign(new Error("No note is open"), { code: "no_note" });
  return e;
}

function editorState() {
  const e = editor();
  const sel = e.view.state.selection.main;
  return { text: e.text, anchor: sel.anchor, head: sel.head };
}

const mark = (id: string, title: string, keys: string, syntax: string): Command => ({
  id,
  title,
  keys,
  run() {
    editor().mark(syntax);
    return editorState();
  },
});

const heading = (level: number): Command => ({
  id: level ? `editor.heading${level}` : "editor.paragraph",
  title: level ? `Heading ${level}` : "Normal text",
  run() {
    editor().heading(level);
    return editorState();
  },
});

export function registerAllCommands(): void {
  registerCommands([
    { id: "palette.commands", title: "Command palette", keys: "Mod-Shift-p", run: () => app.set({ palette: "commands" }) },
    { id: "palette.notes", title: "Go to note…", keys: "Mod-o", run: () => app.set({ palette: "notes" }) },
    { id: "search.open", title: "Search in all notes…", keys: "Mod-Shift-f", run: () => app.set({ palette: "search" }) },
    {
      id: "graph.toggle",
      title: "Show or hide the graph",
      keys: "Mod-g",
      run: () => (app.get().view === "graph" ? closeGraph() : showGraph()),
    },
    { id: "tab.next", title: "Next tab", keys: isMac ? "Ctrl-Tab" : "Mod-Tab", run: () => stepTab(1) },
    { id: "tab.previous", title: "Previous tab", keys: isMac ? "Ctrl-Shift-Tab" : "Mod-Shift-Tab", run: () => stepTab(-1) },
    {
      id: "settings.open",
      title: "Settings",
      keys: "Mod-,",
      run: (a) => app.set((s) => ({ settings: typeof a.page === "string" ? a.page : s.settings ? null : "appearance" })),
    },
    {
      id: "ai.open",
      title: "Assistant: show or hide",
      keys: "Mod-j",
      run: () => app.set((s) => ({ panel: s.panel?.kind === "ai" ? null : { kind: "ai" } })),
    },
    { id: "ai.new", title: "Assistant: new chat", run: newChat },
    { id: "teams.open", title: "Team sync…", run: () => app.set({ settings: "team" }) },
    { id: "window.new", title: "New window", keys: "Mod-Shift-n", run: () => newWindow().catch((e) => notify(e instanceof Error ? e.message : String(e))) },
    { id: "onboarding.open", title: "Lokus: run the setup again", run: () => void import("../features/onboarding/onboarding").then((o) => o.onboarding.set({ open: true })) },
    { id: "updates.check", title: "Lokus: check for updates", run: () => void import("../features/updates/updates").then((u) => u.check(true)) },
    { id: "news.open", title: "Lokus: what’s new", run: () => void import("../features/updates/updates").then((u) => u.readNews("all")) },
    {
      id: "vault.examples",
      title: "Add example notes to this vault",
      run: async () => {
        await runCore("vault.seed");
        await refreshTree();
        await openNote("Welcome.md");
      },
    },
    { id: "vault.choose", title: "Open another vault…", run: chooseVault },
    { id: "sidebar.toggle", title: "Show or hide the sidebar", keys: "Mod-\\", run: () => app.set((s) => ({ sidebar: !s.sidebar })) },
    { id: "note.new", title: "New note", keys: "Mod-n", run: () => createNote() },
    { id: "note.daily", title: "Open today's note", keys: "Mod-Shift-d", run: openDailyNote },
    { id: "note.fromTemplate", title: "New note from a template…", run: () => app.set({ palette: "templates" }) },
    { id: "note.headings", title: "Go to a heading…", keys: "Mod-Shift-o", run: () => app.set({ palette: "headings" }) },
    { id: "note.history", title: "Version history: restore an earlier version…", run: () => app.set({ palette: "history" }) },
    { id: "trash.open", title: "Restore from the trash…", run: () => app.set({ palette: "trash" }) },
    {
      id: "note.save",
      title: "Save now",
      keys: "Mod-s",
      run: () => {
        const { active } = app.get();
        return active ? save(active) : undefined;
      },
    },
    {
      id: "note.close",
      title: "Close note",
      run: () => {
        const { active } = app.get();
        return active ? closeTab(active) : undefined;
      },
    },
    {
      id: "note.trash",
      title: "Move note to trash",
      run: () => {
        const { active } = app.get();
        return active ? deleteEntry(active) : undefined;
      },
    },
    mark("editor.toggleBold", "Bold", "Mod-b", "**"),
    mark("editor.toggleItalic", "Italic", "Mod-i", "*"),
    mark("editor.toggleCode", "Inline code", "Mod-e", "`"),
    mark("editor.toggleStrikethrough", "Strikethrough", "Mod-Shift-x", "~~"),
    mark("editor.toggleHighlight", "Highlight", "Mod-Shift-h", "=="),
    {
      id: "editor.insertLink",
      title: "Insert link",
      keys: "Mod-k",
      run() {
        editor().link();
        return editorState();
      },
    },
    heading(1),
    heading(2),
    heading(3),
    heading(0),
    { id: "page.addIcon", title: "Page: add or change icon", run: () => editor().setProperty("icon", pick(ICONS)) },
    { id: "page.addCover", title: "Page: add or change cover", run: () => editor().setProperty("cover", pick(COVERS)) },
    { id: "page.removeCover", title: "Page: remove cover", run: () => editor().setProperty("cover", null) },
    { id: "database.table", title: "Database: show this folder as a table", run: () => editor().setProperty("view", "table") },
    {
      id: "database.board",
      title: "Database: show this folder as a board",
      run() {
        const e = editor();
        e.setProperty("view", "board");
        if (!e.properties().group) e.setProperty("group", "status");
      },
    },
    { id: "database.off", title: "Database: hide the view", run: () => editor().setProperty("view", null) },
    { id: "customers.open", title: "Customers: open the list", keys: "Mod-Shift-c", run: () => openCustomers() },
    { id: "tasks.open", title: "Tasks: open the board", keys: "Mod-Shift-t", run: () => openTasks() },
    { id: "profile.open", title: "Your profile: name and picture", run: () => app.set({ settings: "profile" }) },
    { id: "customers.mark", title: "Customers: make this note a customer", run: () => editor().setProperty("type", "customer") },
    ...analyticsCommands(notify),
    ...(accountsAvailable
      ? [
          { id: "account.signIn", title: "Sign in…", run: () => app.set({ accountDialog: true }) },
          {
            id: "account.signOut",
            title: "Sign out",
            run: async () => {
              await signOut();
              identify(null);
              app.set({ account: null });
            },
          },
        ]
      : []),

    // For scripts and `lokus app <id>`: drive the live app like a user would.
    { id: "ai.ask", title: "Ask the assistant", hidden: true, run: async (a) => {
        app.set({ panel: { kind: "ai" } });
        await ask(String(a.text ?? ""));
        return chat.get().items;
      } },
    { id: "ai.answer", title: "Allow or decline a change", hidden: true, run: (a) => {
        const waiting = chat.get().items.find((i) => i.kind === "tool" && i.status === "asking");
        if (waiting?.kind === "tool") {
          if (a.all === true) answerAll(waiting.id);
          else answer(waiting.id, a.allow !== false);
        }
        return Boolean(waiting);
      } },
    { id: "ai.configure", title: "Change assistant settings", hidden: true, run: async (a) => {
        const { config } = await aiSettings();
        await saveAiConfig({ ...config, ...a });
        return (await aiSettings()).config;
      } },
    { id: "ai.settings", title: "Assistant settings", hidden: true, run: () => aiSettings() },
    { id: "ai.state", title: "Assistant conversation", hidden: true, run: () => chat.get() },
    { id: "sync.connect", title: "Connect sync", hidden: true, run: (a) => connectSync(String(a.server), String(a.workspace), a.token ? String(a.token) : null) },
    { id: "sync.disconnect", title: "Disconnect sync", hidden: true, run: () => disconnectSync() },
    { id: "note.open", title: "Open note", hidden: true, run: async (a) => {
        await openNote(String(a.path));
        return { active: app.get().active };
      } },
    { id: "note.follow", title: "Follow a link", hidden: true, run: async (a) => {
        await openLink(String(a.target));
        return { active: app.get().active, ...editorState() };
      } },
    { id: "editor.pasteFile", title: "Paste a file into the note", hidden: true, run: async (a) => {
        const bytes = Uint8Array.from(atob(String(a.base64 ?? "")), (c) => c.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], String(a.name ?? "image.png"), { type: String(a.type ?? "image/png") }));
        editor().view.contentDOM.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
        await new Promise((r) => window.setTimeout(r, 600));
        return editorState();
      } },
    { id: "editor.headings", title: "Headings of the open note", hidden: true, run: () => editor().headings() },
    { id: "vault.use", title: "Open vault by path", hidden: true, run: (a) => setVault(String(a.path)) },
    { id: "editor.type", title: "Type text", hidden: true, run(a) {
        editor().type(String(a.text ?? ""));
        return editorState();
      } },
    { id: "editor.select", title: "Set selection", hidden: true, run(a) {
        const anchor = Number(a.anchor ?? 0);
        editor().select(anchor, a.head === undefined ? anchor : Number(a.head));
        return editorState();
      } },
    { id: "editor.delete", title: "Delete the selection", hidden: true, run() {
        const e = editor();
        e.view.dispatch(e.view.state.replaceSelection(""));
        return editorState();
      } },
    { id: "editor.setText", title: "Replace all text", hidden: true, run(a) {
        const e = editor();
        e.view.dispatch({ changes: { from: 0, to: e.view.state.doc.length, insert: String(a.text ?? "") } });
        return editorState();
      } },
    { id: "editor.state", title: "Text and selection", hidden: true, run: editorState },
    { id: "editor.rendered", title: "Lines as shown on screen", hidden: true, run: () => editor().rendered() },
    { id: "app.state", title: "App state", hidden: true, run() {
        const { tree: _tree, ...rest } = app.get();
        return rest;
      } },
  ]);
}

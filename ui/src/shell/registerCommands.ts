/** @part-of ui.shell */
import { identify } from "../bridge/analytics";
import { accountsAvailable, signOut } from "../bridge/auth";
import { analyticsCommands } from "../features/analytics/commands";
import { COVERS, ICONS } from "../features/page-header/PageHeader";
import { type Command, registerCommands } from "./commands";
import {
  app,
  chooseVault,
  closeTab,
  connectSync,
  createNote,
  deleteEntry,
  disconnectSync,
  getEditor,
  notify,
  openNote,
  save,
  setVault,
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
      run: () => app.set((s) => ({ view: s.view === "graph" ? "note" : "graph" })),
    },
    { id: "teams.open", title: "Team sync…", run: () => app.set({ teamsDialog: true }) },
    { id: "vault.choose", title: "Open another vault…", run: chooseVault },
    { id: "sidebar.toggle", title: "Show or hide the sidebar", keys: "Mod-\\", run: () => app.set((s) => ({ sidebar: !s.sidebar })) },
    { id: "note.new", title: "New note", keys: "Mod-n", run: () => createNote() },
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
    { id: "sync.connect", title: "Connect sync", hidden: true, run: (a) => connectSync(String(a.server), String(a.workspace), a.token ? String(a.token) : null) },
    { id: "sync.disconnect", title: "Disconnect sync", hidden: true, run: () => disconnectSync() },
    { id: "note.open", title: "Open note", hidden: true, run: async (a) => {
        await openNote(String(a.path));
        return { active: app.get().active };
      } },
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

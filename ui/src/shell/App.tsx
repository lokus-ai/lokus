/** @part-of ui.shell */
import { type CSSProperties, lazy, type PointerEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { identify } from "../bridge/analytics";
import { accessToken, accountsAvailable } from "../bridge/auth";
import { AiPanel } from "../features/ai/AiPanel";
import { AccountDialog } from "../features/auth/AccountDialog";
import { Backlinks } from "../features/backlinks/Backlinks";
import { FileTree } from "../features/file-tree/FileTree";
import { PluginView } from "../features/plugins/PluginView";
import { PageHeader } from "../features/page-header/PageHeader";
import { SearchPalette } from "../features/search/SearchPalette";
import { TeamsDialog } from "../features/teams/TeamsDialog";
import { Boundary } from "./Boundary";
import { formatKeys, runCommand } from "./commands";
import { Palette } from "./Palette";
import { useStore } from "./store";
import {
  app,
  attachEditor,
  chooseVault,
  closeTab,
  connectSync,
  createFolder,
  createNoteIn,
  createRow,
  deleteEntry,
  disconnectSync,
  getEditor,
  openNote,
  reloadFromDisk,
  renameEntry,
  save,
  setSidebarWidth,
} from "./workspace";

// The graph is only loaded when someone opens it.
const GraphView = lazy(() => import("../features/graph/GraphView"));
const SettingsView = lazy(() => import("../features/settings/SettingsView"));
const DatabaseView = lazy(() => import("../features/database/DatabaseView"));

const tabName = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "");

function Sidebar() {
  const vault = useStore(app, (s) => s.vault);
  const tree = useStore(app, (s) => s.tree);
  const active = useStore(app, (s) => s.active);
  const account = useStore(app, (s) => s.account);
  const open = useStore(app, (s) => s.sidebar);
  const narrow = useStore(app, (s) => s.narrow);
  const sync = useStore(app, (s) => s.sync);

  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.body.classList.add("resizing");
    const move = (ev: globalThis.PointerEvent) => setSidebarWidth(ev.clientX);
    const stop = () => {
      document.body.classList.remove("resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  // On a narrow window the sidebar is an overlay, so choosing something puts it away.
  const act = (id: string) => {
    if (narrow) app.set({ sidebar: false });
    void runCommand(id);
  };
  const pick = (path: string) => {
    if (narrow) app.set({ sidebar: false });
    void openNote(path);
  };

  return (
    <aside className={`sidebar${open ? "" : " closed"}`} aria-hidden={!open}>
     <div className="sidebar-inner">
      <div className="sidebar-top" data-tauri-drag-region />
      <button className="vault-name" title="Open another vault" onClick={() => act("vault.choose")}>
        <span className="vault-badge">{vault?.name.slice(0, 1).toUpperCase()}</span>
        <span className="tree-name">{vault?.name}</span>
      </button>
      <div className="sidebar-actions">
        <button onClick={() => act("palette.notes")}>
          <span>Go to note</span>
          <kbd>{formatKeys("Mod-o")}</kbd>
        </button>
        <button onClick={() => act("search.open")}>
          <span>Search in notes</span>
          <kbd>{formatKeys("Mod-Shift-f")}</kbd>
        </button>
        <button onClick={() => act("graph.toggle")}>
          <span>Graph</span>
          <kbd>{formatKeys("Mod-g")}</kbd>
        </button>
        <button onClick={() => act("ai.open")}>
          <span>Assistant</span>
          <kbd>{formatKeys("Mod-j")}</kbd>
        </button>
        <button onClick={() => act("note.new")}>
          <span>New note</span>
          <kbd>{formatKeys("Mod-n")}</kbd>
        </button>
      </div>
      <div className="sidebar-scroll">
        <FileTree
          entries={tree}
          active={active}
          onOpen={pick}
          onNewNote={(folder) => void createNoteIn(folder)}
          onNewFolder={(path) => void createFolder(path)}
          onRename={(from, to) => void renameEntry(from, to)}
          onDelete={(path) => void deleteEntry(path)}
        />
      </div>
      <button className="sidebar-account" onClick={() => act("teams.open")}>
        <span className={`sync-dot ${sync.status}`} />
        {sync.status === "off" ? "Sync with a team" : sync.status === "online" ? "Syncing" : sync.status === "connecting" ? "Connecting…" : sync.status === "offline" ? "Offline" : "Sync stopped"}
      </button>
      <button className="sidebar-account" onClick={() => act("settings.open")}>
        Settings
      </button>
      {accountsAvailable && (
        <button
          className="sidebar-account"
          onClick={() => act(account ? "palette.commands" : "account.signIn")}
        >
          {account ? account.email : "Sign in for sync and teams"}
        </button>
      )}
     </div>
      <div
        className="sidebar-resizer"
        title="Drag to resize, double-click to reset"
        onPointerDown={startResize}
        onDoubleClick={() => setSidebarWidth(248)}
      />
    </aside>
  );
}

function Tabs() {
  const tabs = useStore(app, (s) => s.tabs);
  const active = useStore(app, (s) => s.active);
  const dirty = useStore(app, (s) => s.dirty);
  const sidebar = useStore(app, (s) => s.sidebar);
  const narrow = useStore(app, (s) => s.narrow);
  const peers = useStore(app, (s) => s.peers);
  return (
    <div className={`tabs${sidebar && !narrow ? "" : " inset"}`} data-tauri-drag-region>
      <button className="tab-toggle" title="Show or hide the sidebar" onClick={() => void runCommand("sidebar.toggle")}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" />
          <path d="M6 2.5v11" />
        </svg>
      </button>
      {tabs.map((path) => (
        <div key={path} className={`tab${path === active ? " active" : ""}`} onMouseDown={() => void openNote(path)}>
          <span className="tree-name">{tabName(path)}</span>
          <button
            className={`tab-close${dirty[path] ? " dirty" : ""}`}
            title="Close"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void closeTab(path)}
          >
            ×
          </button>
        </div>
      ))}
      {peers.length > 0 && (
        <div className="peers" title={peers.map((p) => p.name).join(", ")}>
          {peers.slice(0, 5).map((p, i) => (
            <span key={i} className="peer" style={{ background: p.color }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Teams() {
  const sync = useStore(app, (s) => s.sync);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    void accessToken()
      .then(setToken)
      .catch(() => setToken(null));
  }, []);
  return (
    <TeamsDialog
      current={sync}
      accountToken={token}
      defaultServer={(import.meta.env.VITE_LOKUS_RELAY as string | undefined) ?? ""}
      onConnect={(server, workspace, typed) => void connectSync(server, workspace, typed)}
      onDisconnect={() => void disconnectSync()}
      onClose={() => app.set({ teamsDialog: false })}
    />
  );
}

function Page() {
  const active = useStore(app, (s) => s.active);
  const properties = useStore(app, (s) => s.properties);
  const conflict = useStore(app, (s) => s.conflict);
  const view = useStore(app, (s) => s.view);
  const version = useStore(app, (s) => s.version);
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mount.current) attachEditor(mount.current);
  }, []);

  return (
    <div className="page" hidden={!active || view !== "note"}>
      {active && conflict === active && (
        <div className="banner">
          <span>This note changed on disk while you were editing it.</span>
          <button onClick={() => void reloadFromDisk(active)}>Use the version on disk</button>
          <button onClick={() => void save(active, true)}>Keep mine</button>
        </div>
      )}
      {active && (
        <PageHeader
          path={active}
          properties={properties}
          onRename={(name) => {
            const folder = active.includes("/") ? `${active.slice(0, active.lastIndexOf("/"))}/` : "";
            void renameEntry(active, `${folder}${name}.md`);
          }}
          onProperty={(key, value) => getEditor()?.setProperty(key, value)}
          onEnter={() => getEditor()?.view.focus()}
        />
      )}
      {active && (properties.view === "table" || properties.view === "board") && (
        <div className={properties.view === "board" ? "page-wide" : "page-column"}>
          <Boundary name="This view">
            <Suspense fallback={null}>
              <DatabaseView
                self={active}
                mode={properties.view}
                folder={(properties.source ?? (active.includes("/") ? active.slice(0, active.lastIndexOf("/")) : "")).replace(/^\/|\/$/g, "")}
                group={properties.group || "status"}
                order={(properties.order ?? "").replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean)}
                version={version}
                onOpen={(p) => void openNote(p)}
                onNew={createRow}
              />
            </Suspense>
          </Boundary>
        </div>
      )}
      <div className="page-column">
        <div ref={mount} className="editor-mount" />
        {active && <Backlinks path={active} version={version} onOpen={(p) => void openNote(p)} />}
      </div>
    </div>
  );
}

/** The panel on the right: the assistant or a plugin's view. */
function Panel() {
  const panel = useStore(app, (s) => s.panel);
  if (!panel) return null;
  return (
    <aside className="panel">
      <div className="panel-head" data-tauri-drag-region>
        <span className="tree-name">{panel.kind === "plugin" ? panel.title : "Assistant"}</span>
        <button className="panel-close" title="Close" onClick={() => app.set({ panel: null })}>
          ×
        </button>
      </div>
      <Boundary name={panel.kind === "plugin" ? panel.title : "The assistant"}>
        {panel.kind === "plugin" ? <PluginView plugin={panel.plugin} page={panel.page} /> : <AiPanel />}
      </Boundary>
    </aside>
  );
}

function Welcome() {
  return (
    <div className="welcome" data-tauri-drag-region>
      <h1>Lokus</h1>
      <p>Your notes are plain Markdown files in a folder you choose.</p>
      <button className="primary" onClick={() => void chooseVault()}>
        Open a folder
      </button>
    </div>
  );
}

export function App() {
  const ready = useStore(app, (s) => s.ready);
  const vault = useStore(app, (s) => s.vault);
  const active = useStore(app, (s) => s.active);
  const narrow = useStore(app, (s) => s.narrow);
  const sidebar = useStore(app, (s) => s.sidebar);
  const sidebarWidth = useStore(app, (s) => s.sidebarWidth);
  const palette = useStore(app, (s) => s.palette);
  const view = useStore(app, (s) => s.view);
  const version = useStore(app, (s) => s.version);
  const open = useCallback((path: string) => void openNote(path), []);
  const accountDialog = useStore(app, (s) => s.accountDialog);
  const teamsDialog = useStore(app, (s) => s.teamsDialog);
  const notice = useStore(app, (s) => s.notice);
  const hasNotes = useStore(app, (s) => s.tree.length > 0);

  if (!ready) return <div className="welcome" data-tauri-drag-region />;
  if (!vault) return <Welcome />;
  return (
    <div className={`app${narrow ? " narrow" : ""}`} style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar />
      {narrow && sidebar && <div className="scrim" onMouseDown={() => app.set({ sidebar: false })} />}
      <main className="main">
        <Tabs />
        <Page />
        {view === "graph" && (
          <Boundary name="The graph">
            <Suspense fallback={null}>
              <GraphView active={active} version={version} onOpen={open} />
            </Suspense>
          </Boundary>
        )}
        {view === "settings" && (
          <Boundary name="Settings">
            <Suspense fallback={null}>
              <SettingsView />
            </Suspense>
          </Boundary>
        )}
        {!active && view === "note" && (
          <div className="empty">
            <p>No note open</p>
            {!hasNotes && (
              <button className="primary" onClick={() => void runCommand("vault.examples")}>
                Add a few example notes
              </button>
            )}
            <span>
              <kbd>{formatKeys("Mod-o")}</kbd> go to a note
            </span>
            <span>
              <kbd>{formatKeys("Mod-n")}</kbd> new note
            </span>
            <span>
              <kbd>{formatKeys("Mod-Shift-p")}</kbd> all commands
            </span>
          </div>
        )}
      </main>
      <Panel />
      {palette === "search" && <SearchPalette onOpen={open} onClose={() => app.set({ palette: null })} />}
      {palette && palette !== "search" && <Palette key={palette} mode={palette} />}
      {accountDialog && (
        <AccountDialog
          onClose={() => app.set({ accountDialog: false })}
          onDone={(account) => {
            identify(account.id);
            app.set({ account, accountDialog: false });
          }}
        />
      )}
      {teamsDialog && <Teams />}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

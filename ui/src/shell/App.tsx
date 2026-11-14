/** @part-of ui.shell */
import { track } from "../bridge/analytics";
import { type CSSProperties, lazy, type PointerEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { identify } from "../bridge/analytics";
import { accountsAvailable } from "../bridge/auth";
import { AiPanel } from "../features/ai/AiPanel";
import { chat, continueShared, newChat, shareChat } from "../features/ai/chat";
import { AccountDialog } from "../features/auth/AccountDialog";
import { Backlinks } from "../features/backlinks/Backlinks";
import { FileTree } from "../features/file-tree/FileTree";
import { PluginView } from "../features/plugins/PluginView";
import { isPicture, PageHeader } from "../features/page-header/PageHeader";
import { SearchPalette } from "../features/search/SearchPalette";
import { Boundary } from "./Boundary";
import { formatKeys, runCommand } from "./commands";
import { Icon } from "./Icon";
import { Palette } from "./Palette";
import { useStore } from "./store";
import {
  app,
  attachEditor,
  chooseVault,
  closeGraph,
  closeTab,
  createFolder,
  createNoteIn,
  createRow,
  deleteEntry,
  getEditor,
  GRAPH_TAB,
  openNote,
  reloadFromDisk,
  renameEntry,
  resolveImage,
  save,
  saveFile,
  setPanelWidth,
  setSidebarWidth,
  showGraph,
} from "./workspace";

// The graph is only loaded when someone opens it.
const GraphView = lazy(() => import("../features/graph/GraphView"));
const SettingsView = lazy(() => import("../features/settings/SettingsView"));
const DatabaseView = lazy(() => import("../features/database/DatabaseView"));
import { Avatar } from "../features/profile/Profile";
import { onboarding } from "../features/onboarding/onboarding";
import { Start } from "../features/onboarding/Start";
import { NewsButton, UpdateCard, WhatsNew } from "../features/updates/UpdateCard";
import { useMe } from "../features/profile/profiles";

const CustomersList = lazy(() => import("../features/customers/CustomersList"));
const CustomerProfile = lazy(() => import("../features/customers/CustomerProfile"));
const PersonProfile = lazy(() => import("../features/customers/PersonProfile"));
const Onboarding = lazy(() => import("../features/onboarding/Setup"));
const TasksBoard = lazy(() => import("../features/tasks/TasksBoard"));
const TaskProfile = lazy(() => import("../features/tasks/TaskProfile"));

const tabName = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "");

function Sidebar() {
  const vault = useStore(app, (s) => s.vault);
  const tree = useStore(app, (s) => s.tree);
  const active = useStore(app, (s) => s.active);
  const open = useStore(app, (s) => s.sidebar);
  const narrow = useStore(app, (s) => s.narrow);

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
          <Icon name="goto" />
          <span>Go to note</span>
          <kbd>{formatKeys("Mod-o")}</kbd>
        </button>
        <button onClick={() => act("search.open")}>
          <Icon name="search" />
          <span>Search in notes</span>
          <kbd>{formatKeys("Mod-Shift-f")}</kbd>
        </button>
        <button onClick={() => act("graph.toggle")}>
          <Icon name="graph" />
          <span>Graph</span>
          <kbd>{formatKeys("Mod-g")}</kbd>
        </button>
        <button onClick={() => act("customers.open")}>
          <Icon name="customers" />
          <span>Customers</span>
          <kbd>{formatKeys("Mod-Shift-c")}</kbd>
        </button>
        <button onClick={() => act("tasks.open")}>
          <Icon name="board" />
          <span>Tasks</span>
          <kbd>{formatKeys("Mod-Shift-t")}</kbd>
        </button>
        <button onClick={() => act("ai.open")}>
          <Icon name="assistant" />
          <span>Assistant</span>
          <kbd>{formatKeys("Mod-j")}</kbd>
        </button>
        <button onClick={() => act("note.new")}>
          <Icon name="compose" />
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
      <AccountBar act={act} />
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

const SYNC_LABEL = { off: "Sync is off", online: "Synced", connecting: "Connecting…", offline: "Offline", refused: "Sync stopped" } as const;

/** The foot of the sidebar: who is signed in and how sync is doing, with the account's actions in a menu. */
function AccountBar({ act }: { act(id: string): void }) {
  const account = useStore(app, (s) => s.account);
  const sync = useStore(app, (s) => s.sync);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);
  const pick = (id: string) => {
    setMenu(false);
    act(id);
  };
  const me = useMe();
  const name = me?.name ?? "";

  return (
    <div className="account-bar" onMouseDown={(e) => e.stopPropagation()}>
      {menu && (
        <div className="menu account-menu">
          {account && <p className="account-menu-email">{account.email}</p>}
          {account && <button onClick={() => pick("profile.open")}>Your profile</button>}
          <button onClick={() => pick("teams.open")}>{sync.status === "off" ? "Sync with a team…" : "Team sync…"}</button>
          <button onClick={() => pick("settings.open")}>Settings</button>
          {account && (
            <>
              <hr />
              <button onClick={() => pick("account.signOut")}>Sign out</button>
            </>
          )}
        </div>
      )}
      <button
        className={`account-row${menu ? " open" : ""}`}
        onClick={() => (account || !accountsAvailable ? setMenu((m) => !m) : act("account.signIn"))}
      >
        <span className="account-avatar">
          {account ? <Avatar name={name} picture={me?.picture} size={28} /> : <Icon name="account" />}
          <span className={`sync-dot ${sync.status}`} />
        </span>
        <span className="account-text">
          <span className="tree-name">{account ? name : accountsAvailable ? "Sign in" : "This device"}</span>
          <small className="tree-name">{account || !accountsAvailable ? SYNC_LABEL[sync.status] : "For sync and teams"}</small>
        </span>
      </button>
      <NewsButton />
      <button className="account-gear" title="Settings" onClick={() => act("settings.open")}>
        <Icon name="settings" />
      </button>
    </div>
  );
}

function Tabs() {
  const tabs = useStore(app, (s) => s.tabs);
  const active = useStore(app, (s) => s.active);
  const dirty = useStore(app, (s) => s.dirty);
  const sidebar = useStore(app, (s) => s.sidebar);
  const narrow = useStore(app, (s) => s.narrow);
  const peers = useStore(app, (s) => s.peers);
  const view = useStore(app, (s) => s.view);
  const icon = useStore(app, (s) => s.properties.icon);
  // A page's own icon is only known while it is the open note, so each tab remembers the last one seen.
  const icons = useRef<Record<string, string | undefined>>({});
  if (active) icons.current[active] = icon;
  return (
    <div className={`tabs${sidebar && !narrow ? "" : " inset"}`} data-tauri-drag-region>
      <button className="tab-toggle" title="Show or hide the sidebar" onClick={() => void runCommand("sidebar.toggle")}>
        <Icon name="sidebar" />
      </button>
      {tabs.map((path) =>
        path === GRAPH_TAB ? (
          <div key={path} className={`tab${view === "graph" ? " active" : ""}`} onMouseDown={showGraph}>
            <Icon name="graph" size={14} />
            <span className="tree-name">Graph</span>
            <button className="tab-close" title="Close" onMouseDown={(e) => e.stopPropagation()} onClick={closeGraph}>
              <Icon name="close" size={12} />
            </button>
          </div>
        ) : (
        <div key={path} className={`tab${view === "note" && path === active ? " active" : ""}`} onMouseDown={() => void openNote(path)}>
          {isPicture(icons.current[path]) ? (
            <img className="tab-icon picture" src={resolveImage(icons.current[path]) ?? ""} alt="" />
          ) : icons.current[path] ? (
            <span className="tab-icon">{icons.current[path]}</span>
          ) : (
            <Icon name="note" size={14} />
          )}
          <span className="tree-name">{tabName(path)}</span>
          <button
            className={`tab-close${dirty[path] ? " dirty" : ""}`}
            title="Close"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void closeTab(path)}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
        ),
      )}
      <button className="tab-new" title={`Open a note in a new tab (${formatKeys("Mod-o")})`} onClick={() => void runCommand("palette.notes")}>
        <Icon name="plus" size={14} />
      </button>
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
    <div className={`page${properties.type === "customer" ? " customer" : properties.view === "customers" || properties.view === "tasks" ? " customers" : ""}`} hidden={!active || view !== "note"}>
      {active && conflict === active && (
        <div className="banner">
          <span>This note changed on disk while you were editing it.</span>
          <button onClick={() => void reloadFromDisk(active)}>Use the version on disk</button>
          <button onClick={() => void save(active, true)}>Keep mine</button>
        </div>
      )}
      {active && properties.view !== "customers" && properties.view !== "tasks" && (
        <PageHeader
          path={active}
          properties={properties}
          onRename={(name) => {
            const folder = active.includes("/") ? `${active.slice(0, active.lastIndexOf("/"))}/` : "";
            void renameEntry(active, `${folder}${name}.md`);
          }}
          onProperty={(key, value) => (track("action", { feature: "page", action: "property_changed" }), getEditor()?.setProperty(key, value))}
          resolveImage={resolveImage}
          saveImage={saveFile}
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
      {active && properties.view === "tasks" && (
        <div className="page-bleed">
          <Boundary name="The task board">
            <Suspense fallback={null}>
              <TasksBoard version={version} onOpen={(p) => void openNote(p)} />
            </Suspense>
          </Boundary>
        </div>
      )}
      {active && properties.type === "task" && (
        <div className="page-column">
          <Boundary name="This task">
            <Suspense fallback={null}>
              <TaskProfile properties={properties} onProperty={(key, value) => (track("action", { feature: "tasks", action: "property_changed", key }), getEditor()?.setProperty(key, value))} onOpen={(p) => void openNote(p)} />
            </Suspense>
          </Boundary>
        </div>
      )}
      {active && properties.type === "chat" && (
        <div className="page-column">
          <div className="banner chat-banner">
            <span>
              A conversation with the assistant{properties.shared_by ? `, shared by ${properties.shared_by}` : ""}.
            </span>
            <button onClick={() => void continueShared(active)}>Carry on from here</button>
          </div>
        </div>
      )}
      {active && properties.view === "customers" && (
        <div className="page-bleed">
          <Boundary name="The customers list">
            <Suspense fallback={null}>
              <CustomersList
                folder={(properties.source ?? "customers").replace(/^\/|\/$/g, "")}
                version={version}
                onOpen={(p) => void openNote(p)}
                onNew={createRow}
                onDelete={deleteEntry}
              />
            </Suspense>
          </Boundary>
        </div>
      )}
      {active && properties.type === "customer" && (
        <div className="page-column">
          <Boundary name="This customer">
            <Suspense fallback={null}>
              <CustomerProfile
                path={active}
                properties={properties}
                version={version}
                onProperty={(key, value) => (track("action", { feature: "page", action: "property_changed" }), getEditor()?.setProperty(key, value))}
                onOpen={(p) => void openNote(p)}
              />
            </Suspense>
          </Boundary>
        </div>
      )}
      {active && properties.type === "person" && (
        <div className="page-column">
          <Boundary name="This person">
            <Suspense fallback={null}>
              <PersonProfile
                path={active}
                properties={properties}
                version={version}
                onProperty={(key, value) => (track("action", { feature: "page", action: "property_changed" }), getEditor()?.setProperty(key, value))}
                onOpen={(p) => void openNote(p)}
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
  const width = useStore(app, (s) => s.panelWidth);
  if (!panel) return null;
  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.body.classList.add("resizing");
    const move = (ev: globalThis.PointerEvent) => setPanelWidth(window.innerWidth - ev.clientX);
    const stop = () => {
      document.body.classList.remove("resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  return (
    <aside className="panel" style={{ width }}>
      <div className="panel-resizer" title="Drag to resize, double-click to reset" onPointerDown={startResize} onDoubleClick={() => setPanelWidth(360)} />
      <div className="panel-head" data-tauri-drag-region>
        <span className="tree-name">{panel.kind === "plugin" ? panel.title : "Assistant"}</span>
        {panel.kind === "ai" && (
          <button className="panel-close" title="Share this conversation with the workspace" onClick={() => void shareChat()}>
            <Icon name="share" size={14} />
          </button>
        )}
        {panel.kind === "ai" && (
          <button className="panel-close" title="Earlier conversations" onClick={() => chat.set((s) => ({ history: !s.history }))}>
            <Icon name="history" size={14} />
          </button>
        )}
        {panel.kind === "ai" && (
          <button className="panel-close" title="New chat" onClick={newChat}>
            <Icon name="compose" size={14} />
          </button>
        )}
        <button className="panel-close" title="Close" onClick={() => app.set({ panel: null })}>
          <Icon name="close" size={14} />
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

/**
 * The whole window. The setup sits beside whatever is behind it, so it stays put (and keeps
 * what has been answered) when a folder opens underneath it.
 */
export function App() {
  const ready = useStore(app, (s) => s.ready);
  const vault = useStore(app, (s) => s.vault);
  const onboardingOpen = useStore(onboarding, (s) => s.open);
  if (!ready) return <div className="welcome" data-tauri-drag-region />;
  return (
    <>
      {vault ? (
        <Workspace />
      ) : (
        <>
          <Welcome />
          {/* Someone who has not opened a folder yet is still told about an update. */}
          <UpdateCard />
          <WhatsNew />
        </>
      )}
      {onboardingOpen && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}
    </>
  );
}

function Workspace() {
  const active = useStore(app, (s) => s.active);
  const narrow = useStore(app, (s) => s.narrow);
  const sidebar = useStore(app, (s) => s.sidebar);
  const sidebarWidth = useStore(app, (s) => s.sidebarWidth);
  const palette = useStore(app, (s) => s.palette);
  const view = useStore(app, (s) => s.view);
  const version = useStore(app, (s) => s.version);
  const open = useCallback((path: string) => void openNote(path), []);
  const accountDialog = useStore(app, (s) => s.accountDialog);
  const settings = useStore(app, (s) => s.settings);
  const notice = useStore(app, (s) => s.notice);

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
        {!active && view === "note" && <Start />}
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
      {settings && (
        <Boundary name="Settings">
          <Suspense fallback={null}>
            <SettingsView page={settings} onPage={(page) => app.set({ settings: page })} onClose={() => app.set({ settings: null })} />
          </Suspense>
        </Boundary>
      )}
      <UpdateCard />
      <WhatsNew />
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

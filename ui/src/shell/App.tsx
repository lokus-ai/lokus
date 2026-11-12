/** @part-of ui.shell */
import { useEffect, useRef } from "react";

import { identify } from "../bridge/analytics";
import { accountsAvailable } from "../bridge/auth";
import { AccountDialog } from "../features/auth/AccountDialog";
import { FileTree } from "../features/file-tree/FileTree";
import { PageHeader } from "../features/page-header/PageHeader";
import { formatKeys, runCommand } from "./commands";
import { Palette } from "./Palette";
import { useStore } from "./store";
import { app, attachEditor, chooseVault, closeTab, getEditor, openNote, reloadFromDisk, renameNote, save } from "./workspace";

const tabName = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "");

function Sidebar() {
  const vault = useStore(app, (s) => s.vault);
  const tree = useStore(app, (s) => s.tree);
  const active = useStore(app, (s) => s.active);
  const account = useStore(app, (s) => s.account);
  return (
    <aside className="sidebar">
      <div className="sidebar-top" data-tauri-drag-region />
      <button className="vault-name" title="Open another vault" onClick={() => void runCommand("vault.choose")}>
        <span className="vault-badge">{vault?.name.slice(0, 1).toUpperCase()}</span>
        <span className="tree-name">{vault?.name}</span>
      </button>
      <div className="sidebar-actions">
        <button onClick={() => void runCommand("palette.notes")}>
          <span>Search</span>
          <kbd>{formatKeys("Mod-o")}</kbd>
        </button>
        <button onClick={() => void runCommand("note.new")}>
          <span>New note</span>
          <kbd>{formatKeys("Mod-n")}</kbd>
        </button>
      </div>
      <div className="sidebar-scroll">
        <FileTree entries={tree} active={active} onOpen={(p) => void openNote(p)} />
      </div>
      {accountsAvailable && (
        <button
          className="sidebar-account"
          onClick={() => void runCommand(account ? "palette.commands" : "account.signIn")}
        >
          {account ? account.email : "Sign in for sync and teams"}
        </button>
      )}
    </aside>
  );
}

function Tabs() {
  const tabs = useStore(app, (s) => s.tabs);
  const active = useStore(app, (s) => s.active);
  const dirty = useStore(app, (s) => s.dirty);
  const sidebar = useStore(app, (s) => s.sidebar);
  return (
    <div className={`tabs${sidebar ? "" : " inset"}`} data-tauri-drag-region>
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
    </div>
  );
}

function Page() {
  const active = useStore(app, (s) => s.active);
  const properties = useStore(app, (s) => s.properties);
  const conflict = useStore(app, (s) => s.conflict);
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mount.current) attachEditor(mount.current);
  }, []);

  return (
    <div className="page" hidden={!active}>
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
            void renameNote(active, `${folder}${name}.md`);
          }}
          onProperty={(key, value) => getEditor()?.setProperty(key, value)}
          onEnter={() => getEditor()?.view.focus()}
        />
      )}
      <div className="page-column">
        <div ref={mount} className="editor-mount" />
      </div>
    </div>
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
  const sidebar = useStore(app, (s) => s.sidebar);
  const palette = useStore(app, (s) => s.palette);
  const accountDialog = useStore(app, (s) => s.accountDialog);
  const notice = useStore(app, (s) => s.notice);

  if (!ready) return <div className="welcome" data-tauri-drag-region />;
  if (!vault) return <Welcome />;
  return (
    <div className="app">
      {sidebar && <Sidebar />}
      <main className="main">
        <Tabs />
        <Page />
        {!active && (
          <div className="empty">
            <p>No note open</p>
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
      {palette && <Palette key={palette} mode={palette} />}
      {accountDialog && (
        <AccountDialog
          onClose={() => app.set({ accountDialog: false })}
          onDone={(account) => {
            identify(account.id);
            app.set({ account, accountDialog: false });
          }}
        />
      )}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

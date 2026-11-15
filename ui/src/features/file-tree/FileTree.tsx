/** @part-of ui.file-tree */
import { type MouseEvent, useEffect, useState } from "react";

import type { Entry } from "../../bridge/core";
import { Icon } from "../../shell/Icon";

interface Props {
  entries: Entry[];
  active: string | null;
  onOpen(path: string): void;
  onNewNote(folder: string): void;
  onNewFolder(path: string): void;
  onRename(from: string, to: string): void;
  onDelete(path: string): void;
}

interface Menu {
  x: number;
  y: number;
  entry: Entry | null;
}

/** What the inline text box is doing: renaming a row or naming a new folder. */
type Editing = { kind: "rename"; entry: Entry } | { kind: "folder"; parent: string } | null;

const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const join = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);
const clean = (name: string) => name.trim().replace(/[\\/:]/g, "-");

function NameInput({ initial, depth, onDone }: { initial: string; depth: number; onDone(value: string | null): void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      className="tree-input"
      style={{ marginLeft: 22 + depth * 14 }}
      autoFocus
      value={value}
      spellCheck={false}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(clean(value) || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") onDone(null);
      }}
    />
  );
}

export function FileTree({ entries, active, onOpen, onNewNote, onNewFolder, onRename, onDelete }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  const expand = (path: string) => setOpen((prev) => new Set(prev).add(path));
  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const showMenu = (e: MouseEvent, entry: Entry | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const finishRename = (entry: Entry, value: string | null) => {
    setEditing(null);
    if (!value) return;
    const name = entry.kind === "note" ? `${value.replace(/\.md$/i, "")}.md` : value;
    if (name !== entry.name) onRename(entry.path, join(parentOf(entry.path), name));
  };
  const finishFolder = (parent: string, value: string | null) => {
    setEditing(null);
    if (value) onNewFolder(join(parent, value));
  };

  const rows = (items: Entry[], depth: number, parent: string) => (
    <>
      {editing?.kind === "folder" && editing.parent === parent && (
        <NameInput initial="New folder" depth={depth} onDone={(v) => finishFolder(parent, v)} />
      )}
      {items.map((entry) => {
        const indent = { paddingLeft: 10 + depth * 14 };
        if (editing?.kind === "rename" && editing.entry.path === entry.path) {
          const initial = entry.kind === "note" ? entry.name.replace(/\.md$/i, "") : entry.name;
          return <NameInput key={entry.path} initial={initial} depth={depth} onDone={(v) => finishRename(entry, v)} />;
        }
        if (entry.kind === "folder") {
          const expanded = open.has(entry.path) || Boolean(active?.startsWith(`${entry.path}/`));
          return (
            <div key={entry.path}>
              <button
                className="tree-row"
                style={indent}
                onClick={() => toggle(entry.path)}
                onContextMenu={(e) => showMenu(e, entry)}
              >
                <span className={`tree-caret${expanded ? " open" : ""}`}><Icon name="chevron" size={14} /></span>
                <span className="tree-name">{entry.name}</span>
              </button>
              {expanded && rows(entry.children ?? [], depth + 1, entry.path)}
            </div>
          );
        }
        const isNote = entry.kind === "note";
        return (
          <button
            key={entry.path}
            className={`tree-row${entry.path === active ? " active" : ""}`}
            style={indent}
            onClick={() => onOpen(entry.path)}
            onContextMenu={(e) => showMenu(e, entry)}
          >
            <span className="tree-caret"><Icon name={isNote ? "note" : "file"} size={14} /></span>
            <span className="tree-name">{isNote ? entry.name.replace(/\.md$/i, "") : entry.name}</span>
          </button>
        );
      })}
    </>
  );

  // New things go inside the folder that was clicked, or beside the file that was.
  const target = menu?.entry ? (menu.entry.kind === "folder" ? menu.entry.path : parentOf(menu.entry.path)) : "";
  const act = (run: () => void) => () => {
    setMenu(null);
    run();
  };

  return (
    <nav className="tree" onContextMenu={(e) => showMenu(e, null)}>
      {entries.length === 0 && !editing && <p className="tree-empty">This vault is empty. Right-click to add a note.</p>}
      {rows(entries, 0, "")}
      {menu && (
        <div className="menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={act(() => {
              if (target) expand(target);
              onNewNote(target);
            })}
          >
            New note
          </button>
          <button
            onClick={act(() => {
              if (target) expand(target);
              setEditing({ kind: "folder", parent: target });
            })}
          >
            New folder
          </button>
          {menu.entry && (
            <>
              <hr />
              <button onClick={act(() => setEditing({ kind: "rename", entry: menu.entry! }))}>Rename</button>
              <button className="danger" onClick={act(() => onDelete(menu.entry!.path))}>
                Move to trash
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

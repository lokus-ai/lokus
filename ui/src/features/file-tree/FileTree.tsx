/** @part-of ui.file-tree */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Entry } from "../../bridge/core";
import { registerCommands, unregisterCommands } from "../../shell/commands";
import { fileMenu, openMenu } from "../../shell/contextMenu";
import { Icon } from "../../shell/Icon";

interface Props {
  /** The folder these are the files of; a command sent for another one is not run. */
  root: string;
  entries: Entry[];
  active: string | null;
  onOpen(path: string): void;
  onNewNote(folder: string): void;
  onNewFolder(path: string): void;
  onRename(from: string, to: string): Promise<boolean>;
  onReveal(): void;
}

/** What the inline text box is doing: renaming a row or naming a new folder. */
type Editing = { kind: "rename"; entry: Entry } | { kind: "folder"; parent: string } | null;

const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const join = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);
const find = (entries: Entry[], path: string): Entry | null => {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    const inside = path.startsWith(`${entry.path}/`) ? find(entry.children ?? [], path) : null;
    if (inside) return inside;
  }
  return null;
};
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

export function FileTree({ root, entries, active, onOpen, onNewNote, onNewFolder, onRename, onReveal }: Props) {
  const [open, setOpen] = useState<Map<string, boolean>>(() => new Map());
  const tree = useRef<HTMLElement>(null);
  const [reveal, setReveal] = useState<{ path: string } | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  useLayoutEffect(() => {
    if (!reveal) return;
    const frame = requestAnimationFrame(() => {
      const row = [...(tree.current?.querySelectorAll<HTMLElement>(".tree-row") ?? [])].find((el) => el.dataset.path === reveal.path);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [reveal]);

  useEffect(() => {
    registerCommands([
      {
        id: "tree.collapseAll",
        title: "Collapse all folders",
        run() {
          const closed = new Map<string, boolean>();
          const collapse = (items: Entry[]) => {
            for (const entry of items) {
              if (entry.kind !== "folder") continue;
              closed.set(entry.path, false);
              collapse(entry.children ?? []);
            }
          };
          collapse(entries);
          setOpen(closed);
          setEditing(null);
        },
      },
      {
        id: "tree.revealActive",
        title: "Reveal active file in sidebar",
        run(a) {
          const path = typeof a.path === "string" ? a.path : active;
          if (!path || !here(a)) return;
          show(path);
          setReveal({ path });
        },
      },
      {
        id: "tree.rename",
        title: "Rename the open note or file…",
        run(a) {
          const entry = here(a) ? find(entries, typeof a.path === "string" ? a.path : (active ?? "")) : null;
          if (!entry) return;
          show(entry.path);
          setEditing({ kind: "rename", entry });
        },
      },
      {
        id: "tree.newFolder",
        title: "New folder",
        run(a) {
          if (!here(a)) return;
          const parent = typeof a.folder === "string" ? a.folder : "";
          if (parent) show(`${parent}/`);
          else onReveal();
          setEditing({ kind: "folder", parent });
        },
      },
      {
        id: "tree.newNote",
        title: "New note in a folder",
        hidden: true,
        run(a) {
          if (!here(a)) return;
          const parent = typeof a.folder === "string" ? a.folder : "";
          if (parent) show(`${parent}/`);
          onNewNote(parent);
        },
      },
    ]);
    return () => unregisterCommands(["tree.collapseAll", "tree.revealActive", "tree.rename", "tree.newFolder", "tree.newNote"]);
  }, [root, entries, active, onReveal, onNewNote]);

  const here = (a: Record<string, unknown>) => typeof a.root !== "string" || a.root === root;
  /** Open the folders above a path and bring the sidebar out. */
  const show = (path: string) => {
    setOpen((prev) => {
      const next = new Map(prev);
      for (let folder = parentOf(path); folder; folder = parentOf(folder)) next.set(folder, true);
      return next;
    });
    onReveal();
  };
  const toggle = (path: string) =>
    setOpen((prev) => {
      const expanded = prev.get(path) ?? Boolean(active?.startsWith(`${path}/`));
      return new Map(prev).set(path, !expanded);
    });
  // New things go inside the folder that was clicked, or beside the file that was.
  const menu = (e: Parameters<typeof openMenu>[0], entry: Entry | null) => {
    if (!entry) return openMenu(e, "Files", [{ id: "tree.newNote", label: "New note" }, { id: "tree.newFolder", label: "New folder" }], { args: { folder: "" } });
    if (entry.kind !== "folder") return fileMenu(e, entry.path, "tree", parentOf(entry.path));
    openMenu(e, entry.name, [
      { id: "tree.newNote", label: "New note" },
      { id: "tree.newFolder", label: "New folder" },
      null,
      { id: "tree.rename", label: "Rename" },
      { id: "note.trash", label: "Move to trash", danger: true },
    ], { args: { path: entry.path, folder: entry.path } });
  };

  const finishRename = async (entry: Entry, value: string | null) => {
    setEditing(null);
    if (!value) return;
    const name = entry.kind === "note" ? `${value.replace(/\.md$/i, "")}.md` : value;
    if (name === entry.name) return;
    const to = join(parentOf(entry.path), name);
    if (!(await onRename(entry.path, to)) || entry.kind !== "folder") return;
    setOpen((prev) => {
      const next = new Map(prev);
      for (const [path, expanded] of prev) {
        if (path !== entry.path && !path.startsWith(`${entry.path}/`)) continue;
        next.delete(path);
        next.set(`${to}${path.slice(entry.path.length)}`, expanded);
      }
      return next;
    });
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
          const expanded = open.get(entry.path) ?? Boolean(active?.startsWith(`${entry.path}/`));
          return (
            <div key={entry.path}>
              <button
                className="tree-row"
                style={indent}
                aria-expanded={expanded}
                data-path={entry.path}
                onClick={() => toggle(entry.path)}
                onContextMenu={(e) => menu(e, entry)}
                onKeyDown={(e) => menu(e, entry)}
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
            data-path={entry.path}
            onClick={() => onOpen(entry.path)}
            onContextMenu={(e) => menu(e, entry)}
            onKeyDown={(e) => menu(e, entry)}
          >
            <span className="tree-caret"><Icon name={isNote ? "note" : "file"} size={14} /></span>
            <span className="tree-name">{isNote ? entry.name.replace(/\.md$/i, "") : entry.name}</span>
          </button>
        );
      })}
    </>
  );

  return (
    <nav ref={tree} className="tree" aria-label="Files" tabIndex={-1} onContextMenu={(e) => menu(e, null)}>
      {entries.length === 0 && !editing && <p className="tree-empty">This vault is empty. Right-click to add a note.</p>}
      {rows(entries, 0, "")}
    </nav>
  );
}

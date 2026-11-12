/** @part-of ui.file-tree */
import { useState } from "react";

import type { Entry } from "../../bridge/core";

interface Props {
  entries: Entry[];
  active: string | null;
  onOpen(path: string): void;
}

export function FileTree({ entries, active, onOpen }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const rows = (items: Entry[], depth: number) =>
    items.map((entry) => {
      const indent = { paddingLeft: 10 + depth * 14 };
      if (entry.kind === "folder") {
        const expanded = open.has(entry.path) || Boolean(active?.startsWith(`${entry.path}/`));
        return (
          <div key={entry.path}>
            <button className="tree-row" style={indent} onClick={() => toggle(entry.path)}>
              <span className={`tree-caret${expanded ? " open" : ""}`}>›</span>
              <span className="tree-name">{entry.name}</span>
            </button>
            {expanded && rows(entry.children ?? [], depth + 1)}
          </div>
        );
      }
      const isNote = entry.kind === "note";
      return (
        <button
          key={entry.path}
          className={`tree-row${entry.path === active ? " active" : ""}${isNote ? "" : " muted"}`}
          style={indent}
          disabled={!isNote}
          onClick={() => onOpen(entry.path)}
        >
          <span className="tree-caret" />
          <span className="tree-name">{isNote ? entry.name.replace(/\.md$/i, "") : entry.name}</span>
        </button>
      );
    });

  if (entries.length === 0) return <p className="tree-empty">This vault is empty.</p>;
  return <nav className="tree">{rows(entries, 0)}</nav>;
}

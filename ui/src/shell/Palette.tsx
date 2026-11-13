/** @part-of ui.shell */
import { useEffect, useMemo, useRef, useState } from "react";

import { formatKeys, listCommands, runCommand } from "./commands";
import { allNotes, app, createFromTemplate, createNote, getEditor, openNote, restoreFromTrash, templates, type TrashedFile, trashed } from "./workspace";

interface Item {
  key: string;
  label: string;
  hint?: string;
  run(): void;
}

/** Characters of `query` in order; tighter matches score higher. */
function score(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const at = t.indexOf(q);
  if (at >= 0) return 1000 - at;
  let i = 0;
  let gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, i);
    if (found < 0) return 0;
    gaps += found - i;
    i = found + 1;
  }
  return Math.max(1, 500 - gaps);
}

type Mode = "commands" | "notes" | "headings" | "templates" | "trash";

const PLACEHOLDER: Record<Mode, string> = {
  commands: "Run a command…",
  notes: "Find or create a note…",
  headings: "Go to a heading…",
  templates: "New note from a template…",
  trash: "Restore from the trash…",
};
const EMPTY: Record<Mode, string> = {
  commands: "Nothing matches.",
  notes: "Nothing matches.",
  headings: "This note has no headings.",
  templates: "No templates yet. Notes in a folder called Templates show up here.",
  trash: "The trash is empty.",
};

const noteName = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "");
const folderOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : undefined);

function when(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export function Palette({ mode }: { mode: Mode }) {
  const [trash, setTrash] = useState<TrashedFile[]>([]);
  useEffect(() => {
    if (mode === "trash") void trashed().then(setTrash, () => setTrash([]));
  }, [mode]);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const close = () => app.set({ palette: null });

  const items = useMemo<Item[]>(() => {
    const source: Item[] =
      mode === "commands"
        ? listCommands()
            .filter((c) => !c.hidden)
            .map((c) => ({
              key: c.id,
              label: c.title,
              hint: c.keys ? formatKeys(c.keys) : undefined,
              run: () => void runCommand(c.id),
            }))
        : mode === "headings"
          ? (getEditor()?.headings() ?? []).map((h, i) => ({
              key: `${i}`,
              label: `${"  ".repeat(h.level - 1)}${h.text}`,
              run: () => getEditor()?.goTo(h.pos),
            }))
          : mode === "templates"
            ? templates().map((path) => ({ key: path, label: noteName(path), run: () => void createFromTemplate(path) }))
            : mode === "trash"
              ? trash.map((t) => ({
                  key: t.id,
                  label: noteName(t.path),
                  hint: [folderOf(t.path), when(t.deleted_at)].filter(Boolean).join(" · "),
                  run: () => void restoreFromTrash(t.id),
                }))
              : allNotes().map((path) => ({ key: path, label: noteName(path), hint: folderOf(path), run: () => void openNote(path) }));
    // A note's headings stay in reading order; everything else is ranked by the match.
    if (mode === "headings" && !query.trim()) return source;
    const ranked = source
      .map((item) => ({ item, s: score(query.trim(), item.label) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 50)
      .map((r) => r.item);
    const name = query.trim();
    if (mode === "notes" && name && !ranked.some((i) => i.label.toLowerCase() === name.toLowerCase())) {
      ranked.push({ key: "+new", label: `Create “${name}”`, run: () => void createNote(name) });
    }
    return ranked;
  }, [mode, query, trash]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    close();
    item.run();
  };

  return (
    <div className="overlay top" onMouseDown={close}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder={PLACEHOLDER[mode]}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "Enter") choose(items[index]);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
          }}
        />
        <div className="palette-list" ref={list}>
          {items.map((item, i) => (
            <button
              key={item.key}
              className={`palette-row${i === index ? " active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(item)}
            >
              <span>{item.label}</span>
              {item.hint && <span className="palette-hint">{item.hint}</span>}
            </button>
          ))}
          {items.length === 0 && <p className="palette-empty">{query.trim() ? "Nothing matches." : EMPTY[mode]}</p>}
        </div>
      </div>
    </div>
  );
}

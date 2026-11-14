/** @part-of ui.database */
import { type PointerEvent, useCallback, useEffect, useMemo, useState } from "react";

import { runCore } from "../../bridge/core";
import { Icon } from "../../shell/Icon";

type Scalar = string | number | boolean | null;
type Cell = Scalar | Scalar[];

interface Row {
  path: string;
  title: string;
  props: Record<string, Cell>;
}

export interface DatabaseProps {
  /** The note that holds the view; it is left out of its own rows. */
  self: string;
  mode: "table" | "board";
  /** Folder whose notes are the rows. */
  folder: string;
  /** Board only: the property the columns stand for. */
  group: string;
  /** Board only: column order, when the note sets one. */
  order: string[];
  version: number;
  onOpen(path: string): void;
  /** Create a note in the folder, optionally with one property set; resolves to its path. */
  onNew(folder: string, key?: string, value?: string): Promise<string | null>;
}

/** Properties that describe the page or the view, not the row. */
const HIDDEN = new Set(["icon", "cover", "cover_layout", "view", "source", "group", "order"]);

const show = (value: Cell | undefined): string =>
  value === null || value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);

/** Turn what was typed back into the kind of value the cell held. */
function parse(text: string, was: Cell | undefined): Cell {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (Array.isArray(was)) return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

const name = (row: Row) => row.path.split("/").pop()!.replace(/\.md$/i, "");

export default function DatabaseView({ self, mode, folder, group, order, version, onOpen, onNew }: DatabaseProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let current = true;
    void runCore<Row[]>("props.rows", { folder })
      .then((found) => current && setRows(found.filter((r) => r.path !== self)))
      .catch(() => current && setRows([]));
    return () => {
      current = false;
    };
  }, [folder, self, version, tick]);

  const set = useCallback(async (path: string, key: string, value: Cell) => {
    // Show the change at once; the file watcher confirms it a moment later.
    setRows((all) => all.map((r) => (r.path === path ? { ...r, props: { ...r.props, [key]: value } } : r)));
    await runCore("props.set", { path, key, value }).catch(() => {});
    setTick((t) => t + 1);
  }, []);

  const add = useCallback(
    async (key?: string, value?: string) => {
      await onNew(folder, key, value);
      setTick((t) => t + 1);
    },
    [folder, onNew],
  );

  return mode === "board" ? (
    <Board rows={rows} group={group} order={order} set={set} add={add} onOpen={onOpen} />
  ) : (
    <Table rows={rows} set={set} add={add} onOpen={onOpen} />
  );
}

interface ViewProps {
  rows: Row[];
  set(path: string, key: string, value: Cell): Promise<void>;
  add(key?: string, value?: string): Promise<void>;
  onOpen(path: string): void;
}

function Table({ rows, set, add, onOpen }: ViewProps) {
  const [sort, setSort] = useState<{ key: string; down: boolean } | null>(null);
  const [editing, setEditing] = useState<{ path: string; key: string } | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);

  const columns = useMemo(() => {
    const count = new Map<string, number>();
    for (const row of rows) for (const key of Object.keys(row.props)) if (!HIDDEN.has(key)) count.set(key, (count.get(key) ?? 0) + 1);
    const known = [...count.keys()].sort((a, b) => count.get(b)! - count.get(a)! || a.localeCompare(b));
    return [...known, ...extra.filter((k) => !count.has(k))];
  }, [rows, extra]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const value = (row: Row) => (sort.key === "" ? name(row) : show(row.props[sort.key]));
    return [...rows].sort((a, b) => value(a).localeCompare(value(b), undefined, { numeric: true }) * (sort.down ? -1 : 1));
  }, [rows, sort]);

  const head = (key: string, label: string) => (
    <th key={key} onClick={() => setSort((s) => (s?.key === key ? (s.down ? null : { key, down: true }) : { key, down: false }))}>
      {label}
      {sort?.key === key && <span className="db-sort"><Icon name={sort.down ? "sortDown" : "sortUp"} size={12} /></span>}
    </th>
  );

  return (
    <div className="db">
      <table className="db-table">
        <thead>
          <tr>
            {head("", "Name")}
            {columns.map((key) => head(key, key))}
            <th className="db-add-col">
              {naming ? (
                <input
                  autoFocus
                  placeholder="Property"
                  onBlur={(e) => {
                    const key = e.target.value.trim();
                    if (key) setExtra((x) => [...x, key]);
                    setNaming(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setNaming(false);
                  }}
                />
              ) : (
                <button title="Add a property" onClick={() => setNaming(true)}>
                  +
                </button>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.path}>
              <td className="db-name" onClick={() => onOpen(row.path)}>
                {name(row)}
              </td>
              {columns.map((key) => {
                const value = row.props[key];
                const active = editing?.path === row.path && editing.key === key;
                if (typeof value === "boolean") {
                  return (
                    <td key={key}>
                      <input type="checkbox" checked={value} onChange={(e) => void set(row.path, key, e.target.checked)} />
                    </td>
                  );
                }
                return (
                  <td key={key} onClick={() => setEditing({ path: row.path, key })}>
                    {active ? (
                      <input
                        autoFocus
                        defaultValue={show(value)}
                        onBlur={(e) => {
                          setEditing(null);
                          const next = parse(e.target.value, value);
                          if (show(next) !== show(value)) void set(row.path, key, next);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      show(value)
                    )}
                  </td>
                );
              })}
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <button className="db-new" onClick={() => void add()}>
        + New
      </button>
    </div>
  );
}

function Board({ rows, group, order, set, add, onOpen }: ViewProps & { group: string; order: string[] }) {
  const [drag, setDrag] = useState<{ path: string; over: string | null } | null>(null);

  const columns = useMemo(() => {
    const seen = [...order];
    for (const row of rows) {
      const value = show(row.props[group]);
      if (value && !seen.includes(value)) seen.push(value);
    }
    return ["", ...seen];
  }, [rows, group, order]);

  const columnAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest("[data-column]") as HTMLElement | null)?.dataset.column ?? null;

  const start = (e: PointerEvent, row: Row) => {
    if (e.button !== 0) return;
    const from = { x: e.clientX, y: e.clientY };
    let moved = false;
    const move = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - from.x) + Math.abs(ev.clientY - from.y) < 5) return;
      moved = true;
      setDrag({ path: row.path, over: columnAt(ev.clientX, ev.clientY) });
    };
    const stop = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      setDrag(null);
      if (!moved) {
        onOpen(row.path);
        return;
      }
      const target = columnAt(ev.clientX, ev.clientY);
      if (target !== null && target !== show(row.props[group])) void set(row.path, group, target === "" ? null : target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div className="db board">
      {columns.map((column) => {
        const cards = rows.filter((r) => show(r.props[group]) === column);
        if (column === "" && cards.length === 0) return null;
        return (
          <div key={column} data-column={column} className={`board-col${drag?.over === column ? " over" : ""}`}>
            <div className="board-head">
              <span>{column || `No ${group}`}</span>
              <span className="palette-hint">{cards.length}</span>
            </div>
            {cards.map((row) => (
              <div key={row.path} className={`board-card${drag?.path === row.path ? " dragging" : ""}`} onPointerDown={(e) => start(e, row)}>
                <span>{name(row)}</span>
                {Object.entries(row.props)
                  .filter(([key, value]) => key !== group && !HIDDEN.has(key) && show(value))
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span key={key} className="board-prop">
                      {key}: {show(value)}
                    </span>
                  ))}
              </div>
            ))}
            <button className="db-new" onClick={() => void add(column ? group : undefined, column || undefined)}>
              + New
            </button>
          </div>
        );
      })}
    </div>
  );
}

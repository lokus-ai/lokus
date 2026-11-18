/** @part-of ui.tasks */
import { track } from "../../bridge/analytics";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { registerCommands, runCommand, unregisterCommands } from "../../shell/commands";
import { showContextMenu, type ContextMenuItem } from "../../shell/contextMenu";
import { app, deleteEntry, getEditor, notify, retainTaskChanges } from "../../shell/workspace";
import { Face } from "../profile/Profile";
import { columnOrder, columnsOf, dueText, editTask, isDone, loadTasks, PRIORITIES, recordTask, STATUSES, statusName, type Task, type TaskField } from "./data";
import { SaveFeedback, TaskFields } from "./TaskProfile";

interface Props {
  version: number;
  onOpen(path: string): void;
}

interface TaskWrite {
  message?: string;
  error?: string;
  retry?: () => void;
  intent?: { task: Task; field: TaskField; value: string | null };
}

/** How much a task matters, as three bars that fill up; the most pressing is marked on its own. */
export function Priority({ level }: { level: string }) {
  const at = PRIORITIES.indexOf(level);
  if (at < 0) return <span className="task-priority none" title="No priority" />;
  if (at === 0) return <span className="task-priority urgent" title="Urgent">!</span>;
  return (
    <span className={`task-priority bars-${4 - at}`} title={level.replace(/^./, (c) => c.toUpperCase())}>
      <i />
      <i />
      <i />
    </span>
  );
}

/** What a task carries besides its title: who it is for, how it is labelled, whose it is, when it is due. */
function Facts({ task, onOpenCustomer, compact = false }: { task: Task; onOpenCustomer?(name: string): void; compact?: boolean }) {
  const due = dueText(task.due);
  return (
    <span className="task-facts">
      {task.customer && (
        <span
          className="task-chip"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenCustomer?.(task.customer);
          }}
        >
          {task.customer}
        </span>
      )}
      {task.labels.map((label) => (
        <span key={label} className={`task-chip label${label.includes("churn") ? " risk" : ""}`}>
          {label}
        </span>
      ))}
      {!compact && due && <span className={`task-due${due.late && !isDone(task) ? " late" : ""}`}>{due.text}</span>}
      {!compact && task.assignee && (
        <span className="task-who" title={`Assigned to ${task.assignee}`}>
          <Face name={task.assignee} />
        </span>
      )}
    </span>
  );
}

/**
 * The team's work as a board: a column for each place a task can stand, cards dragged between
 * them. Or as one list, grouped the same way. A task is a note; opening a card opens it.
 */
export default function TasksBoard({ version, onOpen }: Props) {
  const board = useStore(app, (s) => s.active);
  const root = useStore(app, (s) => s.vault?.root);
  const order = useStore(app, (s) => s.properties.order);
  const readOnly = useStore(app, (s) => s.sync.role === "viewer");
  const busy = useRef(new Set<string>());
  const [writes, renderWrites] = useState<Record<string, TaskWrite>>({});
  const writesRef = useRef(writes);
  const setWrites = (update: (now: Record<string, TaskWrite>) => Record<string, TaskWrite>) => {
    writesRef.current = update(writesRef.current);
    renderWrites(writesRef.current);
  };
  const [loadError, setLoadError] = useState("");
  const [columnEdit, setColumnEdit] = useState<{ from: string | null; value: string } | null>(null);
  const dismissMenu = useRef<(() => void) | null>(null);
  const actions = useRef<Record<string, (args: Record<string, unknown>) => unknown>>({});
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [mode, setMode] = useState<"board" | "list">(() => (localStorage.getItem("lokus.tasks.mode") === "list" ? "list" : "board"));
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  /** The card being carried: which one, the column under it, and where to draw it. */
  const [drag, setDrag] = useState<{ path: string; over: string | null; x: number; y: number; width: number } | null>(null);
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    if (board && root) return retainTaskChanges(board, root, () => busy.current.size > 0 || Object.values(writesRef.current).some((write) => Boolean(write.intent)));
  }, [board, root]);

  useEffect(() => {
    let current = true;
    void loadTasks()
      .then((found) => { if (current) { setTasks(found); setLoadError(""); } })
      .catch(() => { if (current) setLoadError("Tasks could not be loaded. Try again."); });
    return () => {
      current = false;
    };
  }, [version, tick]);

  const all = [...(tasks ?? [])];
  for (const write of Object.values(writes)) {
    const held = write.intent?.task;
    if (held && !all.some((task) => task.path === held.path)) all.push(held);
  }
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => writes[t.path]?.intent || !q || [t.key, t.title, t.customer, t.assignee, ...t.labels].some((v) => v.toLowerCase().includes(q)));
  }, [all, query, writes]);
  const statuses = columnsOf(all, columnOrder(order));
  const columns = statuses.filter((c) => showDone || c !== "done" || shown.some((task) => task.status === c && writes[task.path]?.intent));

  const change = async (task: Task, field: TaskField, value: string | null) => {
    if (readOnly || busy.current.has(task.path) || task[field] === (value ?? "")) return;
    const held = writesRef.current[task.path]?.intent;
    if (held && (held.field !== field || held.value !== value)) return;
    busy.current.add(task.path);
    const intent = { task, field, value };
    setWrites((now) => ({ ...now, [task.path]: { intent } }));
    try {
      await editTask(task, field, value);
      setWrites((now) => { const next = { ...now }; delete next[task.path]; return next; });
      await loadTasks().then((found) => { setTasks(found); setLoadError(""); }, () => setLoadError("Saved, but tasks could not be reloaded. Try again."));
    } catch (error) {
      setWrites((now) => ({ ...now, [task.path]: { intent, error: error instanceof Error ? error.message : "Could not save this task.", retry: () => void change(task, field, value) } }));
    } finally {
      busy.current.delete(task.path);
      setTick((t) => t + 1);
    }
  };
  const move = (task: Task, status: string) => change(task, "status", status);
  const cancel = (path: string) => {
    if (busy.current.has(path) || !writesRef.current[path]?.error || !writesRef.current[path]?.intent) return;
    setWrites((now) => { const next = { ...now }; delete next[path]; return next; });
  };
  const add = async (status: string, title: string) => {
    if (readOnly) return;
    track("action", { feature: "tasks", action: "created", in: status });
    setAdding(null);
    if (!title.trim()) return;
    await recordTask({ title: title.trim(), status }).catch((e) => notify(e instanceof Error ? e.message : "The task could not be created."));
    setTick((t) => t + 1);
  };
  const openCustomer = (name: string) => onOpen(`customers/${name}.md`);

  const remove = async (task: Task) => {
    if (readOnly || app.get().vault?.root !== task.root || busy.current.has(task.path) || writesRef.current[task.path]?.intent) return;
    busy.current.add(task.path);
    setWrites((now) => ({ ...now, [task.path]: { message: "Moving to trash…" } }));
    try {
      if (await deleteEntry(task.path)) {
        setWrites((now) => { const next = { ...now }; delete next[task.path]; return next; });
        setTick((t) => t + 1);
      } else setWrites((now) => ({ ...now, [task.path]: { error: "The task was not moved to trash.", retry: () => void remove(task) } }));
    } finally { busy.current.delete(task.path); }
  };
  const writeColumn = async (from: string | null, value: string | null) => {
    if (readOnly || !board || !root) return;
    const status = value === null ? null : value.trim().replace(/\s+/g, " ").toLowerCase();
    if (value !== null && (!status || [...status].length > 30 || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(value))) return notify("Use a column name of 1–30 characters on one line.");
    try {
      const latest = await loadTasks();
      if (app.get().active !== board || app.get().vault?.root !== root || app.get().view !== "note" || app.get().properties.view !== "tasks" || app.get().sync.role === "viewer") return;
      // One-per-line column lists are not read here; refuse rather than rewrite and drop them.
      const text = getEditor()?.text ?? "";
      if (/^order:[ \t]*\n[ \t]+-/m.test(text.startsWith("---") ? text.slice(0, Math.max(0, text.indexOf("\n---", 3))) : "")) return notify("This board lists its columns one per line. Write them as order: [a, b] to change columns here.");
      const current = columnOrder(app.get().properties.order);
      if (from && !columnsOf(latest, current).includes(from)) return notify("That column changed elsewhere. Try again.");
      if (from && (STATUSES.includes(from) || latest.some((t) => t.status === from))) return notify("Move all tasks out of this custom column before renaming or removing it.");
      if (status && status !== from && columnsOf(latest, current).includes(status)) return notify("A column with that name already exists.");
      const next = current.filter((s) => s !== from);
      if (status) next.push(status);
      getEditor()?.setProperty("order", next);
      setColumnEdit(null);
    } catch { notify("Columns could not be changed. Try again."); }
  };
  const controls = (task: Task) => <>
    <TaskFields values={task} statuses={statuses} disabled={readOnly || Boolean(loadError) || busy.current.has(task.path) || Boolean(writes[task.path]?.intent)} onChange={(field, value) => void change(task, field, value)} />
    <div className="task-card-actions" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {writes[task.path] && <span role="status" className={writes[task.path].error ? "task-error" : "task-save"}>
        {writes[task.path].intent && <span>{writes[task.path].intent!.field}: {writes[task.path].intent!.value || "None"}{writes[task.path].error ? " — not saved. " : " — "}</span>}
        {writes[task.path].error ?? writes[task.path].message ?? "Saving…"}
        {writes[task.path].retry && <button className="link" disabled={readOnly || busy.current.has(task.path)} onClick={() => void runCommand("tasks.retry", { path: task.path, board, root })}>Retry</button>}
        {writes[task.path].error && writes[task.path].intent && <button className="link" onClick={() => void runCommand("tasks.cancel", { path: task.path, board, root })}>Cancel change</button>}
      </span>}
      <button className="link" disabled={readOnly || busy.current.has(task.path) || Boolean(writes[task.path]?.intent)} onClick={() => void remove(task)}>Move to trash</button>
    </div>
  </>;

  actions.current = {
    "tasks.retry": (args) => { if (typeof args.path === "string") writesRef.current[args.path]?.retry?.(); },
    "tasks.cancel": (args) => { if (typeof args.path === "string") cancel(args.path); },
    "tasks.edit": (args) => {
      const row = [...document.querySelectorAll<HTMLElement>("[data-task-path]")].find((el) => el.dataset.taskPath === args.path);
      row?.querySelector<HTMLSelectElement>("select")?.focus();
    },
    "tasks.trash": (args) => { const task = all.find((t) => t.path === args.path); if (task) return remove(task); },
    "tasks.column.add": (args) => typeof args.name === "string" ? writeColumn(null, args.name) : setColumnEdit({ from: null, value: "" }),
    "tasks.column.rename": (args) => { if (typeof args.status === "string" && statuses.includes(args.status) && !STATUSES.includes(args.status) && !all.some((t) => t.status === args.status)) return typeof args.name === "string" ? writeColumn(args.status, args.name) : setColumnEdit({ from: args.status, value: args.status }); },
    "tasks.column.remove": (args) => { if (typeof args.status === "string") return writeColumn(args.status, null); },
  };
  useEffect(() => {
    const ids = Object.keys(actions.current);
    registerCommands(ids.map((id) => ({ id, title: id.replaceAll(".", " "), hidden: true, run: (args) => {
      if (app.get().view === "note" && app.get().properties.view === "tasks" && (id === "tasks.cancel" || app.get().sync.role !== "viewer") && (!args.board || args.board === app.get().active) && (!args.root || args.root === app.get().vault?.root)) return actions.current[id]?.(args);
    } })));
    return () => { dismissMenu.current?.(); unregisterCommands(ids); };
  }, []);
  useEffect(() => { dismissMenu.current?.(); }, [tasks, order, board, readOnly]);

  const menu = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, task?: Task, status?: string) => {
    if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
    if ("key" in event && event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    const snapshot = app.get();
    const populated = all.some((t) => t.status === status);
    const custom = Boolean(status && !STATUSES.includes(status));
    const items: (ContextMenuItem | null)[] = task ? [
      { id: "note.open", label: "Open task" },
      { id: "tasks.edit", label: "Edit task fields" },
      null, { id: "tasks.trash", label: "Move task to trash", disabled: Boolean(writes[task.path]?.intent), danger: true },
    ] : [
      { id: "tasks.column.add", label: "Add column" },
      { id: "tasks.column.rename", label: populated ? "Move tasks before renaming" : "Rename column", disabled: !custom || populated },
      null, { id: "tasks.column.remove", label: populated ? "Move tasks before removing" : "Remove column", disabled: !custom || populated, danger: true },
    ];
    dismissMenu.current = showContextMenu("clientX" in event ? { x: event.clientX, y: event.clientY } : { x: box.left, y: box.bottom }, task ? `Task ${task.key}` : `Column ${statusName(status ?? "")}`, items, {
      valid: () => element.isConnected && app.get().view === "note" && app.get().properties.view === "tasks" && app.get().active === board && app.get().vault?.root === snapshot.vault?.root && app.get().version === snapshot.version && app.get().sync.role !== "viewer" && (!task || !busy.current.has(task.path)),
      subscribe: (check) => {
        element.classList.add("task-context-target");
        const stop = app.subscribe(check);
        return () => { stop(); element.classList.remove("task-context-target"); };
      },
      restoreFocus: () => element.focus({ preventScroll: true }),
      run: (id) => { void runCommand(id, { path: task?.path, status, board, root: snapshot.vault?.root }).catch(() => notify("That task action could not be completed.")); },
    });
  };

  const columnAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-status]") as HTMLElement | null)?.dataset.status ?? null;
  const start = (e: PointerEvent, task: Task) => {
    if (e.button !== 0 || readOnly || busy.current.has(task.path) || writesRef.current[task.path]?.intent || (e.target as HTMLElement).closest("button, input, select, fieldset")) return;
    const from = { x: e.clientX, y: e.clientY };
    // Where on the card it was picked up, so the card stays under the pointer the same way.
    const box = e.currentTarget.getBoundingClientRect();
    const grip = { x: e.clientX - box.left, y: e.clientY - box.top };
    let moved = false;
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - from.x) + Math.abs(ev.clientY - from.y) < 5) return;
      moved = true;
      setDrag({ path: task.path, over: columnAt(ev.clientX, ev.clientY), x: ev.clientX - grip.x, y: ev.clientY - grip.y, width: box.width });
    };
    const stop = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      setDrag(null);
      if (!moved) return onOpen(task.path);
      const target = columnAt(ev.clientX, ev.clientY);
      if (target !== null) void move(task, target);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  };

  const newCard = (status: string) =>
    adding === status ? (
      <input
        className="task-new-input"
        autoFocus
        placeholder="What needs doing?"
        aria-label={`New task in ${statusName(status)}`}
        onBlur={(e) => void add(status, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setAdding(null);
        }}
      />
    ) : null;

  if (tasks === null) return <p role="status">{loadError || "Loading tasks…"}{loadError && <button className="link" onClick={() => setTick((t) => t + 1)}>Retry</button>}</p>;
  return (
    <div className="tasks">
      <header className="custs-head">
        <h1>Tasks</h1>
        <div className="segmented">
          <button className={mode === "board" ? "active" : ""} onClick={() => (setMode("board"), localStorage.setItem("lokus.tasks.mode", "board"))}>
            Board
          </button>
          <button className={mode === "list" ? "active" : ""} onClick={() => (setMode("list"), localStorage.setItem("lokus.tasks.mode", "list"))}>
            List
          </button>
        </div>
        <button className="link" onClick={() => setShowDone((s) => !s)}>
          {showDone ? "Hide done" : "Show done"}
        </button>
        <label className="custs-search">
          <Icon name="search" size={14} />
          <input placeholder="Find a task" value={query} spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="link" disabled={readOnly} onClick={() => setColumnEdit({ from: null, value: "" })}>Add column</button>
        <button className="custs-new" disabled={readOnly} onClick={() => setAdding("todo")}>
          <Icon name="plus" size={14} />
          New task
        </button>
      </header>
      <SaveFeedback path={board} label="Board layout" />
      {loadError && <p className="task-error" role="alert">{loadError}<button className="link" onClick={() => setTick((t) => t + 1)}>Retry</button></p>}
      {columnEdit && <form className="task-column-edit" onSubmit={(e) => { e.preventDefault(); void writeColumn(columnEdit.from, columnEdit.value); }}>
        <input className="task-new-input" autoFocus aria-label="Column name" value={columnEdit.value} onChange={(e) => setColumnEdit({ ...columnEdit, value: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") setColumnEdit(null); }} />
        <button className="link" type="submit">{columnEdit.from ? "Rename column" : "Add column"}</button>
        <button className="link" type="button" onClick={() => setColumnEdit(null)}>Cancel</button>
      </form>}

      {mode === "board" ? (
        <div className="task-board">
          {columns.map((status) => {
            const cards = shown.filter((t) => (t.status || "todo") === status);
            return (
              <section key={status} data-status={status} tabIndex={0} onContextMenu={(e) => menu(e, undefined, status)} onKeyDown={(e) => menu(e, undefined, status)} className={`task-col${drag?.over === status ? " over" : ""}`}>
                <h2>
                  <span className={`task-dot ${status}`} />
                  {statusName(status)}
                  <span>{cards.length}</span>
                  <button disabled={readOnly} title={`Add a task to ${statusName(status)}`} onClick={() => setAdding(status)}>
                    <Icon name="plus" size={13} />
                  </button>
                </h2>
                {!STATUSES.includes(status) && <div className="task-column-actions">
                  <button className="link" disabled={readOnly || all.some((t) => t.status === status)} title="Only empty custom columns can be renamed" onClick={() => setColumnEdit({ from: status, value: status })}>Rename</button>
                  <button className="link" disabled={readOnly || all.some((t) => t.status === status)} title="Move all tasks out before removing this column" onClick={() => void writeColumn(status, null)}>Remove</button>
                </div>}
                {newCard(status)}
                {cards.map((task) => (
                  <article key={task.path} data-task-path={task.path} tabIndex={0} onContextMenu={(e) => menu(e, task)} onKeyDown={(e) => menu(e, task)} className={`task-card${drag?.path === task.path ? " dragging" : ""}`} onPointerDown={(e) => start(e, task)}>
                    <div className="task-card-top">
                      <span className="task-key">{task.key}</span>
                      <Priority level={task.priority} />
                    </div>
                    <button className="task-title" onClick={() => onOpen(task.path)}>{task.title}</button>
                    <Facts task={task} compact onOpenCustomer={openCustomer} />
                    {controls(task)}
                  </article>
                ))}
                {cards.length === 0 && adding !== status && <p className="task-none">Nothing here</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="task-list">
          {columns.map((status) => {
            const rows = shown.filter((t) => (t.status || "todo") === status);
            if (rows.length === 0 && adding !== status) return null;
            return (
              <section key={status}>
                <h2>
                  <span className={`task-dot ${status}`} />
                  {statusName(status)}
                  <span>{rows.length}</span>
                </h2>
                {newCard(status)}
                {rows.map((task) => (
                  <article key={task.path} data-task-path={task.path} tabIndex={0} onContextMenu={(e) => menu(e, task)} onKeyDown={(e) => menu(e, task)} className="task-row">
                    <Priority level={task.priority} />
                    <span className="task-key">{task.key}</span>
                    <button className="task-row-title" onClick={() => onOpen(task.path)}>{task.title}</button>
                    <Facts task={task} compact onOpenCustomer={openCustomer} />
                    {controls(task)}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {drag &&
        (() => {
          const carried = all.find((t) => t.path === drag.path);
          return carried ? (
            // The card itself follows the pointer; it lets clicks through so the column under it can be found.
            <article className="task-card carried" style={{ left: drag.x, top: drag.y, width: drag.width }}>
              <div className="task-card-top">
                <span className="task-key">{carried.key}</span>
                <Priority level={carried.priority} />
              </div>
              <p>{carried.title}</p>
              <Facts task={carried} />
            </article>
          ) : null;
        })()}
      {all.length === 0 && (
        <div className="custs-empty">
          <p>No tasks yet</p>
          <span>Add one here, or ask the assistant to turn what customers are saying into tasks.</span>
        </div>
      )}
    </div>
  );
}

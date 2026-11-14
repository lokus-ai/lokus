/** @part-of ui.tasks */
import { type PointerEvent, useEffect, useMemo, useState } from "react";

import { Icon } from "../../shell/Icon";
import { Face } from "../profile/Profile";
import { columnsOf, dueText, isDone, loadTasks, PRIORITIES, recordTask, statusName, type Task } from "./data";

interface Props {
  version: number;
  onOpen(path: string): void;
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
function Facts({ task, onOpenCustomer }: { task: Task; onOpenCustomer?(name: string): void }) {
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
      {due && <span className={`task-due${due.late && !isDone(task) ? " late" : ""}`}>{due.text}</span>}
      {task.assignee && (
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
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [mode, setMode] = useState<"board" | "list">(() => (localStorage.getItem("lokus.tasks.mode") === "list" ? "list" : "board"));
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  /** The card being carried: which one, the column under it, and where to draw it. */
  const [drag, setDrag] = useState<{ path: string; over: string | null; x: number; y: number; width: number } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let current = true;
    void loadTasks()
      .then((found) => current && setTasks(found))
      .catch(() => current && setTasks([]));
    return () => {
      current = false;
    };
  }, [version, tick]);

  const all = tasks ?? [];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => !q || [t.key, t.title, t.customer, t.assignee, ...t.labels].some((v) => v.toLowerCase().includes(q)));
  }, [all, query]);
  const columns = columnsOf(all).filter((c) => showDone || c !== "done");

  const move = async (task: Task, status: string) => {
    if (task.status === status) return;
    // Show it where it was dropped at once; the note catches up a moment later.
    setTasks((now) => (now ?? []).map((t) => (t.path === task.path ? { ...t, status } : t)));
    await recordTask({ key: task.key, status }).catch(() => {});
    setTick((t) => t + 1);
  };
  const add = async (status: string, title: string) => {
    setAdding(null);
    if (!title.trim()) return;
    await recordTask({ title: title.trim(), status }).catch(() => {});
    setTick((t) => t + 1);
  };
  const openCustomer = (name: string) => onOpen(`customers/${name}.md`);

  const columnAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-status]") as HTMLElement | null)?.dataset.status ?? null;
  const start = (e: PointerEvent, task: Task) => {
    if (e.button !== 0) return;
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

  if (tasks === null) return null;
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
        <button className="custs-new" onClick={() => setAdding("todo")}>
          <Icon name="plus" size={14} />
          New task
        </button>
      </header>

      {mode === "board" ? (
        <div className="task-board">
          {columns.map((status) => {
            const cards = shown.filter((t) => (t.status || "todo") === status);
            return (
              <section key={status} data-status={status} className={`task-col${drag?.over === status ? " over" : ""}`}>
                <h2>
                  <span className={`task-dot ${status}`} />
                  {statusName(status)}
                  <span>{cards.length}</span>
                  <button title={`Add a task to ${statusName(status)}`} onClick={() => setAdding(status)}>
                    <Icon name="plus" size={13} />
                  </button>
                </h2>
                {newCard(status)}
                {cards.map((task) => (
                  <article key={task.path} className={`task-card${drag?.path === task.path ? " dragging" : ""}`} onPointerDown={(e) => start(e, task)}>
                    <div className="task-card-top">
                      <span className="task-key">{task.key}</span>
                      <Priority level={task.priority} />
                    </div>
                    <p>{task.title}</p>
                    <Facts task={task} onOpenCustomer={openCustomer} />
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
                  <button key={task.path} className="task-row" onClick={() => onOpen(task.path)}>
                    <Priority level={task.priority} />
                    <span className="task-key">{task.key}</span>
                    <span className="task-row-title">{task.title}</span>
                    <Facts task={task} onOpenCustomer={openCustomer} />
                  </button>
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

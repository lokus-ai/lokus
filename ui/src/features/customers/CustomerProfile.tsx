/** @part-of ui.customers */
import { useEffect, useMemo, useState } from "react";

import { Icon } from "../../shell/Icon";
import { isDone, loadTasks, recordTask, statusName, type Task } from "../tasks/data";
import { Priority } from "../tasks/TasksBoard";
import {
  dayLabel,
  folderOf,
  HIDDEN,
  isOpenIssue,
  type Item,
  type Kind,
  kindOf,
  label,
  loadItems,
  loadPeople,
  type Person,
  loadSchema,
  reasons,
  saveSchema,
  type Schema,
  type Thread,
  threads,
  waitingSince,
} from "./data";
import { ago, cap, readBody } from "./data";
import { Field, FieldMenu, HealthPicker, ItemRow, KIND_ICON_OF, Person as Face, Value } from "./parts";

interface Props {
  /** The customer's note. What happened with them is the notes in the folder of the same name. */
  path: string;
  properties: Record<string, string>;
  version: number;
  onProperty(key: string, value: string | null): void;
  onOpen(path: string): void;
}

/** How much of the activity shows before "Show all". */
const RECENT = 6;

function Days({ items, onOpen }: { items: Item[]; onOpen(path: string): void }) {
  const days = useMemo(() => {
    const groups: { day: string; items: Item[] }[] = [];
    for (const item of items) {
      const day = dayLabel(item.at);
      if (groups.at(-1)?.day === day) groups.at(-1)!.items.push(item);
      else groups.push({ day, items: [item] });
    }
    return groups;
  }, [items]);
  return (
    <>
      {days.map((group) => (
        <div key={group.day} className="cust-day">
          <h4>{group.day}</h4>
          {group.items.map((item) => (
            <ItemRow key={item.path} item={item} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </>
  );
}

/** One conversation: a line that says where it stands, opening into who said what, in order. */
export function Conversation({ thread, onOpen }: { thread: Thread; onOpen(path: string): void }) {
  const [open, setOpen] = useState(thread.waiting);
  const [said, setSaid] = useState<Record<string, string>>({});
  const last = thread.messages[thread.messages.length - 1];
  useEffect(() => {
    if (!open) return;
    let current = true;
    void Promise.all(thread.messages.map(async (m) => [m.path, (await readBody(m.path).catch(() => "")) || m.title] as const)).then(
      (all) => current && setSaid(Object.fromEntries(all)),
    );
    return () => {
      current = false;
    };
  }, [open, thread]);

  return (
    <div className={`cust-thread${open ? " open" : ""}`}>
      <button className="cust-item" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`cust-item-kind chevron${open ? " down" : ""}`}>
          <Icon name="chevron" size={13} />
        </span>
        <span className="cust-item-title">{last.title}</span>
        {thread.waiting && <span className="cust-status waiting">Waiting on us</span>}
        <span className="cust-item-from">
          {[cap(thread.source), thread.channel, `${thread.messages.length} ${thread.messages.length === 1 ? "message" : "messages"}`].filter(Boolean).join("  ·  ")}
        </span>
        <time>{ago(thread.at)}</time>
      </button>
      {open && (
        <div className="cust-talk">
          {thread.messages.map((m) => (
            <div key={m.path} className={`cust-line${m.inbound ? "" : " ours"}`} onDoubleClick={() => onOpen(m.path)}>
              <span className="cust-line-who">
                <b>{m.from || (m.inbound ? "Customer" : "Us")}</b>
                {!m.inbound && <i>us</i>}
                <time>{ago(m.at)}</time>
              </span>
              <p>{said[m.path] ?? m.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * What sits between a customer note's title and its own text: the details as a list of
 * properties, where things stand, what is open and what has happened. It reads as part of the
 * page, in the page's own column, so a customer is still a note.
 */
export default function CustomerProfile({ path, properties, version, onProperty, onOpen }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [schema, setSchema] = useState<Schema>({ path: null, kinds: {}, hidden: [], columns: [] });
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasking, setTasking] = useState(false);
  const [source, setSource] = useState("");
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [writing, setWriting] = useState(false);
  const [unhiding, setUnhiding] = useState(false);
  const name = path.split("/").pop()!.replace(/\.md$/i, "");

  useEffect(() => {
    let current = true;
    void loadItems(path)
      .then(async (found) => {
        if (!current) return;
        setItems(found);
        const who = await loadPeople(path.split("/").pop()!.replace(/\.md$/i, ""), found).catch(() => []);
        if (current) setPeople(who);
      })
      .catch(() => current && setItems([]));
    void loadSchema(folderOf(path))
      .then((found) => current && setSchema(found))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [path, version]);
  useEffect(() => {
    let current = true;
    void loadTasks().then(
      (all) => current && setTasks(all.filter((t) => t.customer.toLowerCase() === name.toLowerCase())),
      () => current && setTasks([]),
    );
    return () => {
      current = false;
    };
  }, [name, version]);
  useEffect(() => {
    setSource("");
    setAll(false);
    setUnhiding(false);
  }, [path]);

  const change = (patch: Parameters<typeof saveSchema>[1]) => {
    setSchema((now) => ({ ...now, ...patch }));
    void saveSchema(schema, patch).catch(() => {});
  };
  const open = useMemo(() => items.filter(isOpenIssue), [items]);
  const sources = useMemo(() => [...new Set(items.filter((i) => i.kind !== "message").map((i) => i.source).filter(Boolean))].sort(), [items]);
  const set = (key: string) => (next: string) => onProperty(key, next.trim() || null);
  const known = Object.keys(properties).filter((k) => !HIDDEN.has(k) && k !== "health");
  const details = known.filter((k) => !schema.hidden.includes(k));
  const hidden = known.filter((k) => schema.hidden.includes(k));
  const kind = (key: string): Kind => kindOf(schema, key, properties[key]);
  const said = reasons(schema, properties, open.length, items[0]?.at ?? 0, waitingSince(items));
  const talks = useMemo(() => threads(items), [items]);
  // Messages have their own section, so the activity below is everything else.
  const rest = items.filter((i) => i.kind !== "message");
  const listed = rest.filter((i) => !source || i.source === source);

  return (
    <div className="cust">
      <div className="cust-props">
        <div className="cust-detail">
          <span className="cust-detail-name">
            <Icon name="activity" size={14} />
            Health
          </span>
          <span className="cust-health-row">
            <HealthPicker value={properties.health ?? ""} onChange={(v) => onProperty("health", v)} />
            {said.length > 0 && <span className="cust-said">{said.join("  ·  ")}</span>}
          </span>
        </div>
        {details.map((key) => (
          <div key={key} className="cust-detail">
            <span className="cust-detail-name">
              <Icon name={KIND_ICON_OF[kind(key)]} size={14} />
              {label(key)}
            </span>
            <Field label={key} value={properties[key]} onChange={set(key)}>
              <Value kind={kind(key)} value={properties[key]} />
            </Field>
            <FieldMenu
              kind={kind(key)}
              history={items.filter((i) => i.field === key)}
              onKind={(k) => change({ kinds: { ...schema.kinds, [key]: k } })}
              onHide={() => change({ hidden: [...schema.hidden, key] })}
              onOpen={onOpen}
            />
          </div>
        ))}
        <div className="cust-props-foot">
          {adding ? (
            <input
              className="cust-input"
              autoFocus
              aria-label="New detail"
              placeholder="Name of the detail"
              onBlur={(e) => {
                const key = e.target.value.trim().toLowerCase().replace(/\s+/g, "_");
                setAdding(false);
                if (key && !(key in properties)) onProperty(key, "-");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setAdding(false);
              }}
            />
          ) : (
            <button className="cust-add" onClick={() => setAdding(true)}>
              <Icon name="plus" size={14} />
              Add a detail
            </button>
          )}
          {hidden.length > 0 && (
            <button className="cust-add" onClick={() => setUnhiding((u) => !u)}>
              <Icon name="hide" size={14} />
              {hidden.length} hidden
            </button>
          )}
        </div>
        {unhiding &&
          hidden.map((key) => (
            <div key={key} className="cust-detail">
              <span className="cust-detail-name">{label(key)}</span>
              <button className="cust-value" onClick={() => change({ hidden: schema.hidden.filter((k) => k !== key) })}>
                Show again
              </button>
            </div>
          ))}
      </div>

      <section>
        <h3>Where things stand</h3>
        {writing ? (
          <textarea
            className="cust-summary"
            autoFocus
            aria-label="Where things stand"
            defaultValue={properties.summary ?? ""}
            onBlur={(e) => {
              setWriting(false);
              const next = e.target.value.replace(/\s+/g, " ").trim();
              if (next !== (properties.summary ?? "")) onProperty("summary", next || null);
            }}
            onKeyDown={(e) => e.key === "Escape" && setWriting(false)}
          />
        ) : (
          <p className="cust-summary" onClick={() => setWriting(true)}>
            {properties.summary || <span className="cust-none">Nobody has written a summary yet. Click to write one.</span>}
          </p>
        )}
      </section>

      <section>
        <h3>
          People <span>{people.length}</span>
        </h3>
        {people.length === 0 && <p className="cust-empty">Nobody yet. A person is a note with “type: person” and “customer: {name}”.</p>}
        {people.map((p) => (
          <button key={p.path} className="cust-item" onClick={() => onOpen(p.path)}>
            <Face name={p.name} icon={typeof p.props.icon === "string" ? p.props.icon : undefined} />
            <span className="cust-item-role">{String(p.props.role ?? "")}</span>
            {p.waiting && <span className="cust-status waiting">Waiting on us</span>}
            {p.asks > 0 && (
              <span className="cust-status">
                {p.asks} open {p.asks === 1 ? "request" : "requests"}
              </span>
            )}
            <time>{ago(p.last)}</time>
          </button>
        ))}
      </section>

      <section>
        <h3>
          Tasks <span>{tasks.filter((t) => !isDone(t)).length}</span>
        </h3>
        {tasks.filter((t) => !isDone(t)).map((task) => (
          <button key={task.path} className="cust-item" onClick={() => onOpen(task.path)}>
            <Priority level={task.priority} />
            <span className="task-key">{task.key}</span>
            <span className="cust-item-title">{task.title}</span>
            {task.labels.some((l) => l.includes("churn")) && <span className="cust-status waiting">Churn risk</span>}
            <span className="cust-status">{statusName(task.status)}</span>
            <span className="cust-item-from">{task.assignee}</span>
          </button>
        ))}
        {tasking ? (
          <input
            className="cust-input task-inline"
            autoFocus
            aria-label="New task for this customer"
            placeholder="What needs doing for them?"
            onBlur={(e) => {
              setTasking(false);
              const title = e.target.value.trim();
              if (title) void recordTask({ title, customer: name }).then(() => loadTasks().then((all) => setTasks(all.filter((t) => t.customer.toLowerCase() === name.toLowerCase()))));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setTasking(false);
            }}
          />
        ) : (
          <button className="cust-add" onClick={() => setTasking(true)}>
            <Icon name="plus" size={14} />
            Add a task
          </button>
        )}
      </section>

      <section>
        <h3>
          Open issues <span>{open.length}</span>
        </h3>
        {open.length === 0 ? <p className="cust-empty">Nothing is open.</p> : open.map((item) => <ItemRow key={item.path} item={item} onOpen={onOpen} />)}
      </section>

      <section>
        <h3>
          Conversations <span>{talks.length}</span>
        </h3>
        {talks.length === 0 ? <p className="cust-empty">No messages yet.</p> : talks.map((t) => <Conversation key={t.id} thread={t} onOpen={onOpen} />)}
      </section>

      <section>
        <h3>
          Activity <span>{rest.length}</span>
          {sources.length > 1 && (
            <select className="cust-source" aria-label="Show activity from" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">From everywhere</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          )}
        </h3>
        {rest.length === 0 && <p className="cust-empty">Nothing has happened yet. Notes added to the “{name}” folder appear here.</p>}
        <Days items={all ? listed : listed.slice(0, RECENT)} onOpen={onOpen} />
        {!all && listed.length > RECENT && (
          <button className="cust-add" onClick={() => setAll(true)}>
            Show all {listed.length}
          </button>
        )}
      </section>

      <h3 className="cust-notes">Notes</h3>
    </div>
  );
}

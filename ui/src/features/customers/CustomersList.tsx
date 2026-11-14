/** @part-of ui.customers */
import { track } from "../../bridge/analytics";
import { Fragment, useEffect, useMemo, useState } from "react";

import { runCore } from "../../bridge/core";
import { Icon, type IconName } from "../../shell/Icon";
import {
  ago,
  attention,
  type Customer,
  daysSince,
  HIDDEN,
  isArchived,
  type Kind,
  kindOf,
  KINDS,
  label,
  loadCustomers,
  loadSchema,
  needsAttention,
  reasons,
  saveSchema,
  type Schema,
  show,
  threads,
  tone,
} from "./data";
import { Health, KIND_ICON_OF, Logo, Value } from "./parts";

interface Props {
  /** Folder whose notes marked `type: customer` are the customers. */
  folder: string;
  version: number;
  onOpen(path: string): void;
  /** Create a note in the folder with one property set; resolves to its path. */
  onNew(folder: string, key?: string, value?: string): Promise<string | null>;
  /** Move a note, or a folder and everything in it, to the trash. */
  onDelete(path: string): Promise<void>;
}

/** The columns a team starts with, after the ones every list has. They can all be taken away. */
const STARTING_COLUMNS = ["owner", "plan", "mrr"];
/** The columns every list has, which say who the customer is and why they matter now. */
const FIXED: { key: string; icon: IconName; text: string }[] = [
  { key: "name", icon: "customers", text: "Customer" },
  { key: "health", icon: "activity", text: "Health" },
  { key: "why", icon: "issue", text: "What is going on" },
  { key: "last", icon: "calendar", text: "Last activity" },
];

/**
 * Every customer in one table, split into those who need someone and the rest, each with the
 * reason in words. The other columns are the team's choice of the customers' details.
 */
export default function CustomersList({ folder, version, onOpen, onNew, onDelete }: Props) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [schema, setSchema] = useState<Schema>({ path: null, kinds: {}, hidden: [], columns: [] });
  const [view, setView] = useState<"all" | "attention" | "waiting" | "archived">("all");
  /** The customers ticked for doing something to several at once, by their note's path. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** A delete of the ticked customers is waiting to be confirmed. */
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; down: boolean } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ path: string; key: string } | null>(null);
  const [fresh, setFresh] = useState({ name: "", kind: "text" as Kind });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let current = true;
    void loadCustomers(folder)
      .then((found) => current && setCustomers(found))
      .catch(() => current && setCustomers([]));
    void loadSchema(folder)
      .then((found) => current && setSchema(found))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [folder, version, tick]);

  const everyone = customers ?? [];
  const archived = everyone.filter(isArchived);
  // Everywhere but the Archived view, a customer that was put away is not there.
  const all = view === "archived" ? archived : everyone.filter((c) => !isArchived(c));
  const live = everyone.length - archived.length;
  const columns = (schema.columns.length ? schema.columns : STARTING_COLUMNS).filter((k) => !HIDDEN.has(k) && k !== "health");
  const offered = useMemo(() => {
    const keys = new Set<string>(Object.keys(schema.kinds));
    for (const c of all) for (const key of Object.keys(c.props)) keys.add(key);
    return [...keys].filter((k) => !HIDDEN.has(k) && k !== "health" && !columns.includes(k)).sort();
  }, [all, schema, columns]);
  const kind = (key: string) => kindOf(schema, key, all.find((c) => c.props[key] !== undefined && c.props[key] !== null)?.props[key]);
  const numeric = (key: string) => kind(key) === "money" || kind(key) === "number";
  const why = (c: Customer) => reasons(schema, c.props, c.open, c.last, c.waiting);

  const save = (patch: Parameters<typeof saveSchema>[1]) => {
    setSchema((now) => ({ ...now, ...patch }));
    void saveSchema(schema, patch).catch(() => {});
  };
  const addColumn = (key: string, as?: Kind) => {
    track("action", { feature: "customers", action: "column_added", kind: as ?? "auto" });
    save({ columns: [...columns, key], ...(as ? { kinds: { ...schema.kinds, [key]: as } } : {}) });
    setMenu(null);
    setFresh({ name: "", kind: "text" });
  };
  const move = (key: string, by: number) => {
    track("action", { feature: "customers", action: "column_moved" });
    const at = columns.indexOf(key);
    const next = [...columns];
    next.splice(at, 1);
    next.splice(Math.max(0, Math.min(columns.length - 1, at + by)), 0, key);
    save({ columns: next });
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kept = all
      .filter((c) => view !== "attention" || needsAttention(schema, c))
      .filter((c) => !q || [c.name, ...Object.values(c.props).map(show)].some((v) => v.toLowerCase().includes(q)));
    if (view === "archived") return [{ title: "", rows: kept.sort((a, b) => a.name.localeCompare(b.name)) }];
    if (sort) {
      const value = (c: Customer): string | number => {
        if (sort.key === "name") return c.name.toLowerCase();
        if (sort.key === "health") return { risk: 0, watch: 1, good: 2, none: 3 }[tone(show(c.props.health))];
        if (sort.key === "why") return -attention(c);
        if (sort.key === "last") return -c.last;
        return numeric(sort.key) ? -(Number(c.props[sort.key]) || 0) : show(c.props[sort.key]).toLowerCase();
      };
      kept.sort((a, b) => {
        const [x, y] = [value(a), value(b)];
        const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        return sort.down ? -order : order;
      });
      return [{ title: "", rows: kept }];
    }
    kept.sort((a, b) => attention(b) - attention(a) || a.name.localeCompare(b.name));
    const urgent = kept.filter((c) => needsAttention(schema, c));
    const rest = kept.filter((c) => !needsAttention(schema, c));
    return [
      { title: "Needs attention", rows: urgent },
      { title: "Doing fine", rows: rest },
    ].filter((g) => g.rows.length > 0);
  }, [all, view, query, sort, schema]);
  const rows = groups.flatMap((g) => g.rows);
  // Every conversation where the customer spoke last, the longest wait first.
  const waiting = useMemo(
    () =>
      all
        .flatMap((c) => threads(c.items).filter((t) => t.waiting).map((thread) => ({ customer: c, thread })))
        .sort((a, b) => a.thread.at - b.thread.at),
    [all],
  );
  const total = (key: string) => rows.reduce((sum, c) => sum + (Number(c.props[key]) || 0), 0);

  const write = async (path: string, key: string, text: string) => {
    track("action", { feature: "customers", action: "cell_edited" });
    const trimmed = text.trim();
    const plain = trimmed.replace(/[$,]/g, "");
    const value = trimmed === "" ? null : numeric(key) && !Number.isNaN(Number(plain)) ? Number(plain) : trimmed;
    await runCore("props.set", { path, key, value }).catch(() => {});
    setTick((t) => t + 1);
  };
  const chosen = everyone.filter((c) => picked.has(c.path));
  const clear = () => {
    setPicked(new Set());
    setConfirming(false);
  };
  const pick = (path: string) =>
    setPicked((now) => {
      const next = new Set(now);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const setArchived = async (list: Customer[], on: boolean) => {
    track("action", { feature: "customers", action: on ? "archived" : "unarchived", count: list.length });
    setMenu(null);
    for (const c of list) await runCore("props.set", { path: c.path, key: "archived", value: on ? true : null }).catch(() => {});
    clear();
    setTick((t) => t + 1);
  };
  /** A customer goes with everything filed under it: what happened, and the people there. */
  const remove = async (list: Customer[]) => {
    track("action", { feature: "customers", action: "deleted", count: list.length });
    setMenu(null);
    const names = new Set(list.map((c) => c.name.toLowerCase()));
    const people = await runCore<{ path: string; props: Record<string, unknown> }[]>("props.rows", { folder: "", deep: true })
      .then((rows) => rows.filter((r) => r.props.type === "person" && names.has(String(r.props.customer ?? "").toLowerCase())).map((r) => r.path))
      .catch(() => [] as string[]);
    for (const c of list) if (c.items.length) await onDelete(c.path.replace(/\.md$/i, ""));
    for (const person of people) await onDelete(person);
    for (const c of list) await onDelete(c.path);
    clear();
    setTick((t) => t + 1);
  };
  const create = async () => {
    track("action", { feature: "customers", action: "created" });
    const path = await onNew(folder, "type", "customer");
    if (path) onOpen(path);
  };
  const sortBy = (key: string, down: boolean) => {
    track("action", { feature: "customers", action: "sorted" });
    setSort({ key, down });
    setMenu(null);
  };

  const head = (key: string, icon: IconName, text: string, own: boolean) => (
    <th key={key} className={own && numeric(key) ? "num" : ""}>
      <button className="custs-th" aria-expanded={menu === key} onClick={() => setMenu(menu === key ? null : key)}>
        <Icon name={icon} size={14} />
        <span>{text}</span>
        {sort?.key === key && <Icon name={sort.down ? "sortDown" : "sortUp"} size={12} />}
      </button>
      {menu === key && (
        <div className="cust-menu left">
          <button onClick={() => sortBy(key, false)}>
            <Icon name="sortUp" size={14} />
            Sort ascending
          </button>
          <button onClick={() => sortBy(key, true)}>
            <Icon name="sortDown" size={14} />
            Sort descending
          </button>
          {own && (
            <>
              <hr />
              <small>Show as</small>
              {(Object.keys(KINDS) as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    save({ kinds: { ...schema.kinds, [key]: k } });
                    setMenu(null);
                  }}
                >
                  <Icon name={KIND_ICON_OF[k]} size={14} />
                  {KINDS[k]}
                  {k === kind(key) && <Icon name="check" size={13} />}
                </button>
              ))}
              <hr />
              <button disabled={columns.indexOf(key) === 0} onClick={() => move(key, -1)}>
                <Icon name="left" size={14} />
                Move left
              </button>
              <button disabled={columns.indexOf(key) === columns.length - 1} onClick={() => move(key, 1)}>
                <Icon name="right" size={14} />
                Move right
              </button>
              <button
                onClick={() => {
                  save({ columns: columns.filter((k) => k !== key) });
                  setMenu(null);
                }}
              >
                <Icon name="hide" size={14} />
                Remove this column
              </button>
            </>
          )}
        </div>
      )}
    </th>
  );

  if (customers === null) return null;
  return (
    <div className="custs">
      {menu && <div className="cust-shade" onClick={() => setMenu(null)} />}
      {picked.size > 0 ? (
        <header className="custs-head picking">
          {confirming ? (
            <>
              <span className="custs-picked">
                Delete {chosen.length === 1 ? chosen[0].name : `${chosen.length} customers`}, everything recorded about {chosen.length === 1 ? "it" : "them"} and the people there?
              </span>
              <button className="custs-new danger" onClick={() => void remove(chosen)}>
                Delete
              </button>
              <button className="custs-new" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <>
              <span className="custs-picked">
                {chosen.length} selected
              </span>
              <button className="custs-new" onClick={() => void setArchived(chosen, view !== "archived")}>
                <Icon name={view === "archived" ? "open" : "hide"} size={14} />
                {view === "archived" ? "Bring back to the list" : "Archive"}
              </button>
              <button className="custs-new" onClick={() => setConfirming(true)}>
                <Icon name="close" size={14} />
                Delete…
              </button>
              <button className="link" onClick={clear}>
                Clear
              </button>
            </>
          )}
        </header>
      ) : (
        <header className="custs-head">
          <h1>Customers</h1>
          <div className="segmented">
            <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>
              All {live}
            </button>
            <button className={view === "attention" ? "active" : ""} onClick={() => setView("attention")}>
              Needs attention {everyone.filter((c) => !isArchived(c) && needsAttention(schema, c)).length}
            </button>
            <button className={view === "waiting" ? "active" : ""} onClick={() => setView("waiting")}>
              Waiting on us {waiting.length}
            </button>
            {(archived.length > 0 || view === "archived") && (
              <button className={view === "archived" ? "active" : ""} onClick={() => setView("archived")}>
                Archived {archived.length}
              </button>
            )}
          </div>
          {sort && (
            <button className="link" onClick={() => setSort(null)}>
              Back to who needs attention first
            </button>
          )}
          <label className="custs-search">
            <Icon name="search" size={14} />
            <input placeholder="Find a customer" value={query} spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button className="custs-new" onClick={() => void create()}>
            <Icon name="plus" size={14} />
            New customer
          </button>
        </header>
      )}

      {all.length === 0 && view === "archived" ? (
        <div className="custs-empty">
          <p>Nothing is archived</p>
          <span>An archived customer is kept with everything about it, but stays out of the list.</span>
        </div>
      ) : all.length === 0 ? (
        <div className="custs-empty">
          <p>No customers yet</p>
          <span>
            A customer is a note in “{folder || "this vault"}” with the property <code>type: customer</code>. Add one to start.
          </span>
        </div>
      ) : view === "waiting" ? (
        <div className="custs-waiting">
          {waiting.length === 0 && <p className="cust-empty">Nobody is waiting on a reply.</p>}
          {waiting.map(({ customer, thread }) => {
            const last = thread.messages[thread.messages.length - 1];
            return (
              <button key={thread.id + customer.path} className="custs-wait" onClick={() => onOpen(customer.path)}>
                <Logo name={customer.name} icon={show(customer.props.icon)} size={22} />
                <span className="custs-wait-who">
                  <strong>{customer.name}</strong>
                  <small>{[last.from, thread.channel].filter(Boolean).join("  ·  ")}</small>
                </span>
                <span className="custs-wait-said">{last.title}</span>
                <Health value={show(customer.props.health)} />
                <time className={daysSince(thread.at) >= 2 ? "stale" : ""}>{ago(thread.at)}</time>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="custs-scroll">
          <table className="custs-table">
            <thead>
              <tr>
                {FIXED.map((f, i) =>
                  i === 0 ? (
                    <th key={f.key} className="custs-th-first">
                      <input
                        type="checkbox"
                        className="custs-tick"
                        aria-label="Select every customer shown"
                        checked={rows.length > 0 && rows.every((c) => picked.has(c.path))}
                        onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((c) => c.path)) : new Set())}
                      />
                      {head(f.key, f.icon, f.text, false).props.children}
                    </th>
                  ) : (
                    head(f.key, f.icon, f.text, false)
                  ),
                )}
                {columns.map((key) => head(key, KIND_ICON_OF[kind(key)], label(key), true))}
                <th className="custs-add">
                  <button className="custs-th" title="Add a column" aria-expanded={menu === "+"} onClick={() => setMenu(menu === "+" ? null : "+")}>
                    <Icon name="plus" size={14} />
                    <span>Add column</span>
                  </button>
                  {menu === "+" && (
                    <div className="cust-menu left wide">
                      {offered.length > 0 && <small>A detail your customers already have</small>}
                      {offered.map((key) => (
                        <button key={key} onClick={() => addColumn(key)}>
                          <Icon name={KIND_ICON_OF[kind(key)]} size={14} />
                          {label(key)}
                        </button>
                      ))}
                      {offered.length > 0 && <hr />}
                      <small>A new detail</small>
                      <form
                        className="custs-fresh"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const key = fresh.name.trim().toLowerCase().replace(/\s+/g, "_");
                          if (key && !columns.includes(key)) addColumn(key, fresh.kind);
                        }}
                      >
                        <input autoFocus placeholder="Name, like Contract end" value={fresh.name} onChange={(e) => setFresh({ ...fresh, name: e.target.value })} />
                        <select aria-label="Type of the new detail" value={fresh.kind} onChange={(e) => setFresh({ ...fresh, kind: e.target.value as Kind })}>
                          {(Object.keys(KINDS) as Kind[]).map((k) => (
                            <option key={k} value={k}>
                              {KINDS[k]}
                            </option>
                          ))}
                        </select>
                        <button className="primary" disabled={!fresh.name.trim()}>
                          Add column
                        </button>
                      </form>
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.title || "all"}>
                  {group.title && (
                    <tr className="custs-group">
                      <td colSpan={FIXED.length + columns.length + 1}>
                        {group.title} <span>{group.rows.length}</span>
                      </td>
                    </tr>
                  )}
                  {group.rows.map((c) => {
                    const said = why(c);
                    return (
                      <tr key={c.path} className={picked.has(c.path) ? "picked" : ""} onClick={() => onOpen(c.path)}>
                        <td>
                          <span className="custs-name">
                            <input
                              type="checkbox"
                              className="custs-tick"
                              aria-label={`Select ${c.name}`}
                              checked={picked.has(c.path)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => pick(c.path)}
                            />
                            <Logo name={c.name} icon={show(c.props.icon)} size={22} />
                            {c.name}
                          </span>
                        </td>
                        <td>
                          <Health value={show(c.props.health)} />
                        </td>
                        <td className="custs-why">{said.length ? said.join("  ·  ") : <span className="cust-none">{c.items[0]?.title ?? "Nothing yet"}</span>}</td>
                        <td className={daysSince(c.last) >= 14 ? "stale" : "quiet"}>{ago(c.last) || "Never"}</td>
                        {columns.map((key) => {
                          const value = show(c.props[key]);
                          if (editing?.path === c.path && editing.key === key) {
                            return (
                              <td key={key} onClick={(e) => e.stopPropagation()}>
                                <input
                                  className="cust-input"
                                  autoFocus
                                  aria-label={label(key)}
                                  defaultValue={value}
                                  onBlur={(e) => {
                                    setEditing(null);
                                    if (e.target.value.trim() !== value) void write(c.path, key, e.target.value);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                />
                              </td>
                            );
                          }
                          return (
                            <td
                              key={key}
                              className={`edit${numeric(key) ? " num" : ""}`}
                              title={`Change ${label(key)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing({ path: c.path, key });
                              }}
                            >
                              <Value kind={kind(key)} value={value} />
                            </td>
                          );
                        })}
                        <td className="custs-actions" onClick={(e) => e.stopPropagation()}>
                          <span className="cust-menu-at">
                            <button className="cust-more" title="Archive or delete" aria-expanded={menu === c.path} onClick={() => setMenu(menu === c.path ? null : c.path)}>
                              <Icon name="more" size={14} />
                            </button>
                            {menu === c.path && (
                              <div className="cust-menu">
                                <button onClick={() => void setArchived([c], !isArchived(c))}>
                                  <Icon name={isArchived(c) ? "open" : "hide"} size={14} />
                                  {isArchived(c) ? "Bring back to the list" : "Archive"}
                                </button>
                                <button
                                  onClick={() => {
                                    setPicked(new Set([c.path]));
                                    setConfirming(true);
                                    setMenu(null);
                                  }}
                                >
                                  <Icon name="close" size={14} />
                                  Delete…
                                </button>
                              </div>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={FIXED.length}>
                  {rows.length} {rows.length === 1 ? "customer" : "customers"}
                </td>
                {columns.map((key) => (
                  <td key={key} className="num">
                    {kind(key) === "money" && `$${total(key).toLocaleString()}`}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {all.length > 0 && view !== "waiting" && rows.length === 0 && <p className="cust-empty pad">No customer matches.</p>}
    </div>
  );
}

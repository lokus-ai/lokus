/** @part-of ui.tasks */
import { useEffect, useState } from "react";

import { accessToken } from "../../bridge/auth";
import { relay } from "../../bridge/sync";
import { Icon, type IconName } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { app } from "../../shell/workspace";
import { Field } from "../customers/parts";
import { Face } from "../profile/Profile";
import { fromEmail, useProfiles } from "../profile/profiles";
import { dueText, loadAssignees, PRIORITIES, STATUSES, statusName } from "./data";
import { Priority } from "./TasksBoard";

interface Props {
  properties: Record<string, string>;
  onProperty(key: string, value: string | null): void;
  onOpen(path: string): void;
}

const cap = (word: string) => word.replace(/^./, (c) => c.toUpperCase());

function Row({ icon, name, children }: { icon: IconName; name: string; children: React.ReactNode }) {
  return (
    <div className="cust-detail">
      <span className="cust-detail-name">
        <Icon name={icon} size={14} />
        {name}
      </span>
      {children}
    </div>
  );
}

/** Whose the task is: shown as a person, chosen from the people the team already works with. */
function Assignee({ value, onChange }: { value: string; onChange(next: string | null): void }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const me = useStore(app, (s) => s.account?.email ?? null);
  const sync = useStore(app, (s) => s.sync);
  const profiles = useProfiles();
  useEffect(() => {
    if (!open) return;
    // Someone is offered by the name they chose in their profile, else one made from their email.
    const named = (email: string) => profiles[email.toLowerCase()]?.name ?? fromEmail(email);
    void (async () => {
      const known = await loadAssignees(me ? named(me) : null);
      // Everyone in the workspace can be given a task, whether or not they have had one before.
      let team: string[] = [];
      if (sync.server && sync.workspace) {
        const token = await accessToken().catch(() => null);
        if (token) {
          team = await relay<{ email: string | null }[]>(sync.server, token, "GET", `/v1/workspaces/${sync.workspace}/members`).then(
            (members) => members.flatMap((m) => (m.email ? [named(m.email)] : [])),
            () => [],
          );
        }
      }
      const chosen = Object.values(profiles).map((p) => p.name);
      setPeople([...new Set([...chosen, ...team, ...known])].sort((a, b) => a.localeCompare(b)));
    })();
  }, [open, me, sync.server, sync.workspace, profiles]);
  const pick = (name: string | null) => {
    onChange(name);
    setOpen(false);
    setTyped("");
  };
  const q = typed.trim().toLowerCase();
  const shown = people.filter((p) => !q || p.toLowerCase().includes(q));
  return (
    <span className="cust-menu-at task-pick">
      <button className="cust-value" title="Change who this is assigned to" onClick={() => setOpen((o) => !o)}>
        {value ? <Face name={value} /> : <span className="cust-none">Nobody yet</span>}
      </button>
      {open && (
        <>
          <div className="cust-shade" onClick={() => setOpen(false)} />
          <div className="cust-menu left">
            <input
              className="cust-input"
              autoFocus
              placeholder="Find or type a name"
              aria-label="Assign to"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typed.trim()) pick(shown[0] ?? typed.trim());
                if (e.key === "Escape") setOpen(false);
              }}
            />
            {shown.map((name) => (
              <button key={name} onClick={() => pick(name)}>
                <Face name={name} />
                {name === value && <Icon name="check" size={13} />}
              </button>
            ))}
            {q && !shown.some((p) => p.toLowerCase() === q) && (
              <button onClick={() => pick(typed.trim())}>
                <Icon name="plus" size={14} />
                Assign to “{typed.trim()}”
              </button>
            )}
            {value && (
              <>
                <hr />
                <button onClick={() => pick(null)}>
                  <Icon name="close" size={14} />
                  Nobody
                </button>
              </>
            )}
          </div>
        </>
      )}
    </span>
  );
}

/** When the task is due: a real date, picked from a calendar. */
function Due({ value, late, onChange }: { value: string; late: boolean; onChange(next: string | null): void }) {
  const shown = dueText(value);
  const days = shown ? Math.ceil((new Date(`${value}T00:00:00`).getTime() - Date.now()) / 86_400_000) : null;
  return (
    <span className="task-date">
      <label className={`cust-value${late ? " late" : ""}`} title="Change the due date">
        {shown ? (
          <>
            {new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            {days !== null && <em>{days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 ? `in ${days} days` : `${-days} ${days === -1 ? "day" : "days"} ago`}</em>}
          </>
        ) : (
          <span className="cust-none">No date</span>
        )}
        <input type="date" aria-label="Due date" value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""} onChange={(e) => onChange(e.target.value || null)} />
      </label>
      {value && (
        <button className="cust-more shown" title="Remove the due date" onClick={() => onChange(null)}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}

/**
 * What sits between a task's title and its text: where it stands, how much it matters, whose it
 * is, who it is for and when it is due. Each is a property of the note, changed in place.
 */
export default function TaskProfile({ properties, onProperty, onOpen }: Props) {
  const status = (properties.status ?? "").toLowerCase();
  const priority = (properties.priority ?? "").toLowerCase();
  const statuses = STATUSES.includes(status) || !status ? STATUSES : [status, ...STATUSES];
  const due = dueText(properties.due ?? "");
  const set = (key: string) => (next: string) => onProperty(key, next.trim() || null);
  return (
    <div className="cust">
      <div className="cust-props">
        <Row icon="activity" name="Status">
          <label className="cust-pick">
            <span className="cust-health">
              <span className={`task-dot ${status}`} />
              {statusName(status)}
            </span>
            <Icon name="down" size={12} />
            <select aria-label="Status" value={status} onChange={(e) => onProperty("status", e.target.value || null)}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusName(s)}
                </option>
              ))}
            </select>
          </label>
        </Row>
        <Row icon="sliders" name="Priority">
          <label className="cust-pick">
            <span className="cust-health">
              <Priority level={priority} />
              {priority ? cap(priority) : <span className="cust-none">Not set</span>}
            </span>
            <Icon name="down" size={12} />
            <select aria-label="Priority" value={priority} onChange={(e) => onProperty("priority", e.target.value || null)}>
              <option value="">Not set</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {cap(p)}
                </option>
              ))}
            </select>
          </label>
        </Row>
        <Row icon="person" name="Assignee">
          <Assignee value={properties.assignee ?? ""} onChange={(next) => onProperty("assignee", next)} />
        </Row>
        <Row icon="customers" name="Customer">
          {properties.customer ? (
            <button className="cust-value" title="Open this customer" onClick={() => onOpen(`customers/${properties.customer}.md`)}>
              <span className="cust-chip">{properties.customer}</span>
            </button>
          ) : (
            <Field label="customer" value="" onChange={set("customer")} />
          )}
        </Row>
        <Row icon="calendar" name="Due">
          <Due value={properties.due ?? ""} late={Boolean(due?.late) && status !== "done"} onChange={(next) => onProperty("due", next)} />
        </Row>
        {properties.labels && (
          <Row icon="tag" name="Labels">
            <span className="task-facts">
              {properties.labels
                .replace(/^\[|\]$/g, "")
                .split(",")
                .map((l) => l.trim().replace(/^"|"$/g, ""))
                .filter(Boolean)
                .map((label) => (
                  <span key={label} className={`task-chip label${label.includes("churn") ? " risk" : ""}`}>
                    {label}
                  </span>
                ))}
            </span>
          </Row>
        )}
      </div>
      <h3 className="cust-notes">Notes</h3>
    </div>
  );
}

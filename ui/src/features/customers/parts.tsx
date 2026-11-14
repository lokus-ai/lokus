/** @part-of ui.customers */
import { useEffect, useState } from "react";

import { Icon, type IconName } from "../../shell/Icon";
import { resolveImage } from "../../shell/workspace";
import { isPicture } from "../page-header/PageHeader";
import { ago, HEALTH, type Item, type Kind, KINDS, parseDay, readBody, tone } from "./data";

const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A square with the customer's picture, or its first letter when it has none. */
export function Logo({ name, icon, size = 20 }: { name: string; icon?: string; size?: number }) {
  const picture = isPicture(icon) ? resolveImage(icon) : null;
  if (picture) return <img className="cust-logo" src={picture} alt="" style={{ width: size, height: size }} />;
  return (
    <span className="cust-logo" style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}>
      {(icon && !isPicture(icon) ? icon : "") || name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A short value as a label: a plan, a region. */
export function Chip({ value }: { value: string }) {
  return value ? (
    <span className="cust-chip">
      {value}
    </span>
  ) : null;
}

/** A person as a small round face (their picture, or their initial) and their name. */
export function Person({ name, icon }: { name: string; icon?: string }) {
  const picture = isPicture(icon) ? resolveImage(icon) : null;
  return name ? (
    <span className="cust-person">
      {picture ? <img src={picture} alt="" /> : <i>{name.slice(0, 1).toUpperCase()}</i>}
      {name}
    </span>
  ) : null;
}

/** A customer's health as a coloured dot and its word. */
export function Health({ value }: { value: string }) {
  if (!value) return <span className="cust-none">Not set</span>;
  return (
    <span className={`cust-health ${tone(value)}`}>
      <i />
      {cap(value)}
    </span>
  );
}

/** The health word, changed by picking from a short list. */
export function HealthPicker({ value, onChange }: { value: string; onChange(next: string | null): void }) {
  const options = HEALTH.includes(value) || !value ? HEALTH : [value, ...HEALTH];
  return (
    <label className={`cust-pick ${tone(value)}`}>
      <Health value={value} />
      <Icon name="down" size={12} />
      <select aria-label="Health" value={value} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {cap(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A value that turns into a text box when clicked. `children` is how it looks when not being edited. */
export function Field({ label, value, onChange, children }: { label: string; value: string; onChange(next: string): void; children?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        className="cust-input"
        aria-label={label}
        autoFocus
        defaultValue={value}
        onBlur={(e) => {
          setEditing(false);
          if (e.target.value.trim() !== value) onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button className="cust-value" title={`Change ${label}`} onClick={() => setEditing(true)}>
      {value ? (children ?? value) : <span className="cust-none">Set a value</span>}
    </button>
  );
}

const KIND_ICON: Record<string, IconName> = { issue: "issue", message: "message", event: "event" };

/**
 * One thing that happened: a line saying what, where from, who and when. Clicking it opens the
 * rest underneath, in place, since the note behind it holds little more than this.
 */
export function ItemRow({ item, onOpen }: { item: Item; onOpen(path: string): void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void readBody(item.path)
      .then((text) => current && setBody(text))
      .catch(() => current && setBody(""));
    return () => {
      current = false;
    };
  }, [open, item.path]);

  return (
    <div className="cust-thread">
      <button className="cust-item" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`cust-item-kind ${item.kind}`}>
          <Icon name={KIND_ICON[item.kind] ?? "event"} size={13} />
        </span>
        <span className="cust-item-title">{item.title}</span>
        {item.status && <span className="cust-status">{cap(item.status)}</span>}
        {item.from && <span className="cust-item-from">{item.from}</span>}
        {item.source && <span className="cust-item-source">{cap(item.source)}</span>}
        <time>{ago(item.at)}</time>
      </button>
      {open && (
        <div className="cust-talk">
          <div className="cust-line">
            <p>{body === null ? "" : body && body !== item.title ? body : "There is nothing more recorded about this."}</p>
            <span className="cust-line-who">
              <time>
                {[item.source && `From ${cap(item.source)}`, item.at ? new Date(item.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""].filter(Boolean).join("  ·  ")}
              </time>
              <button className="link" onClick={() => onOpen(item.path)}>
                Open as a note
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const KIND_ICON_OF: Record<Kind, IconName> = { text: "type", number: "hash", money: "money", date: "calendar", person: "person", choice: "tag", link: "globe" };

/** A detail shown the way its type reads: money with its sign, a date in words with how far off it is. */
export function Value({ kind, value }: { kind: Kind; value: string }) {
  if (!value) return null;
  if (kind === "date") {
    const at = parseDay(value);
    if (Number.isNaN(at)) return <>{value}</>;
    const days = Math.ceil((at - Date.now()) / 86_400_000);
    return (
      <span className="cust-date">
        {new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        {days > 0 && days < 120 && <em className={days <= 45 ? "soon" : ""}>in {days}d</em>}
      </span>
    );
  }
  if (kind === "money" || kind === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return <>{value}</>;
    return <>{kind === "money" ? `$${n.toLocaleString()}` : n.toLocaleString()}</>;
  }
  if (kind === "person") return <Person name={value} />;
  if (kind === "choice") return <Chip value={value} />;
  if (kind === "link") return <Chip value={value} />;
  return <>{value}</>;
}

/** What a detail is, whether it shows, and how it has changed: opened from the detail's own row. */
export function FieldMenu({ kind, history, onKind, onHide, onOpen }: { kind: Kind; history: Item[]; onKind(kind: Kind): void; onHide(): void; onOpen(path: string): void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="cust-menu-at">
      <button className="cust-more" title="Type, history and hiding" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="more" size={14} />
      </button>
      {open && (
        <>
          <div className="cust-shade" onClick={() => setOpen(false)} />
          <div className="cust-menu">
            <small>Show as</small>
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <button
                key={k}
                className={k === kind ? "on" : ""}
                onClick={() => {
                  onKind(k);
                  setOpen(false);
                }}
              >
                <Icon name={KIND_ICON_OF[k]} size={14} />
                {KINDS[k]}
                {k === kind && <Icon name="check" size={13} />}
              </button>
            ))}
            <hr />
            <small>History</small>
            {history.length === 0 && <p>No changes recorded yet.</p>}
            {history.slice(0, 5).map((item) => (
              <button key={item.path} className="past" onClick={() => onOpen(item.path)}>
                <span>{item.title}</span>
                <time>{ago(item.at)}</time>
              </button>
            ))}
            <hr />
            <button
              onClick={() => {
                onHide();
                setOpen(false);
              }}
            >
              <Icon name="hide" size={14} />
              Hide this detail
            </button>
          </div>
        </>
      )}
    </span>
  );
}

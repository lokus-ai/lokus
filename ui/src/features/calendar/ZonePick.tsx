/** @part-of ui.calendar */
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../shell/Icon";
import { localZone, offsetName, ZONES } from "./time";

interface Props {
  value: string;
  label: string;
  title: string;
  /** The instant the offsets are named for: a zone's offset changes through the year. */
  at?: number;
  outlined?: boolean;
  onChange: (zone: string) => void;
}

const KEY = "lokus.calendar.zones";
const recent = (): string[] => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).filter((z) => ZONES.includes(z));
  } catch {
    return [];
  }
};
const name = (zone: string) => zone.replace(/_/g, " ");

/** The time zone: a button that opens a list to type in, with the chosen zone, this computer's and the last few used on top. */
export function ZonePick({ value, label, title, at, outlined, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [on, setOn] = useState(0);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const first = [...new Set([value, localZone, ...recent()])].slice(0, 6);
  const found = words.length ? ZONES.filter((z) => words.every((w) => `${name(z)} ${offsetName(z, at)}`.toLowerCase().includes(w))) : [];
  const list = words.length ? found.slice(0, 60) : [...first, ...ZONES.filter((z) => !first.includes(z))];
  const pick = (zone: string) => {
    localStorage.setItem(KEY, JSON.stringify([zone, ...recent().filter((z) => z !== zone)].slice(0, 4)));
    setOpen(false);
    onChange(zone);
  };

  return (
    <span className="cal-zone" ref={box}>
      <button type="button" className={`cal-pick${outlined ? " outlined" : ""}`} title={title} aria-label={`${title}: ${label}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => (setText(""), setOn(0), setOpen(!open))}>
        <span>{label}</span>
        {outlined && <Icon name="down" size={12} />}
      </button>
      {open && (
        <div className="cal-zone-list">
          <input
            autoFocus
            value={text}
            placeholder="Search a city or GMT+1"
            aria-label="Search time zones"
            onChange={(e) => (setText(e.target.value), setOn(0))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") (e.preventDefault(), setOn(Math.min(list.length - 1, on + 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setOn(Math.max(0, on - 1)));
              else if (e.key === "Enter" && list[on]) pick(list[on]);
            }}
          />
          <div role="listbox" aria-label="Time zones">
            {list.length === 0 && <small>No time zone matches.</small>}
            {list.map((z, i) => (
              <button key={z} role="option" aria-selected={z === value} className={i === on ? "on" : ""} ref={i === on ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined} title={name(z)} onPointerMove={() => on !== i && setOn(i)} onClick={() => pick(z)}>
                <span>{name(z)}</span>
                <small>{z === value ? "Chosen · " : !words.length && z === localZone ? "Here · " : ""}{offsetName(z, at)}</small>
                {!words.length && i === first.length - 1 && <hr />}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

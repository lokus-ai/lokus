/** @part-of ui.calendar */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import type { CalEvent } from "../../bridge/calendar";
import { addDays, addMinutes, clock, DAY, dateOf, dayLabel, dayStart, MINUTE, place, stamp, weekday } from "./time";

const HOUR = 60;
const PX = HOUR / 60;
const SNAP = 15;
const GUTTER = 56;

export interface Overlay {
  label: string;
  color: string;
  times: [string, string][];
}

interface Props {
  days: number[];
  zone: string;
  events: CalEvent[];
  selected: string | null;
  overlays: Overlay[];
  /** The zone the week is shown in, in short ("GMT-8"): it heads the hours. */
  zoneLabel: string;
  colorOf: (event: CalEvent) => string;
  onSelect: (key: string) => void;
  /** An empty stretch was dragged out, or something was dropped on it: start a new event there. */
  onNew: (start: string, end: string, guest?: string) => void;
  onMove: (event: CalEvent, start: string, end: string) => void;
}

interface Drag {
  kind: "new" | "move" | "resize";
  event?: CalEvent;
  /** Where the pointer went down, and where it is: a day and a minute of that day. */
  from: { day: number; minute: number };
  to: { day: number; minute: number };
  moved: boolean;
}

/** The week: one column a day, an hour every 48 pixels, events where they fall. */
/** A person's initials, from a name or the start of an email. */
const initials = (label: string) =>
  label
    .split("@")[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export function Grid({ days, zone, events, selected, overlays, zoneLabel, colorOf, onSelect, onNew, onMove }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const hours = useRef<HTMLDivElement>(null);
  /** A day's width in pixels: how many events fit side by side depends on it. */
  const [dayWidth, setDayWidth] = useState(160);
  useEffect(() => {
    const el = hours.current;
    if (!el) return;
    const watch = new ResizeObserver(() => setDayWidth((el.clientWidth - GUTTER) / days.length));
    watch.observe(el);
    return () => watch.disconnect();
  }, [days.length]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [now, setNow] = useState(Date.now());
  /** The "+N more" that is open: its day, where it hangs, and the events behind it. */
  const [more, setMore] = useState<{ day: number; top: number } | null>(null);
  useEffect(() => {
    if (!more) return;
    const close = (e: Event) => (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest(".cal-more-list, .cal-more")) && setMore(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => (window.removeEventListener("pointerdown", close), window.removeEventListener("keydown", close));
  }, [more]);

  useLayoutEffect(() => {
    // The day opens at 08:00, with room above the line for its own label.
    if (scroll.current) scroll.current.scrollTop = 8 * HOUR - 10;
  }, []);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), MINUTE);
    return () => window.clearInterval(tick);
  }, []);

  const at = (e: { clientX: number; clientY: number }) => {
    const box = hours.current!.getBoundingClientRect();
    const width = (box.width - GUTTER) / days.length;
    const day = Math.min(days.length - 1, Math.max(0, Math.floor((e.clientX - box.left - GUTTER) / width)));
    const minute = Math.min(24 * 60, Math.max(0, (e.clientY - box.top) / PX));
    return { day, minute: Math.round(minute / SNAP) * SNAP };
  };
  /** A minute of a shown day as an instant: by the wall clock, so it is right across a clock change. */
  const when = (day: number, minute: number) => addMinutes(days[day], minute, zone);

  // The drag as it is this instant: a press and release can arrive before the next draw.
  const held = useRef<Drag | null>(null);
  const begin = (kind: Drag["kind"], e: PointerEvent, event?: CalEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const from = at(e);
    held.current = { kind, event, from, to: from, moved: false };
    setDrag(held.current);
    // A pointer that is not really down (a scripted one) cannot be captured; the drag still works inside the column.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* nothing to capture */
    }
  };
  const move = (e: PointerEvent) => {
    const drag = held.current;
    if (!drag) return;
    const to = at(e);
    if (to.day !== drag.to.day || to.minute !== drag.to.minute) setDrag((held.current = { ...drag, to, moved: true }));
  };
  /** What a drag would make of its event: start and end as instants. */
  const outcome = (d: Drag): [number, number] => {
    if (d.kind === "new") {
      const [a, b] = d.from.minute <= d.to.minute ? [d.from.minute, d.to.minute] : [d.to.minute, d.from.minute];
      return [when(d.from.day, a), when(d.from.day, b > a ? b : a + 30)];
    }
    const start = Date.parse(d.event!.start);
    const end = Date.parse(d.event!.end);
    if (d.kind === "resize") return [start, Math.max(start + SNAP * MINUTE, when(d.to.day, d.to.minute))];
    const shifted = addDays(start, d.to.day - d.from.day, zone) + (d.to.minute - d.from.minute) * MINUTE;
    return [shifted, shifted + (end - start)];
  };
  const finish = () => {
    const drag = held.current;
    if (!drag) return;
    held.current = null;
    setDrag(null);
    const [start, end] = outcome(drag);
    if (drag.kind === "new") return onNew(stamp(start), stamp(end));
    if (!drag.moved) return onSelect(drag.event!.key);
    if (start !== Date.parse(drag.event!.start) || end !== Date.parse(drag.event!.end)) onMove(drag.event!, stamp(start), stamp(end));
  };

  /** Arrow keys move between events: up and down through a day, left and right to the nearest in the next day with any. */
  const walk = (e: KeyboardEvent<HTMLElement>, key: string) => {
    const here = e.currentTarget;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return onSelect(key);
    }
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    e.stopPropagation();
    const inColumn = (column: Element | null) => [...(column?.querySelectorAll<HTMLElement>(".cal-event[tabindex]") ?? [])];
    let to: HTMLElement | undefined;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const all = inColumn(here.parentElement);
      to = all[all.indexOf(here) + (e.key === "ArrowDown" ? 1 : -1)];
    } else {
      let column = here.parentElement;
      while (!to && column) {
        column = (e.key === "ArrowRight" ? column.nextElementSibling : column.previousElementSibling) as HTMLElement | null;
        to = inColumn(column).sort((a, b) => Math.abs(a.offsetTop - here.offsetTop) - Math.abs(b.offsetTop - here.offsetTop))[0];
      }
    }
    to?.focus();
  };
  /** What a screen reader says for an event: its title, day, time and state. */
  const spoken = (e: CalEvent) =>
    [
      e.title || "No title",
      new Date(e.start).toLocaleDateString([], { timeZone: zone, weekday: "long", month: "long", day: "numeric" }),
      e.all_day ? "all day" : `${clock(e.start, zone)} to ${clock(e.end, zone)}`,
      e.guests.length ? `${e.guests.length} ${e.guests.length === 1 ? "guest" : "guests"}` : "",
      e.unsent ? "invitation not sent" : e.pending ? "changes not sent" : e.queued ? "waiting to be sent" : "",
      e.reply === "needsAction" ? "not answered" : e.reply === "declined" ? "declined" : "",
    ]
      .filter(Boolean)
      .join(", ");

  const drop = (e: DragEvent) => {
    const guest = e.dataTransfer.getData("text/lokus-guest");
    if (!guest) return;
    e.preventDefault();
    const { day, minute } = at(e);
    const start = when(day, minute);
    onNew(stamp(start), stamp(start + 30 * MINUTE), guest);
  };

  // While something is dragged it is drawn where it would land.
  const ghost = drag && (drag.kind === "new" || drag.moved) ? outcome(drag) : null;
  const shown = ghost && drag?.event ? events.map((e) => (e.key === drag.event!.key ? { ...e, start: stamp(ghost[0]), end: stamp(ghost[1]) } : e)) : events;
  const today = dayStart(now, zone);
  const allDay = shown.filter((e) => e.all_day);

  const laid = days.map((day, i) => place(shown, day, days[i + 1] ?? addDays(day, 1, zone), dayWidth));
  const weekend = (day: number) => [0, 6].includes(weekday(day + DAY / 2, zone));
  const hourName = (h: number) => new Date(Date.UTC(2026, 0, 5, h)).toLocaleTimeString([], { timeZone: "UTC", hour: "numeric" });

  return (
    <div className="cal-grid" role="group" aria-label="Events. Arrow keys move between them, Enter opens one." style={{ "--days": days.length } as CSSProperties}>
      <div className="cal-scroll" ref={scroll} onDragOver={(e) => e.dataTransfer.types.includes("text/lokus-guest") && e.preventDefault()} onDrop={drop}>
        <div className="cal-top">
          <div className="cal-head">
            <div className="cal-gutter" title="The time zone the week is shown in">
              {zoneLabel}
            </div>
            {days.map((day) => {
              const label = dayLabel(day + DAY / 2, zone);
              return (
                <div key={day} className={`cal-day-name${day === today ? " today" : ""}${weekend(day) ? " weekend" : ""}`}>
                  <span>{label.name}</span>
                  <b>{label.number}</b>
                </div>
              );
            })}
          </div>
          {allDay.length > 0 && (
            <div className="cal-allday">
              <div className="cal-gutter">All-day</div>
              {days.map((day) => (
                <div key={day} className={`cal-allday-cell${weekend(day) ? " weekend" : ""}`}>
                  {allDay
                    .filter((e) => e.start.slice(0, 10) <= dateOf(day, zone) && e.end.slice(0, 10) > dateOf(day, zone))
                    .map((e) => (
                      <button key={e.key} className={`cal-chip${e.key === selected ? " selected" : ""}`} style={{ "--c": colorOf(e) } as CSSProperties} title={e.title} aria-label={spoken(e)} aria-pressed={e.key === selected} onClick={() => onSelect(e.key)}>
                        {e.title || "(No title)"}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="cal-hours" ref={hours} style={{ height: 24 * HOUR }}>
          <div className="cal-gutter">
            {Array.from({ length: 23 }, (_, h) => (
              <span key={h} style={{ top: (h + 1) * HOUR }}>
                {hourName(h + 1)}
              </span>
            ))}
          </div>
          {days.map((day, i) => {
            const next = days[i + 1] ?? addDays(day, 1, zone);
            return (
              <div key={day} className={`cal-column${weekend(day) ? " weekend" : ""}`} onPointerDown={(e) => begin("new", e)} onPointerMove={move} onPointerUp={finish}>
                {overlays.map((o) =>
                  o.times
                    .filter(([s, e]) => Date.parse(s) < next && Date.parse(e) > day)
                    .map(([s, e]) => {
                      const top = Math.max(0, (Date.parse(s) - day) / MINUTE);
                      const bottom = Math.min(24 * 60, (Date.parse(e) - day) / MINUTE);
                      return (
                        <div key={`${o.label}${s}`} className="cal-busy" role="img" aria-label={`${o.label} is busy ${clock(s, zone)} to ${clock(e, zone)}`} style={{ top: top * PX, height: (bottom - top) * PX - 2, "--c": o.color } as CSSProperties}>
                          <i>{initials(o.label)}</i>
                        </div>
                      );
                    }),
                )}
                {laid[i].placed.map((p) => {
                  const e = p.event;
                  const tall = p.height * PX - 2;
                  // A line of the title is 15 pixels: under two lines it is the title alone on one, then the time when there is room.
                  // Only the part no later event lies over is written on; a narrow one keeps its title to one line.
                  const wide = (p.right - p.left) * dayWidth - (p.right === 1 ? 8 : 2);
                  const face = Math.max(14, Math.min(tall, p.clear * PX - 1));
                  const room = Math.floor((face - 5) / 15);
                  const short = face < 34;
                  const lines = short ? 1 : Math.max(1, wide < 96 ? Math.min(2, room) : room);
                  const dragged = drag?.event?.key === e.key && drag.moved;
                  const words = (
                    <>
                      <b style={!short && lines >= 2 ? { WebkitLineClamp: wide < 96 ? 1 : lines - 1 } : undefined}>{e.title || "(No title)"}</b>
                      <span>
                        <i>{clock(e.start, zone)}</i>
                        <i>{e.pending || e.unsent ? " · not sent" : e.queued ? " · waiting" : ` – ${clock(e.end, zone)}`}</i>
                      </span>
                    </>
                  );
                  return (
                    <div
                      key={e.key}
                      className={`cal-event${e.key === selected ? " selected" : ""}${e.reply === "needsAction" ? " unanswered" : ""}${e.reply === "declined" ? " declined" : ""}${e.pending || e.unsent ? " pending" : ""}${short ? " short" : lines < 2 ? " one" : ""}${tall < 18 ? " tiny" : ""}${wide < 96 ? " lane" : ""}${dragged ? " dragged" : ""}`}
                      style={{ top: p.top * PX, height: tall, left: `calc(${p.left * 100}% + 1px)`, width: `calc(${(p.right - p.left) * 100}% - ${p.right === 1 ? 9 : 2}px)`, zIndex: p.depth + 1, "--c": colorOf(e), "--h": `${face}px` } as CSSProperties}
                      title={`${e.title || "(No title)"}\n${clock(e.start, zone)} – ${clock(e.end, zone)}`}
                      role="button"
                      tabIndex={0}
                      aria-label={spoken(e)}
                      aria-pressed={e.key === selected}
                      onKeyDown={(ev) => walk(ev, e.key)}
                      onPointerDown={(ev) => (e.mine ? begin("move", ev, e) : (ev.stopPropagation(), onSelect(e.key)))}
                      onPointerMove={move}
                      onPointerUp={finish}
                    >
                      {short ? <div className="cal-line">{words}</div> : words}
                      {e.mine && <u className="cal-resize" onPointerDown={(ev) => begin("resize", ev, e)} onPointerMove={move} onPointerUp={finish} />}
                    </div>
                  );
                })}
                {laid[i].more.map((m) => (
                  <button
                    key={`more${m.top}`}
                    className="cal-more"
                    style={{ top: m.top * PX, left: `calc(${m.left * 100}% + 1px)`, width: `calc(${(m.right - m.left) * 100}% - 9px)`, zIndex: m.depth + 1 }}
                    title={`${m.events.length} more at ${clock(m.events[0].start, zone)}: ${m.events.map((e) => e.title || "(No title)").join(", ")}`}
                    aria-label={`${m.events.length} more events at ${clock(m.events[0].start, zone)}`}
                    aria-haspopup="menu"
                    aria-expanded={more?.day === day && more.top === m.top}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={() => setMore(more?.day === day && more.top === m.top ? null : { day, top: m.top })}
                  >
                    +{m.events.length}
                    {(m.right - m.left) * dayWidth >= 56 ? " more" : ""}
                  </button>
                ))}
                {more?.day === day && laid[i].more.some((m) => m.top === more.top) && (
                  <div className={`cal-more-list${i >= days.length - 1 && days.length > 1 ? " left" : ""}`} role="menu" style={{ top: more.top * PX + 20 }} onPointerDown={(ev) => ev.stopPropagation()}>
                    {laid[i].more.find((m) => m.top === more.top)!.events.map((e) => (
                      <button key={e.key} role="menuitem" style={{ "--c": colorOf(e) } as CSSProperties} title={e.title} onClick={() => (setMore(null), onSelect(e.key))}>
                        <i />
                        <b>{e.title || "(No title)"}</b>
                        <small>{clock(e.start, zone)}</small>
                      </button>
                    ))}
                  </div>
                )}
                {ghost && drag?.kind === "new" && drag.from.day === i && <div className="cal-event ghost" style={{ top: ((ghost[0] - day) / MINUTE) * PX, height: ((ghost[1] - ghost[0]) / MINUTE) * PX - 1, left: 1, width: "calc(100% - 8px)" }} />}
                {ghost && ghost[0] >= day && ghost[0] < next && (
                  <div className="cal-tip" style={{ top: Math.max(0, ((ghost[0] - day) / MINUTE) * PX - 24) }}>
                    {clock(ghost[0], zone)} – {clock(ghost[1], zone)}
                  </div>
                )}
                {day === today && <div className="cal-now" style={{ top: Math.round(((now - day) / MINUTE) * PX) }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

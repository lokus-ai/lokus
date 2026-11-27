/** @part-of ui.calendar */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";
import type { CalEvent } from "../../bridge/calendar";
import { addDays, addMinutes, clock, DAY, dateOf, dayLabel, dayStart, MINUTE, place, stamp } from "./time";

const HOUR = 48;
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
export function Grid({ days, zone, events, selected, overlays, colorOf, onSelect, onNew, onMove }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [now, setNow] = useState(Date.now());

  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 7.5 * HOUR;
  }, []);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), MINUTE);
    return () => window.clearInterval(tick);
  }, []);

  const at = (e: { clientX: number; clientY: number }) => {
    const box = scroll.current!.getBoundingClientRect();
    const width = (box.width - GUTTER) / days.length;
    const day = Math.min(days.length - 1, Math.max(0, Math.floor((e.clientX - box.left - GUTTER) / width)));
    const minute = Math.min(24 * 60, Math.max(0, (e.clientY - box.top + scroll.current!.scrollTop) / PX));
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

  return (
    <div className="cal-grid" style={{ "--days": days.length } as CSSProperties}>
      <div className="cal-head">
        <div className="cal-gutter" />
        {days.map((day) => {
          const label = dayLabel(day + DAY / 2, zone);
          return (
            <div key={day} className={`cal-day-name${day === today ? " today" : ""}`}>
              {label.name} <b>{label.number}</b>
            </div>
          );
        })}
      </div>
      {allDay.length > 0 && (
        <div className="cal-allday">
          <div className="cal-gutter">all-day</div>
          {days.map((day) => (
            <div key={day} className="cal-allday-cell">
              {allDay
                .filter((e) => e.start.slice(0, 10) <= dateOf(day, zone) && e.end.slice(0, 10) > dateOf(day, zone))
                .map((e) => (
                  <button key={e.key} className={`cal-chip${e.key === selected ? " selected" : ""}`} style={{ "--c": colorOf(e) } as CSSProperties} onClick={() => onSelect(e.key)}>
                    {e.title || "(No title)"}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="cal-scroll" ref={scroll} onDragOver={(e) => e.dataTransfer.types.includes("text/lokus-guest") && e.preventDefault()} onDrop={drop}>
        <div className="cal-hours" style={{ height: 24 * HOUR }}>
          <div className="cal-gutter">
            {Array.from({ length: 23 }, (_, h) => (
              <span key={h} style={{ top: (h + 1) * HOUR }}>
                {new Date(Date.UTC(2026, 0, 5, h + 1)).toLocaleTimeString([], { timeZone: "UTC", hour: "numeric" })}
              </span>
            ))}
          </div>
          {days.map((day, i) => {
            const next = days[i + 1] ?? addDays(day, 1, zone);
            return (
              <div key={day} className="cal-column" onPointerDown={(e) => begin("new", e)} onPointerMove={move} onPointerUp={finish}>
                {overlays.map((o) =>
                  o.times
                    .filter(([s, e]) => Date.parse(s) < next && Date.parse(e) > day)
                    .map(([s, e]) => {
                      const top = Math.max(0, (Date.parse(s) - day) / MINUTE);
                      const bottom = Math.min(24 * 60, (Date.parse(e) - day) / MINUTE);
                      return <div key={`${o.label}${s}`} className="cal-busy" title={`${o.label} is busy`} style={{ top: top * PX, height: (bottom - top) * PX, "--c": o.color } as CSSProperties} />;
                    }),
                )}
                {place(shown, day, next).map((p) => {
                  const e = p.event;
                  const away = e.reply === "declined";
                  return (
                    <div
                      key={e.key}
                      className={`cal-event${e.key === selected ? " selected" : ""}${e.reply === "needsAction" ? " unanswered" : ""}${away ? " declined" : ""}${e.pending ? " pending" : ""}${p.height < 34 ? " short" : ""}`}
                      style={{ top: p.top * PX, height: p.height * PX - 2, left: `calc(${(p.column / p.columns) * 100}% + 1px)`, width: `calc(${100 / p.columns}% - 6px)`, "--c": colorOf(e) } as CSSProperties}
                      title={e.title}
                      onPointerDown={(ev) => (e.mine ? begin("move", ev, e) : (ev.stopPropagation(), onSelect(e.key)))}
                      onPointerMove={move}
                      onPointerUp={finish}
                    >
                      <b>{e.title || "(No title)"}</b>
                      <span>
                        {clock(e.start, zone)}
                        {e.pending ? " · not sent" : e.queued ? " · waiting" : ""}
                      </span>
                      {e.mine && <i className="cal-resize" onPointerDown={(ev) => begin("resize", ev, e)} onPointerMove={move} onPointerUp={finish} />}
                    </div>
                  );
                })}
                {ghost && drag?.kind === "new" && drag.from.day === i && (
                  <div className="cal-event ghost" style={{ top: ((ghost[0] - day) / MINUTE) * PX, height: ((ghost[1] - ghost[0]) / MINUTE) * PX - 2, left: 1, width: "calc(100% - 6px)" }}>
                    <span>
                      {clock(ghost[0], zone)} – {clock(ghost[1], zone)}
                    </span>
                  </div>
                )}
                {day === today && <div className="cal-now" style={{ top: ((now - day) / MINUTE) * PX }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

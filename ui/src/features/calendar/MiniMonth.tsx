/** @part-of ui.calendar */
import { useEffect, useState } from "react";
import { Icon } from "../../shell/Icon";
import { DAY, dateOf, dayStart, monthDays, monthStart } from "./time";

interface Props {
  zone: string;
  /** The days the week is showing: they are marked as one band. */
  shown: number[];
  /** A day was chosen: the week goes there. */
  onPick: (day: number) => void;
  /** The day that is picked, when this is choosing a date and not showing the week. */
  picked?: number;
}

const NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** A small month, Monday first: today filled, the days in view marked, a click goes to that day. */
export function MiniMonth({ zone, shown, onPick, picked }: Props) {
  const lead = picked ?? shown[Math.floor(shown.length / 2)];
  const [month, setMonth] = useState(() => monthStart(lead, zone));
  useEffect(() => setMonth(monthStart(lead, zone)), [lead, zone]);
  const today = dayStart(Date.now(), zone);
  const inMonth = dateOf(month + DAY / 2, zone).slice(0, 7);
  const days = monthDays(month, zone);
  const name = new Date(month + DAY / 2).toLocaleDateString([], { timeZone: zone, month: "long", year: "numeric" });
  return (
    <div className="cal-month" role="group" aria-label={name}>
      <div className="cal-month-bar">
        <b>{name}</b>
        <button className="cal-icon" title="Earlier month" onClick={() => setMonth(monthStart(month, zone, -1))}>
          <Icon name="up" size={14} />
        </button>
        <button className="cal-icon" title="Later month" onClick={() => setMonth(monthStart(month, zone, 1))}>
          <Icon name="down" size={14} />
        </button>
      </div>
      <div className="cal-month-days">
        {NAMES.map((n) => (
          <i key={n}>{n}</i>
        ))}
        {days.map((day, i) => {
          const on = picked === undefined ? shown.includes(day) : picked === day;
          const first = on && (i % 7 === 0 || !shown.includes(days[i - 1]) || picked !== undefined);
          const last = on && (i % 7 === 6 || !shown.includes(days[i + 1]) || picked !== undefined);
          return (
            <button
              key={day}
              className={`${dateOf(day + DAY / 2, zone).startsWith(inMonth) ? "" : "out"}${day === today ? " today" : ""}${on ? " on" : ""}${first ? " first" : ""}${last ? " last" : ""}`}
              aria-label={new Date(day + DAY / 2).toLocaleDateString([], { timeZone: zone, weekday: "long", day: "numeric", month: "long" })}
              aria-current={day === today ? "date" : undefined}
              onClick={() => onPick(day)}
            >
              <span>{Number(dateOf(day + DAY / 2, zone).slice(8))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

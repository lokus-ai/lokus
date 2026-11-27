/** @part-of ui.calendar */
import type { CalEvent } from "../../bridge/calendar";

/** Clock arithmetic in a named time zone, so the grid can be read in any zone. */

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const formats = new Map<string, Intl.DateTimeFormat>();
function format(zone: string): Intl.DateTimeFormat {
  let f = formats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formats.set(zone, f);
  }
  return f;
}

/** The wall clock in `zone` at an instant, as if it were UTC. */
function wall(at: number, zone: string): number {
  const p: Record<string, number> = {};
  for (const part of format(zone).formatToParts(at)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** The instant at which the wall clock in `zone` reads `clock` (given as if UTC). */
export function instant(clock: number, zone: string): number {
  let at = clock - (wall(clock, zone) - clock);
  // Once more for the hours around a clock change.
  at = clock - (wall(at, zone) - at);
  return at;
}

/** Midnight in `zone` of the day an instant falls on. */
export function dayStart(at: number, zone: string): number {
  const w = wall(at, zone);
  return instant(w - (w % DAY), zone);
}

/** The same wall time `days` later (a day may be 23 or 25 hours long). */
export function addDays(start: number, days: number, zone: string): number {
  return instant(wall(start, zone) + days * DAY, zone);
}

/** The instant whose wall clock is `minutes` after that of `start`. */
export function addMinutes(start: number, minutes: number, zone: string): number {
  return instant(wall(start, zone) + minutes * MINUTE, zone);
}

/** The date in `zone`, like 2026-12-01. */
export function dateOf(at: number, zone: string): string {
  return new Date(wall(at, zone)).toISOString().slice(0, 10);
}

/** Minutes since midnight in `zone`. */
export function minuteOfDay(at: number, zone: string): number {
  return Math.round((wall(at, zone) % DAY) / MINUTE);
}

export function weekday(at: number, zone: string): number {
  return new Date(wall(at, zone)).getUTCDay();
}

export const stamp = (at: number) => new Date(at).toISOString().replace(/\.\d+Z$/, "Z");

export function clock(at: number | string, zone: string): string {
  return new Date(at).toLocaleTimeString([], { timeZone: zone, hour: "numeric", minute: "2-digit" });
}

export function dayLabel(at: number, zone: string): { name: string; number: string } {
  const d = new Date(at);
  return { name: d.toLocaleDateString([], { timeZone: zone, weekday: "short" }), number: d.toLocaleDateString([], { timeZone: zone, day: "numeric" }) };
}

/** For a `datetime-local` input: the wall clock in `zone`. */
export function toField(at: string, zone: string): string {
  return new Date(wall(Date.parse(at), zone)).toISOString().slice(0, 16);
}

export function fromField(value: string, zone: string): string | null {
  const clock = Date.parse(`${value}:00Z`);
  return Number.isNaN(clock) ? null : stamp(instant(clock, zone));
}

/** GMT+1 and the like, for a zone at an instant. */
export function offsetName(zone: string, at = Date.now()): string {
  const minutes = Math.round((wall(at, zone) - Math.floor(at / 1000) * 1000) / MINUTE);
  const sign = minutes < 0 ? "-" : "+";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export const ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return [localZone, "UTC"];
  }
})();

export interface Placed {
  event: CalEvent;
  /** Minutes from this day's midnight, clipped to the day. */
  top: number;
  height: number;
  /** Which of `columns` side-by-side lanes it sits in. */
  column: number;
  columns: number;
}

/** A day's timed events laid out so that overlapping ones sit side by side. */
export function place(events: CalEvent[], day: number, next: number): Placed[] {
  const minutes = (next - day) / MINUTE;
  const items = events
    .filter((e) => !e.all_day && Date.parse(e.start) < next && Date.parse(e.end) > day)
    .map((event) => {
      const top = Math.max(0, (Date.parse(event.start) - day) / MINUTE);
      const bottom = Math.min(minutes, (Date.parse(event.end) - day) / MINUTE);
      return { event, top, height: Math.max(15, bottom - top), column: 0, columns: 1 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);
  let group: Placed[] = [];
  let groupEnd = -1;
  const close = () => {
    const columns = Math.max(0, ...group.map((p) => p.column)) + 1;
    for (const p of group) p.columns = columns;
    group = [];
  };
  for (const item of items) {
    if (item.top >= groupEnd) close();
    const taken = new Set(group.filter((p) => p.top + p.height > item.top).map((p) => p.column));
    while (taken.has(item.column)) item.column += 1;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.top + item.height);
  }
  close();
  return items;
}

const RULES: [string, string][] = [
  ["", "Does not repeat"],
  ["RRULE:FREQ=DAILY", "Every day"],
  ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "Every weekday"],
  ["RRULE:FREQ=WEEKLY", "Every week"],
  ["RRULE:FREQ=WEEKLY;INTERVAL=2", "Every two weeks"],
  ["RRULE:FREQ=MONTHLY", "Every month"],
  ["RRULE:FREQ=YEARLY", "Every year"],
];

/** The repeat choices, with the event's own rule added when it is none of the usual ones. */
export function repeatChoices(rule: string | null): [string, string][] {
  if (!rule || RULES.some(([r]) => r === rule)) return RULES;
  return [...RULES, [rule, rule.replace("RRULE:", "").toLowerCase()]];
}

export function age(minutes: number | null): string {
  if (minutes === null) return "age unknown";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

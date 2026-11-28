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
  /** Where it starts and ends across the day's width, each a share of it. */
  left: number;
  right: number;
  /** How many earlier groups it is laid over: later ones are drawn on top. */
  depth: number;
  /** Minutes from its top before a later event is laid over it: its words go there, the rest is colour. */
  clear: number;
}

/** The least an event is drawn tall, in minutes: a quarter of an hour, which has room for its title. */
const MIN_HEIGHT = 15;
/** Minutes of an event's height its title needs to stay readable. */
const TITLE = 15;
/** The least width an event is drawn beside another, in pixels: room for a word. */
const FACE = 60;
/** How far an event is set in from the ones it is laid over, in pixels: the one step every stack uses. */
const STEP = 10;

/**
 * A day's timed events laid out as Google and Notion do. Events that start together sit side by
 * side while each has room for a word (`width` is the day's width in pixels). One that starts
 * later while others are still going is set in from them by one step and laid over them up to the
 * day's right edge: the earlier one keeps its title line, the later one the width.
 */
export function place(events: CalEvent[], day: number, next: number, width = 160): Placed[] {
  const minutes = (next - day) / MINUTE;
  const items: Placed[] = events
    .filter((e) => !e.all_day && Date.parse(e.start) < next && Date.parse(e.end) > day)
    .map((event) => {
      const top = Math.max(0, (Date.parse(event.start) - day) / MINUTE);
      const bottom = Math.min(minutes, (Date.parse(event.end) - day) / MINUTE);
      return { event, top, height: Math.max(MIN_HEIGHT, bottom - top), left: 0, right: 1, depth: 0, clear: 0 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);
  const step = STEP / width;
  const done: Placed[] = [];
  for (let i = 0; i < items.length; ) {
    const under = done.filter((p) => p.top + p.height > items[i].top);
    const depth = under.length ? Math.max(...under.map((p) => p.depth)) + 1 : 0;
    const from = Math.min(0.5, depth * step);
    const most = Math.max(1, Math.floor((width * (1 - from) - 8) / FACE));
    // Those that start within a title's height of each other share the width, as many as fit.
    const together = [items[i]];
    while (together.length < most && i + together.length < items.length && items[i + together.length].top < items[i].top + TITLE) together.push(items[i + together.length]);
    i += together.length;
    together.forEach((p, k) => {
      p.depth = depth;
      p.left = from + ((1 - from) * k) / together.length;
      p.right = from + ((1 - from) * (k + 1)) / together.length;
    });
    done.push(...together);
  }
  for (const p of items) {
    const over = items.filter((q) => q.depth > p.depth && q.left < p.right && q.top < p.top + p.height && q.top + q.height > p.top);
    p.clear = Math.min(p.height, ...over.map((q) => Math.max(0, q.top - p.top)));
  }
  return items;
}

/** How long, in words: 45m, 1h, 1h 30m. */
export function span(start: string | number, end: string | number): string {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / MINUTE);
  if (minutes >= 24 * 60) return `${Math.round(minutes / 1440)}d`;
  const [h, m] = [Math.floor(minutes / 60), minutes % 60];
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

/** A typed time ("9", "9:30", "2pm", "14.15") as minutes since midnight; null when it is none. */
export function typedClock(text: string): number | null {
  const m = text.trim().toLowerCase().match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(a|am|p|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3]?.startsWith("p") && h < 12) h += 12;
  if (m[3]?.startsWith("a") && h === 12) h = 0;
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** The six weeks a month is shown in, Monday first: each day's midnight in `zone`. */
export function monthDays(month: number, zone: string): number[] {
  const first = addDays(month, -((weekday(month + DAY / 2, zone) + 6) % 7), zone);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i, zone));
}

/** Midnight of the first day of the month an instant falls in, and of the months around it. */
export function monthStart(at: number, zone: string, add = 0): number {
  const [y, m] = dateOf(at, zone).split("-").map(Number);
  return instant(Date.UTC(y, m - 1 + add, 1), zone);
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

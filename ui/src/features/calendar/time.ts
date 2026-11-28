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
/** The least width an event is drawn beside another, in pixels: room for about two words. A day shows as many side by side as fit at that width; one more is laid over a column when it can be, and the rest are behind "+N". */
const FACE = 72;
/** The least width when that would leave one event showing and the others hidden: room for one word. Two side by side beat one and "+2". */
const SLIM = 48;
/** How many events a width shows side by side: as many as keep two words each, and two when both still keep a word. */
const across = (room: number) => Math.max(1, Math.floor(room / FACE), Math.min(2, Math.floor(room / SLIM)));
/** The least width of an event laid over a column, in pixels: its title's first word is whole. */
const LAID = 64;
/** The width a "+N" takes beside the events that did fit, in pixels. */
const CHIP = 18;
/** How far an event is set in from the ones it is laid over, in pixels: the one step every stack uses. */
const STEP = 10;
/** An event is laid over the ones beneath only when it starts this many minutes after each of them: their titles stay clear. */
const OVER = 30;

/** Events that had no room for a box of their own: drawn as one "+N more". */
export interface More {
  events: CalEvent[];
  top: number;
  left: number;
  right: number;
  depth: number;
}

interface Cluster {
  /** Each column's events, in the order they start. */
  columns: Placed[][];
  /** How far in from the left it starts, when it is laid over the whole width. */
  from: number;
  depth: number;
  /** The one column of another group it is laid over, when that group had no room for it beside; `to` is the column it ends before. */
  over?: { cluster: Cluster; column: number; to?: number };
}

/**
 * A day's timed events laid out as calendars do. Events that overlap share the width as columns,
 * and one widens into the columns to its right that are free while it lasts. One that starts half
 * an hour or more after everything still going is laid over them instead, set in by one step up to
 * the day's right edge: those beneath keep their title line. Columns narrower than a word
 * (`width` is the day's width in pixels) are gathered into a "+N more".
 */
export function place(events: CalEvent[], day: number, next: number, width = 160): { placed: Placed[]; more: More[] } {
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
  const ends = (p: Placed) => p.top + p.height;
  /** Where a group lies across the day, as it stands: its edges, how many boxes it shows, each one's share, its "+N" strip. */
  const lie = (c: Cluster): { lo: number; hi: number; boxes: number; share: number; chip: number } => {
    let [lo, hi] = [c.from, 1];
    if (c.over) {
      const under = lie(c.over.cluster);
      lo = under.lo + under.share * c.over.column + step;
      hi = under.lo + under.share * (c.over.to ?? c.over.column + 1);
    }
    const room = width * (hi - lo) - 8;
    const fits = c.columns.length <= across(room);
    const boxes = fits ? c.columns.length : across(room - CHIP);
    const chip = fits ? 0 : Math.min((hi - lo) * 0.4, (CHIP + 8) / width);
    return { lo, hi, boxes, share: (hi - lo - chip) / boxes, chip };
  };
  const clusters: Cluster[] = [];
  const home = new Map<Placed, Cluster>();
  const seen: Placed[] = [];
  for (const item of items) {
    const going = seen.filter((p) => ends(p) > item.top);
    const close = going.filter((p) => p.top > item.top - OVER);
    const above = going.length ? Math.max(...going.map((p) => home.get(p)!.depth)) + 1 : 0;
    let cluster: Cluster;
    if (close.length) {
      // Beside the ones it starts with: the first column that is free, or one more.
      const beside = home.get(close[close.length - 1])!;
      cluster = beside;
      const free = beside.columns.find((c) => ends(c[c.length - 1]) <= item.top);
      const { lo, hi } = lie(beside);
      // No room for one more column: over a column whose event began long enough ago, if nothing lies on it yet.
      const taken = (k: number) => going.some((p) => home.get(p)!.over?.cluster === beside && home.get(p)!.over?.column === k);
      // A column too narrow for a card set in by one step to show a word takes none: the event goes behind the "+N" instead.
      const holds = lie(beside).share * width - STEP >= LAID;
      // Over rather than beside as soon as one more column would leave each less than a few words wide.
      const snug = beside.columns.length + 1 > across(width * (hi - lo) - 8);
      const column = snug && holds ? beside.columns.findIndex((c, k) => c[c.length - 1].top <= item.top - OVER && !taken(k)) : -1;
      if (free) free.push(item);
      else if (column >= 0) {
        cluster = { columns: [[item]], depth: above, from: 0, over: { cluster: beside, column } };
        clusters.push(cluster);
      } else if (beside.over && beside.columns.length + 1 > across(width * (hi - lo) - 8)) {
        // Laid over a column already, with no room there for one more beside: no sliver, it joins the "+N" of the group beneath.
        cluster = beside;
        while (cluster.over) cluster = cluster.over.cluster;
        cluster.columns.push([item]);
      } else beside.columns.push([item]);
    } else {
      cluster = { columns: [[item]], depth: above, from: Math.min(0.5, above * step) };
      clusters.push(cluster);
    }
    home.set(item, cluster);
    seen.push(item);
  }
  // One laid over a column widens into the columns to its right that hold nothing, beneath or laid over, while it lasts.
  for (const c of clusters) {
    if (!c.over) continue;
    const mine = c.columns.flat();
    const [from, till] = [Math.min(...mine.map((p) => p.top)), Math.max(...mine.map(ends))];
    const meets = (p: Placed) => p.top < till && ends(p) > from;
    const under = c.over.cluster;
    const boxes = lie(under).boxes;
    let to = c.over.column + 1;
    while (
      to < boxes &&
      !under.columns[to].some(meets) &&
      !clusters.some((o) => o !== c && o.over?.cluster === under && o.over.column <= to && (o.over.to ?? o.over.column + 1) > to && o.columns.flat().some(meets))
    )
      to++;
    c.over.to = to;
  }
  const placed: Placed[] = [];
  const more: More[] = [];
  for (const cluster of clusters) {
    const { columns, depth } = cluster;
    const { lo, hi, boxes, share, chip } = lie(cluster);
    columns.slice(0, boxes).forEach((column, k) => {
      for (const p of column) {
        // Wider, into the columns to the right that hold nothing while it lasts.
        let to = k + 1;
        while (to < boxes && !columns[to].some((q) => q.top < ends(p) && ends(q) > p.top)) to++;
        p.depth = depth;
        p.left = lo + share * k;
        p.right = lo + share * to;
        placed.push(p);
      }
    });
    const rest = columns.slice(boxes).flat().sort((a, b) => a.top - b.top);
    if (rest.length) more.push({ events: rest.map((p) => p.event), top: rest[0].top, left: hi - chip, right: hi, depth });
  }
  for (const p of placed) {
    const over = placed.filter((q) => q.depth > p.depth && q.left < p.right && q.right > p.left && q.top < p.top + p.height && q.top + q.height > p.top);
    p.clear = Math.min(p.height, ...over.map((q) => Math.max(0, q.top - p.top)));
  }
  placed.sort((a, b) => a.top - b.top || a.left - b.left);
  return { placed, more };
}

/** How long, in words: 45m, 1h, 1h 30m. */
export function span(start: string | number, end: string | number): string {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / MINUTE);
  if (minutes >= 24 * 60) {
    const hours = Math.round((minutes % 1440) / 60);
    return hours ? `${Math.floor(minutes / 1440)}d ${hours}h` : `${Math.floor(minutes / 1440)}d`;
  }
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

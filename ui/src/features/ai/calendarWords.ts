/** @part-of ui.ai */
import type { CalEvent } from "../../bridge/calendar";

/** Guests as they are given to a calendar tool: addresses, or {email, optional}. */
const guestsOf = (input: Record<string, unknown>): string[] =>
  (Array.isArray(input.guests) ? input.guests : []).map((g) => (typeof g === "string" ? g : `${String((g as { email?: string }).email ?? "")}${(g as { optional?: boolean }).optional ? " (optional)" : ""}`)).filter(Boolean);

/** A calendar tool in a few words. */
export const CALENDAR: Record<string, (i: Record<string, unknown>) => string> = {
  calendar_event_create: (i) => {
    const n = guestsOf(i).length;
    const name = i.title ? `“${String(i.title)}”` : "an event";
    return n ? `Invite ${n} ${n === 1 ? "guest" : "guests"} to ${name}` : `Put ${name} on your calendar`;
  },
  calendar_event_update: () => "Change an event",
  calendar_event_send: (i) => (i.notify === false ? "Save an event without emailing its guests" : "Email an event's guests"),
  calendar_event_discard: () => "Discard an event's unsent changes",
  calendar_event_delete: () => "Delete an event",
  calendar_event_reply: (i) => `Answer an invitation: ${String(i.reply ?? "")}`,
  calendar_block: () => "Block a time as Busy",
  calendar_note: () => "Write a meeting note",
  calendar_calendars_set: () => "Change a calendar's settings",
  calendar_account_add: () => "Connect a calendar account",
  calendar_account_remove: (i) => `Disconnect ${String(i.account ?? "a calendar account").replace(/^[a-z]+:/, "")}`,
  calendar_team_publish: () => "Share your busy times with the team",
  calendar_events: () => "Looking at your calendar",
  calendar_event_get: () => "Looking at an event",
  calendar_status: () => "Looking at your calendar accounts",
  calendar_sync: () => "Checking your calendars",
  calendar_busy: () => "Looking at when people are busy",
  calendar_team: () => "Looking at the team's availability",
  calendar_find_time: () => "Finding a time",
  calendar_briefing: () => "Reading the day's events",
};

/** Anything here emails other people, so each one is asked about on its own: never "allow all". */
export const emailsPeople = (name: string) => /^calendar_event_(create|update|send|delete|reply)$/.test(name);

/** When an event is, in words. */
function eventTime(start: unknown, end: unknown, zone: unknown, allDay: unknown): string {
  const [a, b] = [Date.parse(String(start ?? "")), Date.parse(String(end ?? ""))];
  if (Number.isNaN(a)) return "";
  const timeZone = typeof zone === "string" && zone ? zone : undefined;
  let day: string;
  let clock: (t: number) => string;
  try {
    day = new Date(a).toLocaleDateString([], { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
    clock = (t) => new Date(t).toLocaleTimeString([], { timeZone, hour: "numeric", minute: "2-digit" });
  } catch {
    return String(start);
  }
  if (allDay === true) return `${day}, all day`;
  return `${day}, ${clock(a)}${Number.isNaN(b) ? "" : ` to ${clock(b)}`}${timeZone ? ` (${timeZone.replace(/_/g, " ")})` : ""}`;
}

const REPEATS: Record<string, string> = { DAILY: "every day", WEEKLY: "every week", MONTHLY: "every month", YEARLY: "every year" };

/** What a calendar change would do, in words: the title, the time, the guests, and who is emailed. */
export function calendarDetail(name: string, input: Record<string, unknown>, event: CalEvent | null): string {
  const lines: string[] = [];
  const op = name.replace(/^calendar_(event_)?/, "");
  const changing = op === "update";
  const title = input.title ?? (changing ? undefined : event?.title);
  const guests = Array.isArray(input.guests) ? guestsOf(input) : changing ? null : (event?.guests.map((g) => `${g.name || g.email}${g.optional ? " (optional)" : ""}`) ?? null);
  const invited = event?.guests.length ?? 0;
  if (event && (changing || title === undefined)) lines.push(`Event: ${event.title || "(No title)"}, ${eventTime(event.start, event.end, event.zone, event.all_day)}`);
  if (title !== undefined) lines.push(`${changing ? "New title" : "Title"}: ${String(title) || "(No title)"}`);
  const at = eventTime(input.start ?? (changing ? undefined : event?.start), input.end ?? (changing ? undefined : event?.end), input.zone ?? event?.zone, input.all_day ?? event?.all_day);
  if (at && !(event && title === undefined && !changing)) lines.push(`${changing ? "New time" : "When"}: ${at}`);
  if (guests) lines.push(`Guests: ${guests.length ? guests.join(", ") : "none"}`);
  if (typeof input.location === "string" && input.location) lines.push(`Place: ${input.location}`);
  if (typeof input.repeat === "string") {
    const rule = input.repeat.replace(/^RRULE:/, "");
    lines.push(`Repeats: ${rule ? (REPEATS[rule.replace(/^FREQ=/, "")] ?? rule.toLowerCase().replace(/;/g, ", ")) : "no"}`);
  }
  if (input.meeting === true) lines.push("A video meeting link is added.");
  if (typeof input.description === "string" && input.description) lines.push(`Notes: ${input.description}`);
  if (input.scope === "all") lines.push("Applies to every event of the series.");
  if (op === "create") lines.push(!guestsOf(input).length ? "Nobody is emailed." : input.send === true && input.notify !== false ? "The guests are emailed an invitation." : "Nobody is emailed until you send the invitation.");
  if (op === "update") lines.push(invited ? "The guests are not emailed until you send the update." : "Nobody is emailed.");
  if (op === "send") lines.push(input.notify === false ? "It is saved without emailing the guests." : "The guests are emailed.");
  if (op === "delete") lines.push(invited && input.notify !== false ? `${invited === 1 ? "The guest is" : `All ${invited} guests are`} emailed that it is cancelled.` : "Nobody is emailed.");
  if (op === "reply") lines.push(`Your answer: ${String(input.reply ?? "")}. The organiser is told.`);
  if (op === "block") {
    if (input.start) lines.push(`When: ${eventTime(input.start, input.end, undefined, false)}`);
    lines.push(`A plain “${String(input.title ?? "Busy")}” event on ${String(input.account ?? "your other calendar").replace(/^[a-z]+:/, "")}, with no details.`);
  }
  if (op === "note") lines.push("A note in this folder with the event's time and guests filled in.", "If this folder syncs to your team, the note's title and guests go to the team too.");
  if (op === "calendars_set") lines.push([input.hidden === true ? "Hide it" : input.hidden === false ? "Show it" : "", input.default === true ? "make it the default" : "", input.color ? `colour ${String(input.color)}` : ""].filter(Boolean).join(", ") || "No change");
  return lines.join("\n");
}

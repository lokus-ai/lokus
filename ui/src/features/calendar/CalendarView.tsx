/** @part-of ui.calendar */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onCalendarSynced, runCalendar, syncCalendar, type CalBusy, type CalEvent, type CalMember, type CalSlot, type CalStatus } from "../../bridge/calendar";
import { formatKeys } from "../../shell/commands";
import { Icon } from "../../shell/Icon";
import { EventPanel, type Scope } from "./EventPanel";
import { Grid, type Overlay } from "./Grid";
import { pickMenu } from "./menu";
import { MiniMonth } from "./MiniMonth";
import { Pick } from "./Pick";
import { ZonePick } from "./ZonePick";
import { addDays, age, clock, dayStart, instant, localZone, offsetName, span, stamp, weekday } from "./time";
import "./calendar.css";

const PEOPLE = ["#b266d9", "#e2674a", "#3aa675", "#d9a400", "#4f7cff"];
const DRAFT = "draft";
/** The colours a calendar can be given. */
const COLORS: [string, string][] = [["#4f7cff", "Blue"], ["#b266d9", "Purple"], ["#e2674a", "Red"], ["#d9a400", "Yellow"], ["#3aa675", "Green"], ["#2a9d9d", "Teal"], ["#8d8c87", "Grey"]];
/** The narrowest a day is drawn. */
/** The first day of a week where the person lives, as a weekday number (0 Sunday, 1 Monday). */
const WEEK_STARTS = (() => {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    return ((locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay ?? 1) % 7;
  } catch {
    return 1;
  }
})();
const DAY_MIN = 136;
/** Calendar widths at which the list on the left, and the event on the right, fit beside the week. */
const SIDE_FITS = 1230;
const PANEL_FITS = 1530;
const SIDE_WIDE = 220;
const PANEL_WIDE = 300;
/** The width the event panel covers when it lies over the week. */
const PANEL_OVER = 320;
/** The least the week keeps beside the event panel: its bar still shows the month, Today, the arrows and New. */
const BAR_MIN = 600;
const kept = (name: string, fallback: string) => localStorage.getItem(`lokus.calendar.${name}`) ?? fallback;
const keep = (name: string, value: string) => localStorage.setItem(`lokus.calendar.${name}`, value);

interface Props {
  onOpen: (path: string) => void;
  onNotice: (message: string) => void;
}

/** The calendar: accounts and people on the left, the week in the middle, the event on the right. */
export default function CalendarView({ onOpen, onNotice }: Props) {
  const [status, setStatus] = useState<CalStatus | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [members, setMembers] = useState<CalMember[]>([]);
  const [zone, setZone] = useState(() => kept("zone", localZone));
  const [count, setCount] = useState(() => Number(kept("days", "7")));
  const [anchor, setAnchor] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<CalEvent | null>(null);
  const [scope, setScope] = useState<Scope>("this");
  const [people, setPeople] = useState<string[]>(() => JSON.parse(kept("people", "[]")) as string[]);
  const [shownMembers, setShownMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState<CalBusy[]>([]);
  const [briefing, setBriefing] = useState<{ text: string; events: CalEvent[] }>({ text: "", events: [] });
  const [offline, setOffline] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ minutes: number; found: CalSlot[] | null; unknown: string[] } | null>(null);
  const [person, setPerson] = useState("");
  /** Delete was asked for on an event with guests: the panel asks once whether to tell them. */
  const [deleting, setDeleting] = useState(false);
  /** What the open folder says before a meeting note is written into it (a team's folder syncs). */
  const [noteAsk, setNoteAsk] = useState<string | null>(null);
  // The screen is laid out by the room it has: how wide the calendar is, and the week inside it.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(1440);
  const [weekWidth, setWeekWidth] = useState(900);
  useEffect(() => {
    if (!rootEl || !mainEl) return;
    const watch = new ResizeObserver(() => (setWidth(rootEl.clientWidth), setWeekWidth(mainEl.clientWidth)));
    watch.observe(rootEl);
    watch.observe(mainEl);
    return () => watch.disconnect();
  }, [rootEl, mainEl]);
  /** The calendar list sits beside the week; below this it is opened over it from the bar. */
  const sideFits = width >= SIDE_FITS;
  /** The event and today's summary sit beside the week; below this the event opens over it. */
  const wide = width >= PANEL_FITS;
  /** How much the bar has to give up: 0 nothing, 1 key hints and long names, 2 words for icons, 3 the rest. */
  const tight = weekWidth < 520 ? 3 : weekWidth < 660 ? 2 : weekWidth < 740 ? 1 : 0;
  /** The list on the left: kept open or folded as the person left it; over the week when it has no room beside it. */
  const [side, setSide] = useState(() => kept("side", "1") === "1");
  const [sideOpen, setSideOpen] = useState(false);
  /** Today's summary, opened over the week when it has no room beside it. */
  const [dayOpen, setDayOpen] = useState(false);
  /** An open event takes its own column while a readable day still fits beside it, so its own day is never covered; narrower, it lies over the week. */
  const beside = width - (sideFits && side ? SIDE_WIDE : 0) - PANEL_WIDE >= BAR_MIN;
  /** The day of the open event while its panel lies over the week. */
  const [pin, setPin] = useState<number | null>(null);
  // As many days as fit readably: never thin columns. A week steps down to 5, 3, 2, then a day.
  const room = Math.max(1, Math.floor((weekWidth - 56) / DAY_MIN));
  const fit = count <= room ? count : count === 7 ? ([5, 3, 2, 1].find((n) => n <= room) ?? 1) : room;

  // A week that shows only its working days still turns a whole week at a time, from its first day.
  const week = count === 7 && fit >= 5;
  const turn = week ? 7 : fit;

  const days = useMemo(() => {
    const day = dayStart(anchor, zone);
    // A whole week starts on the first weekday where the person lives; the working week it shrinks to on Monday; fewer days on the day in view.
    const starts = fit === 7 ? WEEK_STARTS : 1;
    const monday = week ? addDays(day, -((weekday(day + 3_600_000 * 12, zone) - starts + 7) % 7), zone) : day;
    // A working week ends on the day in view when that day is at the weekend.
    let first = day >= addDays(monday, fit, zone) ? addDays(day, 1 - fit, zone) : monday;
    // A panel lying over the week covers its last days: the open event's day is kept among the ones still seen.
    if (pin !== null) {
      const clear = Math.max(1, Math.floor((weekWidth - PANEL_OVER - 56) / ((weekWidth - 56) / fit)));
      const at = Math.round((dayStart(pin, zone) - first) / 86_400_000);
      if (at >= clear && at < fit) first = addDays(first, at - clear + 1, zone);
    }
    return Array.from({ length: fit }, (_, i) => addDays(first, i, zone));
  }, [anchor, fit, week, zone, pin, weekWidth]);
  const from = days[0];
  const to = addDays(days[days.length - 1], 1, zone);

  const fail = useCallback((e: unknown) => onNotice(e instanceof Error ? e.message : "The calendar could not do that."), [onNotice]);
  const range = useRef({ from, to, zone });
  range.current = { from, to, zone };

  const refresh = useCallback(async () => {
    const { from, to, zone } = range.current;
    try {
      const [s, e] = await Promise.all([runCalendar<CalStatus>("calendar.status"), runCalendar<{ events: CalEvent[] }>("calendar.events", { from: stamp(from), to: stamp(to) })]);
      setStatus(s);
      setEvents(e.events);
      setBriefing(await runCalendar<{ text: string; events: CalEvent[] }>("calendar.briefing", { zone }));
      // The open folder may not be a team's, or there may be none: then nobody is listed.
      setMembers(await runCalendar<{ members: CalMember[] }>("calendar.team").then((t) => t.members, () => []));
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  useEffect(() => void refresh(), [refresh, from, to, zone]);
  useEffect(() => onCalendarSynced((changed, off) => (off !== undefined && setOffline(off), changed && void refresh())), [refresh]);
  useEffect(() => {
    syncCalendar();
  }, []);

  // A colleague's busy times, asked of the provider for the days in view.
  useEffect(() => {
    if (!people.length || !status?.accounts.length) return setBusy([]);
    let stale = false;
    void runCalendar<{ busy: CalBusy[] }>("calendar.busy", { emails: people, from: stamp(from), to: stamp(to) }).then((b) => !stale && setBusy(b.busy), () => undefined);
    return () => void (stale = true);
  }, [people, from, to, status?.accounts.length]);

  const mine = useMemo(() => new Set(status?.accounts.map((a) => a.email) ?? []), [status]);
  const overlays: Overlay[] = useMemo(
    () => [
      ...members.filter((m) => shownMembers.includes(m.member)).map((m, i) => ({ label: m.name || m.member, color: PEOPLE[i % PEOPLE.length], times: m.busy })),
      ...busy.filter((b) => b.known).map((b, i) => ({ label: b.email, color: PEOPLE[(i + 2) % PEOPLE.length], times: b.times })),
    ],
    [members, shownMembers, busy],
  );
  const colors = useMemo(() => new Map(status?.calendars.map((c) => [`${c.account}|${c.id}`, c.color]) ?? []), [status]);
  const colorOf = useCallback((e: CalEvent) => colors.get(`${e.account}|${e.calendar}`) ?? "#4f7cff", [colors]);

  const shown = draft ? [...events, draft] : events;
  const current = selected === DRAFT ? draft : (events.find((e) => e.key === selected) ?? null);

  // When a panel takes room and fewer days fit, the open event's day stays among them.
  useEffect(() => {
    if (!current) return;
    // An all-day event is held as dates, not instants.
    const [start, end] = current.all_day
      ? [instant(Date.parse(current.start), zone), instant(Date.parse(current.end), zone)]
      : [Date.parse(current.start), Date.parse(current.end)];
    if (start >= to || Math.max(end, start + 1) <= from) setAnchor(dayStart(start, zone) + 12 * 3_600_000);
  }, [fit, current?.key]);
  useEffect(() => {
    if (!current || beside) return setPin(null);
    setPin(current.all_day ? instant(Date.parse(current.start), zone) : Date.parse(current.start));
  }, [current?.key, current?.start, beside, zone]);

  const select = (key: string | null) => {
    setSelected(key);
    setScope("this");
    setDeleting(false);
    setNoteAsk(null);
    if (key !== DRAFT) setDraft(null);
  };

  /** A draft's id is chosen when it is opened: however often it is sent, it is one event. */
  const draftId = useRef("");
  const madeAt = useRef(0);
  const [sending, setSending] = useState(false);
  const startDraft = (start: string, end: string, guest?: string, allDay = false) => {
    // The second click of a double click on "Send invite" lands on the grid the panel just uncovered: it is not a new event.
    if (Date.now() - madeAt.current < 600) return;
    const home = status?.calendars.find((c) => c.default) ?? status?.calendars[0];
    if (!home) return;
    const member = members.find((m) => m.member === guest);
    setDraft({
      key: DRAFT, account: home.account, calendar: home.id, id: DRAFT, uid: "", title: "", start, end, all_day: allDay, zone, location: "", description: "",
      guests: guest ? [{ email: guest, name: member?.name ?? "", optional: false, reply: "needsAction" }] : [],
      organizer: "", mine: true, reply: "", meeting: null, want_meeting: false, repeat: null, series: null, link: "", pending: false, unsent: false, changes: [], queued: false, error: null, note: null,
    });
    draftId.current = crypto.randomUUID().replace(/-/g, "");
    setSelected(DRAFT);
  };

  /** Do something to the calendar, show what it left, and send it on if it is not being held. */
  const last = useRef<Promise<unknown>>(Promise.resolve());
  const act = (name: string, args: Record<string, unknown>, send = true): Promise<CalEvent | null> => {
    // One after another, so a send never overtakes the edit made just before it.
    const run = last.current.then(async () => {
      try {
        const done = await runCalendar<{ event?: CalEvent | null }>(name, args);
        await refresh();
        if (send && !done.event?.pending && !done.event?.unsent) syncCalendar();
        return done.event ?? null;
      } catch (e) {
        fail(e);
        return null;
      }
    });
    last.current = run;
    return run;
  };

  // One reply at a time: a second key press or click while it is on its way does nothing.
  const replying = useRef(false);
  const [answering, setAnswering] = useState(false);
  const reply = async (answer: "yes" | "no" | "maybe") => {
    if (!current || replying.current) return;
    replying.current = true;
    setAnswering(true);
    await act("calendar.event.reply", { key: current.key, scope, reply: answer });
    replying.current = false;
    setAnswering(false);
  };

  const change = (fields: Record<string, unknown>) => {
    if (selected === DRAFT && draft) {
      const { meeting, repeat, ...rest } = fields;
      return setDraft({ ...draft, ...(rest as Partial<CalEvent>), ...(meeting === undefined ? {} : { want_meeting: !!meeting }), ...(repeat === undefined ? {} : { repeat: (repeat as string) || null }) });
    }
    if (current) void act("calendar.event.update", { key: current.key, scope, ...fields });
  };
  const creating = useRef(false);
  const create = async () => {
    if (!draft || creating.current) return;
    creating.current = true;
    setSending(true);
    const made = await act("calendar.event.create", {
      id: draftId.current, account: draft.account, calendar: draft.calendar, title: draft.title, start: draft.start, end: draft.end, all_day: draft.all_day, zone: draft.zone, location: draft.location,
      description: draft.description, guests: draft.guests, meeting: draft.want_meeting, repeat: draft.repeat ?? "", send: true,
    });
    creating.current = false;
    setSending(false);
    if (made) (madeAt.current = Date.now()), select(null);
  };
  /** Delete. With guests who were told of it, the panel asks first, once: `notify` is the answer. */
  const remove = async (notify?: boolean) => {
    if (!current || selected === DRAFT) return select(null);
    if (notify === undefined && !current.unsent && (current.guests.length > 0 || current.changes.includes("guests"))) return setDeleting(true);
    await act("calendar.event.delete", { key: current.key, scope, notify: notify ?? true });
    select(null);
  };
  const note = async (shared = false) => {
    if (!current) return;
    try {
      const done = await runCalendar<{ path: string | null; message?: string }>("calendar.note", { key: current.key, zone, shared });
      setNoteAsk(done.path ? null : (done.message ?? null));
      if (done.path) onOpen(done.path);
    } catch (e) {
      fail(e);
    }
  };
  const connect = async (provider: "google" | "microsoft") => {
    setConnecting(provider);
    try {
      await runCalendar("calendar.account.add", { provider });
      await refresh();
    } catch (e) {
      fail(e);
    }
    setConnecting(null);
  };
  const findTime = async (minutes: number) => {
    const emails = [...people, ...members.filter((m) => shownMembers.includes(m.member)).map((m) => m.member)];
    setSlots({ minutes, found: null, unknown: [] });
    try {
      const done = await runCalendar<{ slots: CalSlot[]; unknown: string[] }>("calendar.find_time", { emails, minutes, zone });
      setSlots({ minutes, found: done.slots, unknown: done.unknown });
    } catch (e) {
      fail(e);
      setSlots(null);
    }
  };
  const addPerson = () => {
    const email = person.trim().toLowerCase();
    setPerson("");
    if (!email.includes("@") || people.includes(email)) return;
    const next = [...people, email];
    setPeople(next);
    keep("people", JSON.stringify(next));
  };

  /** Mod-Enter: the field being typed in is taken first, then the draft or the pending change is sent. */
  const submit = useRef<() => void>(() => undefined);
  submit.current = async () => {
    if (selected === DRAFT) return void create();
    if (!current) return;
    await last.current;
    const { event } = await runCalendar<{ event: CalEvent | null }>("calendar.event.get", { key: current.key });
    if (event?.pending || event?.unsent) void act("calendar.event.send", { key: event.key, notify: true });
  };

  // Keys act on the calendar only while nothing is being typed.
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e) => {
    const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") || !e.target.closest(".calendar, body"));
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      (document.activeElement as HTMLElement | null)?.blur();
      setTimeout(() => submit.current(), 0);
      return e.preventDefault();
    }
    // Escape in a field of the calendar leaves the field; typed in the assistant beside it, it still closes the event.
    const outside = e.target instanceof HTMLElement && !e.target.closest(".calendar");
    if (e.key === "Escape" && e.defaultPrevented) return;
    if (e.key === "Escape" && typing && !(outside && selected)) return (document.activeElement as HTMLElement | null)?.blur();
    if (e.key === "Escape" && sideOpen && !sideFits) return setSideOpen(false);
    if (e.key === "Escape" && dayOpen && !selected) return setDayOpen(false);
    if (e.key === "Escape" && (deleting || noteAsk)) return (setDeleting(false), setNoteAsk(null));
    if (e.key === "Escape" && selected) return select(null);
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".palette, [role=dialog]")) return;
    const step = (by: number) => setAnchor(addDays(from, by * turn, zone));
    if (/^[1-9]$/.test(e.key)) (setCount(Number(e.key)), keep("days", e.key));
    else if (e.key === "t") setAnchor(Date.now());
    else if (e.key === "j" || e.key === "ArrowRight") step(1);
    else if (e.key === "k" || e.key === "ArrowLeft") step(-1);
    else if (e.key === "c") {
      const start = Math.ceil(Date.now() / 1_800_000) * 1_800_000;
      startDraft(stamp(start), stamp(start + 1_800_000));
    } else if (e.key === "f") void findTime(30);
    else if (current && selected !== DRAFT && e.key === "o") void note();
    else if (current && selected !== DRAFT && current.mine && e.key === "Backspace") deleting || void remove();
    else if (current && !current.mine && "ynm".includes(e.key)) void reply(({ y: "yes", n: "no", m: "maybe" } as const)[e.key as "y" | "n" | "m"]);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  if (!status) return <div className="calendar" />;
  const available = status.available;
  const connectors = (
    <>
      <button className="cal-button" disabled={!available.google || !!connecting} title={available.google ? "" : "Not available in this build yet"} onClick={() => void connect("google")}>
        <Icon name="plus" size={14} /> {connecting === "google" ? "Finish in your browser…" : "Google Calendar"}
      </button>
      <button className="cal-button" disabled={!available.microsoft || !!connecting} title={available.microsoft ? "" : "Not available in this build yet"} onClick={() => void connect("microsoft")}>
        <Icon name="plus" size={14} /> {connecting === "microsoft" ? "Finish in your browser…" : "Microsoft 365"}
      </button>
    </>
  );
  if (!status.accounts.length) {
    return (
      <div className="calendar cal-empty">
        <Icon name="calendar" size={28} />
        <h2>Calendar</h2>
        <p>Connect a calendar to see your week, invite people and book time with your team.</p>
        <div>{connectors}</div>
        {available.stand_in && <small>Development: a local stand-in answers, not the real services.</small>}
      </div>
    );
  }

  const waiting = status.waiting.length;
  const middle = days[Math.floor(days.length / 2)] + 12 * 3_600_000;
  const month = new Date(middle).toLocaleDateString([], { timeZone: zone, month: tight ? "short" : "long" });
  const year = new Date(middle).toLocaleDateString([], { timeZone: zone, year: "numeric" });
  const syncNote = `${offline ? "Offline" : status.synced ? `Synced ${clock(status.synced, zone)}` : "Not synced yet"}${waiting > 0 ? ` · ${waiting} waiting to be sent` : ""}`;
  /** The same in few words, for the bar: the whole of it is in the tooltip. */
  const syncShort = waiting > 0 ? `${offline ? "Offline · " : ""}${waiting} waiting` : offline ? "Offline" : status.synced ? `Synced ${clock(status.synced, zone)}` : "Not synced";
  const dayNames = (n: number) => (n === 7 ? "Week" : n === 1 ? "Day" : `${n} days`);
  /** What is shown, said truthfully: "Week" only for a whole week that was asked for. */
  const shownName = fit === 1 ? "Day" : fit === 7 && count === 7 ? "Week" : `${fit} days`;
  const goTo = (day: number) => setAnchor(day + 12 * 3_600_000);
  const sideShown = sideFits ? side : sideOpen;
  const toggleSide = () => (sideFits ? (setSide(!side), keep("side", side ? "0" : "1")) : setSideOpen(!sideOpen));
  const today = dayStart(Date.now(), zone);
  const calendarMenu = (el: HTMLElement, c: CalStatus["calendars"][number]) =>
    pickMenu(el, c.name, [...(c.default ? [] : [["default", "Make default"] as [string, string], null]), [c.hidden ? "show" : "hide", c.hidden ? "Show" : "Hide"], null, ...COLORS.map(([hex, name]): [string, string] => [hex, name])], c.color, (id) =>
      void act("calendar.calendars.set", { account: c.account, calendar: c.id, ...(id === "default" ? { default: true } : id === "hide" || id === "show" ? { hidden: id === "hide" } : { color: id }) }, false),
    );

  const idle = (
    <aside className={`cal-panel cal-idle${wide ? "" : " over"}`} aria-label="Today">
      <header className="cal-panel-bar">
        <b>Today</b>
        <small>{new Date().toLocaleDateString([], { timeZone: zone, weekday: "long", day: "numeric", month: "long" })}</small>
        {!wide && (
          <button className="cal-icon" title={`Close (${formatKeys("Escape")})`} onClick={() => setDayOpen(false)}>
            <Icon name="close" size={14} />
          </button>
        )}
      </header>
      <div className="cal-panel-body">
        <section className="cal-group">
          {briefing.events.length === 0 && <p className="cal-none">Nothing on the calendar today.</p>}
          {briefing.events.map((e) => (
            <button key={e.key} className="cal-item" style={{ "--c": colorOf(e) } as React.CSSProperties} title={e.title} onClick={() => (goTo(today), select(e.key), setDayOpen(false))}>
              <time>{e.all_day ? "All day" : clock(e.start, zone)}</time>
              <i />
              <span>
                <b>{e.title || "(No title)"}</b>
                <small>{[e.all_day ? "" : span(e.start, e.end), e.guests.length ? `${e.guests.length} ${e.guests.length === 1 ? "guest" : "guests"}` : "", e.meeting ? (e.meeting.kind === "teams" ? "Teams" : "Meet") : ""].filter(Boolean).join(" · ")}</small>
              </span>
            </button>
          ))}
          {briefing.events.length > 0 && <p className="cal-none">{briefing.text.split("\n")[0].replace(/^[^:]*: /, "").replace(/^./, (c) => c.toUpperCase())}</p>}
        </section>
        <section className="cal-group cal-keys">
          <h3>Shortcuts</h3>
          {(
            [
              ["New event", "C"],
              ["Find a time", "F"],
              ["Go to today", "T"],
              ["Earlier, later", "K  J"],
              ["Days shown", "1 – 9"],
              ["Send invite or update", formatKeys("Mod-Enter")],
              ["Meeting note", "O"],
            ] as const
          ).map(([name, key]) => (
            <div key={name}>
              <span>{name}</span>
              <kbd>{key}</kbd>
            </div>
          ))}
        </section>
      </div>
    </aside>
  );

  return (
    <div className="calendar" ref={setRootEl}>
      {!sideFits && sideOpen && <div className="cal-scrim" onMouseDown={() => setSideOpen(false)} />}
      <aside className={`cal-side${sideShown ? "" : " away"}${sideFits ? "" : " over"}`} aria-hidden={!sideShown} aria-label="Calendars">
        <MiniMonth zone={zone} shown={days} onPick={goTo} />
        <div className="cal-side-scroll">
          {status.accounts.map((a) => (
            <section key={a.id} className="cal-account">
              <div className="cal-account-name">
                <span title={`${a.name ? `${a.name} · ` : ""}${a.email}`}>{a.email}</span>
                <button className="cal-icon" title="Disconnect this account" onClick={() => void act("calendar.account.remove", { account: a.id }, false)}>
                  <Icon name="close" size={12} />
                </button>
              </div>
              {!a.signed_in && (
                <button className="cal-button cal-signin" disabled={!!connecting} title={`Signed out of ${a.email}. Sign in again in your browser.`} onClick={() => void connect(a.provider)}>
                  {connecting === a.provider ? "Finish in your browser…" : "Sign in again"}
                </button>
              )}
              {status.calendars
                .filter((c) => c.account === a.id)
                .map((c) => (
                  <div key={c.id} className={`cal-calendar${c.hidden ? " off" : ""}`}>
                    <button className="cal-check" role="checkbox" aria-checked={!c.hidden} aria-label={`Show ${c.name}`} style={{ "--c": c.color } as React.CSSProperties} title={c.hidden ? "Show" : "Hide"} onClick={() => void act("calendar.calendars.set", { account: a.id, calendar: c.id, hidden: !c.hidden }, false)}>
                      {!c.hidden && <Icon name="check" size={10} />}
                    </button>
                    {/* The account's own calendar is named after it; its name is already written above. */}
                    <span title={c.name === a.email || c.name === a.name ? `My calendar (${a.email})` : c.name}>{c.name === a.email || c.name === a.name ? "My calendar" : c.name}</span>
                    {c.default && <small>Default</small>}
                    <button className="cal-icon" title="Default, colour, hide" aria-haspopup="menu" onClick={(ev) => calendarMenu(ev.currentTarget, c)}>
                      <Icon name="more" size={14} />
                    </button>
                  </div>
                ))}
            </section>
          ))}
          <Pick
            actions
            icon="plus"
            value=""
            disabled={!!connecting}
            label={connecting ? "Finish in your browser…" : "Add calendar account"}
            title="Add calendar account"
            options={[...(available.google ? [["google", "Google Calendar"] as [string, string]] : []), ...(available.microsoft ? [["microsoft", "Microsoft 365"] as [string, string]] : [])]}
            onChange={(provider) => void connect(provider as "google" | "microsoft")}
          />

          {members.length > 0 && (
            <section>
              <h3>Team</h3>
              {members.map((m) => (
                <button
                  key={m.member}
                  className={`cal-person${shownMembers.includes(m.member) ? " on" : ""}`}
                  draggable={!m.emails.some((e) => mine.has(e))}
                  aria-pressed={shownMembers.includes(m.member)}
                  title={`${m.member}\nClick to show when they are busy. Drag onto the week to book time with them.`}
                  onDragStart={(ev) => ev.dataTransfer.setData("text/lokus-guest", m.member)}
                  onClick={() => setShownMembers((s) => (s.includes(m.member) ? s.filter((x) => x !== m.member) : [...s, m.member]))}
                >
                  <span>{m.name || m.member}</span>
                  <small>
                    {m.emails.some((e) => mine.has(e)) ? "You · " : ""}
                    {age(m.age_minutes)}
                  </small>
                </button>
              ))}
            </section>
          )}

          <section>
            <h3>Colleagues</h3>
            {people.map((email) => {
              const found = busy.find((b) => b.email === email);
              return (
                <div key={email} className="cal-person on" title={found && !found.known ? `${email}\nTheir calendar is not visible to you.` : email}>
                  <span className={found && !found.known ? "unknown" : ""}>{email}</span>
                  <button className="cal-icon" title="Stop showing" onClick={() => (setPeople(people.filter((p) => p !== email)), keep("people", JSON.stringify(people.filter((p) => p !== email))))}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
              );
            })}
            <input className="cal-add" value={person} placeholder="Add a colleague by email" title="Show a colleague's busy times" aria-label="Show a colleague's busy times" onChange={(e) => setPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} onBlur={addPerson} />
          </section>

          <button className="cal-pick" onClick={() => void findTime(slots?.minutes ?? 30)}>
            <Icon name="search" size={14} />
            <span>Find a time</span>
            <kbd>F</kbd>
          </button>
          {slots && (
            <div className="cal-slots">
              <div className="segmented">
                {[30, 45, 60].map((m) => (
                  <button key={m} className={slots.minutes === m ? "active" : ""} onClick={() => void findTime(m)}>
                    {m} min
                  </button>
                ))}
                <button className="cal-icon" title="Close" onClick={() => setSlots(null)}>
                  <Icon name="close" size={12} />
                </button>
              </div>
              {slots.found === null && <small>Looking…</small>}
              {slots.found?.length === 0 && <small>Nobody is free together this week.</small>}
              {slots.found?.map((s) => (
                <button key={s.start} title={s.local} onClick={() => (setAnchor(Date.parse(s.start)), startDraft(s.start, s.end), setDraft((d) => d && { ...d, guests: [...people, ...shownMembers].map((email) => ({ email, name: "", optional: false, reply: "needsAction" })) }))}>
                  {s.local}
                </button>
              ))}
              {slots.unknown.length > 0 && <small>Could not see: {slots.unknown.join(", ")}</small>}
            </div>
          )}
          {available.stand_in && <small className="cal-standin">Development: a local stand-in answers, not the real services.</small>}
        </div>
      </aside>

      <section className="cal-main" ref={setMainEl}>
        <header className="cal-bar">
          <button className="cal-icon" title={sideShown ? "Hide the calendar list" : "Show the calendar list"} aria-expanded={sideShown} onClick={toggleSide}>
            <Icon name="sidebar" size={16} />
          </button>
          <h2 title={`${month} ${year}`}>
            {month}
            {tight < 3 && <span> {year}</span>}
          </h2>
          <span className="cal-spacer" />
          {tight >= 2 && !waiting && !offline ? (
            <span className={`cal-sync${offline || waiting ? " waiting" : ""}`} role="status" tabIndex={0} title={syncNote} aria-label={syncNote} />
          ) : (
            <small className={`cal-status${offline || waiting ? " waiting" : ""}`} role="status" title={syncNote}>
              {syncShort}
            </small>
          )}
          {!wide && !current && (
            <button className="cal-icon" title="Today's events and shortcuts" aria-expanded={dayOpen} onClick={() => setDayOpen(!dayOpen)}>
              <Icon name="overview" size={16} />
            </button>
          )}
          <Pick
            outlined
            value={String(count)}
            label={shownName}
            title={fit < count ? `Days shown (press 1 to 9). ${dayNames(count)} is chosen; ${fit} fit in this window.` : "Days shown (press 1 to 9)"}
            options={[...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): [string, string] => [String(n), `${dayNames(n)}`]), ...(tight >= 3 ? [null, ["today", "Go to today"] as [string, string]] : [])]}
            onChange={(v) => (v === "today" ? setAnchor(Date.now()) : (setCount(Number(v)), keep("days", v)))}
          />
          <ZonePick outlined value={zone} label={offsetName(zone)} title={`Time zone: ${zone.replace(/_/g, " ")}`} onChange={(v) => (setZone(v), keep("zone", v))} />
          {tight < 3 && (
            <button className="cal-button" title="Go to today (T)" onClick={() => setAnchor(Date.now())}>
              Today
            </button>
          )}
          <span className="cal-steps">
            <button className="cal-icon" title="Earlier (K)" onClick={() => setAnchor(addDays(from, -turn, zone))}>
              <Icon name="back" size={16} />
            </button>
            <button className="cal-icon" title="Later (J)" onClick={() => setAnchor(addDays(from, turn, zone))}>
              <Icon name="chevron" size={16} />
            </button>
          </span>
          <button className="primary" title="New event (C)" aria-label="New event" onClick={() => keys.current(new KeyboardEvent("keydown", { key: "c" }))}>
            {tight >= 2 ? <Icon name="plus" size={16} /> : "New"}
            {!tight && <kbd>C</kbd>}
          </button>
        </header>
        <Grid days={days} zone={zone} zoneLabel={offsetName(zone, days[0])} events={shown} selected={selected} overlays={overlays} colorOf={colorOf} onSelect={select} onNew={startDraft} onMove={(e, start, end) => void act("calendar.event.update", { key: e.key, scope: "this", start, end })} />
      </section>

      {current ? (
        <EventPanel
          key={current.key}
          event={current}
          draft={selected === DRAFT}
          accounts={status.accounts}
          calendars={status.calendars}
          zone={zone}
          scope={scope}
          onScope={setScope}
          onChange={change}
          onCreate={() => void create()}
          sending={sending}
          onRetry={() => void act("calendar.event.retry", { key: current.key })}
          onSend={(notify) => void act("calendar.event.send", { key: current.key, notify })}
          onDiscard={() => void act("calendar.event.discard", { key: current.key }, false)}
          onDelete={(notify) => void remove(notify)}
          deleting={deleting}
          onKeep={() => setDeleting(false)}
          noteAsk={noteAsk}
          onReply={(answer) => void reply(answer)}
          replying={answering}
          onNote={(shared) => void note(shared)}
          onBlock={(account) => void act("calendar.block", { key: current.key, account }).then((made) => made && onNotice("Blocked as Busy on the other calendar."))}
          onClose={() => select(null)}
          over={!beside}
        />
      ) : (
        (wide || dayOpen) && idle
      )}
    </div>
  );
}

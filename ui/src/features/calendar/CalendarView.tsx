/** @part-of ui.calendar */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onCalendarSynced, runCalendar, syncCalendar, type CalBusy, type CalEvent, type CalMember, type CalSlot, type CalStatus } from "../../bridge/calendar";
import { Icon } from "../../shell/Icon";
import { EventPanel, type Scope } from "./EventPanel";
import { Grid, type Overlay } from "./Grid";
import { addDays, age, clock, dayStart, localZone, offsetName, stamp, weekday, ZONES } from "./time";
import "./calendar.css";

const PEOPLE = ["#b266d9", "#e2674a", "#3aa675", "#d9a400", "#4f7cff"];
const DRAFT = "draft";
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
  const [briefing, setBriefing] = useState("");
  const [offline, setOffline] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ minutes: number; found: CalSlot[] | null; unknown: string[] } | null>(null);
  const [person, setPerson] = useState("");

  const days = useMemo(() => {
    const day = dayStart(anchor, zone);
    // A whole week starts on Monday; fewer days start on the day in view.
    const first = count === 7 ? addDays(day, -((weekday(day + 3_600_000 * 12, zone) + 6) % 7), zone) : day;
    return Array.from({ length: count }, (_, i) => addDays(first, i, zone));
  }, [anchor, count, zone]);
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
      setBriefing((await runCalendar<{ text: string }>("calendar.briefing", { zone })).text);
      // The open folder may not be a team's, or there may be none: then nobody is listed.
      setMembers(await runCalendar<{ members: CalMember[] }>("calendar.team").then((t) => t.members, () => []));
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  useEffect(() => void refresh(), [refresh, from, to, zone]);
  useEffect(() => onCalendarSynced((changed, off) => (setOffline(off), changed && void refresh())), [refresh]);
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

  const select = (key: string | null) => {
    setSelected(key);
    setScope("this");
    if (key !== DRAFT) setDraft(null);
  };

  const startDraft = (start: string, end: string, guest?: string) => {
    const home = status?.calendars.find((c) => c.default) ?? status?.calendars[0];
    if (!home) return;
    const member = members.find((m) => m.member === guest);
    setDraft({
      key: DRAFT, account: home.account, calendar: home.id, id: DRAFT, title: "", start, end, all_day: false, zone, location: "", description: "",
      guests: guest ? [{ email: guest, name: member?.name ?? "", optional: false, reply: "needsAction" }] : [],
      organizer: "", mine: true, reply: "", meeting: null, want_meeting: false, repeat: null, series: null, link: "", pending: false, unsent: false, changes: [], queued: false, error: null, note: null,
    });
    setSelected(DRAFT);
  };

  /** Do something to the calendar, show what it left, and send it on if it is not being held. */
  const act = async (name: string, args: Record<string, unknown>, send = true): Promise<CalEvent | null> => {
    try {
      const done = await runCalendar<{ event?: CalEvent | null }>(name, args);
      await refresh();
      if (send && !done.event?.pending && !done.event?.unsent) syncCalendar();
      return done.event ?? null;
    } catch (e) {
      fail(e);
      return null;
    }
  };

  const change = (fields: Record<string, unknown>) => {
    if (selected === DRAFT && draft) {
      const { meeting, repeat, ...rest } = fields;
      return setDraft({ ...draft, ...(rest as Partial<CalEvent>), ...(meeting === undefined ? {} : { want_meeting: !!meeting }), ...(repeat === undefined ? {} : { repeat: (repeat as string) || null }) });
    }
    if (current) void act("calendar.event.update", { key: current.key, scope, ...fields });
  };
  const create = async () => {
    if (!draft) return;
    const made = await act("calendar.event.create", {
      account: draft.account, calendar: draft.calendar, title: draft.title, start: draft.start, end: draft.end, zone: draft.zone, location: draft.location,
      description: draft.description, guests: draft.guests, meeting: draft.want_meeting, repeat: draft.repeat ?? "", send: true,
    });
    if (made) select(null);
  };
  const remove = async () => {
    if (!current || selected === DRAFT) return select(null);
    await act("calendar.event.delete", { key: current.key, scope });
    select(null);
  };
  const note = async () => {
    if (!current) return;
    try {
      onOpen((await runCalendar<{ path: string }>("calendar.note", { key: current.key, zone })).path);
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

  // Keys act on the calendar only while nothing is being typed.
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e) => {
    const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") || !e.target.closest(".calendar, body"));
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      (document.activeElement as HTMLElement | null)?.blur();
      if (selected === DRAFT) void create();
      else if (current?.pending || current?.unsent) void act("calendar.event.send", { key: current.key, notify: true });
      return e.preventDefault();
    }
    if (e.key === "Escape" && typing) return (document.activeElement as HTMLElement | null)?.blur();
    if (e.key === "Escape" && selected) return select(null);
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".palette, [role=dialog]")) return;
    const step = (by: number) => setAnchor(addDays(dayStart(anchor, zone), by * count, zone));
    if (/^[1-9]$/.test(e.key)) (setCount(Number(e.key)), keep("days", e.key));
    else if (e.key === "t") setAnchor(Date.now());
    else if (e.key === "j" || e.key === "ArrowRight") step(1);
    else if (e.key === "k" || e.key === "ArrowLeft") step(-1);
    else if (e.key === "c") {
      const start = Math.ceil(Date.now() / 1_800_000) * 1_800_000;
      startDraft(stamp(start), stamp(start + 1_800_000));
    } else if (e.key === "f") void findTime(30);
    else if (current && selected !== DRAFT && e.key === "n") void note();
    else if (current && selected !== DRAFT && current.mine && e.key === "Backspace") void remove();
    else if (current && !current.mine && "ynm".includes(e.key)) void act("calendar.event.reply", { key: current.key, scope, reply: { y: "yes", n: "no", m: "maybe" }[e.key] });
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
      <button className="cal-action" disabled={!available.google || !!connecting} title={available.google ? "" : "Not available in this build yet"} onClick={() => void connect("google")}>
        <Icon name="plus" size={14} /> {connecting === "google" ? "Finish in your browser…" : "Google Calendar"}
      </button>
      <button className="cal-action" disabled={!available.microsoft || !!connecting} title={available.microsoft ? "" : "Not available in this build yet"} onClick={() => void connect("microsoft")}>
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
  const title = new Date(days[Math.floor(days.length / 2)] + 12 * 3_600_000).toLocaleDateString([], { timeZone: zone, month: "long", year: "numeric" });
  return (
    <div className="calendar">
      <aside className="cal-side">
        <h3>Calendars</h3>
        {status.accounts.map((a) => (
          <div key={a.id} className="cal-account">
            <div className="cal-account-name">
              <span title={a.signed_in ? a.email : "Signed out: connect it again"}>{a.email}</span>
              <button className="cal-icon" title="Disconnect this account" onClick={() => void act("calendar.account.remove", { account: a.id }, false)}>
                <Icon name="close" size={12} />
              </button>
            </div>
            {!a.signed_in && <small className="cal-error">Signed out. Connect it again.</small>}
            {status.calendars
              .filter((c) => c.account === a.id)
              .map((c) => (
                <div key={c.id} className={`cal-calendar${c.hidden ? " off" : ""}`}>
                  <button className="cal-check" style={{ "--c": c.color } as React.CSSProperties} title={c.hidden ? "Show" : "Hide"} onClick={() => void act("calendar.calendars.set", { account: a.id, calendar: c.id, hidden: !c.hidden }, false)} />
                  <span>{c.name}</span>
                  {c.default ? <small>default</small> : <button className="link" onClick={() => void act("calendar.calendars.set", { account: a.id, calendar: c.id, default: true }, false)}>Make default</button>}
                  <input type="color" title="Colour" value={c.color} onChange={(ev) => void act("calendar.calendars.set", { account: a.id, calendar: c.id, color: ev.target.value }, false)} />
                </div>
              ))}
          </div>
        ))}
        {connectors}

        {members.length > 0 && (
          <>
            <h3>Team</h3>
            {members.map((m) => (
              <button
                key={m.member}
                className={`cal-person${shownMembers.includes(m.member) ? " on" : ""}`}
                draggable={!m.emails.some((e) => mine.has(e))}
                title="Click to show when they are busy. Drag onto the week to book time with them."
                onDragStart={(ev) => ev.dataTransfer.setData("text/lokus-guest", m.member)}
                onClick={() => setShownMembers((s) => (s.includes(m.member) ? s.filter((x) => x !== m.member) : [...s, m.member]))}
              >
                <span>{m.name || m.member}</span>
                <small>{m.emails.some((e) => mine.has(e)) ? "you · " : ""}synced {age(m.age_minutes)}</small>
              </button>
            ))}
          </>
        )}

        <h3>Colleagues</h3>
        {people.map((email) => {
          const found = busy.find((b) => b.email === email);
          return (
            <div key={email} className="cal-person on">
              <span>{email}</span>
              {found && !found.known && <small>calendar not visible to you</small>}
              <button className="cal-icon" title="Stop showing" onClick={() => (setPeople(people.filter((p) => p !== email)), keep("people", JSON.stringify(people.filter((p) => p !== email))))}>
                <Icon name="close" size={12} />
              </button>
            </div>
          );
        })}
        <input className="cal-add" value={person} placeholder="Show a colleague's busy times" onChange={(e) => setPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} onBlur={addPerson} />

        <button className="cal-action" onClick={() => void findTime(slots?.minutes ?? 30)}>
          <Icon name="search" size={14} /> Find a time <kbd>F</kbd>
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
              <button key={s.start} onClick={() => (setAnchor(Date.parse(s.start)), startDraft(s.start, s.end), setDraft((d) => d && { ...d, guests: [...people, ...shownMembers].map((email) => ({ email, name: "", optional: false, reply: "needsAction" })) }))}>
                {s.local}
              </button>
            ))}
            {slots.unknown.length > 0 && <small>Could not see: {slots.unknown.join(", ")}</small>}
          </div>
        )}
      </aside>

      <section className="cal-main">
        <header className="cal-bar">
          <h2>{title}</h2>
          <button className="cal-action" onClick={() => setAnchor(Date.now())}>
            Today <kbd>T</kbd>
          </button>
          <button className="cal-icon" title="Earlier (K)" onClick={() => setAnchor(addDays(dayStart(anchor, zone), -count, zone))}>
            <Icon name="left" size={14} />
          </button>
          <button className="cal-icon" title="Later (J)" onClick={() => setAnchor(addDays(dayStart(anchor, zone), count, zone))}>
            <Icon name="right" size={14} />
          </button>
          <span className="cal-spacer" />
          <small className={offline || waiting ? "cal-waiting" : ""}>
            {offline ? "Offline" : status.synced ? `Synced ${clock(status.synced, zone)}` : ""}
            {waiting > 0 && ` · ${waiting} waiting to be sent`}
          </small>
          <select title="Days shown (press 1 to 9)" value={count} onChange={(e) => (setCount(Number(e.target.value)), keep("days", e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n === 7 ? "Week" : n === 1 ? "Day" : `${n} days`} ({n})
              </option>
            ))}
          </select>
          <select title="Time zone the week is shown in" value={zone} onChange={(e) => (setZone(e.target.value), keep("zone", e.target.value))}>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")} ({offsetName(z)})
              </option>
            ))}
          </select>
          <button className="primary" onClick={() => keys.current(new KeyboardEvent("keydown", { key: "c" }))}>
            New <kbd>C</kbd>
          </button>
        </header>
        <Grid days={days} zone={zone} events={shown} selected={selected} overlays={overlays} colorOf={colorOf} onSelect={select} onNew={startDraft} onMove={(e, start, end) => void act("calendar.event.update", { key: e.key, scope: "this", start, end })} />
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
          onSend={(notify) => void act("calendar.event.send", { key: current.key, notify })}
          onDiscard={() => void act("calendar.event.discard", { key: current.key }, false)}
          onDelete={() => void remove()}
          onReply={(reply) => void act("calendar.event.reply", { key: current.key, scope, reply })}
          onNote={() => void note()}
          onBlock={(account) => void act("calendar.block", { key: current.key, account }).then((made) => made && onNotice("Blocked as Busy on the other calendar."))}
          onClose={() => select(null)}
        />
      ) : (
        <aside className="cal-panel cal-briefing">
          <h3>Today</h3>
          {briefing.split("\n").map((line, i) => (i === 0 ? <p key={i}>{line}</p> : <p key={i} className="cal-line">{line.replace(/^- /, "")}</p>))}
          <small>Drag on the week to make an event. Press 1 to 9 for that many days.</small>
        </aside>
      )}
    </div>
  );
}

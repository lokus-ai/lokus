/** @part-of ui.calendar */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CalAccount, CalCalendar, CalEvent, CalGuest } from "../../bridge/calendar";
import { openWeb } from "../../bridge/updates";
import { formatKeys } from "../../shell/commands";
import { Icon, type IconName } from "../../shell/Icon";
import { pickMenu } from "./menu";
import { MiniMonth } from "./MiniMonth";
import { Pick } from "./Pick";
import { ZonePick } from "./ZonePick";
import { addDays, addMinutes, clock, DAY, dateOf, dayStart, instant, minuteOfDay, offsetName, repeatChoices, span, stamp, typedClock } from "./time";

export type Scope = "this" | "all";

interface Props {
  event: CalEvent;
  /** Not made yet: nothing has been sent anywhere. */
  draft: boolean;
  accounts: CalAccount[];
  calendars: CalCalendar[];
  zone: string;
  scope: Scope;
  onScope: (scope: Scope) => void;
  onChange: (fields: Record<string, unknown>) => void;
  onCreate: () => void;
  /** The draft is on its way: it cannot be sent a second time. */
  sending: boolean;
  /** Try a refused change again. */
  onRetry: () => void;
  onSend: (notify: boolean) => void;
  onDiscard: () => void;
  /** Delete; `notify` is the answer once the panel has asked about the guests. */
  onDelete: (notify?: boolean) => void;
  /** Delete was asked for and the guests would be emailed: ask once. */
  deleting: boolean;
  onKeep: () => void;
  /** What to say before a meeting note is written into a folder that syncs to a team. */
  noteAsk: string | null;
  onReply: (answer: "yes" | "no" | "maybe") => void;
  /** A reply is on its way: the buttons wait for it. */
  replying: boolean;
  onNote: (shared?: boolean) => void;
  onBlock: (account: string) => void;
  onClose: () => void;
  /** No room beside the week: the panel lies over it instead of squeezing it. */
  over: boolean;
}

/** A text field that keeps what is typed until it is left, then hands it on once. `grow` wraps and is as tall as its text. */
function Text({ value, placeholder, onCommit, className, focus, grow, label }: { value: string; placeholder: string; onCommit: (v: string) => void; className?: string; focus?: boolean; grow?: boolean; label?: string }) {
  const [text, setText] = useState(value);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (focus) field.current?.focus();
  }, [focus]);
  useLayoutEffect(() => {
    const el = field.current;
    if (!grow || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [grow, text]);
  const props = {
    ref: field,
    className,
    value: text,
    placeholder,
    "aria-label": label ?? placeholder,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: () => text !== value && onCommit(text),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), (e.target as HTMLElement).blur());
    },
  };
  return grow ? <textarea rows={1} {...props} /> : <input {...props} />;
}

/** One property of the event: its icon, then what it is. */
function Row({ icon, children, top }: { icon?: IconName; children: React.ReactNode; top?: boolean }) {
  return (
    <div className={`cal-row${top ? " top" : ""}`}>
      <span className="cal-row-icon">{icon && <Icon name={icon} size={16} />}</span>
      {children}
    </div>
  );
}

const REPLY: Record<string, string> = { accepted: "Going", declined: "Not going", tentative: "Maybe", needsAction: "No answer yet" };
const LABEL: Record<string, string> = { title: "title", time: "time", location: "place", description: "notes", guests: "guests", meeting: "meeting link", repeat: "repeat" };
const HUES = ["#4f7cff", "#b266d9", "#e2674a", "#3aa675", "#d9a400", "#2a9d9d"];
const hue = (text: string) => HUES[[...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];
const initial = (g: { name: string; email: string }) => (g.name || g.email).trim().charAt(0).toUpperCase();

/** The event on the right: every part is edited where it stands. */
export function EventPanel(p: Props) {
  const e = p.event;
  const account = p.accounts.find((a) => a.id === e.account);
  const calendar = p.calendars.find((c) => c.account === e.account && c.id === e.calendar);
  const meetingName = account?.provider === "microsoft" ? "Teams meeting" : "Google Meet";
  const can = e.mine;
  const repeating = !!(e.series || e.repeat) && !p.draft;
  const others = p.accounts.filter((a) => a.id !== e.account);
  const [guest, setGuest] = useState("");
  const [dating, setDating] = useState(false);
  const told = e.guests.filter((g) => g.email !== account?.email).length;
  const guests = (next: CalGuest[]) => p.onChange({ guests: next.map((g) => ({ email: g.email, name: g.name, optional: g.optional })) });
  const addGuest = () => {
    const email = guest.trim().toLowerCase();
    setGuest("");
    if (!email.includes("@") || e.guests.some((g) => g.email === email)) return;
    guests([...e.guests, { email, name: "", optional: false, reply: "needsAction" }]);
  };
  const [start, end] = [Date.parse(e.start), Date.parse(e.end)];
  /** A typed time: the start keeps the length; an end before the start is the next day's. */
  const time = (which: "start" | "end", typed: string) => {
    const minutes = typedClock(typed);
    if (minutes === null) return;
    if (which === "start") {
      const at = addMinutes(dayStart(start, p.zone), minutes, p.zone);
      return at !== start && p.onChange({ start: stamp(at), end: stamp(at + end - start) });
    }
    // An event longer than a day keeps its last day; a shorter one ends on the start's day or the next.
    let at = addMinutes(dayStart(end - start > DAY ? end - 1 : start, p.zone), minutes, p.zone);
    if (at <= start) at = addDays(at, 1, p.zone);
    if (at !== end) p.onChange({ end: stamp(at) });
  };
  /** To a whole day and back: the day it is on stays; back, it is half an hour at nine. */
  const allDay = () => {
    if (e.all_day) {
      const at = addMinutes(dayStart(instant(start + DAY / 2, p.zone), p.zone), 9 * 60, p.zone);
      return p.onChange({ all_day: false, start: stamp(at), end: stamp(at + 30 * 60_000) });
    }
    const first = Date.parse(`${dateOf(start, p.zone)}T00:00:00Z`);
    const last = Date.parse(`${dateOf(Math.max(start, end - 1), p.zone)}T00:00:00Z`);
    p.onChange({ all_day: true, start: stamp(first), end: stamp(last + DAY) });
  };
  const date = (day: number) => {
    setDating(false);
    // A whole-day event is kept as midnight UTC of its date, whatever the zone.
    const at = e.all_day ? Date.parse(`${dateOf(day + DAY / 2, p.zone)}T00:00:00Z`) : addMinutes(day, minuteOfDay(start, p.zone), p.zone);
    if (at !== start) p.onChange({ start: stamp(at), end: stamp(at + end - start) });
  };
  const dayName = (at: number) => new Date(at).toLocaleDateString([], { timeZone: e.all_day ? "UTC" : p.zone, weekday: "short", month: "short", day: "numeric", year: new Date(at).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  // A whole-day event over several days names its first and last day.
  const dateName = e.all_day && end - start > DAY ? `${dayName(start)} → ${dayName(end - DAY)}` : dayName(start);
  // An event with no zone of its own (or plain UTC, as providers hand them over) is in the zone the week is shown in.
  const own = e.zone && e.zone !== "UTC" && offsetName(e.zone, Date.parse(e.start)) !== offsetName(p.zone, Date.parse(e.start));
  const zoneOf = own ? e.zone : p.zone;
  const zoneName = (z: string, at: number) => `${offsetName(z, at)} ${z.split("/").pop()!.replace(/_/g, " ")}`;
  const repeatName = e.series && !e.repeat ? "Part of a repeating event" : (repeatChoices(e.repeat).find(([rule]) => rule === (e.repeat ?? ""))?.[1] ?? "");

  return (
    <aside className={`cal-panel${p.over ? " over" : ""}`} aria-label={p.draft ? "New event" : "Event"}>
      <header className="cal-panel-bar">
        <b>{p.draft ? "New event" : "Event"}</b>
        <button className="cal-icon" title={`Close (${formatKeys("Escape")})`} onClick={p.onClose}>
          <Icon name="close" size={14} />
        </button>
      </header>

      <div className="cal-panel-body">
        {can ? <Text grow className="cal-title" value={e.title} placeholder="Title" focus={p.draft} onCommit={(title) => p.onChange({ title })} /> : <h2 className="cal-title">{e.title || "(No title)"}</h2>}
        {e.error && (
          <div className="cal-refused" role="alert">
            <small>{/[.!?]$/.test(e.error) && e.error.length < 90 && !/[{}<>]/.test(e.error) ? e.error : "The provider did not accept this change."}</small>
            <div>
              <button className="cal-button" onClick={p.onRetry}>
                Retry
              </button>
              <button className="link" onClick={p.onDiscard}>
                Discard
              </button>
            </div>
          </div>
        )}
        {e.queued && !e.error && <p className="cal-waiting">Waiting to be sent to {account?.provider === "microsoft" ? "Microsoft 365" : "Google Calendar"}.</p>}

        {repeating && (
          <div className="segmented cal-scope" title="What a change, a reply or a delete applies to">
            <button className={p.scope === "this" ? "active" : ""} onClick={() => p.onScope("this")}>
              This event
            </button>
            <button className={p.scope === "all" ? "active" : ""} onClick={() => p.onScope("all")}>
              All events
            </button>
          </div>
        )}

        <section className="cal-group">
          <Row icon="clock">
            {e.all_day ? (
              <span className="cal-value">{end - start > DAY ? `All day · ${span(e.start, e.end)}` : "All day"}</span>
            ) : can ? (
              <span className="cal-times">
                <Text key={`s${e.start}${p.zone}`} className="cal-time" label="Starts" value={clock(e.start, p.zone)} placeholder="Start" onCommit={(v) => time("start", v)} />
                <Icon name="right" size={14} />
                <Text key={`e${e.end}${p.zone}`} className="cal-time" label="Ends" value={clock(e.end, p.zone)} placeholder="End" onCommit={(v) => time("end", v)} />
                <small>{span(e.start, e.end)}</small>
              </span>
            ) : (
              <span className="cal-times">
                <span className="cal-value">{clock(e.start, p.zone)}</span>
                <Icon name="right" size={14} />
                <span className="cal-value">{clock(e.end, p.zone)}</span>
                <small>{span(e.start, e.end)}</small>
              </span>
            )}
          </Row>
          <Row>
            {can ? (
              <button className="cal-pick" aria-expanded={dating} title="Change the day" onClick={() => setDating(!dating)}>
                <span>{dateName}</span>
              </button>
            ) : (
              <span className="cal-value">{dateName}</span>
            )}
          </Row>
          {can && (
            <Row>
              <button className="cal-switch" role="switch" aria-checked={e.all_day} title="The event takes the whole day" onClick={allDay}>
                <i />
                <span>All day</span>
              </button>
            </Row>
          )}
          {dating && (
            <div className="cal-date">
              <MiniMonth zone={p.zone} shown={[]} picked={dayStart(e.all_day ? instant(start + DAY / 2, p.zone) : start, p.zone)} onPick={date} />
            </div>
          )}
          {can && !e.all_day && (
            <Row icon="globe">
              <ZonePick value={zoneOf} label={zoneName(zoneOf, start)} at={start} title={own ? `Made in ${e.zone.replace(/_/g, " ")}; the times above are in ${p.zone.replace(/_/g, " ")}` : "The event's time zone"} onChange={(zone) => p.onChange({ zone })} />
            </Row>
          )}
          {(can || repeating) && (
            <Row icon="repeat">
              {can ? (
                <Pick value={e.repeat ?? ""} disabled={!!e.series && p.scope === "this"} label={repeatName} title="How it repeats" options={repeatChoices(e.repeat).map(([rule, name]) => [rule, name])} onChange={(repeat) => p.onChange({ repeat })} />
              ) : (
                <span className="cal-value">{repeatName}</span>
              )}
            </Row>
          )}
          {!can && (
            <Row icon="account">
              <span className="cal-value" title={e.organizer}>
                Organised by {e.organizer}
              </span>
            </Row>
          )}
        </section>

        {!can && (
          <div className="cal-reply" role="group" aria-label="Going?">
            {(["yes", "no", "maybe"] as const).map((answer) => {
              const on = e.reply === { yes: "accepted", no: "declined", maybe: "tentative" }[answer];
              return (
                <button key={answer} className={on ? "active" : ""} aria-pressed={on} disabled={p.replying} onClick={() => p.onReply(answer)}>
                  {answer[0].toUpperCase() + answer.slice(1)} <kbd>{answer[0].toUpperCase()}</kbd>
                </button>
              );
            })}
          </div>
        )}

        <section className="cal-group">
          {e.guests.map((g) => (
            <div key={g.email} className="cal-guest" tabIndex={can ? 0 : undefined} title={`${g.name ? `${g.name} · ` : ""}${g.email} · ${REPLY[g.reply] ?? g.reply}`}>
              <span className="cal-avatar" style={{ "--c": hue(g.email) } as React.CSSProperties}>
                {initial(g)}
              </span>
              <i className={`cal-answer ${g.reply}`} role="img" aria-label={REPLY[g.reply] ?? g.reply}>
                {g.reply === "accepted" ? <Icon name="check" size={8} /> : g.reply === "declined" ? <Icon name="close" size={8} /> : g.reply === "tentative" ? "?" : null}
              </i>
              <span className="cal-guest-name">
                <span>{g.name || g.email}</span>
                {g.optional && <small>Optional</small>}
              </span>
              {g.reply !== "needsAction" && <small className="cal-guest-reply">{REPLY[g.reply] ?? g.reply}</small>}
              {can && (
                <>
                  <button className="link" onClick={() => guests(e.guests.map((x) => (x.email === g.email ? { ...x, optional: !x.optional } : x)))}>
                    {g.optional ? "Required" : "Optional"}
                  </button>
                  <button className="cal-icon" title="Remove guest" onClick={() => guests(e.guests.filter((x) => x.email !== g.email))}>
                    <Icon name="close" size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
          {can && (
            <Row icon="person">
              <input className="cal-add" value={guest} placeholder="Add guest by email" aria-label="Add guest by email" onChange={(ev) => setGuest(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && addGuest()} onBlur={addGuest} />
            </Row>
          )}
          {(e.pending || e.unsent) && !p.draft && (
            <div className="cal-pending" role="status">
              <small>{e.unsent ? "Invitation not sent. Guests have not been told." : `Pending changes: ${e.changes.map((c) => LABEL[c] ?? c).join(", ")}. Guests have not been told.`}</small>
              <div className="cal-split">
                <button className="primary" onClick={() => p.onSend(true)}>
                  {e.unsent ? "Send invite" : "Send update"} <kbd>{formatKeys("Mod-Enter")}</kbd>
                </button>
                <button
                  className="primary"
                  title="Other ways to finish"
                  aria-label="Other ways to finish"
                  aria-haspopup="menu"
                  onClick={(ev) =>
                    pickMenu(ev.currentTarget, "Pending changes", [["quiet", e.unsent ? "Save without email" : "Update without email"], null, ["discard", e.unsent ? "Discard invitation" : "Discard changes"]], null, (id) => (id === "quiet" ? p.onSend(false) : p.onDiscard()))
                  }
                >
                  <Icon name="down" size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="cal-group">
          <Row icon="video">
            {e.meeting ? (
              <>
                <button className="cal-pick join" title={e.meeting.url} onClick={() => openWeb(e.meeting!.url)}>
                  <span>Join {e.meeting.kind === "teams" ? "Teams meeting" : "Google Meet"}</span>
                </button>
                {can && (
                  <button className="cal-icon" title="Remove the meeting link" onClick={() => p.onChange({ meeting: false })}>
                    <Icon name="close" size={12} />
                  </button>
                )}
              </>
            ) : e.want_meeting ? (
              <>
                <span className="cal-value muted" title={`A ${meetingName} link is added when the event is sent`}>
                  {account?.provider === "microsoft" ? "Teams" : "Meet"} link on send
                </span>
                <button className="cal-icon" title="Do not add a meeting link" onClick={() => p.onChange({ meeting: false })}>
                  <Icon name="close" size={12} />
                </button>
              </>
            ) : can ? (
              <button className="cal-pick muted" onClick={() => p.onChange({ meeting: true })}>
                <span>Add {meetingName}</span>
              </button>
            ) : (
              <span className="cal-value muted">No meeting link</span>
            )}
          </Row>
          {(can || e.location) && (
            <Row icon="place" top>
              {can ? <Text grow value={e.location} placeholder="Add a place" onCommit={(location) => p.onChange({ location })} /> : <span className="cal-value wrap">{e.location}</span>}
            </Row>
          )}
          {(can || e.description) && (
            <Row icon="text" top>
              {can ? <Text grow value={e.description} placeholder="Add notes for the guests" onCommit={(description) => p.onChange({ description })} /> : <span className="cal-value wrap">{e.description}</span>}
            </Row>
          )}
        </section>

        <section className="cal-group">
          <div className="cal-row">
            <span className="cal-row-icon">
              <i className="cal-dot" style={{ background: calendar?.color }} />
            </span>
            {p.draft ? (
              <Pick
                value={`${e.account}|${e.calendar}`}
                label={`${calendar?.name ?? ""} · ${account?.email ?? ""}`}
                title="The calendar it is made on"
                options={p.calendars.map((c) => [`${c.account}|${c.id}`, `${c.name} · ${p.accounts.find((a) => a.id === c.account)?.email}`])}
                onChange={(v) => p.onChange({ account: v.split("|")[0], calendar: v.split("|")[1] })}
              />
            ) : (
              <span className="cal-value" title={`${calendar?.name ?? ""} · ${account?.email ?? ""}`}>
                {account?.email}
              </span>
            )}
          </div>
          {!p.draft && (
            <Row icon="note">
              <button className="cal-pick" onClick={() => p.onNote()}>
                <span>{e.note ? "Open meeting note" : "Meeting note"}</span>
                <kbd>O</kbd>
              </button>
            </Row>
          )}
          {p.noteAsk && (
            <div className="cal-ask">
              <small>{p.noteAsk}</small>
              <div>
                <button className="link" onClick={() => p.onNote(true)}>
                  Write the note
                </button>
              </div>
            </div>
          )}
          {!p.draft && others.length > 0 && (
            <Row icon="hide">
              <Pick actions value="" label="Block this time on…" title="Block this time as Busy on another of your calendars" options={others.map((a) => [a.id, a.email])} onChange={(v) => p.onBlock(v)} />
            </Row>
          )}
        </section>
      </div>

      {p.draft ? (
        <footer>
          <button className="primary" disabled={p.sending} aria-busy={p.sending} onClick={p.onCreate}>
            {p.sending ? "Sending…" : e.guests.length ? "Send invite" : "Create"} <kbd>{formatKeys("Mod-Enter")}</kbd>
          </button>
          <button className="cal-button" onClick={p.onClose}>
            Cancel
          </button>
        </footer>
      ) : (
        can &&
        (p.deleting ? (
          <footer className="cal-ask danger" role="alertdialog" aria-label="Delete this event">
            <b>
              Delete and tell {told > 0 ? `${told} ` : "the "}{told === 1 ? "guest" : "guests"}?
            </b>
            <small>{p.scope === "all" && repeating ? "Every event of the series is cancelled, and the guests are emailed." : "The guests are emailed that it is cancelled."}</small>
            <div>
              <button className="primary danger" autoFocus onClick={() => p.onDelete(true)}>
                Delete and tell {told === 1 ? "guest" : "guests"}
              </button>
              {/* Microsoft always emails a cancellation, so the quiet choice is not offered there. */}
              {account?.provider !== "microsoft" && (
                <button className="link" onClick={() => p.onDelete(false)}>
                  Delete without email
                </button>
              )}
              <button className="link" onClick={p.onKeep}>
                Keep
              </button>
            </div>
          </footer>
        ) : (
          <footer>
            <button className="cal-button danger" onClick={() => p.onDelete()}>
              Delete <kbd>⌫</kbd>
            </button>
          </footer>
        ))
      )}
    </aside>
  );
}

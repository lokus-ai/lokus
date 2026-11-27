/** @part-of ui.calendar */
import { useEffect, useRef, useState } from "react";
import type { CalAccount, CalCalendar, CalEvent, CalGuest } from "../../bridge/calendar";
import { openWeb } from "../../bridge/updates";
import { formatKeys } from "../../shell/commands";
import { Icon } from "../../shell/Icon";
import { clock, fromField, offsetName, repeatChoices, toField, ZONES } from "./time";

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
  onSend: (notify: boolean) => void;
  onDiscard: () => void;
  onDelete: () => void;
  onReply: (answer: "yes" | "no" | "maybe") => void;
  onNote: () => void;
  onBlock: (account: string) => void;
  onClose: () => void;
}

/** A text field that keeps what is typed until it is left, then hands it on once. */
function Text({ value, placeholder, onCommit, className, focus, area }: { value: string; placeholder: string; onCommit: (v: string) => void; className?: string; focus?: boolean; area?: boolean }) {
  const [text, setText] = useState(value);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (focus) field.current?.focus();
  }, [focus]);
  const props = {
    ref: field,
    className,
    value: text,
    placeholder,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: () => text !== value && onCommit(text),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !(area && !e.metaKey)) (e.target as HTMLElement).blur();
    },
  };
  return area ? <textarea rows={3} {...props} /> : <input {...props} />;
}

const REPLY: Record<string, string> = { accepted: "Yes", declined: "No", tentative: "Maybe", needsAction: "No answer yet" };
const LABEL: Record<string, string> = { title: "title", time: "time", location: "place", description: "notes", guests: "guests", meeting: "meeting link", repeat: "repeat" };

/** The event on the right: every part is edited where it stands. */
export function EventPanel(p: Props) {
  const e = p.event;
  const account = p.accounts.find((a) => a.id === e.account);
  const meetingName = account?.provider === "microsoft" ? "Teams meeting" : "Google Meet";
  const can = e.mine;
  const repeating = !!(e.series || e.repeat) && !p.draft;
  const others = p.accounts.filter((a) => a.id !== e.account);
  const [guest, setGuest] = useState("");
  const guests = (next: CalGuest[]) => p.onChange({ guests: next.map((g) => ({ email: g.email, name: g.name, optional: g.optional })) });
  const addGuest = () => {
    const email = guest.trim().toLowerCase();
    setGuest("");
    if (!email.includes("@") || e.guests.some((g) => g.email === email)) return;
    guests([...e.guests, { email, name: "", optional: false, reply: "needsAction" }]);
  };
  const time = (which: "start" | "end", value: string) => {
    const at = fromField(value, p.zone);
    if (!at || at === e[which]) return;
    if (which === "end") return p.onChange({ end: at });
    // Moving the start keeps the length.
    p.onChange({ start: at, end: new Date(Date.parse(at) + Date.parse(e.end) - Date.parse(e.start)).toISOString().replace(/\.\d+Z$/, "Z") });
  };

  return (
    <aside className="cal-panel">
      <header>
        <span className="cal-dot" style={{ background: p.calendars.find((c) => c.account === e.account && c.id === e.calendar)?.color }} />
        <small>{account?.email}</small>
        <button className="cal-icon" title={`Close (${formatKeys("Escape")})`} onClick={p.onClose}>
          <Icon name="close" size={14} />
        </button>
      </header>

      {(e.pending || e.unsent) && !p.draft && (
        <div className="cal-pending">
          <b>{e.unsent ? "Invitation not sent" : "Pending changes"}</b>
          <small>{e.unsent ? "Guests have not been told about this event." : `Changed: ${e.changes.map((c) => LABEL[c] ?? c).join(", ")}. Guests have not been told.`}</small>
          <div>
            <button className="primary" onClick={() => p.onSend(true)}>
              {e.unsent ? "Send invite" : "Send update"} <kbd>{formatKeys("Mod-Enter")}</kbd>
            </button>
            <button className="link" onClick={() => p.onSend(false)}>
              {e.unsent ? "Save without email" : "Update without email"}
            </button>
            <button className="link" onClick={p.onDiscard}>
              Discard
            </button>
          </div>
        </div>
      )}
      {e.error && <p className="cal-error">The provider refused the last change: {e.error}</p>}
      {e.queued && !e.error && <p className="cal-waiting">Waiting to be sent to {account?.provider === "microsoft" ? "Microsoft 365" : "Google Calendar"}.</p>}

      {can ? <Text className="cal-title" value={e.title} placeholder="Title" focus={p.draft} onCommit={(title) => p.onChange({ title })} /> : <h2 className="cal-title">{e.title || "(No title)"}</h2>}

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

      {can ? (
        <div className="cal-rows">
          <label>
            <span>Starts</span>
            <input type="datetime-local" key={e.start} defaultValue={toField(e.start, p.zone)} onBlur={(ev) => time("start", ev.target.value)} />
          </label>
          <label>
            <span>Ends</span>
            <input type="datetime-local" key={e.end} defaultValue={toField(e.end, p.zone)} onBlur={(ev) => time("end", ev.target.value)} />
          </label>
          <label>
            <span>Time zone</span>
            <select value={e.zone || p.zone} onChange={(ev) => p.onChange({ zone: ev.target.value })}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")} ({offsetName(z, Date.parse(e.start))})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Repeats</span>
            <select value={e.repeat ?? ""} disabled={!!e.series && p.scope === "this"} onChange={(ev) => p.onChange({ repeat: ev.target.value })}>
              {repeatChoices(e.repeat).map(([rule, name]) => (
                <option key={rule} value={rule}>
                  {e.series && !e.repeat && !rule ? "Part of a repeating event" : name}
                </option>
              ))}
            </select>
          </label>
          {p.draft && (
            <label>
              <span>Calendar</span>
              <select value={`${e.account}|${e.calendar}`} onChange={(ev) => p.onChange({ account: ev.target.value.split("|")[0], calendar: ev.target.value.split("|")[1] })}>
                {p.calendars.map((c) => (
                  <option key={`${c.account}|${c.id}`} value={`${c.account}|${c.id}`}>
                    {c.name} · {p.accounts.find((a) => a.id === c.account)?.email}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : (
        <p className="cal-when">
          {new Date(e.start).toLocaleDateString([], { timeZone: p.zone, weekday: "long", month: "long", day: "numeric" })}
          {!e.all_day && `, ${clock(e.start, p.zone)} – ${clock(e.end, p.zone)}`}
          <small>Organised by {e.organizer}</small>
        </p>
      )}

      {!can && (
        <div className="cal-reply">
          <span>Going?</span>
          {(["yes", "no", "maybe"] as const).map((answer) => {
            const on = e.reply === { yes: "accepted", no: "declined", maybe: "tentative" }[answer];
            return (
              <button key={answer} className={on ? "active" : ""} onClick={() => p.onReply(answer)}>
                {answer[0].toUpperCase() + answer.slice(1)} <kbd>{answer[0].toUpperCase()}</kbd>
              </button>
            );
          })}
        </div>
      )}

      <section>
        <h3>Guests</h3>
        {e.guests.map((g) => (
          <div key={g.email} className="cal-guest" title={REPLY[g.reply] ?? g.reply}>
            <i className={`cal-answer ${g.reply}`} />
            <span>
              {g.name || g.email}
              {g.optional && <small> · optional</small>}
            </span>
            {can && (
              <>
                <button className="link" onClick={() => guests(e.guests.map((x) => (x.email === g.email ? { ...x, optional: !x.optional } : x)))}>
                  {g.optional ? "Make required" : "Make optional"}
                </button>
                <button className="cal-icon" title="Remove guest" onClick={() => guests(e.guests.filter((x) => x.email !== g.email))}>
                  <Icon name="close" size={12} />
                </button>
              </>
            )}
          </div>
        ))}
        {can && <input className="cal-add" value={guest} placeholder="Add guest by email" onChange={(ev) => setGuest(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && addGuest()} onBlur={addGuest} />}
      </section>

      <section>
        {e.meeting ? (
          <div className="cal-meeting">
            <button className="primary" onClick={() => openWeb(e.meeting!.url)}>
              Join {e.meeting.kind === "teams" ? "Teams meeting" : "Google Meet"}
            </button>
            {can && (
              <button className="link" onClick={() => p.onChange({ meeting: false })}>
                Remove
              </button>
            )}
          </div>
        ) : e.want_meeting ? (
          <p className="cal-waiting">
            {meetingName} link is added when this is sent.{" "}
            <button className="link" onClick={() => p.onChange({ meeting: false })}>
              Remove
            </button>
          </p>
        ) : (
          can && (
            <button className="cal-action" onClick={() => p.onChange({ meeting: true })}>
              <Icon name="plus" size={14} /> Add {meetingName}
            </button>
          )
        )}
      </section>

      {can ? (
        <section>
          <Text value={e.location} placeholder="Add a place" onCommit={(location) => p.onChange({ location })} />
          <Text area value={e.description} placeholder="Add notes for the guests" onCommit={(description) => p.onChange({ description })} />
        </section>
      ) : (
        (e.location || e.description) && (
          <section>
            {e.location && <p>{e.location}</p>}
            {e.description && <p className="cal-description">{e.description}</p>}
          </section>
        )
      )}

      {p.draft ? (
        <footer>
          <button className="primary" onClick={p.onCreate}>
            {e.guests.length ? "Send invite" : "Create"} <kbd>{formatKeys("Mod-Enter")}</kbd>
          </button>
          <button className="link" onClick={p.onClose}>
            Cancel <kbd>{formatKeys("Escape")}</kbd>
          </button>
        </footer>
      ) : (
        <footer>
          <button className="cal-action" onClick={p.onNote}>
            <Icon name="note" size={14} /> {e.note ? "Open meeting note" : "Meeting note"} <kbd>N</kbd>
          </button>
          {others.length > 0 && (
            <label className="cal-action">
              <Icon name="hide" size={14} />
              <select value="" onChange={(ev) => ev.target.value && p.onBlock(ev.target.value)}>
                <option value="">Block this time on…</option>
                {others.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email}
                  </option>
                ))}
              </select>
            </label>
          )}
          {can && (
            <button className="cal-action danger" onClick={p.onDelete}>
              Delete <kbd>⌫</kbd>
            </button>
          )}
        </footer>
      )}
    </aside>
  );
}

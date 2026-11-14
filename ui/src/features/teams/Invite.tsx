/** @part-of ui.teams */
import { type FormEvent, useState } from "react";

import { track } from "../../bridge/analytics";
import { relay } from "../../bridge/sync";
import { useStore } from "../../shell/store";
import { app, notify } from "../../shell/workspace";
import { useMe } from "../profile/profiles";
import { asWhat, invited, join, joinLink, type Made, notNow, ownNotes, type Role, sharedAlready, type Waiting, whoSent } from "./invites";

/** An invite nobody has used yet, as its owner sees it. */
export interface Invite {
  code: string;
  role: Role;
  expires_at: number;
  email: string | null;
  sent_at: number | null;
}

/** What went wrong, without the plumbing's own preface. */
const said = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^the relay refused: /, "").replace(/^./, (c) => c.toUpperCase());
const ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/** "6 days", "3 hours": how long from now, or how long ago. */
function span(seconds: number): string {
  const s = Math.abs(seconds);
  if (s >= 36 * 3600) return `${Math.round(s / 86400)} days`;
  if (s >= 5400) return `${Math.round(s / 3600)} hours`;
  if (s >= 90) return `${Math.round(s / 60)} minutes`;
  return "a minute";
}

/**
 * Settings, Team, for an owner: write to someone by email, and see who has not answered yet.
 * An invite can still go out as a link, for a person the owner would sooner message themselves.
 */
export function InvitePeople({ server, token, base, invites, reload }: { server: string; token: string; base: string; invites: Invite[]; reload(): Promise<void> }) {
  const me = useMe();
  const [to, setTo] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const now = Date.now() / 1000;

  const copy = (code: string) => void navigator.clipboard.writeText(joinLink(server, code)).then(() => notify("Invite link copied"));

  const send = async (e: FormEvent) => {
    e.preventDefault();
    // Several people can be pasted in at once, separated however a list of addresses comes.
    const people = [...new Set(to.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean))];
    if (!people.length) return;
    setBusy(true);
    setProblem("");
    const left: string[] = [];
    const problems: string[] = [];
    let sent = 0;
    for (const email of people) {
      if (!ADDRESS.test(email)) {
        left.push(email);
        problems.push(`“${email}” is not an email address.`);
        continue;
      }
      try {
        const made = await relay<Made>(server, token, "POST", `${base}/invites`, { role, email, name: me?.name ?? "" });
        if (made.sent) sent += 1;
        else problems.push(`The email to ${email} could not be sent. Their invite is in the list below: copy its link and send it yourself.`);
      } catch (err) {
        left.push(email);
        problems.push(said(err));
      }
    }
    track("action", { feature: "team", action: "invite_sent", count: sent, role });
    if (sent) notify(sent === 1 ? `Invitation sent to ${people.find((p) => !left.includes(p)) ?? people[0]}` : `${sent} invitations sent`);
    setTo(left.join(", "));
    setProblem([...new Set(problems)].join(" "));
    setBusy(false);
    await reload();
  };

  const link = async () => {
    setProblem("");
    try {
      const made = await relay<Made>(server, token, "POST", `${base}/invites`, { role });
      copy(made.code);
      await reload();
    } catch (err) {
      setProblem(said(err));
    }
  };

  const again = async (i: Invite) => {
    setProblem("");
    try {
      const made = await relay<Made>(server, token, "POST", `${base}/invites/${i.code}/send`);
      if (made.sent) notify(`Sent again to ${i.email}`);
      else setProblem(`The email to ${i.email} could not be sent. Copy the link and send it yourself.`);
    } catch (err) {
      setProblem(said(err));
    }
    await reload();
  };

  const cancel = async (i: Invite) => {
    await relay(server, token, "DELETE", `${base}/invites/${i.code}`).catch((err) => setProblem(said(err)));
    await reload();
  };

  return (
    <>
      <h3>Invite people</h3>
      <form className="team-invite" onSubmit={send}>
        <input type="text" inputMode="email" autoComplete="off" spellCheck={false} value={to} placeholder="name@company.com" aria-label="Email address to invite" onChange={(e) => setTo(e.target.value)} />
        <select value={role} aria-label="What they may do" onChange={(e) => setRole(e.target.value as "editor" | "viewer")}>
          <option value="editor">Can edit</option>
          <option value="viewer">Can read</option>
        </select>
        <button className="primary" disabled={busy || !to.trim()}>
          {busy ? "Sending…" : "Send invite"}
        </button>
      </form>
      <p className="team-invite-hint">
        We email them a link from Lokus. They sign in with that address and join in one click.{" "}
        <button type="button" className="link" onClick={() => void link()}>
          Copy an invite link instead
        </button>
      </p>
      {problem && <p className="settings-hint error">{problem}</p>}
      {invites.length > 0 && (
        <div className="settings-list">
          {invites.map((i) => (
            <div key={i.code} className="settings-item">
              <span className="team-avatar waiting">{(i.email ?? "@").slice(0, 1).toUpperCase()}</span>
              <div className="settings-item-main">
                <strong>{i.email ?? `Invite link for ${asWhat(i.role)}`}</strong>
                <small>
                  {i.email ? `${i.role === "editor" ? "Can edit" : "Can read"}. ${i.sent_at ? `Emailed ${span(now - i.sent_at)} ago` : "Email not sent"}, not accepted yet.` : "Not used yet."} Works for {span(i.expires_at - now)}.
                </small>
              </div>
              {i.email && (
                <button className="link" disabled={Boolean(i.sent_at && now - i.sent_at < 60)} onClick={() => void again(i)}>
                  Send again
                </button>
              )}
              <button className="link" onClick={() => copy(i.code)}>
                Copy link
              </button>
              <button className="link danger" onClick={() => void cancel(i)}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** One invitation, with the question of where its workspace should live when that needs asking. */
function Invitation({ w, onLater }: { w: Waiting; onLater?(): void }) {
  const vault = useStore(app, (s) => s.vault);
  const joining = useStore(invited, (s) => s.joining);
  // Looked at when shown: the folder open now, and whether joining in it would give anything away.
  const taken = sharedAlready();
  const own = vault ? ownNotes() : 0;
  const ask = Boolean(vault) && !taken && own > 0;
  const [where, setWhere] = useState<"here" | "new">(taken || own > 0 ? "new" : "here");
  const [problem, setProblem] = useState("");

  const go = () => {
    setProblem("");
    void join(w, where).catch((e) => setProblem(said(e)));
  };

  return (
    <div className="invited">
      <div className="invited-head">
        <span className="invited-tile">{(w.name.match(/[\p{L}\p{N}]/u)?.[0] ?? "L").toUpperCase()}</span>
        <div>
          <strong>
            {whoSent(w)} invited you to {w.name}
          </strong>
          <small>
            You would join as {asWhat(w.role)}
            {w.from && w.from_name ? `. From ${w.from}.` : "."}
          </small>
        </div>
      </div>
      {ask && (
        <div className="invited-where" role="radiogroup" aria-label={`Where ${w.name} should live on this computer`}>
          <button role="radio" aria-checked={where === "new"} className={where === "new" ? "on" : ""} onClick={() => setWhere("new")}>
            <b>In its own folder</b>
            <small>Documents / {w.name}. Your notes in “{vault?.name}” stay yours.</small>
          </button>
          <button role="radio" aria-checked={where === "here"} className={where === "here" ? "on" : ""} onClick={() => setWhere("here")}>
            <b>In “{vault?.name}”</b>
            <small>
              The {own === 1 ? "note" : `${own} notes`} already here {own === 1 ? "becomes" : "become"} the team’s too.
            </small>
          </button>
        </div>
      )}
      {taken && <p className="invited-note">This folder is already shared with another workspace, so {w.name} gets its own folder in Documents.</p>}
      {problem && <p className="invited-note error">{problem}</p>}
      <div className="update-actions">
        <button className="primary" disabled={joining === w.code} onClick={go}>
          {joining === w.code ? "Joining…" : `Join ${w.name}`}
        </button>
        {onLater && (
          <button className="link" onClick={onLater}>
            Not now
          </button>
        )}
      </div>
    </div>
  );
}

/** The pop-up for someone who has been invited: who by, to what, and one button. */
export function Invited() {
  const waiting = useStore(invited, (s) => s.waiting);
  const later = useStore(invited, (s) => s.later);
  const next = waiting.find((w) => !later.includes(w.code));
  if (!next) return null;
  return (
    <aside className="update-card invited-card" role="status" aria-live="polite">
      <Invitation key={next.code} w={next} onLater={() => notNow(next.code)} />
    </aside>
  );
}

/** Every invitation waiting, for Settings: the ones put away with "Not now" are still here. */
export function InvitedList() {
  const waiting = useStore(invited, (s) => s.waiting);
  if (!waiting.length) return null;
  return (
    <>
      <h3>{waiting.length === 1 ? "You have an invitation" : "You have invitations"}</h3>
      <div className="settings-list invited-list">
        {waiting.map((w) => (
          <Invitation key={w.code} w={w} />
        ))}
      </div>
    </>
  );
}

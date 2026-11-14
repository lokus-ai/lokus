/** @part-of ui.teams */
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { accessToken } from "../../bridge/auth";
import { relay } from "../../bridge/sync";
import { useStore } from "../../shell/store";
import { app, connectSync, disconnectSync, notify } from "../../shell/workspace";
import { DataDoor } from "../customers/DataDoor";
import { Avatar } from "../profile/Profile";
import { fromEmail, useProfiles } from "../profile/profiles";
import { Row, Section } from "../settings/parts";

type Role = "owner" | "editor" | "viewer";

interface Workspace {
  id: string;
  name: string;
  role: Role;
}

interface Member {
  user: string;
  email: string | null;
  role: Role;
}

/** An invite nobody has used yet. */
interface Invite {
  code: string;
  role: Role;
  expires_at: number;
}

const ROLES: Record<Role, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };
const CAN: Record<Role, string> = { owner: "Can edit, invite and remove people", editor: "Can edit notes", viewer: "Can read notes" };
const STATUS: Record<string, string> = {
  connecting: "Connecting…",
  online: "Up to date.",
  offline: "Offline. Your edits are kept and sent when the connection returns.",
};
/** The relay this build syncs through; empty when the build has none. */
const HOME = (import.meta.env.VITE_LOKUS_RELAY as string | undefined) ?? "";

/** "6 days", "3 hours": how long an invite still works. */
function until(seconds: number): string {
  const left = seconds - Date.now() / 1000;
  if (left >= 36 * 3600) return `${Math.round(left / 86400)} days`;
  if (left >= 5400) return `${Math.round(left / 3600)} hours`;
  return `${Math.max(1, Math.round(left / 60))} minutes`;
}

/** Settings, Team: sync this vault with other people, and say who they are and what they may do. */
export function TeamSettings() {
  const current = useStore(app, (s) => s.sync);
  const account = useStore(app, (s) => s.account);
  const vault = useStore(app, (s) => s.vault);
  const profiles = useProfiles();
  const [accountToken, setAccountToken] = useState<string | null>(null);
  const [server, setServer] = useState(current.server ?? HOME);
  // With a home server built in, nobody is asked where the server is unless they run their own.
  const [ownServer, setOwnServer] = useState(!HOME || (current.server !== undefined && current.server !== HOME));
  const [typedToken, setTypedToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [fresh, setFresh] = useState<{ code: string; role: string } | null>(null);
  /** The irreversible thing the person has clicked once and must confirm. */
  const [confirming, setConfirming] = useState<"leave" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void accessToken().then(setAccountToken, () => setAccountToken(null));
  }, [account]);

  const token = accountToken ?? (typedToken.trim() || null);
  const connected = current.status === "connecting" || current.status === "online" || current.status === "offline";
  const here = workspaces?.find((w) => w.id === current.workspace);
  const owner = current.role === "owner";
  const base = `/v1/workspaces/${current.workspace}`;

  const attempt = useCallback(async <T,>(work: () => Promise<T>): Promise<T | null> => {
    setMessage(null);
    try {
      return await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!token || !server) return;
    const found = await attempt(() => relay<Workspace[]>(server, token, "GET", "/v1/workspaces"));
    if (found) setWorkspaces(found);
  }, [attempt, server, token]);

  // Asked again once connected, so a workspace made a moment ago is known by its name.
  useEffect(() => {
    void load();
  }, [load, connected]);

  const loadTeam = useCallback(async () => {
    if (!token || !connected || !current.workspace) return;
    const found = await attempt(() => relay<Member[]>(server, token, "GET", `${base}/members`));
    if (found) setMembers(found);
    if (!owner) return setInvites([]);
    const open = await attempt(() => relay<Invite[]>(server, token, "GET", `${base}/invites`));
    if (open) setInvites(open);
  }, [attempt, base, connected, current.workspace, owner, server, token]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const connect = (workspace: string) => void connectSync(server, workspace, accountToken ? null : token);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const made = await attempt(() => relay<Workspace>(server, token, "POST", "/v1/workspaces", { name }));
    if (made) {
      setName("");
      connect(made.id);
    }
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const joined = await attempt(() => relay<{ workspace: string }>(server, token, "POST", `/v1/invites/${code.trim()}/accept`));
    if (joined) {
      setCode("");
      connect(joined.workspace);
    }
  };
  /** One change to the team, then show the team as it now is. */
  const change = async (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => {
    if (!token) return null;
    const done = await attempt(() => relay<{ code?: string; role?: string }>(server, token, method, `${base}${path}`, body));
    await loadTeam();
    return done;
  };
  const invite = async (role: "editor" | "viewer") => {
    const made = await change("POST", "/invites", { role });
    if (made?.code) setFresh({ code: made.code, role });
  };
  const leave = async () => {
    if (current.user && (await change("DELETE", `/members/${encodeURIComponent(current.user)}`))) await disconnectSync();
    setConfirming(null);
  };
  const remove = async () => {
    if (!token) return;
    if ((await attempt(() => relay<unknown>(server, token, "DELETE", base))) !== null) await disconnectSync();
    setConfirming(null);
  };
  const owners = members.filter((m) => m.role === "owner").length;

  if (connected) {
    return (
      <Section title="Team" hint="This vault is shared. Everyone in the workspace keeps a full copy and can work offline.">
        <Row
          label={here?.name ?? "Workspace"}
          hint={
            <>
              <span className={`sync-dot ${current.status}`} /> {STATUS[current.status]}
              {current.role ? ` You are ${current.role === "owner" ? "an owner" : current.role === "editor" ? "an editor" : "a viewer"}.` : ""}
            </>
          }
        >
          <button className="settings-button" onClick={() => void disconnectSync()}>
            Stop syncing on this computer
          </button>
        </Row>

        <h3>People</h3>
        <div className="settings-list">
          {members.map((m) => {
            const me = m.user === current.user;
            // The only owner cannot be made less, or the workspace would have nobody in charge.
            const fixed = !owner || (m.role === "owner" && owners === 1);
            return (
              <div key={m.user} className="settings-item">
                <Avatar name={profiles[(m.email ?? "").toLowerCase()]?.name ?? fromEmail(m.email ?? m.user)} picture={profiles[(m.email ?? "").toLowerCase()]?.picture} size={28} />
                <div className="settings-item-main">
                  <strong>
                    {profiles[(m.email ?? "").toLowerCase()]?.name ?? fromEmail(m.email ?? m.user)}
                    {me && <span className="settings-version"> you</span>}
                  </strong>
                  <small>
                    {[profiles[(m.email ?? "").toLowerCase()]?.role, m.email, CAN[m.role]].filter(Boolean).join(" · ")}
                  </small>
                </div>
                {fixed ? (
                  <span className="team-role">{ROLES[m.role]}</span>
                ) : (
                  <select value={m.role} aria-label={`Role of ${m.email ?? m.user}`} onChange={(e) => void change("PATCH", `/members/${encodeURIComponent(m.user)}`, { role: e.target.value })}>
                    {(Object.keys(ROLES) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLES[r]}
                      </option>
                    ))}
                  </select>
                )}
                {owner && !me && (
                  <button className="link danger" onClick={() => void change("DELETE", `/members/${encodeURIComponent(m.user)}`)}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {owner && (
          <>
            <h3>Invite someone</h3>
            <Row label="Invite codes" hint="A code works once and for 7 days. Send it to one person; they paste it under Team in their own Lokus.">
              <button className="settings-button" onClick={() => void invite("editor")}>
                Invite an editor
              </button>
              <button className="settings-button" onClick={() => void invite("viewer")}>
                Invite a viewer
              </button>
            </Row>
            {fresh && (
              <div className="team-code-row">
                <code className="team-code">{fresh.code}</code>
                <button className="settings-button" onClick={() => void navigator.clipboard.writeText(fresh.code).then(() => notify("Invite code copied"))}>
                  Copy
                </button>
              </div>
            )}
            {invites.length > 0 && (
              <div className="settings-list">
                {invites.map((i) => (
                  <div key={i.code} className="settings-item">
                    <div className="settings-item-main">
                      <strong>Invite for {i.role === "editor" ? "an editor" : "a viewer"}</strong>
                      <small>
                        Not used yet. Works for {until(i.expires_at)}. Code ends in {i.code.slice(-6)}
                      </small>
                    </div>
                    <button
                      className="link"
                      onClick={() => {
                        if (fresh?.code === i.code) setFresh(null);
                        void change("DELETE", `/invites/${i.code}`);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {owner && token && current.workspace && <DataDoor server={server} token={token} workspace={current.workspace} />}

        {current.user && !(owner && owners === 1) && (
          <Row label="Leave this workspace" hint="You stop receiving changes and need a new invite to come back. Your notes stay on this computer.">
            {confirming === "leave" ? (
              <>
                <button className="settings-button danger" onClick={() => void leave()}>
                  Leave
                </button>
                <button className="settings-button" onClick={() => setConfirming(null)}>
                  Stay
                </button>
              </>
            ) : (
              <button className="settings-button" onClick={() => setConfirming("leave")}>
                Leave…
              </button>
            )}
          </Row>
        )}
        {owner && (
          <Row label="Delete this workspace" hint="Removes the shared copy and its history for everyone. Each person keeps the notes already on their own computer.">
            {confirming === "delete" ? (
              <>
                <button className="settings-button danger" onClick={() => void remove()}>
                  Delete for everyone
                </button>
                <button className="settings-button" onClick={() => setConfirming(null)}>
                  Keep it
                </button>
              </>
            ) : (
              <button className="settings-button" onClick={() => setConfirming("delete")}>
                Delete…
              </button>
            )}
          </Row>
        )}
        {message && <p className="settings-hint error">{message}</p>}
      </Section>
    );
  }

  return (
    <Section title="Team" hint={`Share ${vault ? `“${vault.name}”` : "this vault"} with other people. Everyone keeps a full copy and can work offline.`}>
      {current.status === "refused" && current.reason && <p className="settings-hint error">Sync stopped: {current.reason}.</p>}
      {!token && !ownServer ? (
        <Row label="Sign in first" hint="A team needs to know who you are.">
          <button className="settings-button" onClick={() => app.set({ settings: null, accountDialog: true })}>
            Sign in
          </button>
        </Row>
      ) : (
        <>
          {workspaces && workspaces.length > 0 && (
            <>
              <h3>Your workspaces</h3>
              <div className="settings-list">
                {workspaces.map((w) => (
                  <div key={w.id} className="settings-item">
                    <span className="team-avatar">{w.name.slice(0, 1).toUpperCase()}</span>
                    <div className="settings-item-main">
                      <strong>{w.name}</strong>
                      <small>You are {w.role === "owner" ? "an owner" : w.role === "editor" ? "an editor" : "a viewer"}</small>
                    </div>
                    <button className="settings-button" onClick={() => connect(w.id)}>
                      Sync this vault here
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <form onSubmit={create}>
            <Row label="Start a new workspace" hint="You become its owner and can invite people.">
              <input value={name} placeholder="Workspace name" onChange={(e) => setName(e.target.value)} />
              <button className="settings-button" disabled={!token || !name.trim()}>
                Create
              </button>
            </Row>
          </form>
          <form onSubmit={join}>
            <Row label="Join with an invite" hint="Paste the code someone sent you.">
              <input value={code} placeholder="Invite code" spellCheck={false} onChange={(e) => setCode(e.target.value)} />
              <button className="settings-button" disabled={!token || !code.trim()}>
                Join
              </button>
            </Row>
          </form>
        </>
      )}
      {ownServer ? (
        <>
          <Row label="Server" hint={HOME ? "The address of a relay you run yourself." : "This build has no home server set, so it needs the address of one you run."}>
            <input value={server} placeholder="https://…" spellCheck={false} onChange={(e) => setServer(e.target.value)} />
          </Row>
          {!accountToken && (
            <Row label="Access token" hint="Only for a relay that does not use Lokus accounts.">
              <input value={typedToken} type="password" placeholder="Paste a token" autoComplete="off" onChange={(e) => setTypedToken(e.target.value)} />
            </Row>
          )}
        </>
      ) : (
        <button type="button" className="link team-own" onClick={() => setOwnServer(true)}>
          Use my own server
        </button>
      )}
      {message && <p className="settings-hint error">{message}</p>}
    </Section>
  );
}

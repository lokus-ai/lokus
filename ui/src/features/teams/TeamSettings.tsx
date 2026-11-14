/** @part-of ui.teams */
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { accessToken } from "../../bridge/auth";
import { relay } from "../../bridge/sync";
import { useStore } from "../../shell/store";
import { app, connectSync, disconnectSync } from "../../shell/workspace";
import { DataDoor } from "../customers/DataDoor";
import { Avatar } from "../profile/Profile";
import { fromEmail, useProfiles } from "../profile/profiles";
import { Row, Section } from "../settings/parts";
import { type Invite, InviteBox, InvitedList, PendingRows } from "./Invite";
import { HOME, lookForInvites, type Role } from "./invites";

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

const ROLES: Record<Role, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };
const STATUS: Record<string, string> = {
  connecting: "Connecting…",
  online: "Up to date.",
  offline: "Offline. Your edits are kept and sent when the connection returns.",
};
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
  /** The irreversible thing the person has clicked once and must confirm. */
  const [confirming, setConfirming] = useState<"leave" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"members" | "invited">("members");

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
  // Opening this page is a good moment to ask again whether anyone has invited this person.
  useEffect(() => void lookForInvites(), []);

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
  const teamName = here?.name ?? "Workspace";

  if (connected) {
    return (
      <Section title="Team" hint="This vault is shared. Everyone in the workspace keeps a full copy and can work offline.">
        <div className="team-head">
          <span className="team-tile">{(teamName.match(/[\p{L}\p{N}]/u)?.[0] ?? "L").toUpperCase()}</span>
          <div className="team-head-main">
            <strong>{teamName}</strong>
            <small>
              <span className={`sync-dot ${current.status}`} /> {STATUS[current.status]}
              {current.role ? ` You are ${current.role === "owner" ? "an owner" : current.role === "editor" ? "an editor" : "a viewer"}.` : ""}
            </small>
          </div>
          <button className="settings-button" onClick={() => void disconnectSync()}>
            Stop syncing on this computer
          </button>
        </div>

        {owner && token && <InviteBox server={server} token={token} base={base} workspace={teamName} reload={async () => {
          await loadTeam();
          setTab("invited");
        }} />}

        <div className="team-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "members"} className={tab === "members" ? "on" : ""} onClick={() => setTab("members")}>
            Members <span>{members.length}</span>
          </button>
          {owner && (
            <button role="tab" aria-selected={tab === "invited"} className={tab === "invited" ? "on" : ""} onClick={() => setTab("invited")}>
              Invited <span>{invites.length}</span>
            </button>
          )}
        </div>
        {tab === "invited" && owner && token ? (
          <PendingRows server={server} token={token} base={base} invites={invites} reload={loadTeam} />
        ) : (
        <div className="settings-list team-list">
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
                    {[profiles[(m.email ?? "").toLowerCase()]?.role, m.email].filter(Boolean).join(", ")}
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
        )}

        <InvitedList />

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
      <InvitedList />
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
            <Row label="Join with a code" hint="For an invite that came as a link. One sent to your email shows up here by itself.">
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

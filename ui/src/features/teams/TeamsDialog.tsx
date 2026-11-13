/** @part-of ui.teams */
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { relay } from "../../bridge/sync";

interface Workspace {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}

interface Member {
  user: string;
  email: string | null;
  role: string;
}

export interface TeamsProps {
  /** Where this vault is syncing now, if anywhere. */
  current: { status: string; server?: string; workspace?: string; role?: string; reason?: string };
  /** The signed-in account's token, when there is one. */
  accountToken: string | null;
  defaultServer: string;
  onConnect(server: string, workspace: string, token: string | null): void;
  onDisconnect(): void;
  onClose(): void;
}

const STATUS: Record<string, string> = {
  connecting: "Connecting…",
  online: "Syncing",
  offline: "Offline. Your edits are kept and sent when the connection returns.",
  refused: "The server refused the connection.",
};

/** Sync this vault with a team: pick or create a workspace, invite people. */
export function TeamsDialog({ current, accountToken, defaultServer, onConnect, onDisconnect, onClose }: TeamsProps) {
  const [server, setServer] = useState(current.server ?? defaultServer);
  const [typedToken, setTypedToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState<{ code: string; role: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const token = accountToken ?? (typedToken.trim() || null);
  const connected = current.status !== "off" && current.status !== "refused";
  const here = workspaces?.find((w) => w.id === current.workspace);

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !connected || !current.workspace) return;
    void attempt(() => relay<Member[]>(server, token, "GET", `/v1/workspaces/${current.workspace}/members`)).then(
      (found) => found && setMembers(found),
    );
  }, [attempt, connected, current.workspace, server, token]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const made = await attempt(() => relay<Workspace>(server, token, "POST", "/v1/workspaces", { name }));
    if (made) onConnect(server, made.id, accountToken ? null : token);
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const joined = await attempt(() => relay<{ workspace: string }>(server, token, "POST", `/v1/invites/${code.trim()}/accept`));
    if (joined) onConnect(server, joined.workspace, accountToken ? null : token);
  };
  const makeInvite = async (role: "editor" | "viewer") => {
    if (!token || !current.workspace) return;
    const made = await attempt(() =>
      relay<{ code: string; role: string }>(server, token, "POST", `/v1/workspaces/${current.workspace}/invites`, { role }),
    );
    if (made) setInvite(made);
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog teams" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Team sync</h2>
        {connected ? (
          <>
            <p className="dialog-sub">
              <span className={`sync-dot ${current.status}`} /> {here?.name ?? "Workspace"} · {STATUS[current.status]}
              {current.role ? ` · you are ${current.role === "owner" ? "the owner" : `a${current.role === "editor" ? "n editor" : " viewer"}`}` : ""}
            </p>
            <div className="team-list">
              {members.map((m) => (
                <div key={m.user} className="team-row">
                  <span>{m.email ?? m.user}</span>
                  <span className="palette-hint">{m.role}</span>
                </div>
              ))}
            </div>
            {current.role === "owner" && (
              <div className="team-actions">
                <button onClick={() => void makeInvite("editor")}>Invite an editor</button>
                <button onClick={() => void makeInvite("viewer")}>Invite a viewer</button>
              </div>
            )}
            {invite && (
              <p className="dialog-message">
                Send this code to one person. It works once and makes them {invite.role === "editor" ? "an editor" : "a viewer"}:
                <code className="team-code">{invite.code}</code>
              </p>
            )}
            <button className="link danger" onClick={onDisconnect}>
              Stop syncing this vault
            </button>
          </>
        ) : (
          <>
            <p className="dialog-sub">
              Sync this vault with other people. Everyone keeps a full copy and can work offline.
              {current.status === "refused" && current.reason ? ` Last attempt: ${current.reason}.` : ""}
            </p>
            <label>
              Server
              <input value={server} placeholder="https://…" spellCheck={false} onChange={(e) => setServer(e.target.value)} />
            </label>
            {!accountToken && (
              <label>
                Access token
                <input value={typedToken} type="password" placeholder="Sign in, or paste a token" onChange={(e) => setTypedToken(e.target.value)} />
              </label>
            )}
            {workspaces && workspaces.length > 0 && (
              <div className="team-list">
                {workspaces.map((w) => (
                  <button key={w.id} className="team-row" onClick={() => onConnect(server, w.id, accountToken ? null : token)}>
                    <span>{w.name}</span>
                    <span className="palette-hint">{w.role}</span>
                  </button>
                ))}
              </div>
            )}
            <form className="team-form" onSubmit={create}>
              <input value={name} placeholder="New workspace name" onChange={(e) => setName(e.target.value)} />
              <button className="primary" disabled={!token || !name.trim()}>
                Create
              </button>
            </form>
            <form className="team-form" onSubmit={join}>
              <input value={code} placeholder="Invite code" spellCheck={false} onChange={(e) => setCode(e.target.value)} />
              <button className="primary" disabled={!token || !code.trim()}>
                Join
              </button>
            </form>
          </>
        )}
        {message && <p className="dialog-message error">{message}</p>}
      </div>
    </div>
  );
}

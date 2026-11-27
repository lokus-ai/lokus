/** @part-of ui.teams */
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { accessToken } from "../../bridge/auth";
import { listVaults } from "../../bridge/core";
import { relay } from "../../bridge/sync";
import { useStore } from "../../shell/store";
import { allNotes, app, connectSync, leaveWorkspace, notify, resumeSync, setVault } from "../../shell/workspace";
import { Avatar } from "../profile/Profile";
import { fromEmail, useProfiles } from "../profile/profiles";
import { Row, Section } from "../settings/parts";
import { type Invite, InviteDialog, InvitedList, PendingRows } from "./Invite";
import { bringTeams, HOME, lookForInvites, ownNotes, type Role, whileMaking } from "./invites";
import { howMany, lookAtTeams, same, teams } from "./teams";

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
  signin: "Sign in again to keep syncing. Your edits are kept and sent once you have.",
};
/** Settings, Team: sync this vault with other people, and say who they are and what they may do. */
export function TeamSettings() {
  const current = useStore(app, (s) => s.sync);
  const account = useStore(app, (s) => s.account);
  const vault = useStore(app, (s) => s.vault);
  const profiles = useProfiles();
  const [accountToken, setAccountToken] = useState<string | null>(null);
  const linked = useStore(app, (s) => (s.team && s.team.root === s.vault?.root ? s.team : null));
  const at = (current.server ?? linked?.server ?? HOME).replace(/\/+$/, "");
  const [server, setServer] = useState(at);
  // With a home server built in, nobody is asked where the server is unless they run their own.
  const [ownServer, setOwnServer] = useState(!HOME || at !== HOME);
  const [typedToken, setTypedToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  // A private workspace is shared under its own name unless another is typed.
  const [name, setName] = useState(vault?.name ?? "");
  const [code, setCode] = useState("");
  /** The irreversible thing the person has clicked once and must confirm. */
  const [confirming, setConfirming] = useState<"leave" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"members" | "invited">("members");
  const [inviting, setInviting] = useState(false);
  /** The team of this name the account is already in, found when it asked to make another. */
  const [already, setAlready] = useState<Workspace | null>(null);
  const known = useStore(teams, (s) => s.known);

  useEffect(() => {
    void accessToken().then(setAccountToken, () => setAccountToken(null));
  }, [account]);

  const refused = current.status === "refused";
  // A relay of one's own knows the token typed for it, not the Lokus account that happens to be signed in.
  // The folder's token goes only to the folder's own relay, never to another address typed on this page.
  const own = (linked?.server ?? "").trim().replace(/\/+$/, "") === server.trim().replace(/\/+$/, "");
  const token = (refused || !own ? null : linked?.token) ?? accountToken ?? (typedToken.trim() || null);
  // A folder that belongs to a team is shown as that team's whatever its connection is doing: it is never shared or joined anew.
  const connected = !refused && (current.status !== "off" || linked !== null);
  // Only a relay of one's own that turned its typed token away waits for the person: they type another.
  const kept = refused ? linked : null;
  const here = workspaces?.find((w) => w.id === (kept?.workspace ?? current.workspace));
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
    // A folder from someone else can name any relay: the account's sign-in is not shown to one this
    // computer has not used until the person presses Reconnect.
    if (accountToken && linked && !linked.known && linked.server.replace(/\/+$/, "") !== HOME && server.trim().replace(/\/+$/, "") !== HOME) return;
    const found = await attempt(() => relay<Workspace[]>(server, token, "GET", "/v1/workspaces"));
    if (found) setWorkspaces(found);
  }, [accountToken, attempt, linked, server, token]);

  // Asked again once connected, so a workspace made a moment ago is known by its name.
  useEffect(() => {
    void load();
  }, [load, connected]);

  const loadTeam = useCallback(async () => {
    if (!token || !connected || !current.workspace) return;
    const found = await attempt(() => relay<Member[]>(server, token, "GET", `${base}/members`));
    if (found) setMembers(found);
    // The sidebar says how many are in the team: it hears of a change made here at once.
    void lookAtTeams();
    if (!owner) return setInvites([]);
    const open = await attempt(() => relay<Invite[]>(server, token, "GET", `${base}/invites`));
    if (open) setInvites(open);
  }, [attempt, base, connected, current.workspace, owner, server, token]);

  // Asked again on coming back to the window: someone may have accepted an invitation meanwhile.
  // And when the connection comes back: a list asked for while it was down stayed empty.
  useEffect(() => {
    void loadTeam();
    const again = () => void loadTeam();
    window.addEventListener("focus", again);
    return () => window.removeEventListener("focus", again);
  }, [loadTeam, current.status]);
  // Opening this page is a good moment to ask again whether anyone has invited this person.
  useEffect(() => void lookForInvites(), []);

  // A relay of one's own that turned its token away is asked again with the one typed below, once that
  // token has listed this team on this folder's own server: it goes nowhere else, and a token that is
  // not a member never replaces the saved one.
  const reconnect = () => {
    const typed = accountToken ? "" : typedToken.trim();
    // A relay of one's own with no token kept for it and no account: only a typed token opens it.
    if (kept && !typed && !accountToken && !kept.token && kept.server.replace(/\/+$/, "") !== HOME) return setMessage("Type this relay's access token to reconnect.");
    if (!kept || !typed) return void resumeSync(true);
    if (server.trim().replace(/\/+$/, "") !== kept.server.replace(/\/+$/, "") || !here) return setMessage("That token does not open this team on its server.");
    void connectSync(kept.server, kept.workspace, typed);
  };
  const connect = (workspace: string) => void connectSync(server, workspace, accountToken ? null : token);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    // An account already in a team of this name is shown that team, not given a second one:
    // two teams called the same cannot be told apart, and work goes to the wrong one.
    const mine = await attempt(() => relay<Workspace[]>(server, token, "GET", "/v1/workspaces"));
    if (!mine) return;
    setWorkspaces(mine);
    const twin = mine.find((w) => same(w.name, name));
    setAlready(twin ?? null);
    if (twin) return void lookAtTeams();
    await whileMaking(async () => {
      const made = await attempt(() => relay<Workspace>(server, token, "POST", "/v1/workspaces", { name }));
      if (!made) return;
      setName("");
      await connectSync(server, made.id, accountToken ? null : token);
    });
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const joined = await attempt(() => relay<{ workspace: string }>(server, token, "POST", `/v1/invites/${code.trim()}/accept`));
    if (!joined) return;
    setCode("");
    // Notes of the person's own are not given to the team for typing a code: it gets its own folder, as a team joined anywhere does.
    if (server === HOME && accountToken && ownNotes() > 0) return void bringTeams();
    connect(joined.workspace);
  };
  /** Open the folder of a team this account is already in; one with no folder on this computer is given one first. */
  const openTeam = async (w: Workspace) => {
    const folder = async () => (await listVaults()).find((v) => v.workspace === w.id);
    let at = await folder();
    // Only teams on Lokus's own relay are given a folder by themselves.
    if (!at && server === HOME) {
      await bringTeams();
      at = await folder();
    }
    if (!at)
      return setMessage(
        server === HOME
          ? `${w.name} has no folder on this computer yet. It is added to your workspaces by itself; look in the list at the top of the sidebar.`
          : `${w.name} has no folder on this computer. Open the folder that holds it, if it is on another disk, or connect an empty folder to it.`,
      );
    if (at.root === vault?.root) return setMessage(`This folder is ${w.name} already.`);
    app.set({ settings: null });
    await setVault(at.root).catch((e) => notify(e instanceof Error ? e.message : String(e)));
  };
  /** One change to the team, then show the team as it now is. */
  const change = async (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => {
    if (!token) return null;
    const done = await attempt(() => relay<{ code?: string; role?: string }>(server, token, method, `${base}${path}`, body));
    await loadTeam();
    return done;
  };
  // Either one, once the relay agrees, takes the workspace off this device; its notes stay on disk.
  const leave = async () => {
    const me = current.user;
    if (me) await leaveWorkspace(async () => Boolean(await change("DELETE", `/members/${encodeURIComponent(me)}`)), (n) => `You left ${n}. Its notes stay on this computer.`);
    setConfirming(null);
  };
  const remove = async () => {
    if (!token) return;
    await leaveWorkspace(async () => (await attempt(() => relay<unknown>(server, token, "DELETE", base))) !== null, (n) => `${n} was deleted for everyone. Its notes stay on this computer.`);
    setConfirming(null);
  };
  const owners = members.filter((m) => m.role === "owner").length;
  const outsider = current.status === "outsider";
  const teamName = here?.name ?? linked?.name ?? vault?.name ?? "Workspace";
  // A team this account is not in is named only as the folder last heard it: a folder's own name is not a team's.
  const theirs = linked?.name ?? null;
  const size = here ? (members.length || known[here.id]?.members) : null;
  // On a relay of one's own, the person is whoever its token is, as that relay names them.
  const who = linked?.token ? (members.find((m) => m.user === current.user)?.email ?? null) : (account?.email ?? null);
  const signedIn = who && <p className="settings-hint">Signed in as <b>{who}</b></p>;
  // Only what is in this folder is shared. Notes in a person's other workspaces are not.
  const tree = useStore(app, (st) => st.tree);
  const shared = tree ? allNotes().length : 0;

  // The account signed in is not in this folder's team. Said in those words, with the one thing
  // that helps; the folder is never shared anew from here, which would make a second team.
  if (connected && outsider) {
    return (
      <Section title="Team">
        <div className="team-head">
          <div className="team-head-main">
            <strong>{theirs ?? "A team’s folder"}</strong>
            <small>
              <span className="sync-dot outsider" /> <b>{who ?? "This account"}</b> is not a member of this team.
            </small>
          </div>
          <button className="primary team-invite-button" onClick={() => app.set({ settings: null, accountDialog: true })}>
            Use another account
          </button>
        </div>
        <p className="team-empty-note">
          This folder belongs to {theirs ? <>the team <b>{theirs}</b></> : "a team"}. Sign in with the account that is in it, or ask one of its owners to invite {who ?? "this account"}. Until then nothing typed here is sent to anyone; it stays on this computer.
        </p>
        <InvitedList />
      </Section>
    );
  }

  if (connected) {
    return (
      <Section title="Team">
        <div className="team-head">
          <div className="team-head-main">
            <strong>
              {teamName}
              {size ? <span className="settings-version"> · {howMany(size)}</span> : null}
            </strong>
            <small>
              <span className={`sync-dot ${current.status}`} /> {STATUS[current.status] ?? STATUS.connecting} {shared === 0 ? "Nothing is in this workspace yet." : `${shared} ${shared === 1 ? "note" : "notes"} in this workspace.`}
            </small>
          </div>
          {current.status === "signin" ? (
            <button className="primary team-invite-button" onClick={() => app.set({ settings: null, accountDialog: true })}>
              Sign in again
            </button>
          ) : (
            owner &&
            token && (
              <button className="primary team-invite-button" onClick={() => setInviting(true)}>
                Invite people
              </button>
            )
          )}
        </div>
        {signedIn}
        {inviting && owner && token && (
          <InviteDialog
            server={server}
            token={token}
            base={base}
            workspace={teamName}
            onClose={() => setInviting(false)}
            reload={async () => {
              await loadTeam();
              setTab("invited");
            }}
          />
        )}

        {shared === 0 && (
          <p className="team-empty-note">
            Only notes made in this workspace are shared with the team. Notes in your other workspaces stay private. While you work, the top of the sidebar should say <b>{teamName}</b> and how many people are in it.
          </p>
        )}
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
                  <span className={`team-pill ${m.role}`}>{ROLES[m.role]}</span>
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


        {current.user && !(owner && owners === 1) && (
          <Row label="Leave this workspace" hint="It goes from this app. Its notes stay on this computer.">
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
          <Row label="Delete this workspace" hint="For everyone, and it goes from this app. Notes already on each computer stay.">
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
      {signedIn}
      {current.status === "refused" && current.reason && <p className="settings-hint error">Sync stopped: {current.reason}.</p>}
      {kept && (
        <Row label={here?.name ?? vault?.name ?? "Workspace"} hint="This folder belongs to this team. Your notes are kept here and sent once it is connected again.">
          <button className="primary" onClick={reconnect}>
            Reconnect
          </button>
        </Row>
      )}
      <InvitedList />
      {!token && !ownServer ? (
        <Row label="Sign in first" hint="A team needs to know who you are.">
          <button className="settings-button" onClick={() => app.set({ settings: null, accountDialog: true })}>
            Sign in
          </button>
        </Row>
      ) : kept ? null : (
        <>
          {/* With a Lokus account, a team's folder connects by itself. A relay of one's own knows nobody until its address and token are typed, so there the folder is pointed at a team by hand. */}
          {ownServer && workspaces && workspaces.length > 0 && (
            <>
              <h3>Workspaces on this server</h3>
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
            <Row label="Share this workspace with a team">
              <input value={name} placeholder="Workspace name" onChange={(e) => (setName(e.target.value), setAlready(null))} />
              <button className="primary" disabled={!token || !name.trim()}>
                Share
              </button>
            </Row>
          </form>
          {already && (
            <Row
              label={`You are already in a team called ${already.name}`}
              hint={`${howMany(known[already.id]?.members) === "Team" ? "It" : `${howMany(known[already.id]?.members)}: it`} is yours as ${already.role === "owner" ? "an owner" : already.role === "editor" ? "an editor" : "a viewer"}. A second team of the same name was not made. Open that one, or give this one another name.`}
            >
              <button className="primary" onClick={() => void openTeam(already)}>
                Open {already.name}
              </button>
            </Row>
          )}
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

/** @part-of ui.shell */
import { type FormEvent, useEffect, useRef, useState } from "react";

import { defaultVault, forgetVault, listVaults, type VaultInfo } from "../bridge/core";
import { HOME } from "../bridge/sync";
import { invited, join, type Waiting, whoSent } from "../features/teams/invites";
import { howMany, lookAtTeams, teams } from "../features/teams/teams";
import { Icon } from "./Icon";
import { useStore } from "./store";
import { app, chooseVault, notify, setVault } from "./workspace";

const said = (e: unknown) => (e instanceof Error ? e.message : String(e));
const letter = (name: string) => (name.match(/[\p{L}\p{N}]/u)?.[0] ?? "L").toUpperCase();

/**
 * The workspace's name at the top of the sidebar, and the list it opens: every workspace on
 * this computer, with a way to make another. A workspace is a folder; one can be for a team
 * and the next for school, and nothing is shared between them.
 */
export function WorkspaceSwitcher() {
  const vault = useStore(app, (s) => s.vault);
  const waiting = useStore(invited, (s) => s.waiting);
  const joining = useStore(invited, (s) => s.joining);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<VaultInfo[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void listVaults().then(setAll, () => {});
    void lookAtTeams();
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setAdding(false);
    setName("");
  };
  const go = (root: string) => {
    close();
    void setVault(root).catch((e) => notify(said(e)));
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const wanted = name.trim();
    if (!wanted) return;
    close();
    // Find the folder first; it is made and opened only after this window has saved and flushed.
    void defaultVault(false, wanted)
      .then((at) => setVault(at.root, () => defaultVault(true, wanted)))
      .catch((err) => notify(said(err)));
  };
  const accept = (w: Waiting) => {
    void join(w, "new").then(close, (e) => notify(said(e)));
  };
  // Read again whenever sync changes, since sharing or stopping rewrites the saved setting.
  const mine = useStore(app, (s) => (s.team && s.team.root === s.vault?.root ? s.team : null));
  const team = Boolean(mine);
  const known = useStore(teams, (s) => s.known);
  const answered = useStore(teams, (s) => s.home);
  const me = useStore(app, (s) => s.account);
  const online = useStore(app, (s) => s.sync.status === "online");
  const outsider = useStore(app, (s) => s.sync.status === "outsider");
  useEffect(() => void lookAtTeams(), [me?.id, online, vault?.root]);
  // A team folder goes by its team's own name; the folder's name is said beside it when it differs.
  const fact = mine ? known[mine.workspace] : undefined;
  const called = fact?.name ?? mine?.name ?? vault?.name ?? "";
  const size = outsider ? "Not a member" : howMany(fact?.members);
  const folder = (name: string, of: string) => (name === of ? "" : ` · folder ${name}`);

  return (
    <div className="switcher" ref={box}>
      <button className="vault-name" aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <span className="vault-badge">{letter(called)}</span>
        <span className="tree-name">{called}</span>
        {/* Said on the sidebar itself: work done in a private workspace, or a team of one, reaches nobody else. */}
        <span className={`switcher-kind${team ? (outsider || fact?.members === 1 ? " alone" : " team") : ""}`}>{team ? size : "Private"}</span>
        <Icon name="down" size={12} />
      </button>
      {open && (
        <div className="switcher-menu" role="menu">
          <div className="switcher-current">
            <span className="vault-badge big">{letter(called)}</span>
            <div>
              <strong>{called}</strong>
              <small>
                {!team ? "Private" : outsider ? `${me?.email ?? "This account"} is not a member of this team` : `${fact ? howMany(fact.members) : "Team workspace"}${folder(vault?.name ?? "", called)}`}
              </small>
            </div>
          </div>
          <div className="switcher-actions">
            <button onClick={() => (close(), app.set({ settings: "profile" }))}>
              <Icon name="settings" size={13} /> Settings
            </button>
            <button onClick={() => (close(), app.set({ settings: "team" }))}>
              <Icon name="team" size={13} /> {outsider ? "Team" : "Invite people"}
            </button>
          </div>
          <hr />
          <div className="switcher-list">
            {all.map((v) => {
              // Two folders of two teams with one name ("Clean 2", "Clean 3") are told apart by the team's size.
              const its = v.workspace ? known[v.workspace] : undefined;
              const name = v.team ? (its?.name ?? v.teamName ?? v.name) : v.name;
              // The relay answered and this team is not among the account's: said, not left looking like any other.
              const out = v.team && !its && answered && v.server === HOME;
              return (
              <div key={v.root} className="switcher-row">
                <button role="menuitem" title={v.root} onClick={() => go(v.root)}>
                  <span className="vault-badge">{letter(name)}</span>
                  <span className="switcher-names">
                    <span className="tree-name">{name}</span>
                    <small>{v.team ? `${out ? "Not a member" : howMany(its?.members)}${folder(v.name, name)}` : "Private"}</small>
                  </span>
                  {v.root === vault?.root && <Icon name="check" size={13} />}
                </button>
                {v.root !== vault?.root && (
                  <button
                    className="switcher-forget"
                    title="Remove from this list. The folder stays on your computer."
                    aria-label={`Remove ${v.name} from the list`}
                    onClick={() => void forgetVault(v.root).then(() => setAll((had) => had.filter((x) => x.root !== v.root)))}
                  >
                    <Icon name="close" size={11} />
                  </button>
                )}
              </div>
              );
            })}
            {waiting.map((w) => (
              <div key={w.code} className="switcher-row invite">
                <span className="vault-badge ghost">{letter(w.name)}</span>
                <span className="tree-name" title={`${whoSent(w)} invited you`}>
                  {w.name}
                </span>
                <button className="switcher-join" disabled={joining === w.code} onClick={() => accept(w)}>
                  {joining === w.code ? "Joining…" : "Join"}
                </button>
              </div>
            ))}
          </div>
          {adding ? (
            <form className="switcher-add" onSubmit={add}>
              <input autoFocus value={name} maxLength={60} placeholder="Workspace name" aria-label="Name of the new workspace" onChange={(e) => setName(e.target.value)} />
              <button className="primary" disabled={!name.trim()}>
                Create
              </button>
            </form>
          ) : (
            <button className="switcher-new" onClick={() => setAdding(true)}>
              <Icon name="plus" size={13} /> Add workspace
            </button>
          )}
          <hr />
          <button className="switcher-quiet" onClick={() => (close(), void chooseVault())}>
            Open a folder as a workspace…
          </button>
        </div>
      )}
    </div>
  );
}

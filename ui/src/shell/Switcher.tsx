/** @part-of ui.shell */
import { type FormEvent, useEffect, useRef, useState } from "react";

import { defaultVault, forgetVault, listVaults, type VaultInfo } from "../bridge/core";
import { invited, join, type Waiting, whoSent } from "../features/teams/invites";
import { Icon } from "./Icon";
import { useStore } from "./store";
import { app, chooseVault, notify, setVault } from "./workspace";

const said = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Whether a workspace is shared with a team: that is kept with the folder's sync settings. */
const shared = (root: string) => localStorage.getItem(`lokus.sync:${root}`) !== null;
const letter = (name: string) => (name.match(/[\p{L}\p{N}]/u)?.[0] ?? "L").toUpperCase();

/**
 * The workspace's name at the top of the sidebar, and the list it opens: every workspace on
 * this computer, with a way to make another. A workspace is a folder; one can be for a team
 * and the next for school, and nothing is shared between them.
 */
export function WorkspaceSwitcher() {
  const vault = useStore(app, (s) => s.vault);
  const sync = useStore(app, (s) => s.sync);
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
    if (root !== vault?.root) void setVault(root).catch((e) => notify(said(e)));
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const wanted = name.trim();
    if (!wanted) return;
    close();
    void defaultVault(true, wanted).then(
      (made) => setVault(made.root),
      (err) => notify(said(err)),
    );
  };
  const accept = (w: Waiting) => {
    void join(w, "new").then(close, (e) => notify(said(e)));
  };
  // Read again whenever sync changes, since sharing or stopping rewrites the saved setting.
  const team = Boolean(vault && sync && shared(vault.root));

  return (
    <div className="switcher" ref={box}>
      <button className="vault-name" aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <span className="vault-badge">{letter(vault?.name ?? "")}</span>
        <span className="tree-name">{vault?.name}</span>
        <Icon name="down" size={12} />
      </button>
      {open && (
        <div className="switcher-menu" role="menu">
          <div className="switcher-current">
            <span className="vault-badge big">{letter(vault?.name ?? "")}</span>
            <div>
              <strong>{vault?.name}</strong>
              <small>{team ? "Team workspace" : "Private"}</small>
            </div>
          </div>
          <div className="switcher-actions">
            <button onClick={() => (close(), app.set({ settings: "profile" }))}>
              <Icon name="settings" size={13} /> Settings
            </button>
            <button onClick={() => (close(), app.set({ settings: "team" }))}>
              <Icon name="team" size={13} /> Invite people
            </button>
          </div>
          <hr />
          <div className="switcher-list">
            {all.map((v) => (
              <div key={v.root} className="switcher-row">
                <button role="menuitem" title={v.root} onClick={() => go(v.root)}>
                  <span className="vault-badge">{letter(v.name)}</span>
                  <span className="tree-name">{v.name}</span>
                  {shared(v.root) && <span className="switcher-tag">Team</span>}
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
            ))}
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

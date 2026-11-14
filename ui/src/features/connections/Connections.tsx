/** @part-of ui.connections */
import { track } from "../../bridge/analytics";
import { useCallback, useEffect, useMemo, useState } from "react";

import { type AiConfig, aiConnectors, type AiSettings, aiSettings, checkMcp, type Connector, type McpServer, mcpLogin, mcpLogout, saveAiConfig, setAiSecret } from "../../bridge/ai";
import { Icon } from "../../shell/Icon";
import { notify } from "../../shell/workspace";
import { Toggle } from "../settings/parts";
import { Logo } from "./logos";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Offered {
  name: string;
  description: string;
  asks: boolean;
}

/**
 * Settings, Connections: the services the assistant can reach. Pick one by name and sign in;
 * nobody needs to know an address. A server that is not in the list can still be added by hand.
 */
export function Connections() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [catalog, setCatalog] = useState<Connector[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tools, setTools] = useState<Record<string, Offered[] | string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [own, setOwn] = useState({ name: "", url: "", token: "" });
  const [adding, setAdding] = useState(false);

  const reload = useCallback(() => aiSettings().then(setSettings, (e) => setNote(message(e))), []);
  useEffect(() => {
    void reload();
    void aiConnectors().then(setCatalog, () => {});
  }, [reload]);
  const kinds = useMemo(() => [...new Set(catalog.map((c) => c.kind))], [catalog]);
  if (!settings) return <p className="settings-hint">{note ?? "Loading…"}</p>;

  const { config } = settings;
  const save = async (patch: Partial<AiConfig>) => {
    const next = { ...config, ...patch };
    setSettings({ ...settings, config: next });
    await saveAiConfig(next).catch((e) => setNote(message(e)));
  };
  const added = (name: string) => config.mcp.find((s) => s.name === name);
  const signedIn = (name: string) => settings.signed_in.includes(name) || settings.tokens.includes(name);

  /** Ask a connected service what it offers, which also proves the connection works. */
  const look = async (server: McpServer) => {
    setTools((t) => ({ ...t, [server.name]: "Checking…" }));
    const found = await checkMcp(server).then(
      (list) => list as Offered[],
      (e) => message(e),
    );
    setTools((t) => ({ ...t, [server.name]: found }));
  };
  const connect = async (c: Connector) => {
    setNote(null);
    setBusy(c.id);
    const server = { name: c.id, url: c.url, enabled: true };
    try {
      await mcpLogin(server);
      track("connection_added", { service: c.id, from: "settings" });
      if (!added(c.id)) await save({ mcp: [...config.mcp, server] });
      await reload();
      notify(`${c.name} is connected`);
      setOpen(c.id);
      void look(server);
    } catch (e) {
      track("connection_failed", { service: c.id, from: "settings" });
      setNote(`${c.name}: ${message(e)}`);
    }
    setBusy(null);
  };
  const disconnect = async (name: string) => {
    await mcpLogout(name).catch(() => {});
    await setAiSecret("mcp", name, "").catch(() => {});
    await save({ mcp: config.mcp.filter((s) => s.name !== name) });
    await reload();
  };
  const addOwn = async () => {
    const name = own.name.trim().toLowerCase().replace(/\s+/g, "-");
    const url = own.url.trim();
    if (!/^[a-z0-9-]+$/.test(name) || !/^https?:\/\//.test(url) || added(name) || catalog.some((c) => c.id === name)) {
      setNote("A server needs a short name that is not taken (letters, digits and dashes) and an http(s) address.");
      return;
    }
    if (own.token.trim()) await setAiSecret("mcp", name, own.token).catch((e) => setNote(message(e)));
    await save({ mcp: [...config.mcp, { name, url, enabled: true }] });
    setOwn({ name: "", url: "", token: "" });
    setAdding(false);
    await reload();
  };

  const q = query.trim().toLowerCase();
  const shown = (c: Connector) => (!kind || c.kind === kind) && (!q || `${c.name} ${c.kind} ${c.about}`.toLowerCase().includes(q));
  const known = new Set(catalog.map((c) => c.id));
  const connected = catalog.filter((c) => added(c.id));
  const others = [...config.mcp.filter((s) => !known.has(s.name)), ...settings.plugin_servers.map((s) => ({ ...s, plugin: true }))];
  const available = catalog.filter((c) => !added(c.id) && c.ready === "yes" && shown(c));
  const waiting = catalog.filter((c) => c.ready !== "yes" && shown(c));

  /** One service that is connected: its state, a switch, and what it offers when opened. */
  const linked = (server: McpServer, id: string, name: string, about: string, plugin = false) => {
    const offered = tools[server.name];
    const isOpen = open === server.name;
    const needsSignIn = !plugin && !signedIn(server.name);
    return (
      <div key={server.name} className={`conn-row linked${isOpen ? " open" : ""}`}>
        <div className="conn-line">
          <Logo id={id} name={name} />
          <button
            className="conn-main"
            onClick={() => {
              setOpen(isOpen ? null : server.name);
              if (!isOpen && !Array.isArray(offered)) void look(server);
            }}
          >
            <strong>{name}</strong>
            <small>
              {needsSignIn ? (
                <span className="conn-state off">Not signed in</span>
              ) : (
                <span className={`conn-state${server.enabled ? "" : " off"}`}>{server.enabled ? "Connected" : "Switched off"}</span>
              )}
              {Array.isArray(offered) ? `${offered.length} tools` : about}
            </small>
          </button>
          {needsSignIn && (
            <button className="settings-button" onClick={() => void mcpLogin(server).then(reload, (e) => setNote(message(e)))}>
              Sign in
            </button>
          )}
          {!plugin && <Toggle on={server.enabled} label={`Let the assistant use ${name}`} onChange={(enabled) => void save({ mcp: config.mcp.map((m) => (m.name === server.name ? { ...m, enabled } : m)) })} />}
          <button className={`conn-chevron${isOpen ? " down" : ""}`} aria-label={`What ${name} offers`} onClick={() => setOpen(isOpen ? null : server.name)}>
            <Icon name="chevron" size={14} />
          </button>
        </div>
        {isOpen && (
          <div className="conn-detail">
            {typeof offered === "string" && <p>{offered}</p>}
            {Array.isArray(offered) && offered.length === 0 && <p>This service offers no tools.</p>}
            {Array.isArray(offered) && offered.length > 0 && (
              <ul>
                {offered.map((t) => (
                  <li key={t.name} title={t.description}>
                    <code>{t.name}</code>
                    <span>{t.description}</span>
                    <em>{t.asks ? "Asks first" : "Reads only"}</em>
                  </li>
                ))}
              </ul>
            )}
            {!plugin && (
              <div className="conn-detail-foot">
                <button className="link" onClick={() => void look(server)}>
                  Check again
                </button>
                <button className="link danger" onClick={() => void disconnect(server.name)}>
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="conn">
      <header className="conn-head">
        <div>
          <h2>Connections</h2>
          <p>Let the assistant look things up and act in the tools you already use. It works when you ask, and asks before it changes anything.</p>
        </div>
      </header>
      {note && <p className="settings-hint error">{note}</p>}

      {(connected.length > 0 || others.length > 0) && (
        <section>
          <h3>
            Connected <span>{connected.length + others.length}</span>
          </h3>
          <div className="conn-list">
            {connected.map((c) => linked(added(c.id)!, c.id, c.name, c.about))}
            {others.map((s) => linked(s, s.name, s.name, "plugin" in s ? `${s.url} · from a plugin` : s.url, "plugin" in s))}
          </div>
        </section>
      )}

      <section>
        <div className="conn-tools">
          <label className="conn-search">
            <Icon name="search" size={14} />
            <input placeholder="Search connections" value={query} spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="conn-kinds">
            <button className={kind === "" ? "active" : ""} onClick={() => setKind("")}>
              All
            </button>
            {kinds.map((k) => (
              <button key={k} className={kind === k ? "active" : ""} onClick={() => setKind(kind === k ? "" : k)}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="conn-list">
          {available.map((c) => (
            <div key={c.id} className="conn-row">
              <div className="conn-line">
                <Logo id={c.id} name={c.name} />
                <div className="conn-main">
                  <strong>
                    {c.name} <span className="conn-kind">{c.kind}</span>
                  </strong>
                  <small>{c.about}</small>
                </div>
                <button className="settings-button" disabled={busy !== null} onClick={() => void connect(c)}>
                  {busy === c.id ? (
                    "Finish in your browser…"
                  ) : (
                    <>
                      <Icon name="plus" size={13} />
                      Connect
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
          {waiting.map((c) => (
            <div key={c.id} className="conn-row soon">
              <div className="conn-line">
                <Logo id={c.id} name={c.name} />
                <div className="conn-main">
                  <strong>
                    {c.name} <span className="conn-kind">{c.kind}</span>
                  </strong>
                  <small>{c.about}</small>
                </div>
                <span className="conn-soon" title={c.ready === "not_built" ? "Runs on this Mac. Not built yet." : "This service only lets apps it has approved sign people in, and Lokus is not registered with it yet."}>
                  Coming soon
                </span>
              </div>
            </div>
          ))}
          {available.length + waiting.length === 0 && <p className="conn-none">Nothing matches. You can still add a server by its address below.</p>}
        </div>
      </section>

      <section>
        <div className="conn-list">
          <div className="conn-row">
            <div className="conn-line">
              <span className="conn-logo plain">
                <Icon name="plug" size={16} />
              </span>
              <div className="conn-main">
                <strong>Your own tool server</strong>
                <small>Connect any MCP server by its address.</small>
              </div>
              {!adding && (
                <button className="settings-button" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={13} />
                  Add
                </button>
              )}
            </div>
            {adding && (
              <div className="conn-own">
                <input autoFocus value={own.name} placeholder="Name" onChange={(e) => setOwn({ ...own, name: e.target.value })} />
                <input value={own.url} placeholder="https://example.com/mcp" onChange={(e) => setOwn({ ...own, url: e.target.value })} />
                <input type="password" value={own.token} placeholder="Token (optional)" autoComplete="off" onChange={(e) => setOwn({ ...own, token: e.target.value })} />
                <button className="settings-button" onClick={() => void addOwn()}>
                  Add
                </button>
                <button className="link" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

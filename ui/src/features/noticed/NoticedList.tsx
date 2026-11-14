/** @part-of ui.noticed */
import { useEffect, useRef, useState } from "react";

import { openWeb } from "../../bridge/updates";
import { Icon } from "../../shell/Icon";
import { Logo as ServiceLogo } from "../connections/logos";
import { Logo as CustomerLogo } from "../customers/parts";
import { useStore } from "../../shell/store";
import { app, openNote, renderMarkdown } from "../../shell/workspace";
import { Row } from "../settings/parts";
import { act, addToNote, check, exampleWatch, type Noticed, noticed, resolve, setWatchEvery, waiting, watchEvery } from "./noticed";

const ago = (seconds: number) => {
  const minutes = Math.max(1, Math.round((Date.now() / 1000 - seconds) / 60));
  return minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`;
};

/** A line as the assistant wrote it, with its **bold** shown as bold and nothing else interpreted. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part))}
    </>
  );
}

function Source({ text, source, link }: { text: string; source: string; link?: string }) {
  return (
    <li>
      <span>
        <Rich text={text} />
      </span>
      {link?.startsWith("https://") ? (
        <button className="nt-source" onClick={() => openWeb(link)}>
          {source}
        </button>
      ) : (
        <em className="nt-source">{source}</em>
      )}
    </li>
  );
}

/**
 * One thing the assistant noticed, as a row to be read at a glance: what it is, and the one
 * thing recommended, with the button that does it. The grounds for it open underneath.
 */
export function FindingRow({ item, open, onToggle }: { item: Noticed; open?: boolean; onToggle?(): void }) {
  const [busy, setBusy] = useState(false);
  const suggestion = item.kind === "suggestion";
  const title = suggestion ? `Suggestion for ${(item.path ?? "").replace(/^.*\//, "").replace(/\.md$/, "")}` : item.title;
  const go = () => {
    if (suggestion) {
      noticed.set({ open: false });
      void openNote(item.path ?? "");
      return;
    }
    setBusy(true);
    void act(item, true);
  };
  return (
    <article className={`nt-row ${item.urgency ?? "fyi"}${open ? " open" : ""}`}>
      <div className="nt-line">
        <button className="nt-main" aria-expanded={open} onClick={onToggle}>
          <span className="nt-face">
            {item.customer ? <CustomerLogo name={item.customer} size={26} /> : <ServiceLogo id={(item.evidence?.[0]?.source ?? "").toLowerCase()} name={suggestion ? "N" : (item.evidence?.[0]?.source ?? "L")} size={26} />}
            {item.urgency === "now" && <i />}
          </span>
          <span className="nt-text">
            <strong>{title}</strong>
            <small>
              {item.metric && !suggestion && <b>{item.metric}</b>}
              {suggestion ? item.why : item.recommend}
            </small>
          </span>
        </button>
        <button className="nt-go" disabled={busy} title={suggestion ? "Open the note to see the suggestion" : (item.action ?? item.recommend)} onClick={go}>
          {suggestion ? "Open" : busy ? "Doing…" : "Do it"}
        </button>
      </div>
      {open && (
        <div className="nt-more">
          {item.summary && (
            <p>
              <Rich text={item.summary} />
            </p>
          )}
          {item.evidence && item.evidence.length > 0 && (
            <ul className="nt-evidence">
              {item.evidence.slice(0, 3).map((e, i) => (
                <Source key={i} {...e} />
              ))}
            </ul>
          )}
          {item.follows && <p className="nt-follows">You chose this before: {item.follows.replace(/^- /, "")}</p>}
          <div className="nt-actions">
            <span>
              {item.customer ? `${item.customer} · ` : ""}
              {ago(item.created)}
            </span>
            {!suggestion && item.situation && (
              <button className="link" title={`Stop telling me when ${item.situation}`} onClick={() => void resolve(item, "dismissed", true)}>
                Never for things like this
              </button>
            )}
            <button className="link" onClick={() => void resolve(item, "dismissed", false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/** The Noticed list: what needs the person first, the rest behind a tab. */
export function NoticedDrawer() {
  const s = useStore(noticed, (state) => state);
  const [tab, setTab] = useState<"needs" | "fyi">("needs");
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (!s.open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && noticed.set({ open: false });
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [s.open]);
  if (!s.open) return null;
  const all = waiting(s.items).sort((a, b) => Number(b.urgency === "now") - Number(a.urgency === "now") || b.created - a.created);
  const needs = all.filter((i) => i.kind === "finding" && i.urgency !== "fyi");
  const fyi = all.filter((i) => !needs.includes(i));
  const showing = tab === "needs" && needs.length ? needs : tab === "fyi" ? fyi : needs;
  return (
    <div className="nt-scrim" onMouseDown={(e) => e.target === e.currentTarget && noticed.set({ open: false })}>
      <aside className="nt-drawer" role="dialog" aria-label="What the assistant noticed">
        <header>
          <h2>Noticed</h2>
          <button className="link" disabled={s.checking} onClick={() => void check("The user asked you to look now.")}>
            {s.checking ? "Looking…" : "Look now"}
          </button>
          <button className="news-close nt-close" aria-label="Close" onClick={() => noticed.set({ open: false })}>
            <Icon name="close" />
          </button>
        </header>
        <nav className="nt-tabs">
          <button className={tab === "needs" ? "active" : ""} onClick={() => setTab("needs")}>
            Needs you {needs.length > 0 && <b>{needs.length}</b>}
          </button>
          <button className={tab === "fyi" ? "active" : ""} onClick={() => setTab("fyi")}>
            Good to know {fyi.length > 0 && <b>{fyi.length}</b>}
          </button>
          <span>{s.checking ? "Looking now…" : s.checked ? `Looked ${ago(s.checked / 1000)}` : ""}</span>
        </nav>
        {s.problem && <p className="nt-problem">The last look did not finish: {s.problem}</p>}
        <div className="nt-list">
          {showing.length === 0 && (
            <div className="nt-empty">
              <strong>{s.checking ? "Looking…" : tab === "needs" ? "Nothing needs you." : "Nothing here."}</strong>
              {!s.checking && <span>The assistant checks your customers, tasks and tools on its own and lists what it finds here.</span>}
            </div>
          )}
          {showing.map((item) => (
            <FindingRow key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
          ))}
        </div>
      </aside>
    </div>
  );
}

/** The sidebar's way in, with how many things are waiting. */
export function NoticedButton() {
  const count = useStore(noticed, (s) => waiting(s.items).length);
  const checking = useStore(noticed, (s) => s.checking);
  return (
    <button onClick={() => noticed.set({ open: true })}>
      <Icon name="activity" />
      <span>Noticed</span>
      {checking ? <em className="nt-busy" title="Looking now" /> : count > 0 ? <b className="nt-count">{count}</b> : null}
    </button>
  );
}

function Proposed({ text }: { text: string }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => (mount.current ? renderMarkdown(mount.current, text) : undefined), [text]);
  return <div className="nt-proposed" ref={mount} />;
}

/**
 * On a note: text the assistant proposes for it. It is not part of the note, and nobody else
 * sees it, until "Add to note" is pressed.
 */
export function NoteSuggestions({ path }: { path: string }) {
  const items = useStore(noticed, (s) => s.items);
  const mine = items.filter((i) => i.kind === "suggestion" && i.state === "new" && i.path === path);
  if (!mine.length) return null;
  return (
    <div className="nt-on-note">
      {mine.map((item) => (
        <section key={item.id} className="nt-suggestion">
          <p className="nt-kind">
            <Icon name="assistant" size={12} />
            Suggested by the assistant
            <span>Not part of this note yet. Only you can see it.</span>
          </p>
          <Proposed text={item.text ?? ""} />
          <p className="nt-why">
            {item.why}
            {item.link?.startsWith("https://") && (
              <button className="nt-source" onClick={() => openWeb(item.link ?? "")}>
                See where
              </button>
            )}
          </p>
          <div className="nt-actions">
            <button className="primary" onClick={() => void addToNote(item)}>
              {item.after ? `Add under “${item.after}”` : "Add to note"}
            </button>
            <button className="link" onClick={() => void resolve(item, "dismissed", false)}>
              Dismiss
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

/** The start page's share of it: up to three rows, and the way to the rest. */
export function NoticedOnStart() {
  const items = useStore(noticed, (s) => s.items);
  const all = waiting(items).sort((a, b) => Number(b.urgency === "now") - Number(a.urgency === "now") || b.created - a.created);
  if (!all.length) return null;
  return (
    <>
      <h2>
        Noticed for you
        {all.length > 3 && (
          <button className="link" onClick={() => noticed.set({ open: true })}>
            All {all.length}
          </button>
        )}
      </h2>
      <div className="nt-start">
        {all.slice(0, 3).map((item) => (
          <FindingRow key={item.id} item={item} onToggle={() => noticed.set({ open: true })} />
        ))}
      </div>
    </>
  );
}

const EVERY: Record<string, string> = { "0": "Off", "15": "Every 15 min", "30": "Every 30 min", "60": "Hourly" };

/** Settings, Assistant: how often it looks on its own. */
export function WatchSettings() {
  const [every, setEvery] = useState(String(watchEvery()));
  const vault = useStore(app, (s) => s.vault);
  return (
    <>
      <h3>Working on its own</h3>
      <p className="settings-hint">
        While Lokus is open, the assistant looks over your customers, tasks and connected tools and leaves what it finds under Noticed. It changes nothing until you say so. Each look uses your model plan or key, like a question would.
      </p>
      <Row label="Look on its own" hint="It also looks when new customer information arrives from your own systems.">
        <div className="segmented">
          {Object.entries(EVERY).map(([value, label]) => (
            <button
              key={value}
              className={value === every ? "active" : ""}
              onClick={() => {
                setEvery(value);
                setWatchEvery(Number(value));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Your own watches" hint={`A note in the folder “watches” with “type: watch” and “every: 60” (minutes) is something extra to check each time. Write what to look for in plain words.`}>
        <button
          className="settings-button"
          disabled={!vault}
          onClick={() => void exampleWatch()}
        >
          Make an example
        </button>
      </Row>
    </>
  );
}

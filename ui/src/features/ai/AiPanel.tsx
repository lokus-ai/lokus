/** @part-of ui.ai */
import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Entry } from "../../bridge/core";

import { Icon } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { allFiles, app, getEditor, notify, renderMarkdown } from "../../shell/workspace";
import { aiSettings } from "../../bridge/ai";
import { Logo } from "../connections/logos";
import { type Customer, loadCustomers, show as shown, threads, tone } from "../customers/data";
import { answer, answerAll, ask, chat, forgetChat, type Item, type Kept, keptChats, openChat, reply, stop } from "./chat";
import { ModelPicker } from "./ModelPicker";

const TOOLS: Record<string, (input: Record<string, unknown>) => string> = {
  search_notes: (i) => `Searching notes for “${String(i.query ?? "")}”`,
  read_note: (i) => `Reading ${String(i.path ?? "a note")}`,
  list_folder: (i) => `Looking in ${String(i.path || "the vault")}`,
  move_note: (i) => `Move ${String(i.path ?? "a note")} to ${String(i.to ?? "")}`,
  open_note: (i) => `Opening ${String(i.path ?? "a note")}`,
  show_graph: () => "Showing the graph",
  get_backlinks: (i) => `Finding links to ${String(i.path ?? "a note")}`,
  create_note: (i) => `Create ${String(i.path ?? "a note")}`,
  edit_note: (i) => `Edit ${String(i.path ?? "a note")}`,
  set_property: (i) => `Set ${String(i.key ?? "a property")} on ${String(i.path ?? "a note")}`,
  list_customers: () => "Looking at your customers",
  list_tasks: () => "Looking at the board",
  record_task: (i) => (i.key ? `Update ${String(i.key)}${i.status ? `: ${String(i.status)}` : ""}` : `Add a task: ${String(i.title ?? "")}`),
  remember: (i) => `Remembered: ${String(i.fact ?? "")}`,
  record_customer: (i) => {
    const event = i.event as { title?: string; kind?: string } | undefined;
    const person = i.person as { name?: string } | undefined;
    const what = event?.title ? `: ${event.title}` : person?.name ? `: ${person.name}` : "";
    return `Record ${String(i.name ?? i.customer ?? "a customer")}${what}`;
  },
};

/** The connected service a tool belongs to, and the tool's own name; null for a tool that is ours. */
function service(name: string): { id: string; tool: string } | null {
  const [, id, tool] = name.match(/^mcp__(.+?)__(.+)$/) ?? [];
  return tool ? { id, tool } : null;
}

const titled = (word: string) => word.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function describe(name: string, input: Record<string, unknown>): string {
  if (TOOLS[name]) return TOOLS[name](input);
  const from = service(name);
  return from ? `${titled(from.id)}: ${from.tool.replace(/^[a-z]+-/, "").replace(/[-_]+/g, " ")}` : name;
}

/** What a change would do, shown before the person allows it. */
function detail(name: string, input: Record<string, unknown>): string {
  if (name === "edit_note") return input.old_text ? `− ${String(input.old_text)}\n+ ${String(input.new_text ?? "")}` : `+ ${String(input.new_text ?? "")}`;
  if (name === "create_note") return String(input.text ?? "");
  if (name === "set_property") return `${String(input.key)}: ${JSON.stringify(input.value)}`;
  return JSON.stringify(input, null, 2);
}

/** Markdown drawn the way a note is. */
function Rendered({ text }: { text: string }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => (mount.current ? renderMarkdown(mount.current, text) : undefined), [text]);
  return <div ref={mount} />;
}

/** An answer, rendered the way a note is. While it streams it is plain text. */
function Answer({ text, live }: { text: string; live: boolean }) {
  if (live) return <div className="ai-answer plain">{text}</div>;
  return (
    <div className="ai-answer">
      <Rendered text={text} />
      <div className="ai-actions">
        <button onClick={() => void navigator.clipboard.writeText(text).then(() => notify("Copied"))}>Copy</button>
        {getEditor() && app.get().active && <button onClick={() => getEditor()?.insert(text)}>Insert into note</button>}
      </div>
    </div>
  );
}

function Tool({ item }: { item: Extract<Item, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const asking = item.status === "asking";
  return (
    <div className={`ai-tool ${item.status}`}>
      <button className="ai-tool-head" onClick={() => setOpen((o) => !o)}>
        <Mark step={item} />
        <span className="tree-name">{asking ? `Allow this? ${describe(item.name, item.input)}` : describe(item.name, item.input)}</span>
        {item.status === "failed" && <span className="ai-tool-note">not done</span>}
      </button>
      {(asking || open) && <pre className="ai-tool-detail">{asking || !item.result ? detail(item.name, item.input) : item.result}</pre>}
      {asking && (
        <div className="ai-ask">
          <button className="primary" onClick={() => answer(item.id, true)}>
            Allow
          </button>
          <button title="Allow this and every further change of the same kind until this request is finished" onClick={() => answerAll(item.id)}>
            Allow all like this
          </button>
          <button onClick={() => answer(item.id, false)}>Decline</button>
        </div>
      )}
    </div>
  );
}

type Step = Extract<Item, { kind: "tool" }>;

/** The small picture beside a step: the service's mark, or a dot for our own tools. */
function Mark({ step }: { step: Step }) {
  const from = service(step.name);
  return from ? <Logo id={from.id} name={from.id} size={16} /> : <span className={`ai-dot ${step.status}`} />;
}

/**
 * The work between a question and its answer, folded into one line: what it is doing now, or
 * once done, where it looked. Opening it shows every step and what each returned.
 */
function Steps({ steps, live }: { steps: Step[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const current = steps[steps.length - 1];
  const running = live && current.status === "running";
  const places = [...new Set(steps.map((s) => (service(s.name) ? titled(service(s.name)!.id) : "your notes")))];
  const failed = steps.filter((s) => s.status === "failed").length;
  const summary = running
    ? describe(current.name, current.input)
    : `Looked in ${places.length > 1 ? `${places.slice(0, -1).join(", ")} and ${places[places.length - 1]}` : places[0]}`;
  return (
    <div className={`ai-steps${open ? " open" : ""}`}>
      <button className="ai-steps-head" onClick={() => setOpen((o) => !o)}>
        <span className="ai-steps-marks">
          {[...new Map(steps.map((s) => [service(s.name)?.id ?? "", s])).values()].slice(0, 4).map((s) => (
            <Mark key={s.id} step={running ? { ...s, status: "running" } : s} />
          ))}
        </span>
        <span className={`tree-name${running ? " ai-working" : ""}`}>{summary}</span>
        <small>
          {steps.length} {steps.length === 1 ? "step" : "steps"}
          {failed ? `, ${failed} not done` : ""}
        </small>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <div className="ai-steps-list">
          {steps.map((step) => (
            <div key={step.id}>
              <button className="ai-step" onClick={() => setShown(shown === step.id ? null : step.id)}>
                <Mark step={step} />
                <span className="tree-name">{describe(step.name, step.input)}</span>
                {step.status === "failed" && <small>not done</small>}
              </button>
              {shown === step.id && <pre className="ai-tool-detail">{step.result || detail(step.name, step.input)}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A question the assistant asked: pick an answer, or type another. */
function Question({ item }: { item: Extract<Item, { kind: "question" }> }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  if (item.answer) {
    return (
      <div className="ai-asked">
        <Rendered text={item.question} />
        <strong>{item.answer}</strong>
      </div>
    );
  }
  const choose = (option: string) => {
    if (!item.multiple) return reply(item.id, option);
    setPicked((p) => (p.includes(option) ? p.filter((o) => o !== option) : [...p, option]));
  };
  const send = () => reply(item.id, [...picked, other.trim()].filter(Boolean).join(", "));
  return (
    <div className="ai-question">
      <div className="ai-question-text">
        <Rendered text={item.question} />
      </div>
      {item.multiple && <small>Choose any that apply.</small>}
      <div className="ai-options">
        {item.options.map((option, i) => (
          <button key={option} className={picked.includes(option) ? "on" : ""} onClick={() => choose(option)}>
            <kbd>{item.multiple ? (picked.includes(option) ? "✓" : "") : i + 1}</kbd>
            <span>{option}</span>
          </button>
        ))}
        <input
          value={other}
          placeholder="Something else"
          aria-label="Your own answer"
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (other.trim() || picked.length)) send();
          }}
        />
      </div>
      {(item.multiple || other.trim()) && (
        <div className="ai-ask">
          <button className="primary" disabled={!picked.length && !other.trim()} onClick={send}>
            Answer
          </button>
        </div>
      )}
    </div>
  );
}

const DAY = 86_400_000;
function when(at: number): string {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}

/** Earlier conversations kept on this device: pick one to continue it. */
function Earlier() {
  const [kept, setKept] = useState<Kept[] | null>(null);
  const [query, setQuery] = useState("");
  const load = () => void keptChats().then(setKept);
  useEffect(load, []);
  const q = query.trim().toLowerCase();
  const shown = (kept ?? []).filter((c) => !q || c.title.toLowerCase().includes(q));
  return (
    <div className="ai ai-history">
      <label className="ai-history-search">
        <Icon name="search" size={14} />
        <input autoFocus placeholder="Search conversations" value={query} spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="ai-history-list">
        {kept !== null && shown.length === 0 && <p>{kept.length ? "Nothing matches." : "No conversations yet. They are kept on this computer only."}</p>}
        {shown.map((c, i) => (
          <div key={c.id}>
            {(i === 0 || when(shown[i - 1].updated) !== when(c.updated)) && <h4>{when(c.updated)}</h4>}
            <div className="ai-history-row">
              <button className="tree-name" onClick={() => void openChat(c.id)}>
                {c.title || "Untitled"}
              </button>
              <button className="ai-history-forget" title="Delete this conversation" onClick={() => void forgetChat(c.id).then(load)}>
                <Icon name="close" size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Items as they are drawn: a run of finished or running steps becomes one block. */
type Block = { kind: "steps"; steps: Step[]; live: boolean } | { kind: "item"; item: Item };

function blocks(items: Item[], busy: boolean): Block[] {
  const out: Block[] = [];
  items.forEach((item, i) => {
    if (item.kind === "tool" && item.status !== "asking") {
      const last = out[out.length - 1];
      if (last?.kind === "steps") last.steps.push(item);
      else out.push({ kind: "steps", steps: [item], live: false });
      if (busy && i === items.length - 1) out[out.length - 1] = { ...(out[out.length - 1] as Extract<Block, { kind: "steps" }>), live: true };
    } else out.push({ kind: "item", item });
  });
  return out;
}

/** A note or folder that can be pointed at with @. A folder's path ends in "/". */
interface Target {
  path: string;
  name: string;
}

const noteName = (path: string) => path.split("/").pop()!.replace(/\.md$/i, "");

function folders(entries: Entry[], out: Target[] = []): Target[] {
  for (const e of entries) {
    if (e.kind !== "folder") continue;
    out.push({ path: `${e.path}/`, name: `${e.name}/` });
    folders(e.children ?? [], out);
  }
  return out;
}

/** The `@word` being typed just before the caret, if there is one. */
function mentionAt(text: string, caret: number): { from: number; query: string } | null {
  const found = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return found ? { from: caret - found[2].length - 1, query: found[2].toLowerCase() } : null;
}

const STARTERS = ["Summarise the open note", "What is still unfinished in this note?", "Which notes are related to this one?"];
/** Offered as well once a service is connected, since the question can then reach outside the notes. */
const WITH_SERVICES = "What needs my attention across my tools today?";

export function AiPanel() {
  const items = useStore(chat, (s) => s.items);
  const busy = useStore(chat, (s) => s.busy);
  const history = useStore(chat, (s) => s.history);
  const note = useStore(app, (s) => s.active);
  const [draft, setDraft] = useState("");
  const tree = useStore(app, (s) => s.tree);
  /** What has been pointed at with @ for the message being written. */
  const [mentions, setMentions] = useState<Target[]>([]);
  /** The `@word` under the caret and which suggestion is highlighted; null when not picking. */
  const [picking, setPicking] = useState<{ from: number; query: string; at: number } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  /** Things worth doing right now, read from the customers; offered before the first question. */
  const [nudges, setNudges] = useState<string[]>([]);
  const version = useStore(app, (s) => s.version);
  useEffect(() => {
    void loadCustomers("customers").then(
      (all: Customer[]) => {
        const waiting = all.filter((c) => threads(c.items).some((t) => t.waiting));
        const risky = all.filter((c) => tone(shown(c.props.health)) === "risk");
        const out: string[] = [];
        if (waiting.length) out.push(`Draft replies to the ${waiting.length} ${waiting.length === 1 ? "customer" : "customers"} waiting on us`);
        if (risky.length) out.push(`What should we do about ${risky[0].name}?`);
        if (all.length) out.push("Which customers need attention today?");
        setNudges(out.slice(0, 3));
      },
      () => setNudges([]),
    );
  }, [version]);
  /** The services the assistant can use right now. */
  const [services, setServices] = useState<string[]>([]);
  const settingsOpen = useStore(app, (s) => s.settings);
  useEffect(() => {
    if (settingsOpen) return;
    void aiSettings().then(
      (s) => setServices([...s.config.mcp.filter((m) => m.enabled), ...s.plugin_servers].map((m) => m.name)),
      () => {},
    );
  }, [settingsOpen]);

  useLayoutEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [items]);
  useEffect(() => input.current?.focus(), [items.length === 0]);
  // The box grows with what is typed, up to a few lines.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft]);

  const targets = useMemo<Target[]>(
    () => [...allFiles(tree).filter((p) => /\.md$/i.test(p)).map((path) => ({ path, name: noteName(path) })), ...folders(tree)],
    [tree],
  );
  const options = useMemo(() => {
    if (!picking) return [];
    const q = picking.query;
    const starts = targets.filter((t) => t.name.toLowerCase().startsWith(q));
    // A note matches on its own name, not on the folder it happens to sit in.
    const holds = targets.filter((t) => !t.name.toLowerCase().startsWith(q) && t.name.toLowerCase().includes(q));
    return [...starts, ...holds].slice(0, 8);
  }, [picking, targets]);

  const send = () => {
    if (!draft.trim() || busy) return;
    // Only what is still written in the message counts as pointed at.
    void ask(draft, mentions.filter((m) => draft.includes(`@${m.name}`)).map((m) => m.path));
    setDraft("");
    setMentions([]);
    setPicking(null);
  };
  const track = (text: string, caret: number) => {
    const found = mentionAt(text, caret);
    setPicking(found ? { ...found, at: 0 } : null);
  };
  const choose = (target: Target) => {
    if (!picking) return;
    const el = input.current;
    const caret = el?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, picking.from)}@${target.name} ${draft.slice(caret)}`;
    setDraft(next);
    setMentions((m) => (m.some((x) => x.path === target.path) ? m : [...m, target]));
    setPicking(null);
    const place = picking.from + target.name.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(place, place);
    });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (picking && options.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setPicking({ ...picking, at: (picking.at + step + options.length) % options.length });
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
        e.preventDefault();
        choose(options[picking.at]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPicking(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  const last = items[items.length - 1];
  const waiting = busy && !(last?.kind === "assistant" && last.live) && !(last?.kind === "tool") && !(last?.kind === "question" && !last.answer);
  const openName = note ? noteName(note) : null;
  const pointed = mentions.filter((m) => draft.includes(`@${m.name}`));

  const compose = (
    <div className="ai-compose" onClick={() => input.current?.focus()}>
      {picking && options.length > 0 && (
        <div className="ai-mentions" onMouseDown={(e) => e.preventDefault()}>
          {options.map((t, i) => (
            <button key={t.path} className={i === picking.at ? "active" : ""} onMouseEnter={() => setPicking({ ...picking, at: i })} onClick={() => choose(t)}>
              <Icon name={t.path.endsWith("/") ? "folder" : "note"} size={14} />
              <span className="tree-name">{t.name}</span>
              <small className="tree-name">{t.path.endsWith("/") ? t.path.slice(0, -t.name.length) : t.path.includes("/") ? t.path.slice(0, t.path.lastIndexOf("/")) : ""}</small>
            </button>
          ))}
        </div>
      )}
      {(openName || pointed.length > 0) && (
        <div className="ai-contexts">
          {openName && (
            <span className="ai-context" title="The open note is sent along with your question">
              <Icon name="note" size={12} />
              <span className="tree-name">{openName}</span>
            </span>
          )}
          {pointed
            .filter((m) => m.path !== note)
            .map((m) => (
              <span key={m.path} className="ai-context" title={m.path}>
                <Icon name={m.path.endsWith("/") ? "folder" : "note"} size={12} />
                <span className="tree-name">{m.name}</span>
              </span>
            ))}
        </div>
      )}
      <textarea
        ref={input}
        rows={1}
        value={draft}
        placeholder="Ask about your notes, @ to point at one"
        onChange={(e) => {
          setDraft(e.target.value);
          track(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKey}
        onClick={(e) => track(e.currentTarget.value, e.currentTarget.selectionStart)}
        onBlur={() => setPicking(null)}
      />
      <div className="ai-compose-row" onClick={(e) => e.stopPropagation()}>
        <ModelPicker />
        <button className="ai-services" title={services.length ? `Connected: ${services.map(titled).join(", ")}` : "Connect the tools you use"} onClick={() => app.set({ settings: "connections" })}>
          {services.slice(0, 4).map((id) => (
            <Logo key={id} id={id} name={id} size={18} />
          ))}
          {services.length === 0 && (
            <>
              <Icon name="plug" size={13} />
              Connect tools
            </>
          )}
          {services.length > 4 && <small>+{services.length - 4}</small>}
        </button>
        {busy ? (
          <button className="ai-send" title="Stop" onClick={stop}>
            <Icon name="stop" size={11} />
          </button>
        ) : (
          <button className="ai-send" title="Send (Enter)" onClick={send} disabled={!draft.trim()}>
            <Icon name="send" size={15} />
          </button>
        )}
      </div>
    </div>
  );

  if (history) return <Earlier />;

  // Before the first question the box sits in the middle with a few ways to start; after it, the
  // conversation takes the space and the box stays at the bottom.
  if (items.length === 0) {
    return (
      <div className="ai ai-start">
        <h2>What do you want to know?</h2>
        <p>
          {services.length
            ? `It can search your notes and ${services.map(titled).join(", ")}, and asks before it changes anything.`
            : "It can search and read this vault, and asks before it changes anything."}
        </p>
        {compose}
        <div className="ai-starters">
          {[...nudges, ...(services.length ? [WITH_SERVICES] : []), ...(nudges.length ? [] : STARTERS)].slice(0, 5).map((text) => (
            <button
              key={text}
              onClick={() => {
                setDraft(text);
                input.current?.focus();
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ai">
      <div className="ai-scroll" ref={scroll}>
        {blocks(items, busy).map((block, i) => {
          if (block.kind === "steps") return <Steps key={i} steps={block.steps} live={block.live} />;
          const item = block.item;
          return item.kind === "user" ? (
            <div key={i} className="ai-user">
              {item.text}
            </div>
          ) : item.kind === "assistant" ? (
            // A reply that is only white space (some models send one before using a tool) is not shown.
            item.text.trim() ? <Answer key={i} text={item.text} live={item.live} /> : null
          ) : item.kind === "tool" ? (
            <Tool key={i} item={item} />
          ) : item.kind === "question" ? (
            <Question key={i} item={item} />
          ) : (
            <div key={i} className={`ai-notice${item.error ? " error" : ""}`}>
              <span>{item.text.replace(/^./, (c) => c.toUpperCase())}</span>
              {(item.code === "no_key" || item.code === "no_model" || item.code === "bad_key") && <button onClick={() => app.set({ settings: "assistant" })}>Open settings</button>}
            </div>
          );
        })}
        {waiting && <div className="ai-thinking">Thinking…</div>}
      </div>
      {compose}
    </div>
  );
}

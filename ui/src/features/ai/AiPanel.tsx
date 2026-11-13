/** @part-of ui.ai */
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

import { runCommand } from "../../shell/commands";
import { useStore } from "../../shell/store";
import { getEditor, notify } from "../../shell/workspace";
import { answer, ask, chat, type Item, newChat, stop } from "./chat";

const TOOLS: Record<string, (input: Record<string, unknown>) => string> = {
  search_notes: (i) => `Searching notes for “${String(i.query ?? "")}”`,
  read_note: (i) => `Reading ${String(i.path ?? "a note")}`,
  list_notes: () => "Listing notes",
  get_backlinks: (i) => `Finding links to ${String(i.path ?? "a note")}`,
  create_note: (i) => `Create ${String(i.path ?? "a note")}`,
  edit_note: (i) => `Edit ${String(i.path ?? "a note")}`,
  set_property: (i) => `Set ${String(i.key ?? "a property")} on ${String(i.path ?? "a note")}`,
};

function describe(name: string, input: Record<string, unknown>): string {
  if (TOOLS[name]) return TOOLS[name](input);
  const [, server, tool] = name.match(/^mcp__(.+?)__(.+)$/) ?? [];
  return tool ? `${server}: ${tool.replace(/_/g, " ")}` : name;
}

/** What a change would do, shown before the person allows it. */
function detail(name: string, input: Record<string, unknown>): string {
  if (name === "edit_note") return input.old_text ? `− ${String(input.old_text)}\n+ ${String(input.new_text ?? "")}` : `+ ${String(input.new_text ?? "")}`;
  if (name === "create_note") return String(input.text ?? "");
  if (name === "set_property") return `${String(input.key)}: ${JSON.stringify(input.value)}`;
  return JSON.stringify(input, null, 2);
}

/** An answer, rendered the way a note is. While it streams it is plain text. */
function Answer({ text, live }: { text: string; live: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = getEditor();
    if (live || !mount.current || !editor) return;
    return editor.preview(mount.current, text);
  }, [text, live]);
  if (live || !getEditor()) return <div className="ai-answer plain">{text}</div>;
  return (
    <div className="ai-answer">
      <div ref={mount} />
      <div className="ai-actions">
        <button onClick={() => void navigator.clipboard.writeText(text).then(() => notify("Copied"))}>Copy</button>
        <button onClick={() => getEditor()?.insert(text)}>Insert into note</button>
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
        <span className="ai-tool-dot" />
        <span className="tree-name">{describe(item.name, item.input)}</span>
        {item.status === "failed" && <span className="ai-tool-note">not done</span>}
      </button>
      {(asking || open) && <pre className="ai-tool-detail">{asking || !item.result ? detail(item.name, item.input) : item.result}</pre>}
      {asking && (
        <div className="ai-ask">
          <button className="primary" onClick={() => answer(item.id, true)}>
            Allow
          </button>
          <button onClick={() => answer(item.id, false)}>Decline</button>
        </div>
      )}
    </div>
  );
}

export function AiPanel() {
  const items = useStore(chat, (s) => s.items);
  const busy = useStore(chat, (s) => s.busy);
  const [draft, setDraft] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [items]);
  useEffect(() => input.current?.focus(), []);

  const send = () => {
    if (!draft.trim() || busy) return;
    void ask(draft);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  const last = items[items.length - 1];
  const waiting = busy && !(last?.kind === "assistant" && last.live) && !(last?.kind === "tool" && last.status === "asking");

  return (
    <div className="ai">
      <div className="ai-scroll" ref={scroll}>
        {items.length === 0 && (
          <div className="ai-empty">
            <p>Ask about your notes</p>
            <span>The assistant can search and read this vault. It asks before it changes anything.</span>
          </div>
        )}
        {items.map((item, i) =>
          item.kind === "user" ? (
            <div key={i} className="ai-user">
              {item.text}
            </div>
          ) : item.kind === "assistant" ? (
            <Answer key={i} text={item.text} live={item.live} />
          ) : item.kind === "tool" ? (
            <Tool key={i} item={item} />
          ) : (
            <div key={i} className={`ai-notice${item.error ? " error" : ""}`}>
              {item.text}
              {(item.code === "no_key" || item.code === "no_model" || item.code === "bad_key") && (
                <button className="link" onClick={() => void runCommand("settings.open")}>
                  Open settings
                </button>
              )}
            </div>
          ),
        )}
        {waiting && <div className="ai-thinking">Thinking…</div>}
      </div>
      <div className="ai-compose">
        <textarea
          ref={input}
          rows={2}
          value={draft}
          placeholder="Ask anything…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="ai-compose-row">
          <button className="link" onClick={newChat} disabled={items.length === 0}>
            New chat
          </button>
          {busy ? (
            <button className="ai-send" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className="ai-send primary" onClick={send} disabled={!draft.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

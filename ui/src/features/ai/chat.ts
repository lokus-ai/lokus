/** @part-of ui.ai */
import { aiApprove, type AiEvent, aiSend, aiStop, onAiEvent } from "../../bridge/ai";
import { createStore } from "../../shell/store";
import { app, getEditor } from "../../shell/workspace";

/** One thing shown in the conversation. */
export type Item =
  | { kind: "user"; text: string; note?: string }
  | { kind: "assistant"; text: string; live: boolean }
  | { kind: "tool"; id: string; name: string; input: Record<string, unknown>; status: "asking" | "running" | "ok" | "failed"; result?: string }
  | { kind: "notice"; text: string; error?: boolean; code?: string };

export const chat = createStore<{ items: Item[]; busy: boolean }>({ items: [], busy: false });

/** Notes longer than this are named but not attached; the assistant can still read them. */
const ATTACH_LIMIT = 60_000;
let chatId = `chat-${Date.now()}`;
/** The conversation as the provider needs it back. Never shown, never edited. */
let history: unknown[] = [];
let listening = false;

const update = (change: (items: Item[]) => Item[]) => chat.set((s) => ({ items: change(s.items) }));

function onEvent(event: AiEvent): void {
  update((items) => {
    const last = items[items.length - 1];
    switch (event.type) {
      case "text":
        if (last?.kind === "assistant" && last.live) return [...items.slice(0, -1), { ...last, text: last.text + event.delta }];
        return [...items, { kind: "assistant", text: event.delta, live: true }];
      case "tool":
        return [...settle(items), { kind: "tool", id: event.id, name: event.name, input: event.input, status: event.asks ? "asking" : "running" }];
      case "tool_done":
        return items.map((i) => (i.kind === "tool" && i.id === event.id ? { ...i, status: event.ok ? "ok" : "failed", result: event.result } : i));
      case "notice":
        return [...items, { kind: "notice", text: event.message }];
    }
  });
}

/** Nothing is streaming any more. */
const settle = (items: Item[]): Item[] =>
  items.map((i) => (i.kind === "assistant" && i.live ? { ...i, live: false } : i.kind === "tool" && (i.status === "asking" || i.status === "running") ? { ...i, status: "failed" } : i));

const STOPPED: Record<string, string> = {
  refusal: "The model declined to answer this.",
  max_tokens: "The answer was cut off because it reached the length limit.",
};

export async function ask(text: string): Promise<void> {
  const question = text.trim();
  if (!question || chat.get().busy) return;
  if (!listening) {
    listening = true;
    onAiEvent((id, event) => id === chatId && onEvent(event));
  }
  const note = app.get().active;
  const open = note ? getEditor()?.text : undefined;
  const context =
    note && open !== undefined
      ? open.length <= ATTACH_LIMIT
        ? `<open_note path="${note}">\n${open}\n</open_note>\n\n`
        : `The note open now is ${note} (too long to attach; read it with the tools if needed).\n\n`
      : "";
  const message = { role: "user", content: context + question };
  chat.set((s) => ({ busy: true, items: [...s.items, { kind: "user", text: question, note: note ?? undefined }] }));
  const sending = chatId;
  try {
    const outcome = await aiSend(sending, [...history, message]);
    if (sending !== chatId) return;
    history = [...history, message, ...outcome.messages];
    update((items) => (STOPPED[outcome.stop] ? [...settle(items), { kind: "notice", text: STOPPED[outcome.stop] }] : settle(items)));
  } catch (e) {
    if (sending !== chatId) return;
    const err = e as { code?: string; message?: string };
    update((items) => [...settle(items), { kind: "notice", text: err.code === "stopped" ? "Stopped." : (err.message ?? String(e)), error: err.code !== "stopped", code: err.code }]);
  } finally {
    if (sending === chatId) chat.set({ busy: false });
  }
}

export function stop(): void {
  void aiStop(chatId);
}

export function answer(id: string, allow: boolean): void {
  update((items) => items.map((i) => (i.kind === "tool" && i.id === id && i.status === "asking" ? { ...i, status: "running" } : i)));
  void aiApprove(id, allow);
}

export function newChat(): void {
  if (chat.get().busy) stop();
  chatId = `chat-${Date.now()}`;
  history = [];
  chat.set({ items: [], busy: false });
}

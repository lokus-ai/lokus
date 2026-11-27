/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { toCoreError } from "./core";

export interface McpServer {
  name: string;
  url: string;
  enabled: boolean;
}

/** A service offered by name. `ready` says whether a person can connect it today. An empty `url` means it is read on this computer (iMessage), with nothing to sign in to. */
export interface Connector {
  id: string;
  name: string;
  about: string;
  url: string;
  kind: string;
  /** `mac_only`: read on the computer itself, and this one is not a Mac. */
  ready: "yes" | "needs_registration" | "mac_only";
  token_url: string | null;
}

export interface AiConfig {
  provider: "anthropic" | "openai" | "chatgpt";
  /** Empty means the provider's default. */
  model: string;
  base_url: string;
  auto_approve: boolean;
  mcp: McpServer[];
  /** The team's own systems, called as they are. */
  apis?: OwnApi[];
  /** The workspace folder `mcp` and `apis` belong to; empty when no workspace is open. Send it back as it came. */
  root: string;
}

/** A team's own API: its address, and a few words for the assistant on where to start. */
export interface OwnApi {
  name: string;
  url: string;
  about: string;
  enabled: boolean;
}

/** Settings as the window sees them. Keys stay in the keychain; only whether one exists is known here. */
export interface AiSettings {
  config: AiConfig;
  /** The name of the workspace the connections belong to. */
  workspace: string;
  keys: { anthropic: boolean; openai: boolean; chatgpt: boolean };
  /** Names of tool servers that have a token stored. */
  tokens: string[];
  /** Names of tool servers the person has signed in to. */
  signed_in: string[];
  plugin_servers: McpServer[];
  /** Which of the team's own systems have a key saved. */
  api_keys?: string[];
}

export type AiEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; input: Record<string, unknown>; asks: boolean }
  | { type: "tool_done"; id: string; ok: boolean; result: string }
  | { type: "notice"; message: string }
  | { type: "compacted"; summary: string; kept_turns: number }
  | { type: "helper"; id: string; name: string; call: string; state: Helper["state"]; tool: string | null; input: Record<string, unknown> | null; asked: number; error: string | null }
  | { type: "research"; topic: string; stage: Stage; note: string | null };

export type Stage = "plan" | "gather" | "check" | "report" | "changes";

export interface AiOutcome {
  /** Messages to add to the conversation. Opaque here; they are sent back as they are. */
  messages: unknown[];
  stop: string;
  /** What it took: the model, how many times it was asked, tokens (0 when the provider does not say), tools used. */
  model: string;
  rounds: number;
  input_tokens: number;
  output_tokens: number;
  tools: string[];
  /** What the first request was made of, in characters, by part. */
  context: { instructions: number; briefing: number; conversation: number; tools: Record<string, { count: number; chars: number }> };
  /** Every message this request added, whether or not a summary was made on the way. */
  turn: unknown[];
  /** Set when the conversation was compacted on the way: carry on from this, then `messages`. */
  replaced: unknown[] | null;
  /** How many messages from the front of what was sent the summary stands in for. */
  dropped: number;
  /** Tokens the provider counted for the last request and its answer (0 when it does not say), and the model's limit when known. */
  used: number;
  limit: number | null;
  /** What the conversation is made of, in characters by kind. */
  parts: Record<string, number>;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    throw toCoreError(raw);
  }
}

export const aiSettings = () => call<AiSettings>("ai_settings");
export const saveAiConfig = (config: AiConfig) => call<void>("ai_settings_save", { config });
/** Store a provider key, or a key of one of the workspace `root`'s connections, in the keychain; an empty value removes it. */
export const setAiSecret = (kind: "provider" | "mcp" | "api", name: string, value: string, root = "") => call<void>("ai_secret_set", { kind, name, value, root });
export const aiModels = () => call<string[]>("ai_models");
// A connection belongs to one workspace: `root` is the folder of the one it is made, checked or removed in.
export const checkMcp = (root: string, server: McpServer, token?: string) => call<{ name: string; description: string; asks: boolean }[]>("ai_mcp_check", { server, token, root });
export const saveMcpToken = (root: string, server: McpServer, token: string) => call<void>("ai_mcp_token_save", { server, token, root });
export const aiConnectors = () => call<Connector[]>("ai_connectors");
/** Sign in to a tool server in the browser and keep it among `root`'s connections; resolves when the browser has come back. */
export const mcpLogin = (root: string, server: McpServer) => call<void>("ai_mcp_login", { server, root });
/** Show the Full Disk Access list in System Settings. */
export const openDiskAccess = () => call<void>("ai_open_disk_access");
export const mcpLogout = (root: string, name: string) => call<void>("ai_mcp_logout", { name, root });
/** Sign in with ChatGPT in the browser; resolves when the browser has come back. */
export const chatgptLogin = () => call<void>("ai_chatgpt_login");
export const chatgptLogout = () => call<void>("ai_chatgpt_logout");
/** `briefing` is the conversation's standing context; send the same text for every message of a chat. `root` is the workspace it was asked in: if another is open by now, the request is refused. */
/**
 * `conversation` is the kept chat this request belongs to (its helpers' work is filed under it);
 * `web` is where web searches are asked: the Lokus server and the account's sign-in.
 */
export const aiSend = (chat: string, messages: unknown[], briefing: string, root?: string, used = 0, unattended = false, conversation?: string, web?: { server: string; token: string }) =>
  call<AiOutcome>("ai_send", { chat, messages, briefing, root, used, unattended, conversation, web });

/** One helper as the window shows it. `calls`, `task` and `answer` come only when one helper is asked for. */
export interface Helper {
  id: string;
  name: string;
  /** The tool call that started it: which block of the chat its row belongs in. */
  call: string;
  state: "waiting" | "running" | "done" | "stopped" | "failed";
  asked: number;
  error: string | null;
  steps: number;
  began: number;
  ended: number | null;
  findings: string | null;
  task?: Record<string, string>;
  calls?: { name: string; input: Record<string, unknown> }[];
  answer?: string;
}
export const aiHelpers = (conversation: string, id?: string) => call<Helper[]>("ai_helpers", { conversation, id });
/** Stop one helper, or all of the conversation's when `id` is left out. */
export const aiHelperStop = (conversation: string, id?: string) => call<void>("ai_helper_stop", { conversation, id });
/** Something written while the assistant is working: it reads it at its next step. */
export const aiSay = (conversation: string, text: string) => call<void>("ai_say", { conversation, text });

/** A conversation after its earlier part was summarised: what to carry on from, and the summary. */
export interface AiCompacted {
  messages: unknown[];
  summary: string;
  /** How many of the person's own turns were carried over whole, after the summary. */
  kept_turns: number;
  /** How many messages from the front of what was sent the summary stands in for. */
  replaced: number;
  input_tokens: number;
  output_tokens: number;
  limit: number | null;
  parts: Record<string, number>;
}
/** `chat` names this request (for Stop); `conversation` is what two windows must not compact at once. */
export const aiCompact = (
  chat: string,
  conversation: string,
  messages: unknown[],
  note: string,
  root?: string,
) =>
  call<AiCompacted>("ai_compact", { chat, conversation, messages, note, root });
/** Tell the assistant what happened when the window carried out one of its app tools. */
export const aiActDone = (id: string, ok: boolean, result: string) => call<void>("ai_act_done", { id, ok, result });
export const aiStop = (chat: string) => call<void>("ai_stop", { chat });
export const aiApprove = (id: string, allow: boolean) => call<void>("ai_approve", { id, allow });

/** The assistant asks the window to do something in the app (open a note, show a view). */
export function onAiAct(handler: (chat: string, id: string, name: string, input: Record<string, unknown>) => void): () => void {
  const stop = listen<{ chat: string; id: string; name: string; input: Record<string, unknown> }>("ai:act", ({ payload }) =>
    handler(payload.chat, payload.id, payload.name, payload.input),
  );
  return () => void stop.then((off) => off());
}

export function onAiEvent(handler: (chat: string, event: AiEvent) => void): () => void {
  const stop = listen<{ chat: string; event: AiEvent }>("ai:event", ({ payload }) => handler(payload.chat, payload.event));
  return () => void stop.then((off) => off());
}

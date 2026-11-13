/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { toCoreError } from "./core";

export interface McpServer {
  name: string;
  url: string;
  enabled: boolean;
}

export interface AiConfig {
  provider: "anthropic" | "openai";
  /** Empty means the provider's default. */
  model: string;
  base_url: string;
  auto_approve: boolean;
  mcp: McpServer[];
}

/** Settings as the window sees them. Keys stay in the keychain; only whether one exists is known here. */
export interface AiSettings {
  config: AiConfig;
  keys: { anthropic: boolean; openai: boolean };
  /** Names of tool servers that have a token stored. */
  tokens: string[];
  /** Names of tool servers the person has signed in to. */
  signed_in: string[];
  plugin_servers: McpServer[];
}

export type AiEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; input: Record<string, unknown>; asks: boolean }
  | { type: "tool_done"; id: string; ok: boolean; result: string }
  | { type: "notice"; message: string };

export interface AiOutcome {
  /** Messages to add to the conversation. Opaque here; they are sent back as they are. */
  messages: unknown[];
  stop: string;
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
/** Store a provider key or tool-server token in the keychain; an empty value removes it. */
export const setAiSecret = (kind: "provider" | "mcp", name: string, value: string) => call<void>("ai_secret_set", { kind, name, value });
export const aiModels = () => call<string[]>("ai_models");
export const checkMcp = (server: McpServer) => call<{ name: string; description: string; asks: boolean }[]>("ai_mcp_check", { server });
/** Sign in to a tool server in the browser; resolves when the browser has come back. */
export const mcpLogin = (server: McpServer) => call<void>("ai_mcp_login", { server });
export const mcpLogout = (name: string) => call<void>("ai_mcp_logout", { name });
export const aiSend = (chat: string, messages: unknown[]) => call<AiOutcome>("ai_send", { chat, messages });
export const aiStop = (chat: string) => call<void>("ai_stop", { chat });
export const aiApprove = (id: string, allow: boolean) => call<void>("ai_approve", { id, allow });

export function onAiEvent(handler: (chat: string, event: AiEvent) => void): () => void {
  const stop = listen<{ chat: string; event: AiEvent }>("ai:event", ({ payload }) => handler(payload.chat, payload.event));
  return () => void stop.then((off) => off());
}

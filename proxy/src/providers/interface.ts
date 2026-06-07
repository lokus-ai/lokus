/**
 * Provider abstraction — the EXACT contract shared with the wave-2 client-side
 * `providers` stream (which mirrors this file). Do not diverge: the engine's
 * `toToolSchema()` emits `Tool.input_schema`, and the client reassembles
 * `StreamEvent`s into the ReAct loop. This is the single source of truth.
 */

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface CompleteOptions {
  model: string;
  messages: Message[];
  system?: string;
  tools?: Tool[];
  max_tokens: number;
  /** Threaded into every upstream fetch so a dropped client cancels the call. */
  signal: AbortSignal;
}

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | {
      type: "usage";
      promptTokens: number;
      completionTokens: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
    }
  | { type: "message_stop" };

export interface IProvider {
  complete(opts: CompleteOptions): Promise<{ stream(): AsyncIterable<StreamEvent> }>;
  embed?(texts: string[]): Promise<number[][]>;
}

/**
 * Anthropic provider adapter.
 *
 * Cache-aware: the client embeds the literal `CACHE_BOUNDARY` marker in the
 * system prompt between the stable prefix (L1+L2) and the dynamic suffix
 * (L3–L6). We split on it and mark the prefix block `cache_control: ephemeral`
 * so Anthropic caches the large, reused context. If there's no boundary the
 * whole system prompt is sent as a single (uncached) block.
 *
 * Streams the native Anthropic SSE format and re-emits normalized `StreamEvent`s.
 * Tool-use input arrives as fragmented `input_json_delta` chunks which we
 * accumulate and parse on `content_block_stop`.
 *
 * Every fetch is given the caller's AbortSignal so a dropped client cancels the
 * upstream request.
 */
import { config } from "../config.ts";
import { CACHE_BOUNDARY, PROVIDER_TIMEOUT_MS } from "../lib/constants.ts";
import { Errors } from "../lib/errors.ts";
import type {
  CompleteOptions,
  ContentBlock,
  IProvider,
  Message,
  StreamEvent,
  Tool,
} from "./interface.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

/** Build the Anthropic `system` field from a possibly-boundary-marked string. */
function buildSystem(system?: string): SystemBlock[] | undefined {
  if (!system) return undefined;
  const idx = system.indexOf(CACHE_BOUNDARY);
  if (idx === -1) {
    return [{ type: "text", text: system }];
  }
  const prefix = system.slice(0, idx);
  const suffix = system.slice(idx + CACHE_BOUNDARY.length);
  const blocks: SystemBlock[] = [];
  if (prefix) {
    blocks.push({ type: "text", text: prefix, cache_control: { type: "ephemeral" } });
  }
  if (suffix) blocks.push({ type: "text", text: suffix });
  return blocks;
}

/** Map our normalized Message[] to Anthropic's messages array. Tool roles
 *  become user-role messages carrying tool_result blocks. */
function toAnthropicMessages(messages: Message[]): unknown[] {
  return messages.map((m) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    if (typeof m.content === "string") {
      return { role, content: m.content };
    }
    const content = m.content.map((b) => mapBlock(b));
    return { role, content };
  });
}

function mapBlock(b: ContentBlock): unknown {
  switch (b.type) {
    case "text":
      return { type: "text", text: b.text ?? "" };
    case "tool_use":
      return { type: "tool_use", id: b.id, name: b.name, input: b.input ?? {} };
    case "tool_result":
      return {
        type: "tool_result",
        tool_use_id: b.tool_use_id,
        content: b.content ?? "",
        ...(b.is_error ? { is_error: true } : {}),
      };
    default:
      return { type: "text", text: b.text ?? "" };
  }
}

function toAnthropicTools(tools?: Tool[]): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/** Parse a raw SSE stream (ReadableStream of bytes) into discrete events. */
async function* parseSSE(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal.aborted) throw Errors.clientCancelled();
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event = "message";
        const dataLines: string[] = [];
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length) yield { event, data: dataLines.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class AnthropicProvider implements IProvider {
  constructor(private apiKey: string = config.ANTHROPIC_API_KEY) {}

  async complete(opts: CompleteOptions) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), PROVIDER_TIMEOUT_MS);
    // Compose caller cancel + our timeout.
    const signal = anySignal([opts.signal, timeoutController.signal]);

    const body = {
      model: opts.model,
      max_tokens: opts.max_tokens,
      stream: true,
      system: buildSystem(opts.system),
      messages: toAnthropicMessages(opts.messages),
      tools: toAnthropicTools(opts.tools),
    };

    let res: Response;
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (opts.signal.aborted) throw Errors.clientCancelled();
      if (timeoutController.signal.aborted) throw Errors.upstreamTimeout();
      throw Errors.providerError(`anthropic fetch failed: ${(err as Error).message}`);
    }

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const text = await res.text().catch(() => "");
      const retryable = res.status >= 500 || res.status === 429;
      throw Errors.providerError(`anthropic ${res.status}: ${text.slice(0, 500)}`, retryable);
    }

    const responseBody = res.body;
    const stream = async function* (): AsyncIterable<StreamEvent> {
      // Per-tool-use accumulation of fragmented JSON input.
      const toolBuf = new Map<number, { id: string; name: string; json: string }>();
      try {
        for await (const { data } of parseSSE(responseBody, signal)) {
          if (data === "[DONE]") break;
          let evt: any;
          try {
            evt = JSON.parse(data);
          } catch {
            continue;
          }
          switch (evt.type) {
            case "content_block_start":
              if (evt.content_block?.type === "tool_use") {
                toolBuf.set(evt.index, {
                  id: evt.content_block.id,
                  name: evt.content_block.name,
                  json: "",
                });
              }
              break;
            case "content_block_delta":
              if (evt.delta?.type === "text_delta") {
                yield { type: "text_delta", text: evt.delta.text };
              } else if (evt.delta?.type === "input_json_delta") {
                const t = toolBuf.get(evt.index);
                if (t) t.json += evt.delta.partial_json ?? "";
              }
              break;
            case "content_block_stop": {
              const t = toolBuf.get(evt.index);
              if (t) {
                let input: unknown = {};
                try {
                  input = t.json ? JSON.parse(t.json) : {};
                } catch {
                  input = {};
                }
                yield { type: "tool_use", id: t.id, name: t.name, input };
                toolBuf.delete(evt.index);
              }
              break;
            }
            case "message_delta":
              if (evt.usage) {
                yield {
                  type: "usage",
                  promptTokens: evt.usage.input_tokens ?? 0,
                  completionTokens: evt.usage.output_tokens ?? 0,
                  cacheReadTokens: evt.usage.cache_read_input_tokens,
                  cacheCreationTokens: evt.usage.cache_creation_input_tokens,
                };
              }
              break;
            case "message_start":
              if (evt.message?.usage) {
                yield {
                  type: "usage",
                  promptTokens: evt.message.usage.input_tokens ?? 0,
                  completionTokens: evt.message.usage.output_tokens ?? 0,
                  cacheReadTokens: evt.message.usage.cache_read_input_tokens,
                  cacheCreationTokens: evt.message.usage.cache_creation_input_tokens,
                };
              }
              break;
            case "message_stop":
              yield { type: "message_stop" };
              break;
          }
        }
      } finally {
        clearTimeout(timer);
      }
    };

    return { stream };
  }
}

/** Combine multiple AbortSignals into one that aborts when any does. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export { anySignal };

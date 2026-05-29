/**
 * OpenAI provider adapter (Chat Completions, streaming).
 *
 * Used as the fallback path (gpt-4o) and for explicit gpt-4o / gpt-4o-mini
 * requests. OpenAI streams tool calls as FRAGMENTED deltas: the first chunk for
 * a tool call carries `id` + `name`, subsequent chunks carry only argument
 * string fragments under the same `index`. We reassemble by index and emit a
 * single `tool_use` when the stream finishes.
 *
 * Every fetch is given the caller's AbortSignal.
 */
import { config } from "../config.ts";
import { PROVIDER_TIMEOUT_MS } from "../lib/constants.ts";
import { Errors } from "../lib/errors.ts";
import { anySignal } from "./anthropic.ts";
import type {
  CompleteOptions,
  ContentBlock,
  IProvider,
  Message,
  StreamEvent,
  Tool,
} from "./interface.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";

/** Map normalized Message[] to OpenAI chat messages. */
function toOpenAIMessages(messages: Message[], system?: string): unknown[] {
  const out: unknown[] = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (m.role === "tool") {
      // tool messages carry tool_result block(s)
      const blocks = Array.isArray(m.content) ? m.content : [];
      for (const b of blocks) {
        if (b.type === "tool_result") {
          out.push({
            role: "tool",
            tool_call_id: b.tool_use_id,
            content: b.content ?? "",
          });
        }
      }
      continue;
    }
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    // assistant with tool_use blocks → assistant message with tool_calls
    const text = m.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const toolCalls = m.content
      .filter((b: ContentBlock) => b.type === "tool_use")
      .map((b) => ({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      }));
    const msg: Record<string, unknown> = { role: m.role };
    if (text) msg.content = text;
    if (toolCalls.length) msg.tool_calls = toolCalls;
    out.push(msg);
  }
  return out;
}

function toOpenAITools(tools?: Tool[]): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

async function* parseSSE(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<string> {
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
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data:")) yield line.slice(5).trim();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class OpenAIProvider implements IProvider {
  constructor(private apiKey: string = config.OPENAI_API_KEY) {}

  async complete(opts: CompleteOptions) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), PROVIDER_TIMEOUT_MS);
    const signal = anySignal([opts.signal, timeoutController.signal]);

    const body = {
      model: opts.model,
      max_tokens: opts.max_tokens,
      stream: true,
      stream_options: { include_usage: true },
      messages: toOpenAIMessages(opts.messages, opts.system),
      tools: toOpenAITools(opts.tools),
    };

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (opts.signal.aborted) throw Errors.clientCancelled();
      if (timeoutController.signal.aborted) throw Errors.upstreamTimeout();
      throw Errors.providerError(`openai fetch failed: ${(err as Error).message}`);
    }

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const text = await res.text().catch(() => "");
      const retryable = res.status >= 500 || res.status === 429;
      throw Errors.providerError(`openai ${res.status}: ${text.slice(0, 500)}`, retryable);
    }

    const responseBody = res.body;
    const stream = async function* (): AsyncIterable<StreamEvent> {
      // index → accumulating tool call
      const toolBuf = new Map<number, { id: string; name: string; args: string }>();
      try {
        for await (const data of parseSSE(responseBody, signal)) {
          if (data === "[DONE]") break;
          let evt: any;
          try {
            evt = JSON.parse(data);
          } catch {
            continue;
          }
          const choice = evt.choices?.[0];
          const delta = choice?.delta;
          if (delta?.content) {
            yield { type: "text_delta", text: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              let entry = toolBuf.get(idx);
              if (!entry) {
                entry = { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" };
                toolBuf.set(idx, entry);
              }
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name = tc.function.name;
              if (tc.function?.arguments) entry.args += tc.function.arguments;
            }
          }
          // When a tool call finishes, OpenAI sets finish_reason: "tool_calls".
          if (choice?.finish_reason === "tool_calls") {
            for (const [, entry] of toolBuf) {
              let input: unknown = {};
              try {
                input = entry.args ? JSON.parse(entry.args) : {};
              } catch {
                input = {};
              }
              yield { type: "tool_use", id: entry.id, name: entry.name, input };
            }
            toolBuf.clear();
          }
          if (evt.usage) {
            yield {
              type: "usage",
              promptTokens: evt.usage.prompt_tokens ?? 0,
              completionTokens: evt.usage.completion_tokens ?? 0,
            };
          }
        }
        yield { type: "message_stop" };
      } finally {
        clearTimeout(timer);
      }
    };

    return { stream };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(OPENAI_EMBED_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Errors.providerError(`openai embed ${res.status}: ${text.slice(0, 300)}`);
    }
    const json: any = await res.json();
    return (json.data ?? []).map((d: { embedding: number[] }) => d.embedding);
  }
}

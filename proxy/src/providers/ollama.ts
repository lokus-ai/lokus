/**
 * Ollama provider adapter — local model inference (no credits, no upstream key).
 * Streams the Ollama /api/chat NDJSON format and re-emits StreamEvents. Tool
 * use is supported on models that expose it; arguments arrive as a single JSON
 * object per call (not fragmented).
 */
import { config } from "../config.ts";
import { PROVIDER_TIMEOUT_MS } from "../lib/constants.ts";
import { Errors } from "../lib/errors.ts";
import { anySignal } from "./anthropic.ts";
import type {
  CompleteOptions,
  IProvider,
  Message,
  StreamEvent,
  Tool,
} from "./interface.ts";

function toOllamaMessages(messages: Message[], system?: string): unknown[] {
  const out: unknown[] = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
    } else {
      const text = m.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      out.push({ role: m.role === "tool" ? "tool" : m.role, content: text });
    }
  }
  return out;
}

function toOllamaTools(tools?: Tool[]): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

export class OllamaProvider implements IProvider {
  constructor(private baseUrl: string = config.OLLAMA_BASE_URL) {}

  async complete(opts: CompleteOptions) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), PROVIDER_TIMEOUT_MS);
    const signal = anySignal([opts.signal, timeoutController.signal]);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          stream: true,
          messages: toOllamaMessages(opts.messages, opts.system),
          tools: toOllamaTools(opts.tools),
          options: { num_predict: opts.max_tokens },
        }),
        signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (opts.signal.aborted) throw Errors.clientCancelled();
      if (timeoutController.signal.aborted) throw Errors.upstreamTimeout();
      throw Errors.providerError(`ollama fetch failed: ${(err as Error).message}`);
    }

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const text = await res.text().catch(() => "");
      throw Errors.providerError(`ollama ${res.status}: ${text.slice(0, 300)}`);
    }

    const responseBody = res.body;
    const stream = async function* (): AsyncIterable<StreamEvent> {
      const reader = responseBody.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          if (signal.aborted) throw Errors.clientCancelled();
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let evt: any;
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            if (evt.message?.content) {
              yield { type: "text_delta", text: evt.message.content };
            }
            if (evt.message?.tool_calls) {
              for (const tc of evt.message.tool_calls) {
                yield {
                  type: "tool_use",
                  id: tc.id ?? `ollama_${Math.random().toString(36).slice(2, 10)}`,
                  name: tc.function?.name ?? "",
                  input: tc.function?.arguments ?? {},
                };
              }
            }
            if (evt.done) {
              yield {
                type: "usage",
                promptTokens: evt.prompt_eval_count ?? 0,
                completionTokens: evt.eval_count ?? 0,
              };
              yield { type: "message_stop" };
            }
          }
        }
      } finally {
        clearTimeout(timer);
        reader.releaseLock();
      }
    };

    return { stream };
  }
}

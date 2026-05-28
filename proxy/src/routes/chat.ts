/**
 * POST /v1/chat — streaming inference + tool calls.
 *
 * Stateless per request. The ReAct agent loop is CLIENT-side: the client sends
 * the full message history (including prior tool_use / tool_result blocks) on
 * every call; we do exactly one provider turn and stream it back.
 *
 * Lifecycle (board CANONICAL CONTRACTS §3):
 *   auth + rate-limit (middleware) → derive idempotency key → claim (replay
 *   short-circuits) → resolve model → reserve credits (over-reserve to
 *   max_tokens) → stream from provider (Anthropic primary; ONE OpenAI gpt-4o
 *   fallback ONLY before the first streamed byte, reusing the SAME reservation)
 *   → on success settle(actual) + cache result; on failure refund + release key.
 *
 * SSE terminal frame: end with `type:"done"` then `[DONE]`. Errors: `type:"error"`
 * then `[DONE]`. Client treats missing `done` (even on HTTP 200) as failure.
 */
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { AuthedUser } from "../lib/jwks.ts";
import {
  resolveModel,
  reservationAmount,
  actualAmount,
  dailyCapForPlan,
  type Resolved,
  type Tier,
} from "../services/router.ts";
import * as credit from "../services/credit.ts";
import { audit, outcomeForError } from "../services/audit.ts";
import { deriveKey, claim, complete, abandon } from "../middleware/idempotency.ts";
import {
  DEFAULT_MAX_TOKENS,
  MAX_ALLOWED_MAX_TOKENS,
} from "../lib/constants.ts";
import { Errors, ProxyError, toProxyError, errorBody } from "../lib/errors.ts";
import type { CompleteOptions, Message, StreamEvent, Tool } from "../providers/interface.ts";

interface ChatBody {
  model?: string;
  messages: Message[];
  system?: string;
  tools?: Tool[];
  max_tokens?: number;
}

/** Coarse provider label for audit rows, derived from the active model id. */
function providerLabel(model: string): string {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gpt")) return "openai";
  return "ollama";
}

/** Raw plan from the Supabase JWT (free | pro | power | undefined). */
function planOf(user: AuthedUser): string | undefined {
  return (user.payload.app_metadata as { plan?: string } | undefined)?.plan;
}

function tierOf(user: AuthedUser): Tier {
  // The proxy only needs free vs not-free for model gating; the exact plan
  // (pro/power) is used separately for the daily-cap multiplier.
  const plan = planOf(user);
  return plan && plan !== "free" ? "paid" : "free";
}

/** Rough token estimate for sizing the reservation (chars/4 heuristic). */
function estimatePromptTokens(body: ChatBody): number {
  let chars = (body.system ?? "").length;
  for (const m of body.messages ?? []) {
    chars += typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length;
  }
  return Math.ceil(chars / 4);
}

function validate(body: unknown): ChatBody {
  if (!body || typeof body !== "object") throw Errors.invalidRequest("Body required");
  const b = body as ChatBody;
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    throw Errors.invalidRequest("messages[] required");
  }
  if (b.max_tokens !== undefined) {
    if (typeof b.max_tokens !== "number" || b.max_tokens <= 0) {
      throw Errors.invalidRequest("max_tokens must be a positive number");
    }
    if (b.max_tokens > MAX_ALLOWED_MAX_TOKENS) {
      throw Errors.invalidRequest(`max_tokens exceeds ceiling ${MAX_ALLOWED_MAX_TOKENS}`);
    }
  }
  return b;
}

export async function chatHandler(c: Context) {
  const user = c.get("user") as AuthedUser;
  const started = Date.now();

  let body: ChatBody;
  let rawBody: string;
  try {
    rawBody = await c.req.text();
    body = validate(rawBody ? JSON.parse(rawBody) : null);
  } catch (e) {
    const err = e instanceof ProxyError ? e : Errors.invalidRequest("Malformed JSON body");
    return c.json(errorBody(err), err.status as 400);
  }

  const tier = tierOf(user);
  const maxTokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;

  // Resolve model up front so a disallowed model is rejected as a clean JSON 400
  // before we open the SSE stream.
  let resolved: Resolved;
  try {
    resolved = resolveModel(body.model, tier);
  } catch (e) {
    const err = toProxyError(e);
    return c.json(errorBody(err), err.status as 400);
  }

  const isLocal = body.model?.startsWith("ollama/") ?? false;

  // Server-derived idempotency key, reused as the credit reserve_id.
  const key = await deriveKey(user.sub, rawBody);

  // Replay short-circuit (no provider call, no new reservation).
  const claimOutcome = await claim(key);
  if (claimOutcome.replay) {
    return streamSSE(c, async (stream) => {
      // If we have a cached terminal payload, replay it; otherwise signal that
      // an identical request is in-flight and the client should not double-spend.
      if (claimOutcome.cached && claimOutcome.cached !== "pending") {
        try {
          const cached = JSON.parse(claimOutcome.cached);
          await stream.writeSSE({ data: JSON.stringify({ type: "done", replay: true, ...cached }) });
        } catch {
          await stream.writeSSE({ data: JSON.stringify({ type: "done", replay: true }) });
        }
      } else {
        await stream.writeSSE({
          data: JSON.stringify({ type: "done", replay: true, note: "in-flight" }),
        });
      }
      await stream.writeSSE({ data: "[DONE]" });
    });
  }

  // Reserve credits (skip for local/ollama which costs nothing).
  const reserveAmt = isLocal
    ? 0
    : reservationAmount(resolved.model, maxTokens, estimatePromptTokens(body));

  if (!isLocal) {
    // Daily-cap gate (before reserving): refuse if this reservation would push
    // the trailing-24h reserved total over the user's plan cap. Mirrors the
    // ledger edge-function policy so both paths enforce the same ceiling.
    const cap = dailyCapForPlan(planOf(user));
    if (!(await credit.withinDailyCap(user.sub, reserveAmt, cap))) {
      await abandon(key);
      const err = Errors.dailyCapExceeded();
      void audit({
        userId: user.sub,
        reserveId: null,
        action: "chat",
        provider: providerLabel(resolved.model),
        model: resolved.model,
        outcome: "error_credits",
        errorCode: err.code,
      });
      c.header("Retry-After", "3600");
      return c.json(errorBody(err), 429);
    }

    let res: credit.ReserveResult;
    try {
      res = await credit.reserve(user.sub, reserveAmt, key);
    } catch (e) {
      await abandon(key);
      const err = toProxyError(e);
      return c.json(errorBody(err), err.status as 500);
    }
    if (!res.ok) {
      await abandon(key);
      const err = Errors.insufficientCredits();
      void audit({
        userId: user.sub,
        reserveId: null,
        action: "chat",
        provider: providerLabel(resolved.model),
        model: resolved.model,
        creditsReserved: 0,
        creditsActual: 0,
        outcome: "error_credits",
        errorCode: err.code,
      });
      return c.json(errorBody(err), 402);
    }
  }

  // Abort upstream when the client disconnects.
  const abort = new AbortController();
  // Hono streamSSE invokes onAbort; we also wire the raw request signal.
  const reqSignal = c.req.raw.signal;
  if (reqSignal) {
    if (reqSignal.aborted) abort.abort();
    else reqSignal.addEventListener("abort", () => abort.abort(), { once: true });
  }

  return streamSSE(
    c,
    async (stream) => {
      stream.onAbort(() => abort.abort());

      let firstByte = false;
      let usedFallback = false;
      let promptTokens = 0;
      let completionTokens = 0;
      let cacheReadTokens = 0;
      let activeModel = resolved.model;

      const opts: CompleteOptions = {
        model: resolved.model,
        messages: body.messages,
        system: body.system,
        tools: body.tools,
        max_tokens: maxTokens,
        signal: abort.signal,
      };

      const runProvider = async (
        provider: Resolved["provider"],
        model: string,
      ): Promise<void> => {
        activeModel = model;
        const { stream: gen } = await provider.complete({ ...opts, model });
        for await (const ev of gen()) {
          firstByte = firstByte || ev.type === "text_delta" || ev.type === "tool_use";
          if (ev.type === "usage") {
            promptTokens = ev.promptTokens || promptTokens;
            completionTokens = ev.completionTokens || completionTokens;
            cacheReadTokens = ev.cacheReadTokens ?? cacheReadTokens;
            continue; // usage is internal accounting, not forwarded verbatim
          }
          if (ev.type === "message_stop") continue; // we emit our own terminal frame
          await writeEvent(stream, ev);
        }
      };

      try {
        try {
          await runProvider(resolved.provider, resolved.model);
        } catch (primaryErr) {
          const perr = toProxyError(primaryErr);
          // ONE OpenAI fallback, ONLY before the first streamed byte, reusing the
          // same reservation. Never fall back on client cancel.
          if (
            !firstByte &&
            resolved.fallback &&
            perr.code !== "client_cancelled" &&
            perr.code !== "insufficient_credits"
          ) {
            usedFallback = true;
            // Informational only — the billable audit row is written once below
            // (success or error) with the model/provider that actually ran.
            console.log(
              JSON.stringify({
                level: "info",
                at: "chat.fallback",
                userId: user.sub,
                from: resolved.model,
                to: resolved.fallback.model,
                cause: perr.code,
              }),
            );
            await runProvider(resolved.fallback.provider, resolved.fallback.model);
          } else {
            throw primaryErr;
          }
        }

        // Success: settle actual usage (only refunds), cache terminal payload.
        const actual = isLocal ? 0 : actualAmount(activeModel, promptTokens, completionTokens);
        if (!isLocal) await credit.settle(key, actual);
        const donePayload = {
          model: activeModel,
          fallback: usedFallback,
          usage: { promptTokens, completionTokens, cacheReadTokens },
          charged: actual,
        };
        await complete(key, donePayload);
        await stream.writeSSE({ data: JSON.stringify({ type: "done", ...donePayload }) });
        await stream.writeSSE({ data: "[DONE]" });
        void audit({
          userId: user.sub,
          reserveId: isLocal ? null : key,
          action: "chat",
          provider: providerLabel(activeModel),
          model: activeModel,
          tokensPrompt: promptTokens,
          tokensCompletion: completionTokens,
          cacheReadTokens,
          creditsReserved: reserveAmt,
          creditsActual: actual,
          latencyMs: Date.now() - started,
          outcome: "success",
        });
      } catch (e) {
        const err = toProxyError(e);
        // Refund the reservation and release the idempotency key so the client
        // can retry. (Client-cancel still refunds: no billable result delivered.)
        if (!isLocal) await credit.refund(key);
        await abandon(key);
        await stream.writeSSE({
          data: JSON.stringify({
            type: "error",
            code: err.code,
            message: err.message,
            retryable: err.retryable,
          }),
        });
        await stream.writeSSE({ data: "[DONE]" });
        void audit({
          userId: user.sub,
          reserveId: isLocal ? null : key,
          action: "chat",
          provider: providerLabel(activeModel),
          model: activeModel,
          tokensPrompt: promptTokens,
          tokensCompletion: completionTokens,
          cacheReadTokens,
          creditsReserved: reserveAmt,
          creditsActual: 0,
          latencyMs: Date.now() - started,
          outcome: outcomeForError(err.code),
          errorCode: err.code,
        });
      }
    },
    async (err, stream) => {
      // streamSSE onError — emit a terminal error frame.
      const perr = toProxyError(err);
      if (!isLocal) await credit.refund(key);
      await abandon(key);
      await stream.writeSSE({
        data: JSON.stringify({
          type: "error",
          code: perr.code,
          message: perr.message,
          retryable: perr.retryable,
        }),
      });
      await stream.writeSSE({ data: "[DONE]" });
    },
  );
}

/** Forward a normalized StreamEvent as an SSE data frame in the wire shape the
 *  client expects (text_delta / tool_use passthrough). */
async function writeEvent(
  stream: { writeSSE: (m: { data: string }) => Promise<void> },
  ev: StreamEvent,
): Promise<void> {
  if (ev.type === "text_delta") {
    await stream.writeSSE({ data: JSON.stringify({ type: "text_delta", text: ev.text }) });
  } else if (ev.type === "tool_use") {
    await stream.writeSSE({
      data: JSON.stringify({ type: "tool_use", id: ev.id, name: ev.name, input: ev.input }),
    });
  }
}

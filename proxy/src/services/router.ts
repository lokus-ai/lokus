/**
 * Model router + provider selection (board CANONICAL CONTRACTS).
 *
 * Tiers:
 *   free    → claude-haiku-4-20250514
 *   default → claude-sonnet-4-20250514
 *   allowed explicit models: gpt-4o, gpt-4o-mini (openai)
 *
 * Anthropic is primary. ONE OpenAI gpt-4o fallback is permitted, and ONLY
 * before the first streamed byte, reusing the SAME credit reservation. Once any
 * byte has streamed we never switch providers (the client has partial output).
 */
import { AnthropicProvider } from "../providers/anthropic.ts";
import { OpenAIProvider } from "../providers/openai.ts";
import { OllamaProvider } from "../providers/ollama.ts";
import type { IProvider } from "../providers/interface.ts";
import { Errors } from "../lib/errors.ts";
import { config } from "../config.ts";

export const FREE_MODEL = "claude-haiku-4-20250514";
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";
export const FALLBACK_MODEL = "gpt-4o";

const ANTHROPIC_MODELS = new Set([FREE_MODEL, DEFAULT_MODEL]);
const OPENAI_MODELS = new Set(["gpt-4o", "gpt-4o-mini"]);

export type Tier = "free" | "paid";

export interface Resolved {
  model: string;
  provider: IProvider;
  /** Whether a one-shot OpenAI fallback is allowed for this resolution. */
  fallback?: { model: string; provider: IProvider };
}

/**
 * Resolve the requested model (or undefined) for a user tier into a concrete
 * model + provider, validating that the model is allowed.
 */
export function resolveModel(requested: string | undefined, tier: Tier): Resolved {
  // No explicit model → tier default.
  if (!requested) {
    const model = tier === "free" ? FREE_MODEL : DEFAULT_MODEL;
    return withFallback({ model, provider: new AnthropicProvider() });
  }

  // Local models are routed to Ollama by an `ollama/` prefix.
  if (requested.startsWith("ollama/")) {
    return { model: requested.slice("ollama/".length), provider: new OllamaProvider() };
  }

  if (ANTHROPIC_MODELS.has(requested)) {
    // Free users may not request the paid default model.
    if (tier === "free" && requested === DEFAULT_MODEL) {
      throw Errors.modelNotAllowed("Upgrade required for this model");
    }
    return withFallback({ model: requested, provider: new AnthropicProvider() });
  }

  if (OPENAI_MODELS.has(requested)) {
    if (tier === "free") {
      throw Errors.modelNotAllowed("Upgrade required for this model");
    }
    // Explicit OpenAI request: no cross-provider fallback.
    return { model: requested, provider: new OpenAIProvider() };
  }

  throw Errors.modelNotAllowed(`Unknown or disallowed model: ${requested}`);
}

/** Attach the single permitted OpenAI gpt-4o fallback to an Anthropic resolution. */
function withFallback(primary: Resolved): Resolved {
  return {
    ...primary,
    fallback: { model: FALLBACK_MODEL, provider: new OpenAIProvider() },
  };
}

/** Pricing: credits charged per token, by model. Used to size reservations and
 *  settle actual usage. Reservation over-reserves to max_tokens at the output
 *  rate plus a flat input allowance. Keep in sync with the ledger's accounting. */
const RATE_PER_1K: Record<string, { in: number; out: number }> = {
  [FREE_MODEL]: { in: 1, out: 5 },
  [DEFAULT_MODEL]: { in: 3, out: 15 },
  "gpt-4o": { in: 3, out: 10 },
  "gpt-4o-mini": { in: 1, out: 4 },
};

/** Upper-bound credit cost for a request (used as the reservation amount). */
export function reservationAmount(model: string, maxTokens: number, estPromptTokens: number): number {
  const rate = RATE_PER_1K[model] ?? { in: 3, out: 15 };
  const inCost = Math.ceil((estPromptTokens / 1000) * rate.in);
  const outCost = Math.ceil((maxTokens / 1000) * rate.out);
  return Math.max(1, inCost + outCost);
}

/** Actual credit cost from observed usage (always <= reservationAmount). */
export function actualAmount(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = RATE_PER_1K[model] ?? { in: 3, out: 15 };
  const inCost = Math.ceil((promptTokens / 1000) * rate.in);
  const outCost = Math.ceil((completionTokens / 1000) * rate.out);
  return Math.max(1, inCost + outCost);
}

/** Local (ollama) models cost no credits. */
export function isFreeProvider(model: string): boolean {
  return !ANTHROPIC_MODELS.has(model) && !OPENAI_MODELS.has(model);
}

/**
 * Per-day reserved-credit cap for a plan. Base = `DAILY_CREDIT_CAP` (free);
 * ×5 for pro, ×10 for power. Matches the ledger edge-function policy so the
 * proxy and edge paths enforce the same ceiling.
 */
export function dailyCapForPlan(plan: string | undefined): number {
  const base = config.DAILY_CREDIT_CAP;
  if (plan === "power") return base * 10;
  if (plan === "pro") return base * 5;
  return base; // free / unknown
}

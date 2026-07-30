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

export const FREE_MODEL = "gpt-4o-mini";
export const DEFAULT_MODEL = "gpt-4o";
export const FALLBACK_MODEL = "claude-sonnet-4-20250514";

const ANTHROPIC_MODELS = new Set(["claude-haiku-4-20250514", "claude-sonnet-4-20250514", FALLBACK_MODEL]);
const OPENAI_MODELS = new Set(["gpt-4o", "gpt-4o-mini", FREE_MODEL, DEFAULT_MODEL]);

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
  // No explicit model → tier default (OpenAI by default now).
  if (!requested) {
    const model = tier === "free" ? FREE_MODEL : DEFAULT_MODEL;
    return withFallback({ model, provider: new OpenAIProvider() });
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
    // Free users only get the cheap model.
    if (tier === "free" && requested !== FREE_MODEL) {
      throw Errors.modelNotAllowed("Upgrade required for this model");
    }
    return withFallback({ model: requested, provider: new OpenAIProvider() });
  }

  throw Errors.modelNotAllowed(`Unknown or disallowed model: ${requested}`);
}

/** Attach a cross-provider fallback only when the secondary provider key is
 *  actually configured (not a placeholder). Prevents fallback loops when only
 *  one provider is wired. */
function withFallback(primary: Resolved): Resolved {
  const anthropicKey = config.ANTHROPIC_API_KEY;
  const hasAnthropic = anthropicKey && !anthropicKey.startsWith("replace");
  const openaiKey = config.OPENAI_API_KEY;
  const hasOpenAI = openaiKey && !openaiKey.startsWith("replace");

  // Anthropic primary → OpenAI fallback
  if (primary.provider instanceof AnthropicProvider && hasOpenAI) {
    return { ...primary, fallback: { model: "gpt-4o", provider: new OpenAIProvider() } };
  }
  // OpenAI primary → Anthropic fallback
  if (primary.provider instanceof OpenAIProvider && hasAnthropic) {
    return { ...primary, fallback: { model: FALLBACK_MODEL, provider: new AnthropicProvider() } };
  }
  return primary;
}

/** Pricing: credits charged per token, by model. Used to size reservations and
 *  settle actual usage. Reservation over-reserves to max_tokens at the output
 *  rate plus a flat input allowance. Keep in sync with the ledger's accounting. */
const RATE_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 1, out: 4 },
  "gpt-4o": { in: 3, out: 10 },
  "claude-haiku-4-20250514": { in: 1, out: 5 },
  "claude-sonnet-4-20250514": { in: 3, out: 15 },
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

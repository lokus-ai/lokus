/**
 * Lokus credit gate — shared between the edge functions.
 *
 * This is the MONEY path. It calls the credit-ledger RPCs created in
 * `supabase/migrations/20260308000000_credit_ledger.sql`:
 *   - reserve_credits(p_user_id, p_amount, p_reserve_id)  → deduct up front
 *   - settle_credits(p_reserve_id, p_actual_amount)       → refund (reserved-actual)
 *   - refund_reservation(p_reserve_id)                    → full refund on failure
 *   - reserved_today(p_user_id)                           → daily-cap helper
 *
 * Semantics (board "Credit ledger" + MONETIZATION §1/§5):
 *   - Over-reserve to the model's max_tokens ceiling; settle only ever refunds.
 *   - 0-balance / insufficient request MUST be refused (402-style).
 *   - Per-account daily spend cap (default 2,000 credits/day, per-tier override).
 *
 * Files prefixed with `_` (this `_shared/` dir) are NOT deployed as their own
 * function; they are imported by the deployed functions.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Credit cost table (MONETIZATION §1) — credits per 1K tokens.
// Single source of truth for the edge functions; the proxy mirrors this.
// ---------------------------------------------------------------------------

export type Tier = "free" | "pro" | "power";

interface ModelCost {
  /** credits per 1K input tokens */
  inPer1k: number;
  /** credits per 1K output tokens */
  outPer1k: number;
}

/** Per-model credit cost. Keys are the canonical provider model ids. */
const MODEL_COST: Record<string, ModelCost> = {
  // Anthropic
  "claude-sonnet-4-20250514": { inPer1k: 3, outPer1k: 15 },
  "claude-haiku-4-20250514": { inPer1k: 1, outPer1k: 4 },
  "claude-haiku-3-5": { inPer1k: 1, outPer1k: 4 },
  // OpenAI (priced into the same credit currency; gpt-4o ≈ Sonnet tier)
  "gpt-4o": { inPer1k: 3, outPer1k: 15 },
  "gpt-4o-mini": { inPer1k: 1, outPer1k: 4 },
};

/** Fallback cost for an unknown model — price it like the premium tier so we
 *  never under-reserve. */
const DEFAULT_COST: ModelCost = { inPer1k: 3, outPer1k: 15 };

/** Deepgram transcription: 5 credits per minute, billed per second rounded up. */
export const DEEPGRAM_CREDITS_PER_SECOND = 5 / 60;

function costFor(model: string): ModelCost {
  return MODEL_COST[model] ?? DEFAULT_COST;
}

/**
 * Reserve amount = measured input + the FULL max_tokens output ceiling.
 * Over-reserving means settle only ever refunds — never charges more.
 * Always returns at least 1 so a request can never be free.
 */
export function reserveAmount(model: string, inputTokens: number, maxTokens: number): number {
  const c = costFor(model);
  const inputCredits = Math.ceil((Math.max(0, inputTokens) / 1000) * c.inPer1k);
  const outputCredits = Math.ceil((Math.max(0, maxTokens) / 1000) * c.outPer1k);
  return Math.max(1, inputCredits + outputCredits);
}

/**
 * Actual amount = measured input + measured output. Used at settle time so the
 * reservation is reconciled down to true usage (the unused output ceiling is
 * refunded).
 */
export function actualAmount(model: string, inputTokens: number, outputTokens: number): number {
  const c = costFor(model);
  const inputCredits = Math.ceil((Math.max(0, inputTokens) / 1000) * c.inPer1k);
  const outputCredits = Math.ceil((Math.max(0, outputTokens) / 1000) * c.outPer1k);
  return Math.max(1, inputCredits + outputCredits);
}

/** STT credits for a duration in seconds (per-second, rounded up). */
export function transcribeCredits(seconds: number): number {
  return Math.max(1, Math.ceil(Math.max(0, seconds) * DEEPGRAM_CREDITS_PER_SECOND));
}

// ---------------------------------------------------------------------------
// Per-tier daily spend cap (MONETIZATION §5). Default 2,000 credits/day.
// Configurable per tier; the env override DAILY_CREDIT_CAP sets the default.
// ---------------------------------------------------------------------------

function dailyCapEnvDefault(): number {
  const raw = Deno.env.get("DAILY_CREDIT_CAP");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2000;
}

export function dailyCapFor(tier: Tier): number {
  const base = dailyCapEnvDefault();
  // Higher tiers get a larger daily ceiling; still a hard cap to bound the blast
  // radius of a compromised token.
  switch (tier) {
    case "power":
      return base * 10; // 20,000/day default
    case "pro":
      return base * 5; // 10,000/day default
    default:
      return base; // free: 2,000/day default
  }
}

// ---------------------------------------------------------------------------
// Reserve id — server-derived so a client cannot replay a free call.
// Mirrors the proxy: sha256(userId + ':' + sha256(body) + ':' + minuteBucket).
// ---------------------------------------------------------------------------

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Derive a stable, server-side reserve id for an idempotency window (1 min). */
export async function deriveReserveId(userId: string, rawBody: string): Promise<string> {
  const minuteBucket = Math.floor(Date.now() / 60000);
  const bodyHash = await sha256Hex(rawBody);
  return await sha256Hex(`${userId}:${bodyHash}:${minuteBucket}`);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface CreditError extends Error {
  status: number;
  code: string;
  balance?: number;
}

function creditError(message: string, code: string, status: number, balance?: number): CreditError {
  return Object.assign(new Error(message), { status, code, balance }) as CreditError;
}

// ---------------------------------------------------------------------------
// Gate operations
// ---------------------------------------------------------------------------

/**
 * Reserve `amount` credits for `userId` under a server-derived `reserveId`,
 * enforcing the per-account daily cap first. Throws a 402 CreditError if the
 * balance is insufficient (0-balance is refused) and a 429 if the daily cap
 * would be exceeded.
 *
 * Returns the reserveId so the caller can settle/refund it.
 */
export async function reserveOrThrow(
  admin: SupabaseClient,
  userId: string,
  tier: Tier,
  amount: number,
  reserveId: string,
): Promise<void> {
  // Daily cap: refuse if reserving `amount` would push the trailing-24h reserved
  // sum over the tier's cap. (The cap counts reservations, which are the upper
  // bound on spend; refunds at settle make this conservative.)
  const cap = dailyCapFor(tier);
  const { data: reservedRaw, error: capErr } = await admin.rpc("reserved_today", {
    p_user_id: userId,
  });
  if (capErr) {
    // Fail closed on a cap-check error — do not let a DB error become a free pass.
    console.error("[credits] reserved_today failed:", capErr);
    throw creditError("Unable to verify daily usage", "CAP_CHECK_FAILED", 503);
  }
  const reservedToday = Number(reservedRaw ?? 0);
  if (reservedToday + amount > cap) {
    throw creditError(
      `Daily credit cap reached (${cap}/day for ${tier} tier). Try again tomorrow or upgrade.`,
      "DAILY_CAP_EXCEEDED",
      429,
    );
  }

  const { data, error } = await admin.rpc("reserve_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reserve_id: reserveId,
  });
  if (error) {
    console.error("[credits] reserve_credits failed:", error);
    throw creditError("Credit reservation failed", "RESERVE_FAILED", 503);
  }

  // reserve_credits RETURNS TABLE(ok boolean, balance bigint) → supabase-js
  // surfaces a single-row array.
  const row = Array.isArray(data) ? data[0] : data;
  const ok = row?.ok === true;
  const balance = Number(row?.balance ?? 0);

  if (!ok) {
    throw creditError(
      "Insufficient credits. Top up your plan or bring your own API key.",
      "INSUFFICIENT_CREDITS",
      402,
      balance,
    );
  }
}

/** Reconcile a reservation down to actual spend (refund-only). Fire-and-forget. */
export function settle(admin: SupabaseClient, reserveId: string, actual: number): void {
  admin
    .rpc("settle_credits", { p_reserve_id: reserveId, p_actual_amount: actual })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error("[credits] settle failed", reserveId, error);
    });
}

/** Full refund of an unsettled reservation (failure/abort path). Fire-and-forget. */
export function refund(admin: SupabaseClient, reserveId: string): void {
  admin
    .rpc("refund_reservation", { p_reserve_id: reserveId })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error("[credits] refund failed", reserveId, error);
    });
}

// ---------------------------------------------------------------------------
// Shared admin client builder (service role)
// ---------------------------------------------------------------------------

export function buildAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

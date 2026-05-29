/**
 * Credit service — the money path. Wraps the THREE ledger RPCs (owned by the
 * ledger stream; we only CALL them via the service-role Supabase client):
 *
 *   reserve_credits(p_user_id, p_amount, p_reserve_id)
 *   settle_credits(p_reserve_id, p_actual_amount)
 *   refund_reservation(p_reserve_id)
 *
 * Discipline (board CANONICAL CONTRACTS):
 *  - OVER-reserve to the model's max_tokens ceiling up front.
 *  - Reconcile (settle) only ever REFUNDS the unused portion — never charges
 *    more — so there's no negative-balance bug class.
 *  - A 0-balance / insufficient-balance request MUST be refused before any
 *    provider call.
 *  - `p_reserve_id` is the server-derived idempotency key; the ledger's
 *    INSERT ... ON CONFLICT DO NOTHING makes reserve naturally idempotent.
 *
 * This module is mocked in unit tests; the real reserve→settle path is what the
 * chat-route test exercises through these functions.
 */
import { getSupabase } from "../lib/supabase.ts";
import { Errors } from "../lib/errors.ts";

export interface ReserveResult {
  ok: boolean;
  balance?: number;
  reserved?: number;
}

/**
 * Reserve `amount` credits for `userId` under `reserveId`. Returns ok=false if
 * the balance is insufficient (caller refuses with 402). Idempotent on reserveId.
 */
export async function reserve(
  userId: string,
  amount: number,
  reserveId: string,
): Promise<ReserveResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("reserve_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reserve_id: reserveId,
  });
  if (error) {
    // The ledger raises a specific condition for insufficient balance; surface
    // it as a clean 402 rather than a 500.
    const msg = error.message ?? "";
    if (/insufficient/i.test(msg) || error.code === "P0001") {
      return { ok: false };
    }
    throw Errors.internal(`reserve_credits failed: ${msg}`);
  }
  // The RPC returns the reservation row / balance snapshot. Treat any non-null
  // success as reserved.
  const row = normalizeRow(data);
  if (row && row.ok === false) return { ok: false };
  return { ok: true, balance: row?.balance, reserved: amount };
}

/**
 * Settle a reservation with the ACTUAL amount consumed. Only ever refunds the
 * difference (actual <= reserved). Best-effort: failures are logged, not thrown,
 * because the response has already been streamed to the client.
 */
export async function settle(reserveId: string, actualAmount: number): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("settle_credits", {
    p_reserve_id: reserveId,
    p_actual_amount: actualAmount,
  });
  if (error) {
    console.error(
      JSON.stringify({ level: "error", at: "settle", reserveId, msg: error.message }),
    );
  }
}

/** Refund a reservation in full (provider failed before producing billable usage). */
export async function refund(reserveId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("refund_reservation", { p_reserve_id: reserveId });
  if (error) {
    console.error(
      JSON.stringify({ level: "error", at: "refund", reserveId, msg: error.message }),
    );
  }
}

/**
 * Trailing-24h reserved-credit sum for the daily cap (ledger helper
 * `reserved_today(p_user_id)`). Service-role only. Used to refuse a request that
 * would push the user over their per-day cap BEFORE reserving.
 */
export async function reservedToday(userId: string): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("reserved_today", { p_user_id: userId });
  if (error) throw Errors.internal(`reserved_today failed: ${error.message}`);
  return Number(data ?? 0);
}

/**
 * Daily-cap gate. Returns true if reserving `amount` would keep the user at or
 * under `cap` for the trailing 24h. Fails OPEN (returns true) if the underlying
 * `reserved_today` read errors — reserve_credits + the balance CHECK remain the
 * hard backstop, so an infra blip never wrongly blocks a paying user.
 */
export async function withinDailyCap(
  userId: string,
  amount: number,
  cap: number,
): Promise<boolean> {
  try {
    const usedToday = await reservedToday(userId);
    return usedToday + amount <= cap;
  } catch (e) {
    console.error(
      JSON.stringify({ level: "warn", at: "daily-cap", msg: (e as Error).message }),
    );
    return true; // fail open
  }
}

/** Read the user's current credit balance. */
export async function getBalance(userId: string): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw Errors.internal(`balance read failed: ${error.message}`);
  return data?.balance ?? 0;
}

function normalizeRow(data: unknown): { ok?: boolean; balance?: number } | null {
  if (data == null) return null;
  if (Array.isArray(data)) return (data[0] as any) ?? null;
  return data as any;
}

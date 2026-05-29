/**
 * Audit logging — one row per request into `ai_audit_log` (service-role INSERT),
 * plus a structured stdout line. Fire-and-forget: a failed audit write is logged
 * but NEVER blocks or fails the request (the response has usually already
 * streamed by the time we audit).
 *
 * Schema/contract owned by the ledger stream (migration
 * `20260308000200_ai_audit_log.sql`). Column rules we must respect:
 *  - `credits_delta` is GENERATED — never insert it.
 *  - `outcome` has a CHECK ∈ {success, error_upstream, error_credits, client_abort}.
 *  - `reserve_id` is NULL for $0 / local requests that never reserved.
 *  - Only service_role may INSERT (we use the service-role client).
 */
import { getSupabase } from "../lib/supabase.ts";

/** Allowed `outcome` values (matches the table CHECK constraint). */
export type AuditOutcome = "success" | "error_upstream" | "error_credits" | "client_abort";

export interface AuditRecord {
  userId: string;
  reserveId?: string | null;
  action?: string; // chat|summarize|rewrite|agent|transcribe|embed|… (default 'chat')
  provider: string;
  model: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
  cacheReadTokens?: number;
  creditsReserved?: number;
  creditsActual?: number;
  latencyMs?: number;
  outcome: AuditOutcome;
  errorCode?: string | null;
}

/** Map a proxy error `code` to the table's coarse `outcome` enum. */
export function outcomeForError(code: string): AuditOutcome {
  if (code === "client_cancelled") return "client_abort";
  if (code === "insufficient_credits") return "error_credits";
  return "error_upstream";
}

/**
 * Insert one audit row (fire-and-forget) and emit a stdout line. Awaiting is
 * optional — callers may `void audit(...)`; failures are swallowed after logging.
 */
export async function audit(rec: AuditRecord): Promise<void> {
  // Always emit the structured stdout line (cheap, ships off-box via the log
  // pipeline even if the DB insert fails).
  console.log(
    JSON.stringify({ level: "audit", ts: new Date().toISOString(), ...rec }),
  );

  try {
    const sb = getSupabase();
    const { error } = await sb.from("ai_audit_log").insert({
      user_id: rec.userId,
      reserve_id: rec.reserveId ?? null,
      action: rec.action ?? "chat",
      provider: rec.provider,
      model: rec.model,
      tokens_prompt: rec.tokensPrompt ?? 0,
      tokens_completion: rec.tokensCompletion ?? 0,
      cache_read_tokens: rec.cacheReadTokens ?? 0,
      credits_reserved: rec.creditsReserved ?? 0,
      credits_actual: rec.creditsActual ?? 0,
      latency_ms: rec.latencyMs ?? null,
      outcome: rec.outcome,
      error_code: rec.errorCode ?? null,
      // credits_delta is GENERATED — intentionally omitted.
    });
    if (error) {
      console.error(
        JSON.stringify({ level: "error", at: "audit.insert", msg: error.message }),
      );
    }
  } catch (e) {
    console.error(
      JSON.stringify({ level: "error", at: "audit.insert", msg: (e as Error).message }),
    );
  }
}

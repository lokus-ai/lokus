/**
 * Idempotency — derives a SERVER-side key from the user + request body +
 * minute-bucket, so a client retry within the same minute does not double-spend.
 *
 *   key = sha256(user_id + ':' + sha256(body) + ':' + minute_bucket)
 *
 * The key is claimed in Redis with `SET reserve:{key} ... NX EX 900`. A replayed
 * key short-circuits: we return the cached result and make NO provider call. The
 * same key is reused as the credit `reserve_id`, so the ledger's
 * `INSERT ... ON CONFLICT DO NOTHING` makes the reservation itself idempotent.
 *
 * This module exposes helpers used by the chat/embed/transcribe routes rather
 * than a blanket middleware, because the routes need to weave the key through
 * reserve/settle and emit it on the SSE stream.
 */
import {
  claimIdempotencyKey,
  storeIdempotencyResult,
  releaseIdempotencyKey,
} from "../lib/redis.ts";
import { IDEMPOTENCY_TTL_SECONDS } from "../lib/constants.ts";

/** sha256 hex of a string (Web Crypto, available in Bun). */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build the server-derived idempotency / reservation key for a request. */
export async function deriveKey(
  userId: string,
  rawBody: string,
  now = Date.now(),
): Promise<string> {
  const bodyHash = await sha256Hex(rawBody);
  const minuteBucket = Math.floor(now / 60_000);
  return sha256Hex(`${userId}:${bodyHash}:${minuteBucket}`);
}

export type ClaimOutcome =
  | { replay: false }
  | { replay: true; cached: string };

/**
 * Claim the key. Returns {replay:false} for a fresh request (caller proceeds),
 * or {replay:true, cached} for a replay (caller returns the cached payload).
 */
export async function claim(key: string): Promise<ClaimOutcome> {
  const result = await claimIdempotencyKey(key, IDEMPOTENCY_TTL_SECONDS);
  if (result === "fresh") return { replay: false };
  return { replay: true, cached: result };
}

export async function complete(key: string, result: unknown): Promise<void> {
  await storeIdempotencyResult(key, result, IDEMPOTENCY_TTL_SECONDS);
}

/** Release a claimed key whose request failed before producing a billable result. */
export async function abandon(key: string): Promise<void> {
  await releaseIdempotencyKey(key);
}

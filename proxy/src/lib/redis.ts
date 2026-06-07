/**
 * Redis client (ioredis) — backs the sliding-window rate limiter and the
 * idempotency / reservation store. A single shared connection is reused across
 * requests. In tests this module is mocked; nothing here calls a real network
 * at import time.
 */
import Redis from "ioredis";
import { config } from "../config.ts";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    // Do not crash the process on a transient Redis blip; log and let the
    // per-request guards (rate-limit / idempotency) decide fail-open vs closed.
    console.error(JSON.stringify({ level: "error", at: "redis", msg: err.message }));
  });
  return client;
}

/**
 * Sliding-window rate limit using a sorted set keyed by the JWT `sub`.
 * Returns the current count within the window after recording this hit.
 * Atomic via a single pipeline; expired entries are trimmed each call.
 */
export async function slidingWindowHit(
  key: string,
  windowMs: number,
  now = Date.now(),
): Promise<number> {
  const redis = getRedis();
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  const cutoff = now - windowMs;
  const results = await redis
    .multi()
    .zremrangebyscore(key, 0, cutoff)
    .zadd(key, now, member)
    .zcard(key)
    .pexpire(key, windowMs)
    .exec();
  // results: [[err, n], [err, n], [err, count], [err, n]]
  const card = results?.[2]?.[1];
  return typeof card === "number" ? card : Number(card ?? 0);
}

/**
 * Idempotency reservation gate. Returns:
 *  - "fresh": this is the first time we've seen the key (caller proceeds).
 *  - the stored JSON string: a replay; caller returns the cached result.
 * Uses SET NX EX to claim the key atomically.
 */
export async function claimIdempotencyKey(
  key: string,
  ttlSeconds: number,
): Promise<"fresh" | string> {
  const redis = getRedis();
  const ok = await redis.set(`reserve:${key}`, "pending", "EX", ttlSeconds, "NX");
  if (ok === "OK") return "fresh";
  const existing = await redis.get(`reserve:${key}`);
  return existing ?? "pending";
}

/** Store the final result for a completed idempotency key (replay payload). */
export async function storeIdempotencyResult(
  key: string,
  result: unknown,
  ttlSeconds: number,
): Promise<void> {
  const redis = getRedis();
  await redis.set(`reserve:${key}`, JSON.stringify(result), "EX", ttlSeconds);
}

/** Release a claimed-but-failed key so the client may retry immediately. */
export async function releaseIdempotencyKey(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`reserve:${key}`);
}

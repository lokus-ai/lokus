/**
 * Rate-limit middleware — two layers:
 *
 *   1. IP-based (global backstop): catches account-farming and unauthenticated
 *      probes before they reach auth.
 *   2. User-based (JWT `sub`): per-account throttle.
 *
 * Redis failures are treated as FAIL-CLOSED (503) rather than fail-open.
 * With a history of $10k abuse bills, we NEVER allow requests when the
 * rate-limit store is unreachable.
 */
import type { Context, Next } from "hono";
import { slidingWindowHit } from "../lib/redis.ts";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  IP_RATE_LIMIT_MAX,
  IP_RATE_LIMIT_WINDOW_MS,
} from "../lib/constants.ts";
import { Errors, errorBody } from "../lib/errors.ts";
import type { AuthedUser } from "../lib/jwks.ts";

/** Extract the client IP from X-Forwarded-For (nginx sets this) or the
 *  direct connection remote address. */
function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can be a chain; take the FIRST (closest to client).
    return forwarded.split(",")[0].trim();
  }
  // Hono does not expose remoteAddr directly in all runtimes;
  // fallback to a sentinel so we still rate-limit by connection.
  return (c.env as any)?.remoteAddress ?? "unknown";
}

export async function ipRateLimitMiddleware(c: Context, next: Next) {
  const ip = clientIp(c);
  try {
    const count = await slidingWindowHit(`ratelimit-ip:${ip}`, IP_RATE_LIMIT_WINDOW_MS);
    if (count > IP_RATE_LIMIT_MAX) {
      const err = Errors.rateLimited();
      c.header("Retry-After", String(Math.ceil(IP_RATE_LIMIT_WINDOW_MS / 1000)));
      return c.json(errorBody(err), 429);
    }
  } catch (e) {
    console.error(
      JSON.stringify({ level: "error", at: "rate-limit-ip", msg: (e as Error).message }),
    );
    // FAIL CLOSED — do NOT allow requests when Redis is unreachable.
    return c.json(
      errorBody(Errors.providerError("Rate limiter unavailable")),
      503,
    );
  }
  await next();
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get("user") as AuthedUser | undefined;
  if (!user) {
    // auth must precede this; defensively 401.
    return c.json(errorBody(Errors.unauthorized()), 401);
  }
  try {
    const count = await slidingWindowHit(`ratelimit:${user.sub}`, RATE_LIMIT_WINDOW_MS);
    if (count > RATE_LIMIT_MAX) {
      const err = Errors.rateLimited();
      c.header("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
      return c.json(errorBody(err), 429);
    }
  } catch (e) {
    console.error(
      JSON.stringify({ level: "error", at: "rate-limit", msg: (e as Error).message }),
    );
    // FAIL CLOSED — do NOT allow requests when Redis is unreachable.
    return c.json(
      errorBody(Errors.providerError("Rate limiter unavailable")),
      503,
    );
  }
  await next();
}

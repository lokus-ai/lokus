/**
 * Rate-limit middleware — Redis sliding window keyed by the authenticated user
 * (JWT `sub`). Must run AFTER auth. Over-limit → 429 (retryable). If Redis is
 * unreachable we fail OPEN (allow the request) rather than locking everyone out
 * on an infra blip — the credit ledger is the hard backstop on abuse.
 */
import type { Context, Next } from "hono";
import { slidingWindowHit } from "../lib/redis.ts";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "../lib/constants.ts";
import { Errors, errorBody } from "../lib/errors.ts";
import type { AuthedUser } from "../lib/jwks.ts";

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
      JSON.stringify({ level: "warn", at: "rate-limit", msg: (e as Error).message }),
    );
    // fail open
  }
  await next();
}

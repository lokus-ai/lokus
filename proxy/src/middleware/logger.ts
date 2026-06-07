/**
 * Request logger — one structured line per request with method, path, status,
 * and duration. Never logs bodies, tokens, or auth headers.
 */
import type { Context, Next } from "hono";

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const durationMs = Date.now() - start;
  console.log(
    JSON.stringify({
      level: "info",
      at: "request",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
    }),
  );
}

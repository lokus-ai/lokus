/**
 * Request logger — one structured line per request with method, path, status,
 * duration, and client IP. Never logs bodies, tokens, or auth headers.
 */
import type { Context, Next } from "hono";

function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (c.env as any)?.remoteAddress ?? "unknown";
}

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
      ip: clientIp(c),
    }),
  );
}

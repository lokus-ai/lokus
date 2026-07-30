/**
 * Security middleware — body-size guard, message-length guard, and concurrent
 * stream tracking. Applied BEFORE auth so unauthenticated junk is rejected
 * cheaply (no JWT verification cost).
 *
 * Concurrent stream tracking uses an in-memory map keyed by user sub.
 * This is NOT distributed-safe (a user could open streams on two proxy
 * instances), but it is sufficient for a single-instance deployment and
 * acts as a backstop against connection exhaustion.
 */
import type { Context, Next } from "hono";
import {
  MAX_BODY_SIZE_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGES_COUNT,
  MAX_CONCURRENT_STREAMS_PER_USER,
} from "../lib/constants.ts";
import { Errors, errorBody } from "../lib/errors.ts";

// ---------------------------------------------------------------------------
// Body size guard
// ---------------------------------------------------------------------------

export async function bodySizeGuard(c: Context, next: Next) {
  const contentLength = c.req.header("content-length");
  if (contentLength) {
    const len = Number(contentLength);
    if (Number.isFinite(len) && len > MAX_BODY_SIZE_BYTES) {
      return c.json(
        errorBody(Errors.invalidRequest(`Body exceeds ${MAX_BODY_SIZE_BYTES} bytes`)),
        413,
      );
    }
  }
  await next();
}

// ---------------------------------------------------------------------------
// Message validation guard (chat only)
// ---------------------------------------------------------------------------

export async function messageGuard(c: Context, next: Next) {
  if (c.req.method !== "POST" || c.req.path !== "/v1/chat") {
    await next();
    return;
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    await next();
    return;
  }

  if (!body || typeof body !== "object") {
    await next();
    return;
  }

  const b = body as { messages?: unknown[]; max_tokens?: unknown };

  if (Array.isArray(b.messages)) {
    if (b.messages.length > MAX_MESSAGES_COUNT) {
      return c.json(
        errorBody(Errors.invalidRequest(`messages[] exceeds ${MAX_MESSAGES_COUNT} items`)),
        400,
      );
    }
    for (let i = 0; i < b.messages.length; i++) {
      const m = b.messages[i];
      if (m && typeof m === "object") {
        const content = (m as { content?: unknown }).content;
        const text = typeof content === "string"
          ? content
          : (Array.isArray(content)
              ? content.map((b: unknown) =>
                  typeof b === "object" && b !== null
                    ? ((b as { text?: string }).text ?? "")
                    : String(b)
                ).join("")
              : JSON.stringify(content));
        if (text.length > MAX_MESSAGE_LENGTH) {
          return c.json(
            errorBody(Errors.invalidRequest(`message[${i}] exceeds ${MAX_MESSAGE_LENGTH} chars`)),
            400,
          );
        }
      }
    }
  }

  await next();
}

// ---------------------------------------------------------------------------
// Concurrent stream tracking (per-user)
// ---------------------------------------------------------------------------

const activeStreams = new Map<string, number>();

export function incrementStreams(sub: string): boolean {
  const current = activeStreams.get(sub) ?? 0;
  if (current >= MAX_CONCURRENT_STREAMS_PER_USER) {
    return false;
  }
  activeStreams.set(sub, current + 1);
  return true;
}

export function decrementStreams(sub: string): void {
  const current = activeStreams.get(sub) ?? 0;
  if (current <= 1) {
    activeStreams.delete(sub);
  } else {
    activeStreams.set(sub, current - 1);
  }
}

export async function streamConcurrencyGuard(c: Context, next: Next) {
  // Only gate SSE streaming endpoints.
  if (c.req.method !== "POST" || c.req.path !== "/v1/chat") {
    await next();
    return;
  }

  const user = c.get("user") as { sub: string } | undefined;
  if (!user) {
    await next();
    return;
  }

  if (!incrementStreams(user.sub)) {
    return c.json(
      errorBody(
        Errors.invalidRequest(
          `Max ${MAX_CONCURRENT_STREAMS_PER_USER} concurrent streams exceeded`,
        ),
      ),
      429,
    );
  }

  try {
    await next();
  } finally {
    decrementStreams(user.sub);
  }
}

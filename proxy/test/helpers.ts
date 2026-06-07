/**
 * Shared test helpers: an unsigned-but-shaped JWT and a fake provider stream.
 * Tests mock the modules that touch the network (jwks, credit, redis, providers)
 * so nothing here reaches a real service.
 */
import type { StreamEvent } from "../src/providers/interface.ts";

/** A throwaway base64url JWT payload (NOT verified — jwks is mocked in tests). */
export function fakeJwt(sub = "user-123", plan = "paid"): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub, app_metadata: { plan }, exp: Math.floor(Date.now() / 1000) + 3600 }),
  );
  return `${header}.${payload}.sig`;
}

function b64url(s: string): string {
  return Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Build a provider whose `complete()` yields the given events. */
export function fakeProvider(events: StreamEvent[]) {
  return {
    async complete() {
      return {
        async *stream() {
          for (const ev of events) yield ev;
        },
      };
    },
  };
}

/** Collect all SSE `data:` frames from a streamed Response body into an array of
 *  parsed JSON objects (and the literal `[DONE]` sentinel as a string). */
export async function collectSSE(res: Response): Promise<Array<unknown>> {
  const text = await res.text();
  const out: unknown[] = [];
  for (const block of text.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") {
      out.push("[DONE]");
      continue;
    }
    try {
      out.push(JSON.parse(data));
    } catch {
      out.push(data);
    }
  }
  return out;
}

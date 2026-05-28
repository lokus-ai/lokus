/**
 * /v1/chat — the money path. Verifies that a single chat request, with every
 * external dependency mocked, performs reserve → stream → settle and ends with
 * the SSE terminal `type:"done"` then `[DONE]` frames.
 *
 * Mock strategy: replace the modules that touch the network (jwks, credit,
 * idempotency/redis, router providers) BEFORE importing the handler, so the test
 * exercises the real orchestration in chat.ts without any real provider/Supabase/
 * Redis call.
 */
import { describe, it, expect, mock, beforeAll } from "bun:test";
import { fakeJwt, collectSSE } from "./helpers.ts";

// --- Spies ---------------------------------------------------------------
const calls = {
  reserve: [] as Array<{ userId: string; amount: number; reserveId: string }>,
  settle: [] as Array<{ reserveId: string; actual: number }>,
  refund: [] as Array<{ reserveId: string }>,
  providerComplete: 0,
};

let reserveOk = true;

// Mock jwks: any token → a fixed paid user.
mock.module("../src/lib/jwks.ts", () => ({
  verifyToken: async () => ({
    sub: "user-123",
    payload: { sub: "user-123", app_metadata: { plan: "paid" } },
  }),
  __clearTokenCache: () => {},
}));

// Mock the credit service.
mock.module("../src/services/credit.ts", () => ({
  reserve: async (userId: string, amount: number, reserveId: string) => {
    calls.reserve.push({ userId, amount, reserveId });
    return { ok: reserveOk, reserved: amount };
  },
  settle: async (reserveId: string, actual: number) => {
    calls.settle.push({ reserveId, actual });
  },
  refund: async (reserveId: string) => {
    calls.refund.push({ reserveId });
  },
  getBalance: async () => 1000,
}));

// Mock idempotency: always fresh, no real Redis.
mock.module("../src/middleware/idempotency.ts", () => ({
  deriveKey: async () => "test-reserve-key",
  claim: async () => ({ replay: false }),
  complete: async () => {},
  abandon: async () => {},
}));

// Mock rate-limit Redis primitives so the middleware never touches Redis.
mock.module("../src/lib/redis.ts", () => ({
  getRedis: () => ({}),
  slidingWindowHit: async () => 1,
  claimIdempotencyKey: async () => "fresh",
  storeIdempotencyResult: async () => {},
  releaseIdempotencyKey: async () => {},
}));

// Mock the router so we get a deterministic fake provider and skip real SDKs.
mock.module("../src/services/router.ts", () => {
  const fakeProvider = {
    async complete() {
      calls.providerComplete++;
      return {
        async *stream() {
          yield { type: "text_delta", text: "Hello" };
          yield { type: "text_delta", text: ", world" };
          yield {
            type: "usage",
            promptTokens: 100,
            completionTokens: 20,
            cacheReadTokens: 0,
          };
          yield { type: "message_stop" };
        },
      };
    },
  };
  return {
    resolveModel: () => ({
      model: "claude-sonnet-4-20250514",
      provider: fakeProvider,
      fallback: { model: "gpt-4o", provider: fakeProvider },
    }),
    reservationAmount: () => 100,
    actualAmount: () => 7,
    isFreeProvider: () => false,
    FREE_MODEL: "claude-haiku-4-20250514",
    DEFAULT_MODEL: "claude-sonnet-4-20250514",
    FALLBACK_MODEL: "gpt-4o",
  };
});

let app: { fetch: (req: Request) => Response | Promise<Response> };

beforeAll(async () => {
  process.env.BUN_TEST = "1";
  const mod = await import("../src/index.ts");
  app = mod.app;
});

function chatRequest(body: unknown) {
  return new Request("http://localhost/v1/chat", {
    method: "POST",
    headers: {
      authorization: `Bearer ${fakeJwt()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/chat", () => {
  it("does reserve → stream → settle and ends with done + [DONE]", async () => {
    calls.reserve.length = 0;
    calls.settle.length = 0;
    calls.refund.length = 0;
    calls.providerComplete = 0;
    reserveOk = true;

    const res = await app.fetch(
      chatRequest({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(res.status).toBe(200);

    const frames = await collectSSE(res);

    // reserve happened exactly once, before settle.
    expect(calls.reserve.length).toBe(1);
    expect(calls.reserve[0].reserveId).toBe("test-reserve-key");
    expect(calls.providerComplete).toBe(1);
    expect(calls.settle.length).toBe(1);
    expect(calls.settle[0].reserveId).toBe("test-reserve-key");
    expect(calls.refund.length).toBe(0);

    // text deltas forwarded.
    const textFrames = frames.filter(
      (f): f is { type: string; text: string } =>
        typeof f === "object" && f !== null && (f as any).type === "text_delta",
    );
    expect(textFrames.map((f) => f.text).join("")).toBe("Hello, world");

    // terminal frames: a type:"done" then literal [DONE].
    const done = frames.find(
      (f) => typeof f === "object" && f !== null && (f as any).type === "done",
    ) as any;
    expect(done).toBeTruthy();
    expect(done.usage.promptTokens).toBe(100);
    expect(done.usage.completionTokens).toBe(20);
    expect(frames[frames.length - 1]).toBe("[DONE]");
  });

  it("refuses with 402 when balance is insufficient (no provider call)", async () => {
    calls.reserve.length = 0;
    calls.settle.length = 0;
    calls.providerComplete = 0;
    reserveOk = false;

    const res = await app.fetch(
      chatRequest({ messages: [{ role: "user", content: "hi" }] }),
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("insufficient_credits");
    expect(calls.providerComplete).toBe(0);
    expect(calls.settle.length).toBe(0);
  });

  it("rejects an empty messages[] with 400 before reserving", async () => {
    calls.reserve.length = 0;
    reserveOk = true;
    const res = await app.fetch(chatRequest({ messages: [] }));
    expect(res.status).toBe(400);
    expect(calls.reserve.length).toBe(0);
  });

  it("returns 401 without a bearer token", async () => {
    const res = await app.fetch(
      new Request("http://localhost/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});

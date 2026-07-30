/**
 * Pure-unit tests: SSE frame helpers, idempotency key derivation, router model
 * selection, and the Anthropic cache-boundary split. No network, no mocks.
 */
import { describe, it, expect } from "bun:test";
import { sseError, sseDone, sseData, Errors } from "../src/lib/errors.ts";
import { deriveKey } from "../src/middleware/idempotency.ts";
import { CACHE_BOUNDARY } from "../src/lib/constants.ts";

describe("SSE frame helpers", () => {
  it("sseDone ends with type:done then [DONE]", () => {
    const out = sseDone({ model: "x" });
    expect(out).toContain('"type":"done"');
    expect(out).toContain('"model":"x"');
    expect(out.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("sseError ends with type:error then [DONE] and carries retryable", () => {
    const out = sseError(Errors.rateLimited());
    expect(out).toContain('"type":"error"');
    expect(out).toContain('"code":"rate_limited"');
    expect(out).toContain('"retryable":true');
    expect(out.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("sseData encodes a single frame", () => {
    expect(sseData({ a: 1 })).toBe('data: {"a":1}\n\n');
  });
});

describe("idempotency key derivation", () => {
  it("is stable for the same user+body within the same minute bucket", async () => {
    const now = 1_700_000_000_000;
    const a = await deriveKey("u1", "body", now);
    const b = await deriveKey("u1", "body", now + 5_000); // same minute
    expect(a).toBe(b);
  });

  it("differs across minute buckets", async () => {
    const now = 1_700_000_000_000;
    const a = await deriveKey("u1", "body", now);
    const b = await deriveKey("u1", "body", now + 61_000); // next minute
    expect(a).not.toBe(b);
  });

  it("differs by user and by body", async () => {
    const now = 1_700_000_000_000;
    expect(await deriveKey("u1", "body", now)).not.toBe(await deriveKey("u2", "body", now));
    expect(await deriveKey("u1", "body", now)).not.toBe(await deriveKey("u1", "other", now));
  });

  it("produces a 64-char sha256 hex digest", async () => {
    const k = await deriveKey("u1", "body", 1_700_000_000_000);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("router model selection", async () => {
  // Imported lazily so the module's provider constructors (which read config)
  // don't run at file load under odd env.
  const { resolveModel, FREE_MODEL, DEFAULT_MODEL, dailyCapForPlan } = await import(
    "../src/services/router.ts"
  );

  it("free tier with no model → haiku", () => {
    expect(resolveModel(undefined, "free").model).toBe(FREE_MODEL);
  });

  it("paid tier with no model → sonnet", () => {
    expect(resolveModel(undefined, "paid").model).toBe(DEFAULT_MODEL);
  });

  it("paid default resolves to gpt-4o with anthropic fallback", () => {
    const r = resolveModel(undefined, "paid");
    expect(r.model).toBe("gpt-4o");
    expect(r.fallback?.model).toBe("claude-sonnet-4-20250514");
  });

  it("free tier cannot request the paid default model", () => {
    expect(() => resolveModel(DEFAULT_MODEL, "free")).toThrow();
  });

  it("free tier cannot request gpt-4o", () => {
    expect(() => resolveModel("gpt-4o", "free")).toThrow();
  });

  it("explicit openai model gets anthropic fallback when key available", () => {
    const r = resolveModel("gpt-4o", "paid");
    expect(r.model).toBe("gpt-4o");
    expect(r.fallback?.model).toBe("claude-sonnet-4-20250514");
  });

  it("unknown model is rejected", () => {
    expect(() => resolveModel("definitely-not-a-model", "paid")).toThrow();
  });

  it("daily cap scales by plan: free=base, pro=x5, power=x10", () => {
    const free = dailyCapForPlan("free");
    expect(dailyCapForPlan(undefined)).toBe(free);
    expect(dailyCapForPlan("pro")).toBe(free * 5);
    expect(dailyCapForPlan("power")).toBe(free * 10);
  });
});

describe("audit outcome mapping", async () => {
  const { outcomeForError } = await import("../src/services/audit.ts");
  it("maps error codes to the table's outcome enum", () => {
    expect(outcomeForError("client_cancelled")).toBe("client_abort");
    expect(outcomeForError("insufficient_credits")).toBe("error_credits");
    expect(outcomeForError("provider_error")).toBe("error_upstream");
    expect(outcomeForError("upstream_timeout")).toBe("error_upstream");
  });
});

describe("cache boundary", () => {
  it("is the exact literal the engine inserts", () => {
    expect(CACHE_BOUNDARY).toBe("\n\n---CACHE_BOUNDARY---\n\n");
  });
});

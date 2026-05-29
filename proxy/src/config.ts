/**
 * Centralized config. Reads from the environment ONCE at import and fails fast
 * if a required var is missing — the process refuses to boot rather than 500ing
 * at request time. Provider and service-role keys live ONLY here, sourced from
 * env; nothing else in the codebase reads `process.env` for secrets.
 */

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export interface Config {
  PORT: number;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  REDIS_URL: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  LOKUS_DEEPGRAM_KEY: string;
  OLLAMA_BASE_URL: string;
  OPENROUTER_API_KEY: string;
  DAILY_CREDIT_CAP: number;
}

// In `bun test` we don't want config to throw on missing secrets — tests mock
// every downstream client. Detect the test runtime and relax `required`.
const IS_TEST =
  process.env.NODE_ENV === "test" ||
  typeof (globalThis as { Bun?: { jest?: unknown } }).Bun?.jest !== "undefined" ||
  process.env.BUN_TEST === "1";

function req(name: string, testFallback: string): string {
  return IS_TEST ? optional(name, testFallback) : required(name);
}

export const config: Config = {
  PORT: Number(optional("PORT", "3000")),
  SUPABASE_URL: req("SUPABASE_URL", "https://test.supabase.co"),
  SUPABASE_SERVICE_ROLE_KEY: req("SUPABASE_SERVICE_ROLE_KEY", "test-service-role"),
  REDIS_URL: req("REDIS_URL", "redis://localhost:6379"),
  ANTHROPIC_API_KEY: req("ANTHROPIC_API_KEY", "test-anthropic"),
  OPENAI_API_KEY: req("OPENAI_API_KEY", "test-openai"),
  LOKUS_DEEPGRAM_KEY: req("LOKUS_DEEPGRAM_KEY", "test-deepgram"),
  OLLAMA_BASE_URL: optional("OLLAMA_BASE_URL", "http://localhost:11434"),
  OPENROUTER_API_KEY: optional("OPENROUTER_API_KEY", ""),
  // Base free-tier daily reserved-credit cap. Pro/power scale it (see
  // dailyCapForPlan in services/router.ts). Matches the ledger edge-fn default.
  DAILY_CREDIT_CAP: Number(optional("DAILY_CREDIT_CAP", "2000")),
};

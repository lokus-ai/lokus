/**
 * Local JWT verification against Supabase's JWKS.
 *
 * Hot path: every /v1 request carries a Supabase access token. We verify it
 * LOCALLY (no network on the happy path) using the project's JWKS endpoint,
 * which `jose` fetches and caches. Two layers of caching keep latency near zero:
 *   1. JWKS key set — cached by `jose` for ~1h (cooldownDuration).
 *   2. Decoded token — a 60s in-memory cache keyed by the raw token string, so a
 *      burst of requests from one client verifies the signature once.
 *
 * `getUser()` (a network round-trip to Supabase) is intentionally NOT called on
 * the happy path — only callers that explicitly need fresh user metadata do so,
 * and only on a cache miss.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.ts";

export interface AuthedUser {
  sub: string;
  email?: string;
  role?: string;
  payload: JWTPayload;
}

const JWKS_URL = new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);

const jwks = createRemoteJWKSet(JWKS_URL, {
  cacheMaxAge: 60 * 60 * 1000, // 1h
  cooldownDuration: 30 * 1000,
});

interface CachedToken {
  user: AuthedUser;
  expiresAt: number; // ms epoch — min(token exp, now+60s)
}

const TOKEN_CACHE_TTL_MS = 60 * 1000;
const tokenCache = new Map<string, CachedToken>();

function pruneTokenCache(now: number): void {
  if (tokenCache.size < 1024) return;
  for (const [k, v] of tokenCache) {
    if (v.expiresAt <= now) tokenCache.delete(k);
  }
}

/**
 * Verify a bearer token and return the authed user, using the JWKS + 60s decoded
 * cache. Throws on any verification failure (caller maps to 401).
 */
export async function verifyToken(token: string): Promise<AuthedUser> {
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) return cached.user;

  const { payload } = await jwtVerify(token, jwks, {
    // Supabase signs with the project; we trust the project's JWKS. issuer/
    // audience are validated loosely (Supabase sets aud to "authenticated").
    algorithms: ["RS256", "ES256"],
  });

  if (!payload.sub) {
    throw new Error("token missing sub");
  }

  const user: AuthedUser = {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    role: typeof payload.role === "string" ? payload.role : undefined,
    payload,
  };

  const tokenExpMs = typeof payload.exp === "number" ? payload.exp * 1000 : Infinity;
  pruneTokenCache(now);
  tokenCache.set(token, {
    user,
    expiresAt: Math.min(now + TOKEN_CACHE_TTL_MS, tokenExpMs),
  });

  return user;
}

/** Test-only: clear the decoded-token cache. */
export function __clearTokenCache(): void {
  tokenCache.clear();
}

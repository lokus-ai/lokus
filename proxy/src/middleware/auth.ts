/**
 * Auth middleware — extracts the bearer token, verifies it locally against the
 * Supabase JWKS (cached), and stashes the authed user on the Hono context as
 * `user`. Failure → 401. No network on the happy path.
 */
import type { Context, Next } from "hono";
import { verifyToken, type AuthedUser } from "../lib/jwks.ts";
import { Errors, errorBody } from "../lib/errors.ts";

export interface AuthVars {
  user: AuthedUser;
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    const err = Errors.unauthorized("Missing bearer token");
    return c.json(errorBody(err), 401);
  }
  const token = header.slice(7).trim();
  try {
    const user = await verifyToken(token);
    c.set("user", user);
  } catch {
    const err = Errors.unauthorized("Invalid or expired token");
    return c.json(errorBody(err), 401);
  }
  await next();
}

/**
 * GET /v1/balance — current credit balance for the authenticated user.
 */
import type { Context } from "hono";
import type { AuthedUser } from "../lib/jwks.ts";
import * as credit from "../services/credit.ts";
import { toProxyError, errorBody } from "../lib/errors.ts";

export async function balanceHandler(c: Context) {
  const user = c.get("user") as AuthedUser;
  try {
    const balance = await credit.getBalance(user.sub);
    return c.json({ balance });
  } catch (e) {
    const err = toProxyError(e);
    return c.json(errorBody(err), err.status as 500);
  }
}

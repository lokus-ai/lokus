/**
 * POST /v1/embed — cloud embedding FALLBACK only. The client embeds locally by
 * default; it calls this when local embeddings are unavailable. Reserves a small
 * fixed credit amount, embeds via OpenAI, settles. Not streamed.
 */
import type { Context } from "hono";
import type { AuthedUser } from "../lib/jwks.ts";
import { OpenAIProvider } from "../providers/openai.ts";
import * as credit from "../services/credit.ts";
import { deriveKey, claim, complete, abandon } from "../middleware/idempotency.ts";
import { Errors, ProxyError, toProxyError, errorBody } from "../lib/errors.ts";

interface EmbedBody {
  texts: string[];
}

/** Flat credit cost per embedding call (cheap; over-reserve = exact here). */
const EMBED_COST_PER_TEXT = 1;

export async function embedHandler(c: Context) {
  const user = c.get("user") as AuthedUser;

  let body: EmbedBody;
  let rawBody: string;
  try {
    rawBody = await c.req.text();
    const parsed = rawBody ? JSON.parse(rawBody) : null;
    if (!parsed || !Array.isArray(parsed.texts) || parsed.texts.length === 0) {
      throw Errors.invalidRequest("texts[] required");
    }
    if (parsed.texts.some((t: unknown) => typeof t !== "string")) {
      throw Errors.invalidRequest("texts[] must be strings");
    }
    body = parsed;
  } catch (e) {
    const err = e instanceof ProxyError ? e : Errors.invalidRequest("Malformed JSON body");
    return c.json(errorBody(err), err.status as 400);
  }

  const key = await deriveKey(user.sub, rawBody);
  const claimOutcome = await claim(key);
  if (claimOutcome.replay && claimOutcome.cached !== "pending") {
    try {
      return c.json(JSON.parse(claimOutcome.cached));
    } catch {
      // fall through and recompute
    }
  }

  const amount = Math.max(1, body.texts.length * EMBED_COST_PER_TEXT);
  let reserved: credit.ReserveResult;
  try {
    reserved = await credit.reserve(user.sub, amount, key);
  } catch (e) {
    await abandon(key);
    const err = toProxyError(e);
    return c.json(errorBody(err), err.status as 500);
  }
  if (!reserved.ok) {
    await abandon(key);
    return c.json(errorBody(Errors.insufficientCredits()), 402);
  }

  try {
    const provider = new OpenAIProvider();
    const embeddings = await provider.embed(body.texts);
    await credit.settle(key, amount);
    const result = { embeddings, model: "text-embedding-3-small" };
    await complete(key, result);
    return c.json(result);
  } catch (e) {
    await credit.refund(key);
    await abandon(key);
    const err = toProxyError(e);
    return c.json(errorBody(err), err.status as 502);
  }
}

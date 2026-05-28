/**
 * Transcription routes — cloud STT fallback (Deepgram). The client transcribes
 * locally by default (Whisper sidecar); these endpoints are the cloud path.
 *
 *   POST /v1/transcribe        — batch: upload audio, get a transcript back.
 *   POST /v1/transcribe/ticket — issue a short-lived, single-use WS ticket so
 *                                the browser can open the WS without putting a
 *                                JWT in the URL (and never sees the Deepgram key).
 *   GET  /v1/transcribe/ws     — WebSocket relay: validates the ticket, then
 *                                proxies audio frames to Deepgram live STT and
 *                                relays transcripts back. The Deepgram key stays
 *                                server-side.
 *
 * The Deepgram key loads ONLY from env (LOKUS_DEEPGRAM_KEY). Credits are
 * reserved per request by audio seconds and settled on completion.
 */
import type { Context } from "hono";
import type { AuthedUser } from "../lib/jwks.ts";
import { config } from "../config.ts";
import * as credit from "../services/credit.ts";
import { getRedis } from "../lib/redis.ts";
import { verifyToken } from "../lib/jwks.ts";
import { deriveKey, claim, complete, abandon } from "../middleware/idempotency.ts";
import { Errors, toProxyError, errorBody } from "../lib/errors.ts";

const DEEPGRAM_BATCH_URL = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_LIVE_URL = "wss://api.deepgram.com/v1/listen";

/** Credit cost per second of audio (batch + live). */
const COST_PER_SECOND = 1;
/** Reservation ceiling for a live session (refunded down on settle). */
const LIVE_RESERVE_SECONDS = 600;
const TICKET_TTL_SECONDS = 60;

// ---------------------------------------------------------------------------
// POST /v1/transcribe — batch
// ---------------------------------------------------------------------------
export async function transcribeHandler(c: Context) {
  const user = c.get("user") as AuthedUser;

  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  const audio = await c.req.arrayBuffer();
  if (!audio || audio.byteLength === 0) {
    return c.json(errorBody(Errors.invalidRequest("audio body required")), 400);
  }

  // Derive idempotency key from a cheap fingerprint of the upload.
  const key = await deriveKey(user.sub, `transcribe:${audio.byteLength}:${contentType}`);
  const claimOutcome = await claim(key);
  if (claimOutcome.replay && claimOutcome.cached !== "pending") {
    try {
      return c.json(JSON.parse(claimOutcome.cached));
    } catch {
      /* recompute */
    }
  }

  // Over-reserve to a generous ceiling based on byte size (~16kB/s @ 16kHz mono
  // PCM as a floor); settle to real duration after Deepgram reports it.
  const estSeconds = Math.max(1, Math.ceil(audio.byteLength / 16000));
  const reserveAmt = estSeconds * COST_PER_SECOND;

  let reserved: credit.ReserveResult;
  try {
    reserved = await credit.reserve(user.sub, reserveAmt, key);
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
    const res = await fetch(`${DEEPGRAM_BATCH_URL}?smart_format=true&punctuate=true`, {
      method: "POST",
      headers: {
        authorization: `Token ${config.LOKUS_DEEPGRAM_KEY}`,
        "content-type": contentType,
      },
      body: audio,
      signal: c.req.raw.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Errors.providerError(`deepgram ${res.status}: ${text.slice(0, 300)}`);
    }
    const json: any = await res.json();
    const transcript =
      json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    const durationSec = Math.max(1, Math.ceil(json.metadata?.duration ?? estSeconds));
    const actual = Math.min(reserveAmt, durationSec * COST_PER_SECOND);
    await credit.settle(key, actual);
    const result = { transcript, durationSec, charged: actual };
    await complete(key, result);
    return c.json(result);
  } catch (e) {
    await credit.refund(key);
    await abandon(key);
    const err = toProxyError(e);
    return c.json(errorBody(err), err.status as 502);
  }
}

// ---------------------------------------------------------------------------
// POST /v1/transcribe/ticket — issue a single-use WS ticket
// ---------------------------------------------------------------------------
export async function transcribeTicketHandler(c: Context) {
  const user = c.get("user") as AuthedUser;
  const ticket = crypto.randomUUID();
  const redis = getRedis();
  await redis.set(
    `ticket:${ticket}`,
    JSON.stringify({ sub: user.sub, issuedAt: Date.now() }),
    "EX",
    TICKET_TTL_SECONDS,
  );
  return c.json({ ticket, expiresIn: TICKET_TTL_SECONDS });
}

/**
 * Validate (and consume) a WS ticket. Returns the user sub or null. Single-use:
 * the key is deleted on read.
 */
async function consumeTicket(ticket: string): Promise<string | null> {
  const redis = getRedis();
  const raw = await redis.getdel(`ticket:${ticket}`);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { sub: string }).sub;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /v1/transcribe/ws — live relay to Deepgram
// ---------------------------------------------------------------------------
// Returns a Bun-native WebSocket upgrade handler factory. Wired in index.ts via
// Bun.serve's `websocket` option because Hono's helper differs across runtimes.
export interface WsAuthContext {
  sub: string;
  reserveId: string;
  reservedSeconds: number;
}

/**
 * Authorize a websocket upgrade: accepts either a `?ticket=` (preferred) or a
 * `?token=` bearer fallback, then reserves credits for the live session. Returns
 * the per-connection auth context or throws a ProxyError.
 */
export async function authorizeWs(url: URL): Promise<WsAuthContext> {
  const ticket = url.searchParams.get("ticket");
  const token = url.searchParams.get("token");

  let sub: string | null = null;
  if (ticket) {
    sub = await consumeTicket(ticket);
  } else if (token) {
    try {
      sub = (await verifyToken(token)).sub;
    } catch {
      sub = null;
    }
  }
  if (!sub) throw Errors.unauthorized("Invalid or expired transcription ticket");

  const reserveId = `live:${crypto.randomUUID()}`;
  const reserveAmt = LIVE_RESERVE_SECONDS * COST_PER_SECOND;
  const reserved = await credit.reserve(sub, reserveAmt, reserveId);
  if (!reserved.ok) throw Errors.insufficientCredits();

  return { sub, reserveId, reservedSeconds: LIVE_RESERVE_SECONDS };
}

/** Build the upstream Deepgram live URL (key sent via header on connect). */
export function deepgramLiveUrl(): string {
  return `${DEEPGRAM_LIVE_URL}?smart_format=true&punctuate=true&interim_results=true`;
}

export const DEEPGRAM_LIVE_HEADERS = () => ({
  authorization: `Token ${config.LOKUS_DEEPGRAM_KEY}`,
});

export { COST_PER_SECOND };

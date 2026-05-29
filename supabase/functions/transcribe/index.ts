/**
 * Lokus Transcription Proxy — Supabase Edge Function
 *
 * Proxies audio transcription requests to Deepgram on behalf of users
 * on the Lokus-provided AI tier. Validates JWT, enforces tier-based
 * rate limits, forwards audio, and tracks usage.
 *
 * Supports two transports:
 *   POST  — batch transcription (base64 audio body)
 *   GET   — WebSocket upgrade for real-time streaming
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildAdminClient as buildCreditAdminClient,
  deriveReserveId,
  refund as refundCredits,
  reserveOrThrow,
  settle as settleCredits,
  transcribeCredits,
} from "../_shared/credits.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";
const DEEPGRAM_REST_URL = "https://api.deepgram.com/v1/listen";

// [FIX] The per-tier monthly meeting count-cap (free:5, pro:30, power:Infinity)
// is REPLACED by a real credit-balance gate. Transcription credits are
// duration-based (Deepgram: ~5 credits/min). We reserve on an upper-bound
// duration estimate, then settle to Deepgram's reported `metadata.duration`.
// A 0-balance request is refused (402); a per-account daily cap also applies.

/** Max audio duration (seconds) we reserve against for the WebSocket stream
 *  before we know the real length. Hard server-side stream ceiling = 2h. */
const WS_RESERVE_SECONDS = 2 * 60 * 60;

/** Allowed audio encodings forwarded to Deepgram. */
const ALLOWED_ENCODINGS = new Set(["linear16", "opus", "mulaw", "alaw", "mp3", "flac"]);

/**
 * Upper-bound duration (seconds) for a batch audio buffer. For PCM (linear16)
 * we compute it exactly from byte length / (sampleRate * 2 bytes * 1 channel);
 * for compressed formats we cannot know without decoding, so we use a generous
 * ceiling derived from a low assumed bitrate so the reservation never
 * under-charges (settle reconciles to Deepgram's real duration).
 */
function estimateAudioSeconds(byteLength: number, encoding: string, sampleRate: number): number {
  if (encoding === "linear16") {
    const sr = sampleRate > 0 ? sampleRate : 16000;
    return Math.ceil(byteLength / (sr * 2)); // 16-bit mono
  }
  // Compressed: assume a low ~16 kbps floor → 2 KB/s, generous over-estimate.
  return Math.ceil(byteLength / 2000);
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Client-Info",
};

function corsResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers as Record<string, string> | undefined) },
  });
}

function errorResponse(
  message: string,
  code: string,
  status: number,
): Response {
  return corsResponse(JSON.stringify({ error: message, code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Supabase admin client (uses service role key for privileged DB access)
// ---------------------------------------------------------------------------

function buildAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// JWT validation & user resolution
// ---------------------------------------------------------------------------

interface UserContext {
  userId: string;
  tier: "free" | "pro" | "power";
  meetingsThisMonth: number;
}

async function resolveUserContext(authHeader: string | null): Promise<UserContext> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing or malformed Authorization header"), { status: 401, code: "UNAUTHORIZED" });
  }

  const jwt = authHeader.slice(7);
  const supabase = buildAdminClient();

  // Validate JWT by asking Supabase auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    throw Object.assign(new Error("Invalid or expired token"), { status: 401, code: "INVALID_TOKEN" });
  }

  const userId = user.id;

  // Fetch tier from user_tiers table (default to 'free' if row absent)
  const { data: tierRow } = await supabase
    .from("user_tiers")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();

  const tier = (tierRow?.tier as "free" | "pro" | "power") ?? "free";

  // Fetch or initialise usage for the current calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: usageRow } = await supabase
    .from("meeting_usage")
    .select("meetings_this_month, last_reset_date")
    .eq("user_id", userId)
    .maybeSingle();

  let meetingsThisMonth = 0;

  if (usageRow) {
    // Reset counter if the stored month is before this month
    const lastReset = new Date(usageRow.last_reset_date ?? 0);
    const isStale = lastReset < new Date(monthStart);
    meetingsThisMonth = isStale ? 0 : (usageRow.meetings_this_month ?? 0);
  }

  return { userId, tier, meetingsThisMonth };
}

// ---------------------------------------------------------------------------
// Usage increment (fire-and-forget — best effort)
// ---------------------------------------------------------------------------

async function incrementUsage(userId: string): Promise<void> {
  try {
    const supabase = buildAdminClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Upsert: if row exists, increment; otherwise insert with count=1.
    const { error } = await supabase.rpc("increment_meeting_usage", {
      p_user_id: userId,
      p_month_start: monthStart,
    });

    if (error) {
      // Fallback to manual upsert if the RPC doesn't exist yet
      await supabase.from("meeting_usage").upsert(
        {
          user_id: userId,
          meetings_this_month: 1,
          last_reset_date: monthStart,
          updated_at: now.toISOString(),
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        },
      );
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.error("[transcribe] Failed to increment usage:", err);
  }
}

// ---------------------------------------------------------------------------
// Deepgram query string builder
// ---------------------------------------------------------------------------

function buildDeepgramQuery(encoding: string, sampleRate: number): string {
  const params = new URLSearchParams({
    model: "nova-2",
    language: "en",
    smart_format: "true",
    punctuate: "true",
    diarize: "true",
    encoding: ALLOWED_ENCODINGS.has(encoding) ? encoding : "linear16",
    sample_rate: String(sampleRate > 0 ? sampleRate : 16000),
    channels: "1",
  });
  return params.toString();
}

// ---------------------------------------------------------------------------
// HTTP POST handler — batch transcription
// ---------------------------------------------------------------------------

async function handlePost(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");

  let userCtx: UserContext;
  try {
    userCtx = await resolveUserContext(authHeader);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string };
    return errorResponse(e.message, e.code ?? "AUTH_ERROR", e.status ?? 401);
  }

  // [FIX] count-cap removed; the credit gate below is the real enforcement.

  // Parse request body
  let body: { audio?: string; encoding?: string; sample_rate?: number };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Request body must be valid JSON", "INVALID_BODY", 400);
  }

  if (!body.audio) {
    return errorResponse("Missing required field: audio", "MISSING_AUDIO", 400);
  }

  const encoding = body.encoding ?? "linear16";
  const sampleRate = body.sample_rate ?? 16000;

  if (!ALLOWED_ENCODINGS.has(encoding)) {
    return errorResponse(
      `Unsupported encoding '${encoding}'. Allowed: ${[...ALLOWED_ENCODINGS].join(", ")}`,
      "INVALID_ENCODING",
      400,
    );
  }

  const deepgramKey = Deno.env.get("LOKUS_DEEPGRAM_KEY");
  if (!deepgramKey) {
    console.error("[transcribe] LOKUS_DEEPGRAM_KEY not configured");
    return errorResponse("Transcription service not configured", "SERVICE_UNAVAILABLE", 503);
  }

  // Decode base64 audio
  let audioBuffer: Uint8Array;
  try {
    audioBuffer = Uint8Array.from(atob(body.audio), (c) => c.charCodeAt(0));
  } catch {
    return errorResponse("audio field must be a valid base64 string", "INVALID_AUDIO_ENCODING", 400);
  }

  if (audioBuffer.byteLength === 0) {
    return errorResponse("Audio data is empty", "EMPTY_AUDIO", 400);
  }

  // -------------------------------------------------------------------------
  // Credit gate: reserve on an upper-bound duration estimate (over-reserve),
  // then settle to Deepgram's reported duration (refund unused) or refund in
  // full on failure. 0-balance is refused (402); daily cap enforced in reserve.
  // -------------------------------------------------------------------------
  const creditAdmin = buildCreditAdminClient();
  const estSeconds = estimateAudioSeconds(audioBuffer.byteLength, encoding, sampleRate);
  const reserveAmt = transcribeCredits(estSeconds);
  const reserveId = await deriveReserveId(userCtx.userId, body.audio);

  try {
    await reserveOrThrow(creditAdmin, userCtx.userId, userCtx.tier, reserveAmt, reserveId);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string; balance?: number };
    return corsResponse(
      JSON.stringify({ error: e.message, code: e.code ?? "INSUFFICIENT_CREDITS", balance: e.balance }),
      { status: e.status ?? 402, headers: { "Content-Type": "application/json" } },
    );
  }

  // Forward to Deepgram REST API
  const deepgramUrl = `${DEEPGRAM_REST_URL}?${buildDeepgramQuery(encoding, sampleRate)}`;

  let deepgramRes: Response;
  try {
    deepgramRes = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramKey}`,
        "Content-Type": "audio/*",
      },
      body: audioBuffer,
    });
  } catch (err) {
    refundCredits(creditAdmin, reserveId);   // never produced output → full refund
    console.error("[transcribe] Deepgram network error:", err);
    return errorResponse("Transcription service unreachable", "UPSTREAM_UNAVAILABLE", 502);
  }

  if (!deepgramRes.ok) {
    refundCredits(creditAdmin, reserveId);   // upstream error → full refund
    const errText = await deepgramRes.text().catch(() => "");
    console.error(`[transcribe] Deepgram error ${deepgramRes.status}:`, errText);
    return errorResponse("Transcription failed", "UPSTREAM_ERROR", 502);
  }

  const transcript = await deepgramRes.json();

  // Settle to the ACTUAL audio duration Deepgram processed (refund the unused
  // reserved seconds). Fall back to the estimate if metadata is absent.
  const actualSeconds = Number(transcript?.metadata?.duration ?? estSeconds);
  const actualAmt = transcribeCredits(actualSeconds);
  settleCredits(creditAdmin, reserveId, actualAmt);

  // Increment usage asynchronously after a successful transcription
  incrementUsage(userCtx.userId);

  return corsResponse(JSON.stringify({ ...transcript, credits: { reserved: reserveAmt, actual: actualAmt } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// WebSocket handler — real-time streaming
// ---------------------------------------------------------------------------

async function handleWebSocket(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") ??
    // Some WS clients pass auth via query string as a fallback
    `Bearer ${new URL(req.url).searchParams.get("token") ?? ""}`;

  let userCtx: UserContext;
  try {
    userCtx = await resolveUserContext(authHeader);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string };
    // WS upgrade failures must close with a non-101 status
    return errorResponse(e.message, e.code ?? "AUTH_ERROR", e.status ?? 401);
  }

  const deepgramKey = Deno.env.get("LOKUS_DEEPGRAM_KEY");
  if (!deepgramKey) {
    return errorResponse("Transcription service not configured", "SERVICE_UNAVAILABLE", 503);
  }

  // -------------------------------------------------------------------------
  // Credit gate for the stream: reserve the 2h ceiling up front (refused with
  // 402 if balance/daily-cap insufficient), then settle to the actual streamed
  // duration on close (refund the unused reserved seconds). Failure/no-audio
  // paths refund in full.
  // -------------------------------------------------------------------------
  const creditAdmin = buildCreditAdminClient();
  const reserveAmt = transcribeCredits(WS_RESERVE_SECONDS);
  const reserveId = await deriveReserveId(
    userCtx.userId,
    `ws:${userCtx.userId}:${Date.now()}`, // unique per connection — each stream is its own reservation
  );

  try {
    await reserveOrThrow(creditAdmin, userCtx.userId, userCtx.tier, reserveAmt, reserveId);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string; balance?: number };
    return corsResponse(
      JSON.stringify({ error: e.message, code: e.code ?? "INSUFFICIENT_CREDITS", balance: e.balance }),
      { status: e.status ?? 402, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse encoding/sample_rate from query string (client sets these before upgrade)
  const url = new URL(req.url);
  const encoding = url.searchParams.get("encoding") ?? "linear16";
  const sampleRate = parseInt(url.searchParams.get("sample_rate") ?? "16000", 10);

  // Upgrade the inbound connection
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Open the upstream Deepgram WebSocket
  const dgUrl = `${DEEPGRAM_WS_URL}?${buildDeepgramQuery(encoding, sampleRate)}`;
  const deepgramSocket = new WebSocket(dgUrl, ["token", deepgramKey]);
  deepgramSocket.binaryType = "arraybuffer";

  let usageIncremented = false;

  // Credit reconciliation state for this stream.
  let streamSeconds = 0;        // max observed (start + duration) across segments
  let creditSettled = false;    // guard so we settle/refund exactly once

  /** Settle the stream reservation to the actual streamed duration (refund-only),
   *  or full-refund if no audio was processed. Idempotent via creditSettled and
   *  the RPC's settled flag. */
  const reconcileCredits = () => {
    if (creditSettled) return;
    creditSettled = true;
    if (streamSeconds <= 0) {
      refundCredits(creditAdmin, reserveId);            // never transcribed → full refund
    } else {
      settleCredits(creditAdmin, reserveId, transcribeCredits(streamSeconds));
    }
  };

  // ---- Client → Deepgram ------------------------------------------------
  clientSocket.onopen = () => {
    console.log(`[transcribe/ws] Client connected — user=${userCtx.userId} tier=${userCtx.tier}`);
  };

  clientSocket.onmessage = (event) => {
    if (deepgramSocket.readyState !== WebSocket.OPEN) return;
    // Pass raw audio binary or JSON control messages straight through
    deepgramSocket.send(event.data);
  };

  clientSocket.onerror = (event) => {
    console.error("[transcribe/ws] Client socket error:", event);
  };

  clientSocket.onclose = () => {
    console.log("[transcribe/ws] Client disconnected");
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close(1000, "client disconnected");
    }
    reconcileCredits();   // settle/refund the stream reservation
  };

  // ---- Deepgram → Client ------------------------------------------------
  deepgramSocket.onopen = () => {
    console.log("[transcribe/ws] Connected to Deepgram");
  };

  deepgramSocket.onmessage = (event) => {
    if (clientSocket.readyState !== WebSocket.OPEN) return;

    try {
      const data = JSON.parse(event.data as string);

      // Track the furthest audio timestamp seen so we can settle to the real
      // streamed duration on close (credit reconciliation).
      const segEnd = Number(data?.start ?? 0) + Number(data?.duration ?? 0);
      if (Number.isFinite(segEnd) && segEnd > streamSeconds) {
        streamSeconds = segEnd;
      }

      // Count usage once the first is_final transcript arrives
      if (!usageIncremented && data?.is_final === true) {
        usageIncremented = true;
        incrementUsage(userCtx.userId);
      }

      // Forward the transcript segment to the client
      clientSocket.send(JSON.stringify({
        text: data?.channel?.alternatives?.[0]?.transcript ?? "",
        is_final: data?.is_final ?? false,
        speaker: data?.channel?.alternatives?.[0]?.words?.[0]?.speaker ?? 0,
        timestamp: data?.start ?? 0,
        duration: data?.duration ?? 0,
        words: data?.channel?.alternatives?.[0]?.words ?? [],
      }));
    } catch {
      // Forward raw if unparseable
      clientSocket.send(event.data as string);
    }
  };

  deepgramSocket.onerror = (event) => {
    console.error("[transcribe/ws] Deepgram socket error:", event);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({ error: "Upstream transcription error", code: "UPSTREAM_ERROR" }),
      );
    }
  };

  deepgramSocket.onclose = (event) => {
    console.log(`[transcribe/ws] Deepgram closed: code=${event.code}`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(event.code, event.reason);
    }
    reconcileCredits();   // settle/refund the stream reservation
  };

  return response;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(null, { status: 204 });
  }

  const upgradeHeader = req.headers.get("Upgrade");

  // Real-time WebSocket streaming path
  if (upgradeHeader?.toLowerCase() === "websocket") {
    if (req.method !== "GET") {
      return errorResponse("WebSocket upgrade requires GET", "METHOD_NOT_ALLOWED", 405);
    }
    return handleWebSocket(req);
  }

  // Batch transcription path
  if (req.method === "POST") {
    return handlePost(req);
  }

  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
});

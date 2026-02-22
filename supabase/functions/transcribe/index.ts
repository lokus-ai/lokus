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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";
const DEEPGRAM_REST_URL = "https://api.deepgram.com/v1/listen";

/** Per-tier monthly meeting caps. Power tier has no hard cap. */
const TIER_LIMITS: Record<string, number> = {
  free: 5,
  pro: 30,
  power: Infinity,
};

/** Allowed audio encodings forwarded to Deepgram. */
const ALLOWED_ENCODINGS = new Set(["linear16", "opus", "mulaw", "alaw", "mp3", "flac"]);

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
// Usage enforcement
// ---------------------------------------------------------------------------

function assertWithinLimit(ctx: UserContext): void {
  const limit = TIER_LIMITS[ctx.tier] ?? TIER_LIMITS.free;
  if (ctx.meetingsThisMonth >= limit) {
    throw Object.assign(
      new Error(
        `Monthly meeting limit reached (${limit} for ${ctx.tier} tier). ` +
          "Upgrade your plan or bring your own API key.",
      ),
      { status: 429, code: "USAGE_LIMIT_EXCEEDED" },
    );
  }
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

  try {
    assertWithinLimit(userCtx);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string };
    return errorResponse(e.message, e.code ?? "LIMIT_ERROR", e.status ?? 429);
  }

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
    console.error("[transcribe] Deepgram network error:", err);
    return errorResponse("Transcription service unreachable", "UPSTREAM_UNAVAILABLE", 502);
  }

  if (!deepgramRes.ok) {
    const errText = await deepgramRes.text().catch(() => "");
    console.error(`[transcribe] Deepgram error ${deepgramRes.status}:`, errText);
    return errorResponse("Transcription failed", "UPSTREAM_ERROR", 502);
  }

  const transcript = await deepgramRes.json();

  // Increment usage asynchronously after a successful transcription
  incrementUsage(userCtx.userId);

  return corsResponse(JSON.stringify(transcript), {
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

  try {
    assertWithinLimit(userCtx);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string };
    return errorResponse(e.message, e.code ?? "LIMIT_ERROR", e.status ?? 429);
  }

  const deepgramKey = Deno.env.get("LOKUS_DEEPGRAM_KEY");
  if (!deepgramKey) {
    return errorResponse("Transcription service not configured", "SERVICE_UNAVAILABLE", 503);
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
  };

  // ---- Deepgram → Client ------------------------------------------------
  deepgramSocket.onopen = () => {
    console.log("[transcribe/ws] Connected to Deepgram");
  };

  deepgramSocket.onmessage = (event) => {
    if (clientSocket.readyState !== WebSocket.OPEN) return;

    try {
      const data = JSON.parse(event.data as string);

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

/**
 * Lokus inference proxy — entrypoint.
 *
 * Hono app on Bun, listening on :PORT (default 3000, docker-bridge; Caddy fronts
 * 443/80). CORS is owned ONLY here (Caddy sets no ACAO). The live-transcription
 * WebSocket is served through Bun's native `websocket` handler since it relays
 * binary audio to Deepgram, which Hono's helper doesn't cover uniformly.
 *
 * Route surface (NO others):
 *   POST /v1/chat
 *   POST /v1/embed
 *   POST /v1/transcribe
 *   POST /v1/transcribe/ticket
 *   GET  /v1/transcribe/ws   (WebSocket upgrade)
 *   GET  /v1/balance
 *   GET  /health
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.ts";
import { loggerMiddleware } from "./middleware/logger.ts";
import { authMiddleware, type AuthVars } from "./middleware/auth.ts";
import { ipRateLimitMiddleware, rateLimitMiddleware } from "./middleware/rate-limit.ts";
import { bodySizeGuard, messageGuard, streamConcurrencyGuard } from "./middleware/security.ts";
import { chatHandler } from "./routes/chat.ts";
import { embedHandler } from "./routes/embed.ts";
import { balanceHandler } from "./routes/balance.ts";
import {
  transcribeHandler,
  transcribeTicketHandler,
  authorizeWs,
  deepgramLiveUrl,
  DEEPGRAM_LIVE_HEADERS,
} from "./routes/transcribe.ts";
import * as credit from "./services/credit.ts";
import { REQUEST_TIMEOUT_MS } from "./lib/constants.ts";

const ALLOWED_ORIGINS = ["tauri://localhost", "https://tauri.localhost"];

export const app = new Hono<{ Variables: AuthVars }>();

app.use("*", loggerMiddleware);
app.use(
  "*",
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["authorization", "content-type"],
    maxAge: 600,
  }),
);

// Health — unauthenticated.
app.get("/health", (c) => c.json({ status: "ok", ts: Date.now() }));

// Global IP rate limit + body guard BEFORE auth (cheap rejection).
app.use("/v1/*", ipRateLimitMiddleware);
app.use("/v1/*", bodySizeGuard);

// Authenticated endpoints.
app.use("/v1/*", authMiddleware);
app.use("/v1/*", rateLimitMiddleware);
app.use("/v1/*", messageGuard);
app.use("/v1/*", streamConcurrencyGuard);

app.post("/v1/chat", chatHandler);
app.post("/v1/embed", embedHandler);
app.post("/v1/transcribe", transcribeHandler);
app.post("/v1/transcribe/ticket", transcribeTicketHandler);
app.get("/v1/balance", balanceHandler);

// ---------------------------------------------------------------------------
// Bun server with native WebSocket relay for /v1/transcribe/ws.
// ---------------------------------------------------------------------------
interface WsData {
  sub: string;
  reserveId: string;
  reservedSeconds: number;
  upstream?: WebSocket;
  startedAt: number;
}

// Guard so importing `app` in tests doesn't start a server.
const IS_TEST =
  process.env.NODE_ENV === "test" || process.env.BUN_TEST === "1";

// `Bun` is present at runtime; typed loosely so tsc (Node libs) doesn't choke.
const BunRuntime = (globalThis as { Bun?: any }).Bun;

if (!IS_TEST && BunRuntime) {
  BunRuntime.serve({
    port: config.PORT,
    idleTimeout: 120,
    async fetch(req: Request, server: any) {
      const url = new URL(req.url);

      // --- Global IP rate limit (applies to WS too) ---
      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
      try {
        const { slidingWindowHit } = await import("./lib/redis.ts");
        const { IP_RATE_LIMIT_WINDOW_MS, IP_RATE_LIMIT_MAX } = await import("./lib/constants.ts");
        const count = await slidingWindowHit(`ratelimit-ip-ws:${ip}`, IP_RATE_LIMIT_WINDOW_MS);
        if (count > IP_RATE_LIMIT_MAX) {
          return new Response("rate limited", { status: 429 });
        }
      } catch {
        return new Response("rate limiter unavailable", { status: 503 });
      }

      if (url.pathname === "/v1/transcribe/ws") {
        let ctx;
        try {
          ctx = await authorizeWs(url);
        } catch {
          return new Response("unauthorized", { status: 401 });
        }
        const ok = server.upgrade(req, {
          data: { ...ctx, startedAt: Date.now() } satisfies WsData,
        });
        if (ok) return undefined; // upgraded; Bun takes over
        return new Response("upgrade failed", { status: 400 });
      }

      // Overall request timeout for non-WS requests.
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        return await app.fetch(req, server);
      } finally {
        clearTimeout(timeout);
      }
    },
    websocket: {
      async open(ws: any) {
        const data = ws.data as WsData;
        // Open the upstream Deepgram live connection and pipe transcripts back.
        const upstream = new WebSocket(deepgramLiveUrl(), {
          headers: DEEPGRAM_LIVE_HEADERS(),
        } as any);
        data.upstream = upstream;
        upstream.addEventListener("message", (ev: MessageEvent) => {
          try {
            ws.send(typeof ev.data === "string" ? ev.data : ev.data);
          } catch {
            /* client gone */
          }
        });
        upstream.addEventListener("close", () => {
          try {
            ws.close();
          } catch {
            /* already closed */
          }
        });
        upstream.addEventListener("error", () => {
          try {
            ws.close(1011, "upstream error");
          } catch {
            /* already closed */
          }
        });
      },
      message(ws: any, message: any) {
        const data = ws.data as WsData;
        // Relay raw audio frames upstream.
        if (data.upstream && data.upstream.readyState === WebSocket.OPEN) {
          data.upstream.send(message);
        }
      },
      async close(ws: any) {
        const data = ws.data as WsData;
        try {
          data.upstream?.close();
        } catch {
          /* ignore */
        }
        // Settle the live reservation by elapsed seconds (refunds the rest).
        const elapsedSec = Math.max(
          1,
          Math.ceil((Date.now() - data.startedAt) / 1000),
        );
        const actual = Math.min(data.reservedSeconds, elapsedSec);
        await credit.settle(data.reserveId, actual);
      },
    },
  });
  console.log(
    JSON.stringify({ level: "info", at: "boot", msg: `proxy listening on :${config.PORT}` }),
  );
}

// Default export.
//
// Under Bun (runtime), we ALREADY called `Bun.serve(...)` above to get the
// native WebSocket relay. Bun's entrypoint runner ALSO auto-serves any
// server-shaped default export (anything with a `fetch`), which would bind the
// same port a SECOND time → EADDRINUSE. So under Bun we export an inert object.
// On Node / non-Bun runtimes (and `bun test`, which sets BUN_TEST and never
// hits the explicit serve), we export the Hono fetch handler so adapters can
// mount it. Tests import the named `{ app }` regardless.
export default BunRuntime && !IS_TEST ? {} : { fetch: app.fetch };

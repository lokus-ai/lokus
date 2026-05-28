# Lokus Inference Proxy

Self-hosted, stateless inference proxy for Lokus. Verifies Supabase JWTs locally,
rate-limits per user, reserves/settles credits against the ledger, and streams
inference (Anthropic primary, OpenAI fallback, Ollama local) back over SSE. The
ReAct agent loop is **client-side** — the proxy does exactly one provider turn
per request.

Runtime: **Bun 1.1+** (Node 22 is a Dockerfile-CMD fallback only). Listens on
**:3000** (docker bridge). Caddy fronts 443/80 with `flush_interval -1` for SSE.

## Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/chat` | SSE streaming inference + tool calls |
| POST | `/v1/embed` | Cloud embedding fallback |
| POST | `/v1/transcribe` | Batch STT (Deepgram) |
| POST | `/v1/transcribe/ticket` | Issue single-use WS ticket |
| GET | `/v1/transcribe/ws` | Live STT WebSocket relay |
| GET | `/v1/balance` | Credit balance |
| GET | `/health` | Liveness (unauthenticated) |

## Request pipeline (`/v1/*`)

`CORS (Hono only)` → `JWT verify (local JWKS, 1h JWKS cache + 60s token cache)` →
`rate-limit (Redis sliding window, per JWT sub)` → `derive idempotency key`
(`sha256(user_id + ':' + sha256(body) + ':' + minute_bucket)`, Redis `SET reserve:{key} NX EX 900`)
→ `reserve credits (over-reserve to max_tokens)` → `stream from provider` →
`settle (refund-only) on success / refund on failure`.

SSE terminal frame: every stream ends `data: {"type":"done", ...}` then
`data: [DONE]`. Errors: `data: {"type":"error","code":...,"retryable":bool}` then
`data: [DONE]`. Clients treat the absence of a `type:"done"` frame as failure even
on HTTP 200.

## Environment

Copy `env.sample` → `.env`. Required (process refuses to boot if missing):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `LOKUS_DEEPGRAM_KEY`. Optional: `OLLAMA_BASE_URL`,
`OPENROUTER_API_KEY`, `PORT`. **Provider / service-role keys load ONLY from env.**

## Develop & verify

```bash
bun install
bun test            # mocked providers/redis/supabase: reserve→stream→settle, /health 200
bun run typecheck   # tsc --noEmit
bun run dev         # hot-reload on :3000

# Health check (after boot):
curl -s localhost:3000/health   # → {"status":"ok",...}
```

## Deploy

```bash
docker compose up --build       # proxy + redis + caddy
# proxy is internal-only (:3000 on the bridge); Caddy publishes 443/80.
```

/** Shared proxy constants. */

/** Literal cache marker the client inserts between the stable prefix (L1+L2)
 *  and the dynamic suffix (L3–L6). The Anthropic adapter splits on this and
 *  marks the prefix block `cache_control: ephemeral`. Must match the engine. */
export const CACHE_BOUNDARY = "\n\n---CACHE_BOUNDARY---\n\n";

/** Rate limit: sliding window, per authenticated user (JWT `sub`). */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 60; // requests / window

/** Rate limit: sliding window, per IP address (global abuse backstop).
 *  Higher than per-user because legitimate users may share an office IP.
 *  This is the LAST line of defense against account-farming. */
export const IP_RATE_LIMIT_WINDOW_MS = 60_000;
export const IP_RATE_LIMIT_MAX = 120; // requests / window per IP

/** Idempotency reservation TTL — board: Redis SET reserve:{key} ... NX EX 900. */
export const IDEMPOTENCY_TTL_SECONDS = 900;

/** Upstream provider request timeout (ms). */
export const PROVIDER_TIMEOUT_MS = 120_000;

/** Overall HTTP request timeout (ms) — kills hung connections. */
export const REQUEST_TIMEOUT_MS = 180_000;

/** Default max_tokens when a request omits it. Reservations over-reserve to
 *  this ceiling so reconcile only ever refunds. */
export const DEFAULT_MAX_TOKENS = 4096;
export const MAX_ALLOWED_MAX_TOKENS = 16_384;

/** Maximum request body size (bytes). Prevents multi-megabyte DoS payloads. */
export const MAX_BODY_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Maximum length of a single message content string (chars). */
export const MAX_MESSAGE_LENGTH = 50_000;

/** Maximum number of messages in a chat request. */
export const MAX_MESSAGES_COUNT = 200;

/** Maximum concurrent SSE streams per user. Prevents connection exhaustion. */
export const MAX_CONCURRENT_STREAMS_PER_USER = 5;

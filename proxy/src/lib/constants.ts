/** Shared proxy constants. */

/** Literal cache marker the client inserts between the stable prefix (L1+L2)
 *  and the dynamic suffix (L3–L6). The Anthropic adapter splits on this and
 *  marks the prefix block `cache_control: ephemeral`. Must match the engine. */
export const CACHE_BOUNDARY = "\n\n---CACHE_BOUNDARY---\n\n";

/** Rate limit: sliding window, per authenticated user (JWT `sub`). */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 60; // requests / window

/** Idempotency reservation TTL — board: Redis SET reserve:{key} ... NX EX 900. */
export const IDEMPOTENCY_TTL_SECONDS = 900;

/** Upstream provider request timeout (ms). */
export const PROVIDER_TIMEOUT_MS = 120_000;

/** Default max_tokens when a request omits it. Reservations over-reserve to
 *  this ceiling so reconcile only ever refunds. */
export const DEFAULT_MAX_TOKENS = 4096;
export const MAX_ALLOWED_MAX_TOKENS = 16_384;

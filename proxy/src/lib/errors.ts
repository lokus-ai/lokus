/**
 * Typed errors + SSE error helpers.
 *
 * The proxy never throws raw strings across the request boundary. Every failure
 * carries a stable machine `code` and a `retryable` hint the client uses to
 * decide whether to retry. On the SSE channel an error is delivered as a
 * terminal frame, NOT an HTTP status — see `sseError`. Clients treat the
 * absence of a `type:"done"` frame as failure even on HTTP 200.
 */

export type ErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "insufficient_credits"
  | "invalid_request"
  | "model_not_allowed"
  | "provider_error"
  | "upstream_timeout"
  | "client_cancelled"
  | "internal";

export class ProxyError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, status: number, retryable = false) {
    super(message);
    this.name = "ProxyError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export const Errors = {
  unauthorized: (msg = "Missing or invalid token") =>
    new ProxyError("unauthorized", msg, 401, false),
  rateLimited: (msg = "Rate limit exceeded") =>
    new ProxyError("rate_limited", msg, 429, true),
  insufficientCredits: (msg = "Insufficient credits") =>
    new ProxyError("insufficient_credits", msg, 402, false),
  invalidRequest: (msg = "Invalid request") =>
    new ProxyError("invalid_request", msg, 400, false),
  modelNotAllowed: (msg = "Model not allowed") =>
    new ProxyError("model_not_allowed", msg, 400, false),
  providerError: (msg = "Provider error", retryable = true) =>
    new ProxyError("provider_error", msg, 502, retryable),
  upstreamTimeout: (msg = "Upstream timeout") =>
    new ProxyError("upstream_timeout", msg, 504, true),
  clientCancelled: (msg = "Client cancelled") =>
    new ProxyError("client_cancelled", msg, 499, false),
  internal: (msg = "Internal error") =>
    new ProxyError("internal", msg, 500, false),
};

/** Normalize any thrown value to a ProxyError. */
export function toProxyError(err: unknown): ProxyError {
  if (err instanceof ProxyError) return err;
  if (err instanceof Error) {
    if (err.name === "AbortError") return Errors.clientCancelled();
    return Errors.internal(err.message);
  }
  return Errors.internal(String(err));
}

/** A JSON body for a non-stream (pre-stream) error response. */
export function errorBody(err: ProxyError) {
  return {
    error: { code: err.code, message: err.message, retryable: err.retryable },
  };
}

/** Encode an SSE terminal error frame pair: the error frame then `[DONE]`. */
export function sseError(err: ProxyError): string {
  const frame = JSON.stringify({
    type: "error",
    code: err.code,
    message: err.message,
    retryable: err.retryable,
  });
  return `data: ${frame}\n\ndata: [DONE]\n\n`;
}

/** Encode a single SSE data frame. */
export function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/** Encode the SSE terminal success frame pair: `type:"done"` then `[DONE]`. */
export function sseDone(extra: Record<string, unknown> = {}): string {
  const frame = JSON.stringify({ type: "done", ...extra });
  return `data: ${frame}\n\ndata: [DONE]\n\n`;
}

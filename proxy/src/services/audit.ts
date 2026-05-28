/**
 * Lightweight structured audit logging. Emits one JSON line per significant
 * event (request start/finish, reserve/settle/refund, provider fallback,
 * errors). Logs are stdout-only here; ops ships them off the box. Never logs
 * token contents or secrets — only metadata and counts.
 */
export interface AuditEvent {
  at: string;
  userId?: string;
  route?: string;
  model?: string;
  reserveId?: string;
  reserved?: number;
  actual?: number;
  promptTokens?: number;
  completionTokens?: number;
  cacheReadTokens?: number;
  fallback?: boolean;
  code?: string;
  durationMs?: number;
  [k: string]: unknown;
}

export function audit(event: AuditEvent): void {
  console.log(JSON.stringify({ level: "audit", ts: new Date().toISOString(), ...event }));
}

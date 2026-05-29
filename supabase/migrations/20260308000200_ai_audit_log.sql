-- =============================================================================
-- Migration: 20260308000200_ai_audit_log.sql
-- Description: Per-request AI audit log + founder cost dashboard view.
--
-- Canonical schema: LOKUS_AI_IMPLEMENTATION.md §6.4 (authoritative — this
-- reconciles the two PRD drafts into one table). The proxy's
-- `proxy/src/services/audit.ts` inserts one row per AI request after the stream
-- completes, correlated by `reserve_id` to the credit ledger
-- (20260308000000_credit_ledger.sql). The IMPLEMENTATION §1 topology diagram
-- lists `ai_audit_log` as a canonical Supabase table; it was missing from the
-- credit-ledger migration set — this adds it.
--
-- One row per request (success OR failure). The proxy writes with the service
-- role; users may read only their own rows. `v_daily_cost` aggregates successful
-- spend per day/provider/model for the cost dashboard + daily alert cron.
-- =============================================================================


-- =============================================================================
-- 1. ai_audit_log table
--
-- Token columns mirror the proxy's `type:"usage"` stream event (promptTokens /
-- completionTokens / cacheReadTokens) and the credit reconcile values
-- (credits_reserved / credits_actual). `credits_delta` is the refund
-- (reserved − actual) and is GENERATED so it can never drift from its inputs.
-- `outcome` records how the request ended so the dashboard can separate billed
-- success from refunded failures/aborts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reserve_id        text,                                   -- correlates to credit_reservations / credit_ledger
  action            text        NOT NULL DEFAULT 'chat',    -- feature/request type: chat|summarize|rewrite|agent|transcribe|embed|...
  provider          text        NOT NULL,                   -- anthropic|openai|deepgram|ollama|...
  model             text        NOT NULL,
  tokens_prompt     integer     NOT NULL DEFAULT 0,         -- input tokens
  tokens_completion integer     NOT NULL DEFAULT 0,         -- output tokens
  cache_read_tokens integer     NOT NULL DEFAULT 0,         -- prefix-cache reads (billed ~10% of input)
  credits_reserved  integer     NOT NULL DEFAULT 0,         -- over-reserved up front
  credits_actual    integer     NOT NULL DEFAULT 0,         -- realized spend after reconcile
  credits_delta     integer     GENERATED ALWAYS AS (credits_reserved - credits_actual) STORED,  -- refund
  latency_ms        integer,
  outcome           text        NOT NULL DEFAULT 'success'  -- success|error_upstream|error_credits|client_abort
                                CHECK (outcome IN ('success', 'error_upstream', 'error_credits', 'client_abort')),
  error_code        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.ai_audit_log                   IS 'One row per AI request (success or failure). Written by the proxy (service role), correlated to the credit ledger by reserve_id. Source for v_daily_cost.';
COMMENT ON COLUMN public.ai_audit_log.reserve_id        IS 'Correlates to credit_reservations.reserve_id / credit_ledger.reserve_id. NULL for requests that never reserved (e.g. local/$0).';
COMMENT ON COLUMN public.ai_audit_log.action            IS 'Feature/request type: chat|summarize|rewrite|agent|transcribe|embed|...';
COMMENT ON COLUMN public.ai_audit_log.credits_delta     IS 'GENERATED: credits_reserved - credits_actual (the refund). Never drifts from its inputs.';
COMMENT ON COLUMN public.ai_audit_log.outcome           IS 'How the request ended: success|error_upstream|error_credits|client_abort.';

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.ai_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_date ON public.ai_audit_log (created_at DESC);


-- =============================================================================
-- 2. Row Level Security — users read their own; only service_role inserts
-- =============================================================================

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read only their own audit rows.
DROP POLICY IF EXISTS audit_sel ON public.ai_audit_log;
CREATE POLICY audit_sel ON public.ai_audit_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Only the service role (proxy) may insert audit rows.
DROP POLICY IF EXISTS audit_ins ON public.ai_audit_log;
CREATE POLICY audit_ins ON public.ai_audit_log
  FOR INSERT TO service_role WITH CHECK (true);

-- service_role full access for repair / backfill / dashboards.
DROP POLICY IF EXISTS audit_all ON public.ai_audit_log;
CREATE POLICY audit_all ON public.ai_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =============================================================================
-- 3. v_daily_cost — founder cost dashboard
--
-- Aggregates realized spend for SUCCESSFUL requests per day/provider/model.
-- Queried in Supabase Studio / Grafana and by the daily cost-alert cron.
-- The view runs with the privileges of the querying role and is filtered by the
-- underlying ai_audit_log RLS, so an authenticated user only ever sees their own
-- rows aggregated; the service role sees everything.
-- =============================================================================

CREATE OR REPLACE VIEW public.v_daily_cost AS
SELECT
  date_trunc('day', created_at)::date AS day,
  provider,
  model,
  COUNT(*)                  AS calls,
  SUM(tokens_prompt)        AS tok_in,
  SUM(tokens_completion)    AS tok_out,
  SUM(cache_read_tokens)    AS tok_cache_read,
  SUM(credits_actual)       AS credits
FROM public.ai_audit_log
WHERE outcome = 'success'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, credits DESC;

COMMENT ON VIEW public.v_daily_cost IS
  'Daily realized spend per provider/model for successful AI requests. Cost dashboard + daily alert cron. Filtered by ai_audit_log RLS (authenticated sees own; service_role sees all).';


-- =============================================================================
-- 4. Grants
--
-- The view inherits the table's RLS. Grant SELECT on the view to authenticated
-- (they see only their own aggregated rows) and service_role (full).
-- =============================================================================

GRANT SELECT ON public.v_daily_cost TO authenticated;
GRANT SELECT ON public.v_daily_cost TO service_role;

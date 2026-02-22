-- =============================================================================
-- Migration: 20260221000000_meeting_usage.sql
-- Description: Usage tracking tables, RPCs, RLS policies, and triggers for
--              the Lokus AI Meeting Notes feature.
--
-- Tables created:
--   - user_tiers      : tracks per-user subscription tier (free/pro/power)
--   - meeting_usage   : tracks monthly meeting count and token consumption
--
-- RPCs created:
--   - increment_meeting_usage : atomically increments meetings_this_month
--   - increment_token_usage   : atomically adds tokens to tokens_used
--
-- Triggers created:
--   - on_auth_user_created    : auto-inserts a free-tier row on signup
--   - set_user_tiers_updated_at : auto-updates updated_at on user_tiers writes
-- =============================================================================


-- =============================================================================
-- 1. user_tiers table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_tiers (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier        text        NOT NULL DEFAULT 'free'
                          CHECK (tier IN ('free', 'pro', 'power')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_tiers_pkey         PRIMARY KEY (id),
  CONSTRAINT user_tiers_user_id_key  UNIQUE      (user_id)
);

COMMENT ON TABLE  public.user_tiers          IS 'Subscription tier assigned to each Lokus user.';
COMMENT ON COLUMN public.user_tiers.user_id  IS 'References auth.users(id). Cascade-deletes on user removal.';
COMMENT ON COLUMN public.user_tiers.tier     IS 'One of: free (5 meetings/mo), pro (30/mo), power (unlimited).';


-- =============================================================================
-- 2. meeting_usage table
--
-- Design note: the edge functions query this table with a single .eq("user_id")
-- filter (no month filter) and then compare last_reset_date client-side to
-- detect a stale month. The fallback upsert also uses onConflict: "user_id".
-- Therefore the unique constraint is on user_id alone, keeping one live row
-- per user. The `month` column records the calendar month that row represents
-- and is updated by the RPCs when they detect a month rollover.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.meeting_usage (
  id                  uuid    NOT NULL DEFAULT gen_random_uuid(),
  user_id             uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meetings_this_month integer NOT NULL DEFAULT 0,
  tokens_used         bigint  NOT NULL DEFAULT 0,
  month               date    NOT NULL DEFAULT date_trunc('month', now())::date,
  last_reset_date     date             DEFAULT current_date,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meeting_usage_pkey         PRIMARY KEY (id),
  -- One active row per user; month rolls over in-place via the RPCs.
  CONSTRAINT meeting_usage_user_id_key  UNIQUE      (user_id)
);

COMMENT ON TABLE  public.meeting_usage                    IS 'Monthly meeting count and LLM token consumption per user.';
COMMENT ON COLUMN public.meeting_usage.meetings_this_month IS 'Number of meetings processed this calendar month.';
COMMENT ON COLUMN public.meeting_usage.tokens_used         IS 'Cumulative LLM tokens consumed this calendar month.';
COMMENT ON COLUMN public.meeting_usage.month               IS 'Calendar month (first day of month) that this row represents.';
COMMENT ON COLUMN public.meeting_usage.last_reset_date     IS 'Date the counters were last reset; used for staleness detection.';


-- =============================================================================
-- 3. updated_at trigger helper (reusable)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger: keep user_tiers.updated_at current on every row update.
DROP TRIGGER IF EXISTS set_user_tiers_updated_at ON public.user_tiers;
CREATE TRIGGER set_user_tiers_updated_at
  BEFORE UPDATE ON public.user_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 4. Auto-create free-tier row on user signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_tiers (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users so every signup gets a default free-tier row.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 5. RPC: increment_meeting_usage
--
-- Called by: supabase/functions/transcribe/index.ts
-- Params passed by the edge function:
--   p_user_id    uuid
--   p_month_start text  (ISO-8601 timestamp string, e.g. "2026-02-01T00:00:00.000Z")
--
-- Behaviour:
--   - If a row exists for p_user_id and last_reset_date is within the same
--     calendar month as p_month_start, increment meetings_this_month by 1.
--   - If the row is stale (previous month) or does not exist, reset counters
--     and set meetings_this_month = 1.
--   - Returns the new meetings_this_month value.
--
-- SECURITY DEFINER: executes with the function owner's privileges so
-- authenticated users can call it without needing direct table write access.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_meeting_usage(
  p_user_id    uuid,
  p_month_start text  -- ISO-8601 timestamp; cast to date inside the function
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_month_date date;
  v_new_count  integer;
BEGIN
  -- Normalise the incoming timestamp string to the first day of its month.
  v_month_date := date_trunc('month', p_month_start::timestamptz)::date;

  INSERT INTO public.meeting_usage (
    user_id,
    meetings_this_month,
    tokens_used,
    month,
    last_reset_date
  )
  VALUES (
    p_user_id,
    1,          -- first meeting this month
    0,
    v_month_date,
    v_month_date
  )
  ON CONFLICT (user_id) DO UPDATE
    SET meetings_this_month = CASE
          -- Same calendar month: increment.
          WHEN date_trunc('month', meeting_usage.last_reset_date::timestamptz)
               = date_trunc('month', v_month_date::timestamptz)
          THEN meeting_usage.meetings_this_month + 1
          -- New month: reset and start at 1.
          ELSE 1
        END,
        tokens_used = CASE
          WHEN date_trunc('month', meeting_usage.last_reset_date::timestamptz)
               = date_trunc('month', v_month_date::timestamptz)
          THEN meeting_usage.tokens_used
          ELSE 0
        END,
        month           = v_month_date,
        last_reset_date = v_month_date
  RETURNING meetings_this_month INTO v_new_count;

  RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_meeting_usage(uuid, text) IS
  'Atomically increments meetings_this_month for p_user_id, resetting counters '
  'if the stored month is older than p_month_start. Returns the new count.';


-- =============================================================================
-- 6. RPC: increment_token_usage
--
-- Called by: supabase/functions/llm-summary/index.ts
-- Params passed by the edge function:
--   p_user_id    uuid
--   p_month_start text   (ISO-8601 timestamp string)
--   p_tokens     bigint
--
-- Behaviour:
--   - If a row exists for p_user_id within the same calendar month, add
--     p_tokens to tokens_used.
--   - If the row is stale or absent, reset meetings_this_month to 0 and
--     set tokens_used = p_tokens.
--   - Returns void (fire-and-forget from the edge function).
--
-- SECURITY DEFINER: same rationale as increment_meeting_usage.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_token_usage(
  p_user_id    uuid,
  p_month_start text,   -- ISO-8601 timestamp
  p_tokens     bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_month_date date;
BEGIN
  v_month_date := date_trunc('month', p_month_start::timestamptz)::date;

  INSERT INTO public.meeting_usage (
    user_id,
    meetings_this_month,
    tokens_used,
    month,
    last_reset_date
  )
  VALUES (
    p_user_id,
    0,
    p_tokens,
    v_month_date,
    v_month_date
  )
  ON CONFLICT (user_id) DO UPDATE
    SET tokens_used = CASE
          -- Same month: accumulate.
          WHEN date_trunc('month', meeting_usage.last_reset_date::timestamptz)
               = date_trunc('month', v_month_date::timestamptz)
          THEN meeting_usage.tokens_used + p_tokens
          -- New month: reset meetings count too, start fresh token total.
          ELSE p_tokens
        END,
        meetings_this_month = CASE
          WHEN date_trunc('month', meeting_usage.last_reset_date::timestamptz)
               = date_trunc('month', v_month_date::timestamptz)
          THEN meeting_usage.meetings_this_month
          ELSE 0
        END,
        month           = v_month_date,
        last_reset_date = v_month_date;
END;
$$;

COMMENT ON FUNCTION public.increment_token_usage(uuid, text, bigint) IS
  'Atomically adds p_tokens to tokens_used for p_user_id, resetting counters '
  'if the stored month is older than p_month_start.';


-- =============================================================================
-- 7. Row Level Security
-- =============================================================================

-- ---- user_tiers ----

ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read only their own tier row.
DROP POLICY IF EXISTS "user_tiers_select_own" ON public.user_tiers;
CREATE POLICY "user_tiers_select_own"
  ON public.user_tiers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only the service role (edge functions) may insert tier rows.
DROP POLICY IF EXISTS "user_tiers_insert_service_role" ON public.user_tiers;
CREATE POLICY "user_tiers_insert_service_role"
  ON public.user_tiers
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only the service role may update tier rows (e.g. tier upgrades via webhook).
DROP POLICY IF EXISTS "user_tiers_update_service_role" ON public.user_tiers;
CREATE POLICY "user_tiers_update_service_role"
  ON public.user_tiers
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only the service role may delete tier rows.
DROP POLICY IF EXISTS "user_tiers_delete_service_role" ON public.user_tiers;
CREATE POLICY "user_tiers_delete_service_role"
  ON public.user_tiers
  FOR DELETE
  TO service_role
  USING (true);


-- ---- meeting_usage ----

ALTER TABLE public.meeting_usage ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read only their own usage row.
DROP POLICY IF EXISTS "meeting_usage_select_own" ON public.meeting_usage;
CREATE POLICY "meeting_usage_select_own"
  ON public.meeting_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only the service role (edge functions via SECURITY DEFINER RPCs) may insert.
DROP POLICY IF EXISTS "meeting_usage_insert_service_role" ON public.meeting_usage;
CREATE POLICY "meeting_usage_insert_service_role"
  ON public.meeting_usage
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only the service role may update usage rows.
DROP POLICY IF EXISTS "meeting_usage_update_service_role" ON public.meeting_usage;
CREATE POLICY "meeting_usage_update_service_role"
  ON public.meeting_usage
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only the service role may delete usage rows.
DROP POLICY IF EXISTS "meeting_usage_delete_service_role" ON public.meeting_usage;
CREATE POLICY "meeting_usage_delete_service_role"
  ON public.meeting_usage
  FOR DELETE
  TO service_role
  USING (true);


-- =============================================================================
-- 8. Indexes
--
-- Both unique constraints (user_tiers_user_id_key and meeting_usage_user_id_key)
-- implicitly create btree indexes on their respective user_id columns, so no
-- additional indexes are needed for the primary lookup pattern used by the edge
-- functions (.eq("user_id", userId)).
--
-- An explicit composite index on (user_id, month) is added here anyway to
-- support any future analytic queries that filter by both dimensions without
-- relying on the unique index alone.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_meeting_usage_user_month
  ON public.meeting_usage (user_id, month);

CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id
  ON public.user_tiers (user_id);

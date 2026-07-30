-- Migration: 20260311000000_cleanup_meeting_usage_and_grants.sql
-- Purpose: Remove dead code from the old edge-function-based meeting system
--          and the retired free-tier starter grant.

-- =============================================================================
-- 1. meeting_usage table (old per-month meeting counter, superseded by credit
--    ledger which is the real gate for all AI usage).
-- =============================================================================

DROP TABLE IF EXISTS public.meeting_usage CASCADE;

-- =============================================================================
-- 2. increment_meeting_usage function (only called by the old edge functions).
-- =============================================================================

DROP FUNCTION IF EXISTS public.increment_meeting_usage(uuid, bigint);

-- =============================================================================
-- 3. grant_starter_credits function (retired with the free tier; no starter
--    grants, no daily stipend, no free credits of any kind).
-- =============================================================================

DROP FUNCTION IF EXISTS public.grant_starter_credits(uuid);

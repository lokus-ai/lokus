-- =============================================================================
-- Smoke test: credit ledger invariants (the MONEY path)
--
-- Asserts, against a DB with the credit_ledger migration applied:
--   1. A 0-balance reserve is REFUSED (ok=false), no reservation row created.
--   2. reserve → settle only ever REFUNDS (reserved − actual); never charges
--      more than reserved; balance never goes negative.
--   3. A replayed reserve_id is idempotent (no double-spend; returns prior state).
--   4. refund_reservation returns the full reserved amount; idempotent on replay.
--   5. settle with actual > reserved is clamped (charges at most reserved).
--   6. Daily-cap helper reserved_today sums the trailing-24h reservations.
--   7. Ledger audit completeness; 8. user isolation.
--
-- Each assertion RAISEs EXCEPTION on failure, so a non-zero psql exit = failure.
-- Column references to the credit RPCs are aliased (r.ok / r.balance) because
-- the RETURNS TABLE output column is named `balance`; an unaliased
-- `SELECT balance INTO … FROM reserve_credits(…)` is ambiguous in PL/pgSQL.
--
-- HOW TO RUN
--   Against a Supabase local stack (auth schema present):
--     supabase db reset                                   # applies migrations
--     psql "$DATABASE_URL" -f supabase/tests/credit_ledger_test.sql
--
--   Against a scratch Postgres WITHOUT Supabase's auth schema, create the shims
--   the migrations depend on BEFORE applying them (verified working on
--   postgres:16):
--     CREATE EXTENSION IF NOT EXISTS pgcrypto;
--     CREATE SCHEMA IF NOT EXISTS auth;
--     CREATE TABLE IF NOT EXISTS auth.users (
--       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--       email text, email_confirmed_at timestamptz);
--     CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULL::uuid $f$;
--     DO $r$ BEGIN
--       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
--       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
--     END $r$;
--   Then apply, in order:
--     psql -f supabase/migrations/20260221000000_meeting_usage.sql   (provides user_tiers for the signup trigger)
--     psql -f supabase/migrations/20260308000000_credit_ledger.sql
--     psql -f supabase/migrations/20260308000100_workspace_manifests.sql
--     psql -f supabase/tests/credit_ledger_test.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_user  uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_ok    boolean;
  v_bal   bigint;
  v_today bigint;
BEGIN
  -- Two test users with verified emails (so the grant path can run).
  INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES (v_user,  'ledger-test-1@example.test', now()),
           (v_user2, 'ledger-test-2@example.test', now());

  -- -------------------------------------------------------------------------
  -- 1. 0-balance reserve is REFUSED.
  -- -------------------------------------------------------------------------
  SELECT r.ok, r.balance INTO v_ok, v_bal
    FROM public.reserve_credits(v_user, 100, 'rid-zero-1') r;
  IF v_ok IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST 1 FAILED: 0-balance reserve should be refused, got ok=%', v_ok;
  END IF;
  IF EXISTS (SELECT 1 FROM credit_reservations WHERE reserve_id = 'rid-zero-1') THEN
    RAISE EXCEPTION 'TEST 1 FAILED: refused reserve must not create a reservation row';
  END IF;
  RAISE NOTICE 'TEST 1 PASS: 0-balance reserve refused, no reservation row';

  -- Grant a starter balance for the remaining tests (verified email gate).
  PERFORM public.grant_starter_credits(v_user);
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 500 THEN
    RAISE EXCEPTION 'SETUP FAILED: expected 500 starter credits, got %', v_bal;
  END IF;

  -- grant is idempotent: a second call must NOT add another 500.
  PERFORM public.grant_starter_credits(v_user);
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 500 THEN
    RAISE EXCEPTION 'TEST grant-idempotent FAILED: second grant changed balance to %', v_bal;
  END IF;
  RAISE NOTICE 'TEST grant idempotent PASS: balance stays 500';

  -- -------------------------------------------------------------------------
  -- 2. reserve → settle only refunds (reserved 300, actual 100 → refund 200).
  -- -------------------------------------------------------------------------
  SELECT r.ok, r.balance INTO v_ok, v_bal
    FROM public.reserve_credits(v_user, 300, 'rid-a') r;
  IF v_ok IS NOT TRUE OR v_bal <> 200 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: reserve 300 → expected ok=true balance=200, got ok=% balance=%', v_ok, v_bal;
  END IF;

  PERFORM public.settle_credits('rid-a', 100);   -- actual 100 of 300 reserved
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 400 THEN  -- 200 + (300-100 refund) = 400
    RAISE EXCEPTION 'TEST 2 FAILED: settle(actual=100) → expected balance 400, got %', v_bal;
  END IF;
  RAISE NOTICE 'TEST 2 PASS: settle refunded unused (balance 400)';

  -- -------------------------------------------------------------------------
  -- 3. Replayed reserve_id is idempotent (no double-spend).
  -- -------------------------------------------------------------------------
  SELECT r.ok INTO v_ok FROM public.reserve_credits(v_user, 50, 'rid-b') r;  -- 400 → 350
  IF v_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 3 SETUP FAILED: reserve rid-b not ok';
  END IF;
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 350 THEN
    RAISE EXCEPTION 'TEST 3 SETUP FAILED: expected 350 after reserve 50, got %', v_bal;
  END IF;

  -- Replay the SAME reserve_id: must be a no-op (returns ok=true, current balance).
  SELECT r.ok, r.balance INTO v_ok, v_bal
    FROM public.reserve_credits(v_user, 50, 'rid-b') r;
  IF v_ok IS NOT TRUE OR v_bal <> 350 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: replayed reserve_id should be no-op (ok=true bal=350), got ok=% bal=%', v_ok, v_bal;
  END IF;
  IF (SELECT count(*) FROM credit_reservations WHERE reserve_id = 'rid-b') <> 1 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: replayed reserve_id created a duplicate reservation row';
  END IF;
  RAISE NOTICE 'TEST 3 PASS: replayed reserve_id is idempotent (balance 350, one row)';

  -- settle is idempotent too: settle rid-b once (full consumption), then again.
  PERFORM public.settle_credits('rid-b', 50);   -- actual=reserved → no refund
  PERFORM public.settle_credits('rid-b', 50);   -- replay → no-op
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 350 THEN
    RAISE EXCEPTION 'TEST 3b FAILED: settle replay changed balance to %', v_bal;
  END IF;
  RAISE NOTICE 'TEST 3b PASS: settle idempotent';

  -- -------------------------------------------------------------------------
  -- 4. refund_reservation returns the full reserved amount; idempotent.
  -- -------------------------------------------------------------------------
  PERFORM public.reserve_credits(v_user, 80, 'rid-c');                    -- 350 → 270
  PERFORM public.refund_reservation('rid-c');                            -- + 80 → 350
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 350 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: refund should restore balance to 350, got %', v_bal;
  END IF;
  PERFORM public.refund_reservation('rid-c');                            -- replay no-op
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 350 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: refund replay changed balance to %', v_bal;
  END IF;
  RAISE NOTICE 'TEST 4 PASS: refund full + idempotent (balance 350)';

  -- -------------------------------------------------------------------------
  -- 5. settle with actual > reserved is CLAMPED (never charges more).
  -- -------------------------------------------------------------------------
  PERFORM public.reserve_credits(v_user, 40, 'rid-d');                    -- 350 → 310
  PERFORM public.settle_credits('rid-d', 99999);   -- actual >> reserved → clamp to 40, refund 0
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = v_user;
  IF v_bal <> 310 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: over-actual settle must charge at most reserved (expect 310), got %', v_bal;
  END IF;
  IF v_bal < 0 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: balance went negative (%)', v_bal;
  END IF;
  RAISE NOTICE 'TEST 5 PASS: settle clamps actual to reserved (balance 310, never negative)';

  -- -------------------------------------------------------------------------
  -- 6. reserved_today sums trailing-24h reservations (daily-cap helper).
  --    rid-a(300)+rid-b(50)+rid-c(80)+rid-d(40) = 470 reserved within 24h
  --    (settled/refunded rows still count — they were reserved today).
  -- -------------------------------------------------------------------------
  SELECT public.reserved_today(v_user) INTO v_today;
  IF v_today <> 470 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: reserved_today expected 470, got %', v_today;
  END IF;
  RAISE NOTICE 'TEST 6 PASS: reserved_today = 470';

  -- -------------------------------------------------------------------------
  -- 7. Ledger audit completeness: every reserve/settle/refund left an audit row.
  -- -------------------------------------------------------------------------
  IF (SELECT count(*) FROM credit_ledger WHERE user_id = v_user AND reason = 'reserve') < 4 THEN
    RAISE EXCEPTION 'TEST 7 FAILED: expected >=4 reserve audit rows';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM credit_ledger WHERE reserve_id = 'rid-a' AND reason = 'settle') THEN
    RAISE EXCEPTION 'TEST 7 FAILED: missing settle audit row for rid-a';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM credit_ledger WHERE reserve_id = 'rid-c' AND reason = 'refund') THEN
    RAISE EXCEPTION 'TEST 7 FAILED: missing refund audit row for rid-c';
  END IF;
  RAISE NOTICE 'TEST 7 PASS: ledger audit rows present';

  -- -------------------------------------------------------------------------
  -- 8. Isolation: the unrelated user never received credits.
  -- -------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM user_credits WHERE user_id = v_user2 AND balance > 0) THEN
    RAISE EXCEPTION 'TEST 8 FAILED: unrelated user got credits';
  END IF;
  RAISE NOTICE 'TEST 8 PASS: user isolation holds';

  RAISE NOTICE 'ALL CREDIT-LEDGER SMOKE TESTS PASSED';
END $$;

-- Roll back so the test leaves no rows behind.
ROLLBACK;

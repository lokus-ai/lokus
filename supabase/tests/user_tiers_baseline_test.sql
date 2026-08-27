-- Regression test for the signup trigger installed by credit_ledger migration.

BEGIN;

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_tier text;
BEGIN
  IF to_regclass('public.user_tiers') IS NULL THEN
    RAISE EXCEPTION 'MISSING TABLE: public.user_tiers';
  END IF;

  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (v_user, 'tier-baseline@example.test', now());

  SELECT tier INTO v_tier
    FROM public.user_tiers
   WHERE user_id = v_user;

  IF v_tier <> 'free' THEN
    RAISE EXCEPTION 'SIGNUP TIER FAILED: expected free, got %', v_tier;
  END IF;

  RAISE NOTICE 'USER TIERS BASELINE TEST PASSED';
END $$;

ROLLBACK;

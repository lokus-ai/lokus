-- =============================================================================
-- Migration: 20260308000000_credit_ledger.sql
-- Description: Canonical credit ledger for Lokus AI. This is the MONEY path.
--
-- Design (IMPLEMENTATION §0 canonical-decisions + §6.1–6.4 — authoritative):
--   * One mutable balance row per user (`user_credits`). The row-level
--     `FOR UPDATE` lock on this row is the serialization primitive — no
--     aggregating view (you cannot FOR UPDATE a view), no advisory locks.
--   * Append-only `credit_ledger` audit of every mutation.
--   * `credit_reservations` — one row per reserve_id; the PRIMARY KEY +
--     `INSERT … ON CONFLICT DO NOTHING` is the idempotency gate.
--   * EXACTLY three spend RPCs: reserve_credits / settle_credits /
--     refund_reservation. (deduct/check_and_deduct/reconcile/adjust REMOVED.)
--   * Over-reserve to the model's max_tokens ceiling at reserve time; settle
--     CLAMPS the actual to [0, reserved] so it only ever REFUNDS the
--     difference, never charges more → no negative-balance bug class.
--   * Anti-farming: the 500-credit starter grant fires on
--     `grant_starter_credits()` (verified email + first workspace, service
--     role), NOT on raw `auth.users` INSERT. The signup trigger is re-pointed
--     to seed only the free `user_tiers` row.
--
-- Tables:   user_credits, credit_ledger, credit_reservations, credit_grant_log
-- RPCs:     reserve_credits, settle_credits, refund_reservation,
--           grant_starter_credits, reserved_today (daily-cap helper),
--           sweep_stranded_reservations (recovery)
-- Lockdown: RLS (users SELECT own; service_role mutates), REVOKE PUBLIC,
--           GRANT EXECUTE … TO service_role on every mutating RPC.
-- =============================================================================


-- =============================================================================
-- 1. Tables
-- =============================================================================

-- One mutable balance row per user. balance >= 0 is enforced by CHECK; combined
-- with the reserve RPC's pre-check this makes negative balances impossible.
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    bigint      NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_credits         IS 'Mutable per-user credit balance. Row-level FOR UPDATE here is the serialization primitive for all credit mutations.';
COMMENT ON COLUMN public.user_credits.balance IS 'Current spendable credits. CHECK(balance>=0) makes negative balances impossible.';

-- Append-only audit of every credit mutation. Never updated/deleted in normal
-- operation; one row per grant / reserve / settle / refund / shortfall event.
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta         bigint      NOT NULL,                 -- + grant/refund/settle-refund, − reserve
  reason        text        NOT NULL                  -- 'grant'|'reserve'|'settle'|'refund'|'shortfall'
                            CHECK (reason IN ('grant', 'reserve', 'settle', 'refund', 'shortfall')),
  reserve_id    text,                                 -- correlates reserve/settle/refund of one request
  balance_after bigint      NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_ledger IS 'Append-only audit of every credit mutation (grant/reserve/settle/refund/shortfall).';

CREATE INDEX IF NOT EXISTS idx_ledger_user
  ON public.credit_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_reserve
  ON public.credit_ledger (reserve_id)
  WHERE reserve_id IS NOT NULL;

-- One row per reservation. The PRIMARY KEY on reserve_id (server-derived sha256
-- on the proxy) + `INSERT … ON CONFLICT DO NOTHING` is the idempotency gate: a
-- replayed reserve_id is a no-op that returns the prior state, never re-charges,
-- never triggers a second provider call.
CREATE TABLE IF NOT EXISTS public.credit_reservations (
  reserve_id text        PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     bigint      NOT NULL CHECK (amount >= 0),
  settled    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_reservations IS 'One row per reserve_id. PK + ON CONFLICT DO NOTHING is the idempotency gate. settled=false rows are recoverable by the sweeper.';

-- Partial index for the stranded-reservation sweeper and the daily-cap query.
CREATE INDEX IF NOT EXISTS idx_resv_unsettled
  ON public.credit_reservations (settled, created_at)
  WHERE settled = false;
CREATE INDEX IF NOT EXISTS idx_resv_user_created
  ON public.credit_reservations (user_id, created_at);

-- Gate table: one row per user, written the first time they earn the starter
-- grant. Ties the 500-credit grant to a verified email + first workspace so a
-- script cannot farm credits with throwaway emails.
CREATE TABLE IF NOT EXISTS public.credit_grant_log (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_grant_log IS 'One row per user once they earn the starter grant (anti-farming gate).';


-- =============================================================================
-- 2. The three spend RPCs — row-locked, idempotent, refund-only on settle
-- =============================================================================

-- reserve_credits: deducts p_amount up front (over-reserved to max_tokens by the
-- caller). Refuses if balance < amount (0-balance requests MUST be refused).
-- Idempotent: a replayed reserve_id returns the current balance and ok=true
-- WITHOUT deducting again (the proxy's INSERT-NX gate normally prevents the
-- replay even reaching here; this is belt-and-braces).
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id   uuid,
  p_amount    bigint,
  p_reserve_id text
)
  RETURNS TABLE (ok boolean, balance bigint)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_bal bigint;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'reserve_credits: p_amount must be >= 0 (got %)', p_amount;
  END IF;

  -- Idempotency: a reserve_id we have already seen is a no-op. Return current
  -- balance and success so the caller treats it as the same (already-reserved)
  -- request — never double-deduct.
  -- NOTE: table columns are qualified (uc.balance) throughout because the OUT
  -- column is also named `balance`; an unqualified reference would be ambiguous.
  IF EXISTS (SELECT 1 FROM credit_reservations WHERE reserve_id = p_reserve_id) THEN
    SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = p_user_id;
    RETURN QUERY SELECT true, COALESCE(v_bal, 0);
    RETURN;
  END IF;

  -- Serialize concurrent reservations for this user on the balance row.
  SELECT uc.balance INTO v_bal FROM user_credits uc WHERE uc.user_id = p_user_id FOR UPDATE;
  IF v_bal IS NULL THEN
    -- No balance row yet → effectively zero credits. Create the row so the
    -- FOR UPDATE lock has something to hold on the next call.
    INSERT INTO user_credits (user_id, balance) VALUES (p_user_id, 0)
      ON CONFLICT (user_id) DO NOTHING;
    v_bal := 0;
  END IF;

  -- 0-balance (or insufficient) request is REFUSED — no reservation row created.
  IF v_bal < p_amount THEN
    RETURN QUERY SELECT false, v_bal;
    RETURN;
  END IF;

  UPDATE user_credits uc
     SET balance = uc.balance - p_amount, updated_at = now()
   WHERE uc.user_id = p_user_id;

  INSERT INTO credit_reservations (reserve_id, user_id, amount)
    VALUES (p_reserve_id, p_user_id, p_amount);

  INSERT INTO credit_ledger (user_id, delta, reason, reserve_id, balance_after)
    VALUES (p_user_id, -p_amount, 'reserve', p_reserve_id, v_bal - p_amount);

  RETURN QUERY SELECT true, v_bal - p_amount;
END;
$$;

COMMENT ON FUNCTION public.reserve_credits(uuid, bigint, text) IS
  'Reserve (deduct up front) p_amount for p_user_id under p_reserve_id. Refuses on insufficient balance. Idempotent on reserve_id. Returns (ok, balance).';

-- settle_credits: reconcile a reservation to the ACTUAL spend. The actual is
-- CLAMPED to [0, reserved] so settle ONLY EVER REFUNDS (reserved − actual) >= 0.
-- This is the core invariant: settle never charges more than was reserved, so a
-- balance can never go negative. Idempotent on the settled flag.
CREATE OR REPLACE FUNCTION public.settle_credits(
  p_reserve_id   text,
  p_actual_amount bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user   uuid;
  v_amount bigint;   -- originally reserved
  v_actual bigint;   -- clamped actual
  v_delta  bigint;   -- refund amount (always >= 0)
  v_bal    bigint;
BEGIN
  SELECT user_id, amount INTO v_user, v_amount
    FROM credit_reservations
   WHERE reserve_id = p_reserve_id AND settled = false
   FOR UPDATE;

  -- Already settled / refunded / unknown → no-op (idempotent).
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  -- Clamp to [0, reserved]: we never charge more than reserved.
  v_actual := LEAST(GREATEST(COALESCE(p_actual_amount, 0), 0), v_amount);
  v_delta  := v_amount - v_actual;   -- refund, always >= 0

  IF v_delta > 0 THEN
    SELECT balance INTO v_bal FROM user_credits WHERE user_id = v_user FOR UPDATE;
    UPDATE user_credits
       SET balance = balance + v_delta, updated_at = now()
     WHERE user_id = v_user;
    INSERT INTO credit_ledger (user_id, delta, reason, reserve_id, balance_after)
      VALUES (v_user, v_delta, 'settle', p_reserve_id, v_bal + v_delta);
  ELSE
    -- Full consumption (or the model wanted more than reserved, which we floored):
    -- record a zero-delta 'shortfall' audit row for visibility.
    INSERT INTO credit_ledger (user_id, delta, reason, reserve_id, balance_after)
      SELECT v_user, 0, 'shortfall', p_reserve_id, balance
        FROM user_credits WHERE user_id = v_user;
  END IF;

  UPDATE credit_reservations SET settled = true WHERE reserve_id = p_reserve_id;
END;
$$;

COMMENT ON FUNCTION public.settle_credits(text, bigint) IS
  'Reconcile a reservation to actual spend. Actual is clamped to [0, reserved] so settle ONLY refunds (reserved-actual). Idempotent on settled flag.';

-- refund_reservation: full refund of an unsettled reservation (failure / abort /
-- client-disconnect path). Idempotent on the settled flag.
CREATE OR REPLACE FUNCTION public.refund_reservation(
  p_reserve_id text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user   uuid;
  v_amount bigint;
  v_bal    bigint;
BEGIN
  SELECT user_id, amount INTO v_user, v_amount
    FROM credit_reservations
   WHERE reserve_id = p_reserve_id AND settled = false
   FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN;   -- already settled/refunded/unknown → no-op
  END IF;

  SELECT balance INTO v_bal FROM user_credits WHERE user_id = v_user FOR UPDATE;
  UPDATE user_credits
     SET balance = balance + v_amount, updated_at = now()
   WHERE user_id = v_user;

  INSERT INTO credit_ledger (user_id, delta, reason, reserve_id, balance_after)
    VALUES (v_user, v_amount, 'refund', p_reserve_id, v_bal + v_amount);

  UPDATE credit_reservations SET settled = true WHERE reserve_id = p_reserve_id;
END;
$$;

COMMENT ON FUNCTION public.refund_reservation(text) IS
  'Full refund of an unsettled reservation (failure/abort path). Idempotent on settled flag.';


-- =============================================================================
-- 3. Daily spend cap helper (MONETIZATION §5)
--
-- The per-account daily cap (default 2,000 credits/day, configurable per tier)
-- is enforced by the proxy by summing the credits
-- reserved in the trailing 24h and refusing if reserving p_amount would exceed
-- the cap. Exposed as a read-only helper so callers do not need direct table
-- access. SECURITY DEFINER so service_role callers can read across the table.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reserved_today(
  p_user_id uuid
)
  RETURNS bigint
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::bigint
    FROM public.credit_reservations
   WHERE user_id = p_user_id
     AND created_at >= now() - interval '24 hours';
$$;

COMMENT ON FUNCTION public.reserved_today(uuid) IS
  'Sum of credits reserved by p_user_id in the trailing 24h. Callers compare against the per-account daily cap (default 2000) before reserving.';


-- =============================================================================
-- 4. Starter grant on signup — slimmed tier-only trigger (anti-farming)
--
-- [FIX] The old handle_new_user() seeded the free user_tiers row on raw
-- auth.users INSERT. We KEEP that behavior (seed the tier) but the 500-credit
-- grant is moved OUT of the signup path into grant_starter_credits(), which the
-- workspace-registration service-role path calls after email verification.
-- =============================================================================

-- Tier-only signup seed (no credit grant here).
CREATE OR REPLACE FUNCTION public.handle_new_user_tier()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_tiers (user_id, tier) VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Re-point the existing trigger at the slimmed function and drop the old one so
-- credits are NO LONGER granted on raw signup.
DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_tier();

-- grant_starter_credits: idempotent, verified-email-gated 500-credit grant.
-- Called by the service-role workspace-registration path (post email verify +
-- first workspace). Grants exactly once per user.
CREATE OR REPLACE FUNCTION public.grant_starter_credits(
  p_user_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_verified timestamptz;
BEGIN
  -- Grant once only.
  IF EXISTS (SELECT 1 FROM credit_grant_log WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  -- Require a verified email.
  SELECT email_confirmed_at INTO v_verified FROM auth.users WHERE id = p_user_id;
  IF v_verified IS NULL THEN
    RETURN;
  END IF;

  -- Atomically mark the grant; if another concurrent call already logged it,
  -- the ON CONFLICT makes this a no-op and we skip the credit insert.
  INSERT INTO public.credit_grant_log (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN;   -- another call won the race; do not double-grant
  END IF;

  INSERT INTO public.user_credits (user_id, balance) VALUES (p_user_id, 500)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = user_credits.balance + 500, updated_at = now();

  INSERT INTO public.credit_ledger (user_id, delta, reason, balance_after)
    SELECT p_user_id, 500, 'grant', balance
      FROM public.user_credits WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.grant_starter_credits(uuid) IS
  'Idempotent verified-email-gated 500-credit starter grant. Called by the service-role workspace-registration path (anti-farming). Grants once per user.';


-- =============================================================================
-- 5. Stranded-reservation sweeper (recovery)
--
-- If a settle/refund RPC call is lost (proxy crash, deploy mid-stream), the
-- reservation row persists with settled=false. This sweeper refunds reservations
-- older than the cutoff so credits are never stranded. Intended to be run on a
-- schedule (pg_cron every 5 min); also safe to call manually. Refunds via the
-- idempotent refund_reservation RPC.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sweep_stranded_reservations(
  p_older_than interval DEFAULT interval '15 minutes'
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_id    text;
  v_count integer := 0;
BEGIN
  FOR v_id IN
    SELECT reserve_id FROM credit_reservations
     WHERE settled = false AND created_at < now() - p_older_than
  LOOP
    PERFORM public.refund_reservation(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.sweep_stranded_reservations(interval) IS
  'Refunds reservations left settled=false past the cutoff (default 15 min). Run on a 5-min schedule (pg_cron) to recover from lost settle/refund calls.';


-- =============================================================================
-- 6. Row Level Security — users read their own; only service_role mutates
-- =============================================================================

ALTER TABLE public.user_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_grant_log    ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read only their own rows.
DROP POLICY IF EXISTS uc_sel ON public.user_credits;
CREATE POLICY uc_sel ON public.user_credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS cl_sel ON public.credit_ledger;
CREATE POLICY cl_sel ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS cr_sel ON public.credit_reservations;
CREATE POLICY cr_sel ON public.credit_reservations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS cg_sel ON public.credit_grant_log;
CREATE POLICY cg_sel ON public.credit_grant_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- service_role full access (all mutation flows through the SECURITY DEFINER RPCs,
-- but these policies let the service role read/repair directly when needed).
DROP POLICY IF EXISTS uc_all ON public.user_credits;
CREATE POLICY uc_all ON public.user_credits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cl_all ON public.credit_ledger;
CREATE POLICY cl_all ON public.credit_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cr_all ON public.credit_reservations;
CREATE POLICY cr_all ON public.credit_reservations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cg_all ON public.credit_grant_log;
CREATE POLICY cg_all ON public.credit_grant_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =============================================================================
-- 7. Function lockdown — REVOKE FROM PUBLIC; GRANT EXECUTE TO service_role
--
-- No mutating RPC is callable by anonymous or authenticated roles. Every credit
-- mutation must go through the proxy which authenticates with
-- the service role key. (reserved_today is read-only but still service-role-only
-- so a user cannot enumerate it directly.)
-- =============================================================================

REVOKE ALL ON FUNCTION public.reserve_credits(uuid, bigint, text)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_credits(text, bigint)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_reservation(text)              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_starter_credits(uuid)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserved_today(uuid)                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_stranded_reservations(interval) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, bigint, text)   TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credits(text, bigint)          TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_reservation(text)              TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_starter_credits(uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.reserved_today(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_stranded_reservations(interval) TO service_role;

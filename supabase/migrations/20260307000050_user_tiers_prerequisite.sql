-- Ensure the credit-ledger signup trigger has its required tier table.
-- This must run before 20260308000000_credit_ledger.sql.

CREATE TABLE IF NOT EXISTS public.user_tiers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'pro', 'power')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_tiers_select_own ON public.user_tiers;
CREATE POLICY user_tiers_select_own
  ON public.user_tiers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_tiers_service_all ON public.user_tiers;
CREATE POLICY user_tiers_service_all
  ON public.user_tiers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.user_tiers FROM anon, authenticated;
GRANT SELECT ON public.user_tiers TO authenticated;
GRANT ALL ON public.user_tiers TO service_role;

INSERT INTO public.user_tiers (user_id, tier)
SELECT id, 'free'
  FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

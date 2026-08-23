-- Harden legacy objects surfaced by Supabase advisors while keeping behavior.

ALTER VIEW IF EXISTS public.v_daily_cost SET (security_invoker = true);

REVOKE ALL ON FUNCTION public.handle_new_user_tier()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.reserve_credits(uuid, bigint, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_credits(text, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_reservation(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserved_today(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_stranded_reservations(interval)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, bigint, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_credits(text, bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_reservation(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reserved_today(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_stranded_reservations(interval)
  TO service_role;

-- Staging previously generated this unnamed equivalent before the canonical
-- named index was added. Production clean installs will not create it.
DROP INDEX IF EXISTS public.pending_revision_uploads_actor_device_id_client_sequence_idx;

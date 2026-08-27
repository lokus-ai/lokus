-- Team Notes V1: recover finalized idempotent results after response loss.

SET search_path TO public, auth;

CREATE OR REPLACE FUNCTION public.get_mutation_receipt(
  p_device_id uuid,
  p_op_id uuid
)
RETURNS TABLE (
  result public.mutation_result,
  revision_id uuid,
  action_sequence bigint,
  current_head_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT receipt.result,
         receipt.result_revision_id,
         receipt.result_action_sequence,
         receipt.result_revision_id
    FROM public.mutation_receipts receipt
    JOIN public.devices device
      ON device.id = receipt.actor_device_id
     AND device.user_id = auth.uid()
     AND device.status = 'active'
   WHERE receipt.actor_device_id = p_device_id
     AND receipt.op_id = p_op_id
     AND p_device_id = receipt.actor_device_id;
$$;

REVOKE ALL ON FUNCTION public.get_mutation_receipt(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mutation_receipt(uuid, uuid)
  TO authenticated;

-- Team Notes V1: bootstrap durable device-global mutation ordering.

SET search_path TO public, auth;

CREATE OR REPLACE FUNCTION public.get_device_sequence_high_water(
  p_device_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE(max(receipt.client_sequence), 0)
    FROM public.devices device
    LEFT JOIN public.mutation_receipts receipt
      ON receipt.actor_device_id = device.id
   WHERE device.id = p_device_id
     AND device.user_id = auth.uid()
     AND device.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.get_device_sequence_high_water(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_device_sequence_high_water(uuid)
  TO authenticated;

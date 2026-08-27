-- Team Notes V1: recipient-scoped envelope reads and admin provisioning queue.

SET search_path TO public, auth;

CREATE OR REPLACE FUNCTION public.get_recipient_key_envelope(
  p_scope_kind text,
  p_scope_id uuid,
  p_epoch integer,
  p_recipient_device_id uuid
)
RETURNS TABLE (
  wrapped_key bytea,
  wrapping_nonce bytea,
  algorithm text,
  sender_device_id uuid,
  sender_public_key bytea
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.owns_device(p_recipient_device_id)
     OR EXISTS (
       SELECT 1 FROM public.devices
        WHERE id = p_recipient_device_id AND status <> 'active'
     ) THEN
    RAISE EXCEPTION 'active recipient device required' USING ERRCODE = '42501';
  END IF;

  IF p_scope_kind = 'team' THEN
    IF NOT private.is_active_team_member(p_scope_id) THEN
      RAISE EXCEPTION 'active team membership required' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT envelope.wrapped_key, envelope.wrapping_nonce, envelope.algorithm,
           envelope.created_by_device_id, sender.public_key
      FROM public.team_key_envelopes envelope
      JOIN public.devices sender ON sender.id = envelope.created_by_device_id
     WHERE envelope.team_id = p_scope_id
       AND envelope.epoch = p_epoch
       AND envelope.recipient_device_id = p_recipient_device_id;
  ELSIF p_scope_kind = 'space' THEN
    IF NOT private.has_space_role(p_scope_id, 'reader') THEN
      RAISE EXCEPTION 'space reader role required' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT envelope.wrapped_key, envelope.wrapping_nonce, envelope.algorithm,
           envelope.created_by_device_id, sender.public_key
      FROM public.space_key_envelopes envelope
      JOIN public.devices sender ON sender.id = envelope.created_by_device_id
     WHERE envelope.space_id = p_scope_id
       AND envelope.epoch = p_epoch
       AND envelope.recipient_device_id = p_recipient_device_id;
  ELSE
    RAISE EXCEPTION 'invalid key-envelope scope' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_key_provisioning_targets(
  p_team_id uuid
)
RETURNS TABLE (
  target_user_id uuid,
  target_device_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  WITH candidates AS (
    SELECT membership.user_id, device.id AS device_id
      FROM public.team_memberships membership
      JOIN public.devices device
        ON device.user_id = membership.user_id
       AND device.status = 'active'
     WHERE membership.team_id = p_team_id
       AND membership.status IN ('key_pending', 'active')
       AND private.has_team_role(p_team_id, 'admin')
  ),
  intended_spaces AS (
    SELECT candidate.user_id, grant_row.space_id
      FROM candidates candidate
      JOIN public.space_member_grants grant_row
        ON grant_row.team_id = p_team_id
       AND grant_row.user_id = candidate.user_id
    UNION
    SELECT candidate.user_id, group_grant.space_id
      FROM candidates candidate
      JOIN public.space_group_grants group_grant
        ON group_grant.team_id = p_team_id
      JOIN public.team_groups team_group
        ON team_group.team_id = group_grant.team_id
       AND team_group.id = group_grant.group_id
       AND team_group.deleted_at IS NULL
      LEFT JOIN public.team_group_members group_member
        ON group_member.team_id = team_group.team_id
       AND group_member.group_id = team_group.id
       AND group_member.user_id = candidate.user_id
     WHERE team_group.system_key = 'everyone'
        OR group_member.user_id IS NOT NULL
  )
  SELECT candidate.user_id, candidate.device_id
    FROM candidates candidate
   WHERE EXISTS (
     SELECT 1
       FROM public.team_key_epochs epoch
      WHERE epoch.team_id = p_team_id
        AND NOT EXISTS (
          SELECT 1 FROM public.team_key_envelopes envelope
           WHERE envelope.team_id = epoch.team_id
             AND envelope.epoch = epoch.epoch
             AND envelope.recipient_device_id = candidate.device_id
        )
   )
      OR EXISTS (
        SELECT 1
          FROM intended_spaces intended
          JOIN public.space_key_epochs epoch
            ON epoch.space_id = intended.space_id
         WHERE intended.user_id = candidate.user_id
           AND NOT EXISTS (
             SELECT 1 FROM public.space_key_envelopes envelope
              WHERE envelope.space_id = epoch.space_id
                AND envelope.epoch = epoch.epoch
                AND envelope.recipient_device_id = candidate.device_id
           )
      )
   ORDER BY candidate.user_id, candidate.device_id;
$$;

REVOKE ALL ON FUNCTION public.get_recipient_key_envelope(
  text, uuid, integer, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_key_provisioning_targets(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_recipient_key_envelope(
  text, uuid, integer, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_key_provisioning_targets(uuid)
  TO authenticated;

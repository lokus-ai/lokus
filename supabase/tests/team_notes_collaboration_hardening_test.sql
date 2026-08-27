-- =============================================================================
-- Team Notes V1 — collaboration hardening contracts
-- =============================================================================

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

DO $$
DECLARE
  v_signature text;
  v_function regprocedure;
BEGIN
  IF to_regprocedure('public.accept_invite(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE HARDENING FAILED: tokenless overload still exists';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.accept_invite(uuid,text,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.accept_invite(uuid,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'INVITE HARDENING FAILED: token-bound grants are incorrect';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY[
    'private.team_role_rank(public.team_role)',
    'private.space_role_rank(public.space_role)',
    'private.is_active_team_member(uuid,uuid)',
    'private.has_team_role(uuid,public.team_role,uuid)',
    'private.shares_active_team(uuid,uuid)',
    'private.effective_space_role(uuid,uuid)',
    'private.has_space_role(uuid,public.space_role,uuid)',
    'private.owns_device(uuid,uuid)',
    'private.can_read_device(uuid,uuid)',
    'private.can_read_note(uuid,uuid)',
    'private.can_read_profile(uuid,uuid)',
    'private.claim_pending_revision(uuid,public.revision_operation)'
  ] LOOP
    v_function := to_regprocedure(v_signature);
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'PRIVATE HELPER CONTRACT FAILED: missing %', v_signature;
    END IF;
    IF has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION
        'PRIVATE HELPER CONTRACT FAILED: authenticated can execute %',
        v_signature;
    END IF;
  END LOOP;

  IF has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION
      'PRIVATE HELPER CONTRACT FAILED: authenticated has private schema usage';
  END IF;
  IF NOT has_schema_privilege('authenticated', 'team_notes_rls', 'USAGE')
     OR NOT has_function_privilege(
       'authenticated',
       'team_notes_rls.authorize(text,uuid,text)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'authenticated',
       'team_notes_rls.can_access_realtime_topic(text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'RLS GATEWAY CONTRACT FAILED';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.revoke_team_invite(uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.revoke_team_invite(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'INVITE REVOCATION GRANTS FAILED';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_policy policy
     WHERE COALESCE(
       pg_get_expr(policy.polqual, policy.polrelid),
       ''
     ) LIKE '%private.%'
        OR COALESCE(
          pg_get_expr(policy.polwithcheck, policy.polrelid),
          ''
        ) LIKE '%private.%'
  ) THEN
    RAISE EXCEPTION
      'RLS GATEWAY CONTRACT FAILED: a policy still calls private helpers';
  END IF;

  IF (
    SELECT count(*)
      FROM pg_policy policy
      JOIN pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'realtime'
       AND relation.relname = 'messages'
       AND policy.polname IN (
         'team_notes_collaboration_receive',
         'team_notes_collaboration_send'
       )
       AND policy.polcmd IN ('r', 'a')
       AND policy.polroles @> ARRAY[(
         SELECT oid FROM pg_roles WHERE rolname = 'authenticated'
       )]
  ) <> 2 THEN
    RAISE EXCEPTION 'REALTIME POLICY CONTRACT FAILED';
  END IF;
END
$$;

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000901',
    'hardening-owner@example.test',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000902',
    'hardening-member@example.test',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000903',
    'hardening-outsider@example.test',
    now()
  );

INSERT INTO public.teams (
  id, name, created_by, current_permission_epoch, current_key_epoch
) VALUES (
  '10000000-0000-0000-0000-000000000901',
  'Hardening Team',
  '00000000-0000-0000-0000-000000000901',
  1,
  1
);
INSERT INTO public.team_permission_epochs (
  team_id, epoch, reason_code, changed_by
) VALUES (
  '10000000-0000-0000-0000-000000000901',
  1,
  'team_created',
  '00000000-0000-0000-0000-000000000901'
);
INSERT INTO public.team_key_epochs (team_id, epoch, reason_code, created_by)
VALUES (
  '10000000-0000-0000-0000-000000000901',
  1,
  'team_created',
  '00000000-0000-0000-0000-000000000901'
);
INSERT INTO public.team_memberships (team_id, user_id, role, status)
VALUES
  (
    '10000000-0000-0000-0000-000000000901',
    '00000000-0000-0000-0000-000000000901',
    'owner',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000901',
    '00000000-0000-0000-0000-000000000902',
    'member',
    'active'
  );

INSERT INTO public.spaces (
  id, team_id, kind, name_ciphertext, name_nonce, current_key_epoch,
  created_by, deleted_at, archived_by, retention_expires_at
) VALUES
  (
    '30000000-0000-0000-0000-000000000901',
    '10000000-0000-0000-0000-000000000901',
    'restricted',
    decode('01', 'hex'),
    decode('02', 'hex'),
    1,
    '00000000-0000-0000-0000-000000000901',
    NULL,
    NULL,
    NULL
  ),
  (
    '30000000-0000-0000-0000-000000000902',
    '10000000-0000-0000-0000-000000000901',
    'restricted',
    decode('03', 'hex'),
    decode('04', 'hex'),
    1,
    '00000000-0000-0000-0000-000000000901',
    now(),
    '00000000-0000-0000-0000-000000000901',
    now() + interval '30 days'
  );
INSERT INTO public.space_key_epochs (space_id, epoch, reason, created_by)
VALUES
  (
    '30000000-0000-0000-0000-000000000901',
    1,
    'space_created',
    '00000000-0000-0000-0000-000000000901'
  ),
  (
    '30000000-0000-0000-0000-000000000902',
    1,
    'space_created',
    '00000000-0000-0000-0000-000000000901'
  );
INSERT INTO public.space_member_grants (
  team_id, space_id, user_id, role, granted_by
) VALUES
  (
    '10000000-0000-0000-0000-000000000901',
    '30000000-0000-0000-0000-000000000901',
    '00000000-0000-0000-0000-000000000901',
    'manager',
    '00000000-0000-0000-0000-000000000901'
  ),
  (
    '10000000-0000-0000-0000-000000000901',
    '30000000-0000-0000-0000-000000000901',
    '00000000-0000-0000-0000-000000000902',
    'reader',
    '00000000-0000-0000-0000-000000000901'
  );
INSERT INTO public.notes (
  id, team_id, space_id, created_by, status, schema_version
) VALUES (
  '40000000-0000-0000-0000-000000000901',
  '10000000-0000-0000-0000-000000000901',
  '30000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000901',
  'active',
  1
);

SET CONSTRAINTS ALL IMMEDIATE;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000902',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT team_notes_rls.can_access_realtime_topic(
    'team-space:30000000-0000-0000-0000-000000000901'
  ) OR NOT team_notes_rls.can_access_realtime_topic(
    'team-note:30000000-0000-0000-0000-000000000901:40000000-0000-0000-0000-000000000901'
  ) THEN
    RAISE EXCEPTION 'REALTIME AUTH FAILED: granted reader was denied';
  END IF;

  IF team_notes_rls.can_access_realtime_topic('team-space:not-a-uuid')
     OR team_notes_rls.can_access_realtime_topic(
       'team-note:30000000-0000-0000-0000-000000000901:not-a-uuid'
     )
     OR team_notes_rls.can_access_realtime_topic(
       'team-note:30000000-0000-0000-0000-000000000902:40000000-0000-0000-0000-000000000901'
     )
     OR team_notes_rls.can_access_realtime_topic(
       'team-note:30000000-0000-0000-0000-000000000901:40000000-0000-0000-0000-000000000901:extra'
     ) THEN
    RAISE EXCEPTION 'REALTIME AUTH FAILED: malformed or mismatched topic allowed';
  END IF;

  PERFORM set_config(
    'realtime.topic',
    'team-note:30000000-0000-0000-0000-000000000901:40000000-0000-0000-0000-000000000901',
    true
  );
  INSERT INTO realtime.messages (topic, extension)
  VALUES
    (
      'team-note:30000000-0000-0000-0000-000000000901:40000000-0000-0000-0000-000000000901',
      'broadcast'
    ),
    (
      'team-note:30000000-0000-0000-0000-000000000901:40000000-0000-0000-0000-000000000901',
      'presence'
    );

  PERFORM set_config('realtime.topic', 'team-space:not-a-uuid', true);
  BEGIN
    INSERT INTO realtime.messages (topic, extension)
    VALUES ('team-space:not-a-uuid', 'broadcast');
    RAISE EXCEPTION 'REALTIME AUTH FAILED: malformed policy topic allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;

RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000901',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM public.create_invite(
      '60000000-0000-0000-0000-000000000901',
      '10000000-0000-0000-0000-000000000901',
      'archived-space@example.test',
      extensions.digest('archived-space-token', 'sha256'),
      'member',
      now() + interval '1 day',
      jsonb_build_array(jsonb_build_object(
        'space_id', '30000000-0000-0000-0000-000000000902',
        'role', 'reader'
      ))
    );
    RAISE EXCEPTION 'CREATE INVITE FAILED: archived space was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  PERFORM public.create_invite(
    '60000000-0000-0000-0000-000000000902',
    '10000000-0000-0000-0000-000000000901',
    'revoked-invite@example.test',
    extensions.digest('revoked-invite-token', 'sha256'),
    'member',
    now() + interval '1 day',
    jsonb_build_array(jsonb_build_object(
      'space_id', '30000000-0000-0000-0000-000000000901',
      'role', 'reader'
    ))
  );
END
$$;

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.team_invites
     WHERE id = '60000000-0000-0000-0000-000000000901'
  ) THEN
    RAISE EXCEPTION 'CREATE INVITE FAILED: rejected invite was partially stored';
  END IF;
END
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000902',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM public.revoke_team_invite(
      '60000000-0000-0000-0000-000000000902'
    );
    RAISE EXCEPTION 'INVITE REVOCATION FAILED: non-admin revoked invite';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;

RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000901',
  true
);
SET LOCAL ROLE authenticated;

SELECT public.revoke_team_invite(
  '60000000-0000-0000-0000-000000000902'
);
SELECT public.revoke_team_invite(
  '60000000-0000-0000-0000-000000000902'
);

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.team_invites
     WHERE id = '60000000-0000-0000-0000-000000000902'
       AND revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'INVITE REVOCATION FAILED: invite remains pending';
  END IF;
  IF (
    SELECT count(*)
      FROM public.team_audit_events
     WHERE event_type = 'invite_revoked'
       AND target_type = 'invite'
       AND target_id = '60000000-0000-0000-0000-000000000902'
       AND old_status = 'pending'
       AND new_status = 'revoked'
       AND reason_code = 'invite_revoked'
  ) <> 1 THEN
    RAISE EXCEPTION 'INVITE REVOCATION FAILED: audit event is not idempotent';
  END IF;
END
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000903',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF team_notes_rls.can_access_realtime_topic(
    'team-space:30000000-0000-0000-0000-000000000901'
  ) OR team_notes_rls.can_access_realtime_topic(
    'team-note:30000000-0000-0000-0000-000000000901:40000000-0000-0000-0000-000000000901'
  ) THEN
    RAISE EXCEPTION 'REALTIME AUTH FAILED: outsider was allowed';
  END IF;
END
$$;

RESET ROLE;

UPDATE public.team_memberships
   SET status = 'suspended',
       suspended_at = now(),
       membership_version = membership_version + 1
 WHERE team_id = '10000000-0000-0000-0000-000000000901'
   AND user_id = '00000000-0000-0000-0000-000000000902';

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000902',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF team_notes_rls.can_access_realtime_topic(
    'team-space:30000000-0000-0000-0000-000000000901'
  ) THEN
    RAISE EXCEPTION 'REALTIME AUTH FAILED: suspended member was allowed';
  END IF;
END
$$;

RESET ROLE;

DO $$
BEGIN
  RAISE NOTICE 'TEAM NOTES COLLABORATION HARDENING TESTS PASSED';
END
$$;

ROLLBACK;

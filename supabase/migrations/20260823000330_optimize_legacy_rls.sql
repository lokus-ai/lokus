-- Cache auth.uid() once per statement in legacy RLS policies.

DROP POLICY IF EXISTS "Users access own files" ON public.sync_files;
CREATE POLICY "Users access own files" ON public.sync_files
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own key" ON public.user_encryption_keys;
CREATE POLICY "Users manage own key" ON public.user_encryption_keys
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users access own workspaces" ON public.user_workspaces;
CREATE POLICY "Users access own workspaces" ON public.user_workspaces
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
CREATE POLICY "Users can read own files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'vaults'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS uc_sel ON public.user_credits;
CREATE POLICY uc_sel ON public.user_credits
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS cl_sel ON public.credit_ledger;
CREATE POLICY cl_sel ON public.credit_ledger
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS cr_sel ON public.credit_reservations;
CREATE POLICY cr_sel ON public.credit_reservations
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS cg_sel ON public.credit_grant_log;
CREATE POLICY cg_sel ON public.credit_grant_log
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS wm_sel ON public.workspace_manifests;
CREATE POLICY wm_sel ON public.workspace_manifests
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS wm_ins ON public.workspace_manifests;
CREATE POLICY wm_ins ON public.workspace_manifests
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS wm_upd ON public.workspace_manifests;
CREATE POLICY wm_upd ON public.workspace_manifests
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS wm_del ON public.workspace_manifests;
CREATE POLICY wm_del ON public.workspace_manifests
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS audit_sel ON public.ai_audit_log;
CREATE POLICY audit_sel ON public.ai_audit_log
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS user_tiers_select_own ON public.user_tiers;
CREATE POLICY user_tiers_select_own ON public.user_tiers
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

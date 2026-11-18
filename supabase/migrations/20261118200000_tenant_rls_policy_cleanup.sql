-- Remove legacy permissive policies that could override tenant and role checks.
-- Keep the existing rows and replace only RLS predicates.

DROP POLICY IF EXISTS clients_all_own ON public.clients;
DROP POLICY IF EXISTS companies_all_own ON public.companies;
DROP POLICY IF EXISTS notifications_all_own ON public.notifications;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

ALTER POLICY tenant_ai_logs_company ON public.ai_action_logs
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_calendar_company ON public.calendar_events
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_clients_company ON public.clients
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_companies_read ON public.companies
  USING (id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_companies_update ON public.companies
  USING (
    id = (SELECT public.current_user_company_id())
    AND (SELECT public.current_user_company_role()) = 'admin'
  )
  WITH CHECK (
    id = (SELECT public.current_user_company_id())
    AND (SELECT public.current_user_company_role()) = 'admin'
  );

ALTER POLICY tenant_doc_categories_company ON public.document_categories
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_documents_company ON public.documents
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_finance_company ON public.financial_transactions
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_notifications_user ON public.notifications
  USING (
    company_id = (SELECT public.current_user_company_id())
    AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    company_id = (SELECT public.current_user_company_id())
    AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
  );

ALTER POLICY tenant_profiles_self ON public.profiles
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND company_id = (SELECT public.current_user_company_id())
    AND role = (SELECT public.current_user_company_role())
  );

ALTER POLICY tenant_projects_company ON public.projects
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_tasks_company ON public.tasks
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY tenant_users_company ON public.users
  USING (company_id = (SELECT public.current_user_company_id()))
  WITH CHECK (company_id = (SELECT public.current_user_company_id()));

ALTER POLICY budgets_all_own ON public.budgets
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY budget_items_all_own ON public.budget_items
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets
      WHERE budgets.id = budget_items.budget_id
        AND budgets.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets
      WHERE budgets.id = budget_items.budget_id
        AND budgets.user_id = (SELECT auth.uid())
    )
  );

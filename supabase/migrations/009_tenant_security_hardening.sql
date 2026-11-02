-- Tenant isolation and safe first-company provisioning.
-- Existing records are preserved. Existing profile/company assignments should be reviewed
-- before rollout if earlier users were provisioned into the same default company.

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_company_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_company_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_company_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_company_role() TO authenticated;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_companies" ON public.companies;
DROP POLICY IF EXISTS "tenant_companies_read" ON public.companies;
DROP POLICY IF EXISTS "tenant_companies_update" ON public.companies;
CREATE POLICY "tenant_companies_read" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.current_user_company_id());
CREATE POLICY "tenant_companies_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.current_user_company_id() AND public.current_user_company_role() = 'admin')
  WITH CHECK (id = public.current_user_company_id() AND public.current_user_company_role() = 'admin');

DROP POLICY IF EXISTS "tenant_isolation_profiles" ON public.profiles;
DROP POLICY IF EXISTS "tenant_profiles_self" ON public.profiles;
CREATE POLICY "tenant_profiles_self" ON public.profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_user_company_id()
    AND role = public.current_user_company_role()
  );

DROP POLICY IF EXISTS "tenant_isolation_users" ON public.users;
DROP POLICY IF EXISTS "tenant_users_company" ON public.users;
CREATE POLICY "tenant_users_company" ON public.users
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_doc_categories" ON public.document_categories;
DROP POLICY IF EXISTS "tenant_doc_categories_company" ON public.document_categories;
CREATE POLICY "tenant_doc_categories_company" ON public.document_categories
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_clients" ON public.clients;
DROP POLICY IF EXISTS "tenant_clients_company" ON public.clients;
CREATE POLICY "tenant_clients_company" ON public.clients
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_projects" ON public.projects;
DROP POLICY IF EXISTS "tenant_projects_company" ON public.projects;
CREATE POLICY "tenant_projects_company" ON public.projects
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_tasks" ON public.tasks;
DROP POLICY IF EXISTS "tenant_tasks_company" ON public.tasks;
CREATE POLICY "tenant_tasks_company" ON public.tasks
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_calendar" ON public.calendar_events;
DROP POLICY IF EXISTS "tenant_calendar_company" ON public.calendar_events;
CREATE POLICY "tenant_calendar_company" ON public.calendar_events
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_finance" ON public.financial_transactions;
DROP POLICY IF EXISTS "tenant_finance_company" ON public.financial_transactions;
CREATE POLICY "tenant_finance_company" ON public.financial_transactions
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_docs" ON public.documents;
DROP POLICY IF EXISTS "tenant_documents_company" ON public.documents;
CREATE POLICY "tenant_documents_company" ON public.documents
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_notifications" ON public.notifications;
DROP POLICY IF EXISTS "tenant_notifications_user" ON public.notifications;
CREATE POLICY "tenant_notifications_user" ON public.notifications
  FOR ALL TO authenticated
  USING (
    company_id = public.current_user_company_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    company_id = public.current_user_company_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "tenant_isolation_ai_logs" ON public.ai_action_logs;
DROP POLICY IF EXISTS "tenant_ai_logs_company" ON public.ai_action_logs;
CREATE POLICY "tenant_ai_logs_company" ON public.ai_action_logs
  FOR ALL TO authenticated
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

CREATE OR REPLACE FUNCTION public.validate_tenant_relations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME IN ('projects', 'tasks', 'calendar_events', 'financial_transactions', 'documents')
     AND NEW.client_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.clients c
       WHERE c.id = NEW.client_id AND c.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'The client must belong to the same company.';
  END IF;

  IF TG_TABLE_NAME = 'tasks'
     AND NEW.project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.projects p
       WHERE p.id = NEW.project_id AND p.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'The project must belong to the same company.';
  END IF;

  IF TG_TABLE_NAME = 'tasks'
     AND NEW.assigned_to IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.users u
       WHERE u.id = NEW.assigned_to AND u.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'The task assignee must belong to the same company.';
  END IF;

  IF TG_TABLE_NAME = 'projects'
     AND NEW.lead_user_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.users u
       WHERE u.id = NEW.lead_user_id AND u.company_id = NEW.company_id
     ) THEN
    RAISE EXCEPTION 'The project owner must belong to the same company.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_tenant_project_relations ON public.projects;
CREATE TRIGGER validate_tenant_project_relations
  BEFORE INSERT OR UPDATE OF company_id, client_id, lead_user_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_relations();
DROP TRIGGER IF EXISTS validate_tenant_task_relations ON public.tasks;
CREATE TRIGGER validate_tenant_task_relations
  BEFORE INSERT OR UPDATE OF company_id, client_id, project_id, assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_relations();
DROP TRIGGER IF EXISTS validate_tenant_calendar_relations ON public.calendar_events;
CREATE TRIGGER validate_tenant_calendar_relations
  BEFORE INSERT OR UPDATE OF company_id, client_id ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_relations();
DROP TRIGGER IF EXISTS validate_tenant_finance_relations ON public.financial_transactions;
CREATE TRIGGER validate_tenant_finance_relations
  BEFORE INSERT OR UPDATE OF company_id, client_id ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_relations();
DROP TRIGGER IF EXISTS validate_tenant_document_relations ON public.documents;
CREATE TRIGGER validate_tenant_document_relations
  BEFORE INSERT OR UPDATE OF company_id, client_id ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_relations();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  user_full_name TEXT;
  company_name TEXT;
BEGIN
  user_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'Usuário'
  );
  company_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), 'Minha Empresa');

  INSERT INTO public.companies (name, email, phone, plan)
  VALUES (company_name, NEW.email, NULLIF(NEW.raw_user_meta_data->>'phone', ''), 'starter')
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (
    user_id, company_id, full_name, display_name, email, avatar_url, role, job_title, status
  ) VALUES (
    NEW.id,
    new_company_id,
    user_full_name,
    user_full_name,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'admin',
    'Administrador',
    'ativo'
  );

  INSERT INTO public.users (id, company_id, name, full_name, display_name, email, role, job_title, status)
  VALUES (NEW.id, new_company_id, user_full_name, user_full_name, user_full_name, COALESCE(NEW.email, ''), 'admin', 'Administrador', 'ativo')
  ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "User Avatar Upload" ON storage.objects;
DROP POLICY IF EXISTS "User Avatar Update" ON storage.objects;
DROP POLICY IF EXISTS "User Avatar Delete" ON storage.objects;
CREATE POLICY "User Avatar Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);
CREATE POLICY "User Avatar Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);
CREATE POLICY "User Avatar Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "Tenant Documents View" ON storage.objects;
DROP POLICY IF EXISTS "Tenant Documents Upload" ON storage.objects;
DROP POLICY IF EXISTS "Tenant Documents Update" ON storage.objects;
DROP POLICY IF EXISTS "Tenant Documents Delete" ON storage.objects;
CREATE POLICY "Tenant Documents View" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND split_part(name, '/', 1) = public.current_user_company_id()::text);
CREATE POLICY "Tenant Documents Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND split_part(name, '/', 1) = public.current_user_company_id()::text);
CREATE POLICY "Tenant Documents Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND split_part(name, '/', 1) = public.current_user_company_id()::text)
  WITH CHECK (bucket_id = 'documents' AND split_part(name, '/', 1) = public.current_user_company_id()::text);
CREATE POLICY "Tenant Documents Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND split_part(name, '/', 1) = public.current_user_company_id()::text);

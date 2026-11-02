-- ==============================================================================
-- NEXUS PDS — SCHEMA COMPLETO DO BANCO DE DADOS POSTGRESQL / SUPABASE
-- Execute este arquivo no Supabase SQL Editor para criar todas as tabelas,
-- chaves estrangeiras, índices, políticas RLS, triggers e buckets de storage.
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA DE EMPRESAS (Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(30),
    segment VARCHAR(100),
    plan VARCHAR(50) DEFAULT 'pro' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    website VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE PERFIS DE USUÁRIOS (Sincronizada com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'gerente', 'colaborador')),
    job_title VARCHAR(100) DEFAULT 'Administrador',
    bio TEXT,
    avatar_url TEXT,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'pendente')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_company UNIQUE (user_id, company_id)
);

-- 4. TABELA DE USUÁRIOS DO SISTEMA
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    display_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'gerente', 'colaborador')),
    job_title VARCHAR(100) DEFAULT 'Administrador',
    avatar_url TEXT,
    phone VARCHAR(50),
    bio TEXT,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'pendente')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE CATEGORIAS DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'indigo',
    icon VARCHAR(50) DEFAULT 'Folder',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE CLIENTES (CRM 360°)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    document VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'prospect')),
    total_revenue NUMERIC(14, 2) DEFAULT 0.00,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE PROJETOS
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    lead_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    budget NUMERIC(14, 2) DEFAULT 0.00,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status VARCHAR(50) DEFAULT 'em_andamento' CHECK (status IN ('planejamento', 'em_andamento', 'pausado', 'concluido')),
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA DE TAREFAS
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
    status VARCHAR(50) DEFAULT 'a_fazer' CHECK (status IN ('backlog', 'a_fazer', 'em_andamento', 'concluido')),
    due_date DATE,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABELA DE EVENTOS DA AGENDA / CALENDÁRIO
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'reuniao' CHECK (event_type IN ('reuniao', 'ligacao', 'tarefa', 'compromisso', 'outro')),
    event_date DATE NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20),
    duration_minutes INTEGER DEFAULT 60,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'agendado' CHECK (status IN ('agendado', 'concluido', 'cancelado')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABELA DE TRANSAÇÕES FINANCEIRAS (Receitas e Despesas)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('receita', 'despesa')),
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    payment_method VARCHAR(50) DEFAULT 'pix' CHECK (payment_method IN ('pix', 'boleto', 'cartao', 'transferencia')),
    status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente', 'atrasado')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABELA DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.document_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    file_size VARCHAR(50),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    file_data TEXT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TABELA DE NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'urgent')),
    read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TABELA DE LOGS DE AÇÕES DA IA
CREATE TABLE IF NOT EXISTS public.ai_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID,
    tool_name VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'rejected', 'failed', 'pending_confirmation')),
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_status ON public.tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_company_date ON public.calendar_events(company_id, event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_client ON public.calendar_events(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_company_date ON public.financial_transactions(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_client ON public.financial_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_company ON public.ai_action_logs(company_id, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- ==============================================================================
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

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.users WHERE id = auth.uid()
    LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Políticas de RLS
DROP POLICY IF EXISTS "tenant_isolation_companies" ON public.companies;
CREATE POLICY "tenant_isolation_companies" ON public.companies FOR ALL USING (id = public.current_user_company_id() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tenant_isolation_profiles" ON public.profiles;
CREATE POLICY "tenant_isolation_profiles" ON public.profiles FOR ALL USING (user_id = auth.uid() OR company_id = public.current_user_company_id()) WITH CHECK (user_id = auth.uid() OR company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_users" ON public.users;
CREATE POLICY "tenant_isolation_users" ON public.users FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_doc_categories" ON public.document_categories;
CREATE POLICY "tenant_isolation_doc_categories" ON public.document_categories FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_clients" ON public.clients;
CREATE POLICY "tenant_isolation_clients" ON public.clients FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_projects" ON public.projects;
CREATE POLICY "tenant_isolation_projects" ON public.projects FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_tasks" ON public.tasks;
CREATE POLICY "tenant_isolation_tasks" ON public.tasks FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_calendar" ON public.calendar_events;
CREATE POLICY "tenant_isolation_calendar" ON public.calendar_events FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_finance" ON public.financial_transactions;
CREATE POLICY "tenant_isolation_finance" ON public.financial_transactions FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_docs" ON public.documents;
CREATE POLICY "tenant_isolation_docs" ON public.documents FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_notifications" ON public.notifications;
CREATE POLICY "tenant_isolation_notifications" ON public.notifications FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_ai_logs" ON public.ai_action_logs;
CREATE POLICY "tenant_isolation_ai_logs" ON public.ai_action_logs FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

-- ==============================================================================
-- TRIGGER DE NOVO USUÁRIO (AUTH.USERS -> PROFILES)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_tenant_id UUID;
    user_full_name TEXT;
BEGIN
    SELECT id INTO default_tenant_id FROM public.companies ORDER BY created_at ASC LIMIT 1;
    
    IF default_tenant_id IS NULL THEN
        INSERT INTO public.companies (name, cnpj, segment, plan)
        VALUES ('Minha Empresa', '00.000.000/0001-00', 'Geral', 'pro')
        RETURNING id INTO default_tenant_id;
    END IF;

    user_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );

    INSERT INTO public.profiles (
        user_id,
        company_id,
        full_name,
        display_name,
        email,
        avatar_url,
        role,
        job_title,
        status
    ) VALUES (
        new.id,
        default_tenant_id,
        user_full_name,
        user_full_name,
        new.email,
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        'admin',
        'Administrador',
        'ativo'
    ) ON CONFLICT (user_id, company_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- TRIGGER DE ATUALIZAÇÃO AUTOMÁTICA (UPDATED_AT)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_companies_updated_at ON public.companies;
CREATE TRIGGER set_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_calendar_updated_at ON public.calendar_events;
CREATE TRIGGER set_calendar_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_financial_updated_at ON public.financial_transactions;
CREATE TRIGGER set_financial_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- SUPABASE STORAGE BUCKETS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar Public View" ON storage.objects;
CREATE POLICY "Avatar Public View" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "User Avatar Upload" ON storage.objects;
CREATE POLICY "User Avatar Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Tenant Documents View" ON storage.objects;
CREATE POLICY "Tenant Documents View" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Tenant Documents Upload" ON storage.objects;
CREATE POLICY "Tenant Documents Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- ==============================================================================

-- Tenant security hardening (also available as migration 009).
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

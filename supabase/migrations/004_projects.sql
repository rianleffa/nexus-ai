-- ==============================================================================
-- 004_projects.sql
-- NEXUS PDS - Tabela de Projetos, Orçamentos, Progresso e RLS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    lead_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    description TEXT,
    budget NUMERIC(14, 2) DEFAULT 0.00,
    spent NUMERIC(14, 2) DEFAULT 0.00,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status VARCHAR(50) DEFAULT 'em_andamento' CHECK (status IN ('planejamento', 'em_andamento', 'pausado', 'concluido')),
    priority VARCHAR(50) DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(company_id, status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "tenant_isolation_projects" ON public.projects;
CREATE POLICY "tenant_isolation_projects" ON public.projects FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

-- ==============================================================================
-- 003_clients.sql
-- NEXUS PDS - Tabela de Clientes (CRM 360°), Índices e RLS
-- ==============================================================================

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
    avatar TEXT,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'prospect')),
    total_revenue NUMERIC(14, 2) DEFAULT 0.00,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(company_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "tenant_isolation_clients" ON public.clients;
CREATE POLICY "tenant_isolation_clients" ON public.clients FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

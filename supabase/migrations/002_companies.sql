-- ==============================================================================
-- 002_companies.sql
-- NEXUS PDS - Empresas (Tenants), Foreign Keys e Políticas de Isolamento RLS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    settings JSONB DEFAULT '{}'::jsonb,
    logo_url TEXT,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign Keys ligando profiles e users à tabela companies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_profiles_company') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_company FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_company') THEN
        ALTER TABLE public.users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_user_company') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT unique_user_company UNIQUE (user_id, company_id);
    END IF;
END $$;

-- Função Helper para Identificar o Tenant Atual na Sessão do Usuário
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT company_id FROM public.users WHERE id = auth.uid()
    LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Trigger para Criar Perfil e Empresa Default Automaticamente ao Registrar Novo Usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
    user_full_name TEXT;
    company_name TEXT;
BEGIN
    user_full_name := COALESCE(
        NULLIF(new.raw_user_meta_data->>'full_name', ''),
        NULLIF(new.raw_user_meta_data->>'name', ''),
        split_part(COALESCE(new.email, ''), '@', 1),
        'Usuário'
    );
    company_name := COALESCE(NULLIF(new.raw_user_meta_data->>'company_name', ''), 'Minha Empresa');

    INSERT INTO public.companies (user_id, name, email, phone, plan)
    VALUES (new.id, company_name, COALESCE(new.email, ''), NULLIF(new.raw_user_meta_data->>'phone', ''), 'starter')
    RETURNING id INTO new_tenant_id;

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
        new_tenant_id,
        user_full_name,
        user_full_name,
        new.email,
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        'admin',
        'Administrador',
        'ativo'
    ) ON CONFLICT (user_id, company_id) DO NOTHING;

    INSERT INTO public.users (id, company_id, name, full_name, display_name, email, role, job_title, status)
    VALUES (new.id, new_tenant_id, user_full_name, user_full_name, user_full_name, COALESCE(new.email, ''), 'admin', 'Administrador', 'ativo')
    ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_companies_updated_at ON public.companies;
CREATE TRIGGER set_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Políticas RLS
DROP POLICY IF EXISTS "tenant_isolation_companies" ON public.companies;
CREATE POLICY "tenant_isolation_companies" ON public.companies FOR ALL USING (id = public.current_user_company_id()) WITH CHECK (id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_profiles" ON public.profiles;
CREATE POLICY "tenant_isolation_profiles" ON public.profiles FOR ALL USING (user_id = auth.uid() OR company_id = public.current_user_company_id()) WITH CHECK (user_id = auth.uid() OR company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_users" ON public.users;
CREATE POLICY "tenant_isolation_users" ON public.users FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

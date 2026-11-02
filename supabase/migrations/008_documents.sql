-- ==============================================================================
-- 008_documents.sql
-- NEXUS PDS - Documentos, Categorias, Notificações, Auditoria IA, Storage e Seed
-- ==============================================================================

-- 1. TABELA DE CATEGORIAS DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'indigo',
    icon VARCHAR(50) DEFAULT 'Folder',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.document_categories(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    file_size VARCHAR(50),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    file_data TEXT,
    status VARCHAR(50) DEFAULT 'ativo',
    tags TEXT[],
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE NOTIFICAÇÕES
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

-- 4. TABELA DE AUDITORIA DE AÇÕES DA IA
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

CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_company ON public.ai_action_logs(company_id, created_at DESC);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Políticas RLS
DROP POLICY IF EXISTS "tenant_isolation_doc_categories" ON public.document_categories;
CREATE POLICY "tenant_isolation_doc_categories" ON public.document_categories FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_docs" ON public.documents;
CREATE POLICY "tenant_isolation_docs" ON public.documents FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_notifications" ON public.notifications;
CREATE POLICY "tenant_isolation_notifications" ON public.notifications FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation_ai_logs" ON public.ai_action_logs;
CREATE POLICY "tenant_isolation_ai_logs" ON public.ai_action_logs FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

-- Buckets do Supabase Storage
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

-- Dados fictícios ficam em supabase/seed_demo.sql e nunca são inseridos nesta migração.

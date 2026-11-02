-- ==============================================================================
-- 007_finance.sql
-- NEXUS PDS - Tabela de Transações Financeiras (Receitas, Despesas e Fluxo de Caixa)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('receita', 'despesa')),
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    payment_method VARCHAR(50) DEFAULT 'pix' CHECK (payment_method IN ('pix', 'boleto', 'cartao', 'transferencia')),
    status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente', 'atrasado')),
    notes TEXT,
    invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_company_date ON public.financial_transactions(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_client ON public.financial_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_type_status ON public.financial_transactions(company_id, type, status);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_financial_updated_at ON public.financial_transactions;
CREATE TRIGGER set_financial_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "tenant_isolation_finance" ON public.financial_transactions;
CREATE POLICY "tenant_isolation_finance" ON public.financial_transactions FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

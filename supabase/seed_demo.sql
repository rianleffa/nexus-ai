-- DADOS DE DEMONSTRAÇÃO OPCIONAIS (fictícios). Execute apenas em um ambiente de demonstração.
-- Estes registros não são inseridos automaticamente pelo schema de produção.

-- DADOS INICIAIS (SEED DATA)
-- ==============================================================================
DO $$
DECLARE
    company_uuid UUID;
    client_1_uuid UUID;
    client_2_uuid UUID;
    client_3_uuid UUID;
    client_4_uuid UUID;
    proj_1_uuid UUID;
    proj_2_uuid UUID;
BEGIN
    SELECT id INTO company_uuid FROM public.companies WHERE name = 'Tech Solutions' LIMIT 1;
    
    IF company_uuid IS NULL THEN
        INSERT INTO public.companies (name, cnpj, segment, plan, phone, email, address, website, city, state)
        VALUES ('Tech Solutions', '12.345.678/0001-90', 'Desenvolvimento de Software & Consultoria TI', 'pro', '(11) 3344-5566', 'contato@techsolutions.com.br', 'Av. Paulista, 1500 - Bela Vista', 'https://techsolutions.com.br', 'São Paulo', 'SP')
        RETURNING id INTO company_uuid;
    END IF;

    INSERT INTO public.document_categories (company_id, name, color, icon)
    VALUES
        (company_uuid, 'Notas Fiscais', 'emerald', 'FileSpreadsheet'),
        (company_uuid, 'Contratos', 'indigo', 'FileText'),
        (company_uuid, 'Comprovantes', 'amber', 'CheckCircle'),
        (company_uuid, 'Documentos da Empresa', 'blue', 'Folder'),
        (company_uuid, 'Financeiro', 'rose', 'DollarSign')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.clients (company_id, name, company_name, document, email, phone, address, notes, status, total_revenue)
    VALUES (company_uuid, 'João Silva', 'Silva & Associados Advogados', '234.567.890-12', 'joao.silva@silvaadv.com.br', '(11) 98123-4567', 'Av. Paulista, 1000 - SP', 'Cliente premium.', 'ativo', 14500.00)
    RETURNING id INTO client_1_uuid;

    INSERT INTO public.clients (company_id, name, company_name, document, email, phone, address, notes, status, total_revenue)
    VALUES (company_uuid, 'Empresa Alpha Ltda', 'Alpha Tecnologia e Logística', '19.876.543/0001-21', 'contato@alphatec.com.br', '(11) 3456-7890', 'Rua Funchal, 418 - SP', 'Projeto financeiro ERP.', 'ativo', 28000.00)
    RETURNING id INTO client_2_uuid;

    INSERT INTO public.projects (company_id, client_id, name, description, budget, progress, status, start_date, due_date)
    VALUES (company_uuid, client_1_uuid, 'Site Institucional & Portal do Cliente', 'Desenvolvimento de portal corporativo.', 18500.00, 75, 'em_andamento', '2026-08-01', '2026-09-30')
    RETURNING id INTO proj_1_uuid;

    INSERT INTO public.projects (company_id, client_id, name, description, budget, progress, status, start_date, due_date)
    VALUES (company_uuid, client_2_uuid, 'Sistema Financeiro Integrado ERP', 'Módulo de contas a pagar e receber.', 32000.00, 45, 'em_andamento', '2026-08-15', '2026-10-31')
    RETURNING id INTO proj_2_uuid;

    INSERT INTO public.tasks (company_id, project_id, client_id, title, description, priority, status, due_date, tags)
    VALUES
        (company_uuid, proj_1_uuid, client_1_uuid, 'Enviar proposta comercial atualizada', 'Encaminhar proposta revisada com aditivo.', 'urgente', 'a_fazer', '2026-09-17', ARRAY['Comercial']),
        (company_uuid, proj_1_uuid, client_1_uuid, 'Reunião de alinhamento com cliente', 'Apresentar os mockups da tela de processos.', 'alta', 'em_andamento', '2026-09-18', ARRAY['Reunião']);

    INSERT INTO public.calendar_events (company_id, client_id, title, description, event_type, event_date, start_time, duration_minutes, location, status)
    VALUES
        (company_uuid, client_1_uuid, 'Reunião de Feedback do Portal', 'Apresentação do fluxo.', 'reuniao', '2026-09-18', '10:00', 60, 'Google Meet', 'agendado'),
        (company_uuid, client_2_uuid, 'Alinhamento do Módulo ERP', 'Validação de regras.', 'reuniao', '2026-09-18', '14:00', 90, 'Google Meet', 'agendado');

    INSERT INTO public.financial_transactions (company_id, client_id, type, description, amount, category, due_date, payment_date, payment_method, status)
    VALUES
        (company_uuid, client_1_uuid, 'receita', 'Parcela 1/3 Portal Jurídico', 7200.00, 'Serviços', '2026-09-18', NULL, 'pix', 'pendente'),
        (company_uuid, client_2_uuid, 'receita', 'Mensalidade Suporte e Hospedagem Cloud', 8500.00, 'Vendas', '2026-09-10', '2026-09-09', 'pix', 'pago'),
        (company_uuid, NULL, 'despesa', 'Folha de Pagamento Equipe Dev & Design', 12500.00, 'Salários', '2026-09-05', '2026-09-05', 'transferencia', 'pago');

    INSERT INTO public.documents (company_id, client_id, title, category, file_path, file_size, mime_type)
    VALUES
        (company_uuid, client_1_uuid, 'Contrato_Prestacao_Servicos_SilvaAdv_2026.pdf', 'Contratos', '/documents/contratos/silva_adv_2026.pdf', '2.4 MB', 'application/pdf'),
        (company_uuid, client_2_uuid, 'Proposta_Comercial_ERP_Financeiro_Alpha.pdf', 'Contratos', '/documents/propostas/alpha_erp_v2.pdf', '1.8 MB', 'application/pdf');

END $$;

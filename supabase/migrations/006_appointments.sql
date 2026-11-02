-- ==============================================================================
-- 006_appointments.sql
-- NEXUS PDS - Tabela de Agenda e Compromissos (Calendar Events & Appointments)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'reuniao' CHECK (event_type IN ('reuniao', 'ligacao', 'tarefa', 'compromisso', 'outro')),
    event_date DATE NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20),
    duration_minutes INTEGER DEFAULT 60,
    location VARCHAR(255),
    meet_url VARCHAR(255),
    status VARCHAR(50) DEFAULT 'agendado' CHECK (status IN ('agendado', 'concluido', 'cancelado')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- View de compatibilidade para consultas com nome appointments
CREATE OR REPLACE VIEW public.appointments AS
SELECT * FROM public.calendar_events;

CREATE INDEX IF NOT EXISTS idx_calendar_company_date ON public.calendar_events(company_id, event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_client ON public.calendar_events(client_id);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_calendar_updated_at ON public.calendar_events;
CREATE TRIGGER set_calendar_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "tenant_isolation_calendar" ON public.calendar_events;
CREATE POLICY "tenant_isolation_calendar" ON public.calendar_events FOR ALL USING (company_id = public.current_user_company_id()) WITH CHECK (company_id = public.current_user_company_id());

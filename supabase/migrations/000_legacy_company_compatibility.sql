-- Bridge the existing single-owner schema to the NEXUS company-scoped schema.
-- This migration preserves all legacy columns and rows. The preflight deliberately
-- aborts when an owner cannot be mapped to exactly one company.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL AND to_regclass('public.companies') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.companies GROUP BY user_id HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'Compatibility migration stopped: a user owns multiple companies; map tenants explicitly before continuing.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.user_id = p.user_id)
    ) THEN
      RAISE EXCEPTION 'Compatibility migration stopped: at least one profile has no company owner match.';
    END IF;
    IF to_regclass('public.clients') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.user_id = cl.user_id)
    ) THEN
      RAISE EXCEPTION 'Compatibility migration stopped: at least one client has no company owner match.';
    END IF;
    IF to_regclass('public.notifications') IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.user_id = n.user_id)
    ) THEN
      RAISE EXCEPTION 'Compatibility migration stopped: at least one notification has no company owner match.';
    END IF;
  END IF;
END $$;

-- Existing companies already have one owner each. Keep legacy fields such as
-- document, instagram, PIX configuration, and default_template untouched.
ALTER TABLE IF EXISTS public.companies
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS job_title text NOT NULL DEFAULT 'Administrador',
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS total_revenue numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interaction timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'document') THEN
      UPDATE public.companies SET cnpj = document WHERE cnpj IS NULL AND document IS NOT NULL;
    END IF;
    IF to_regclass('public.profiles') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'paid_subscription') THEN
      EXECUTE $sql$
        UPDATE public.companies c
        SET plan = CASE
          WHEN p.plan::text = 'enterprise' THEN 'enterprise'
          WHEN p.plan::text IN ('pro', 'business') OR p.paid_subscription THEN 'pro'
          ELSE 'starter'
        END
        FROM public.profiles p
        WHERE p.user_id = c.user_id AND c.plan = 'starter'
      $sql$;
    END IF;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL AND to_regclass('public.companies') IS NOT NULL THEN
    UPDATE public.profiles p SET company_id = c.id
    FROM public.companies c WHERE c.user_id = p.user_id AND p.company_id IS NULL;
  END IF;

  IF to_regclass('public.clients') IS NOT NULL AND to_regclass('public.companies') IS NOT NULL THEN
    UPDATE public.clients cl SET company_id = c.id
    FROM public.companies c WHERE c.user_id = cl.user_id AND cl.company_id IS NULL;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL AND to_regclass('public.companies') IS NOT NULL THEN
    UPDATE public.notifications n SET company_id = c.id
    FROM public.companies c WHERE c.user_id = n.user_id AND n.company_id IS NULL;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read') THEN
      EXECUTE 'UPDATE public.notifications SET read = COALESCE(is_read, false) WHERE read = false';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE company_id IS NULL) THEN
      RAISE EXCEPTION 'Compatibility migration stopped: profile tenant assignment is incomplete.';
    END IF;
    ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_company') THEN
      ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_company FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'gerente', 'colaborador'));
    END IF;
  END IF;

  IF to_regclass('public.clients') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.clients WHERE company_id IS NULL) THEN
      RAISE EXCEPTION 'Compatibility migration stopped: client tenant assignment is incomplete.';
    END IF;
    ALTER TABLE public.clients ALTER COLUMN company_id SET NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_company_id_fkey') THEN
      ALTER TABLE public.clients ADD CONSTRAINT clients_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_status_check') THEN
      ALTER TABLE public.clients ADD CONSTRAINT clients_status_check CHECK (status IN ('ativo', 'inativo', 'prospect'));
    END IF;
  END IF;

  IF to_regclass('public.companies') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_plan_check') THEN
      ALTER TABLE public.companies ADD CONSTRAINT companies_plan_check CHECK (plan IN ('starter', 'pro', 'enterprise'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_status_check') THEN
      ALTER TABLE public.companies ADD CONSTRAINT companies_status_check CHECK (status IN ('ativo', 'inativo', 'bloqueado'));
    END IF;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.notifications WHERE company_id IS NULL) THEN
      RAISE EXCEPTION 'Compatibility migration stopped: notification tenant assignment is incomplete.';
    END IF;
    ALTER TABLE public.notifications ALTER COLUMN company_id SET NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_company_id_fkey') THEN
      ALTER TABLE public.notifications ADD CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id)';
  END IF;
  IF to_regclass('public.clients') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id)';
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id, user_id)';
  END IF;
END $$;

BEGIN;

-- Keep all client rows and move the legacy value before adding the new constraint.
DO $$
DECLARE
  check_name TEXT;
BEGIN
  FOR check_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%prospect%'
  LOOP
    EXECUTE format('ALTER TABLE public.clients DROP CONSTRAINT %I', check_name);
  END LOOP;
END $$;

UPDATE public.clients
SET status = 'em_negociacao'
WHERE lower(status) = 'prospect';

ALTER TABLE public.clients
  ALTER COLUMN status SET DEFAULT 'ativo';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check
  CHECK (status IN ('ativo', 'em_negociacao', 'pendente', 'inativo')) NOT VALID;

ALTER TABLE public.clients VALIDATE CONSTRAINT clients_status_check;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(9);

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Company Logos Public View" ON storage.objects;
CREATE POLICY "Company Logos Public View" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Company Logos Tenant Upload" ON storage.objects;
CREATE POLICY "Company Logos Tenant Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.current_user_company_id()::text
  );

DROP POLICY IF EXISTS "Company Logos Tenant Update" ON storage.objects;
CREATE POLICY "Company Logos Tenant Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.current_user_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.current_user_company_id()::text
  );

DROP POLICY IF EXISTS "Company Logos Tenant Delete" ON storage.objects;
CREATE POLICY "Company Logos Tenant Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.current_user_company_id()::text
  );

COMMIT;

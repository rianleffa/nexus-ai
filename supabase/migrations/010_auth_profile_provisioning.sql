-- Create an isolated company and profile for each new Supabase Auth user.
-- Existing users and tenant assignments are intentionally left unchanged.
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
  user_email TEXT;
  avatar_url TEXT;
  user_phone TEXT;
BEGIN
  user_email := COALESCE(NEW.email, '');
  user_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(user_email, '@', 1),
    'Usuário'
  );
  company_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), 'Minha Empresa');
  user_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');
  avatar_url := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    ''
  );

  INSERT INTO public.companies (user_id, name, email, phone, plan)
  VALUES (NEW.id, company_name, user_email, user_phone, 'starter')
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (
    user_id, company_id, full_name, display_name, email, phone, avatar_url, role, job_title, status
  ) VALUES (
    NEW.id, new_company_id, user_full_name, user_full_name, user_email, user_phone, avatar_url,
    'admin', 'Administrador', 'ativo'
  );

  INSERT INTO public.users (
    id, company_id, name, full_name, display_name, email, phone, avatar_url, role, job_title, status
  ) VALUES (
    NEW.id, new_company_id, user_full_name, user_full_name, user_full_name, user_email, user_phone,
    avatar_url, 'admin', 'Administrador', 'ativo'
  )
  ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    avatar_url = EXCLUDED.avatar_url;

  RETURN NEW;
END;
$$;

-- Backfill the NEXUS membership mirror for existing Auth users. No Auth account,
-- profile, company, or application row is deleted or reassigned.
INSERT INTO public.users (id, company_id, name, full_name, display_name, email, phone, avatar_url, role, job_title, status)
SELECT p.user_id, p.company_id,
  COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), p.email),
  COALESCE(NULLIF(p.full_name, ''), p.email),
  COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), p.email),
  p.email, p.phone, p.avatar_url, p.role, p.job_title, p.status
FROM public.profiles p
ON CONFLICT (id) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  name = EXCLUDED.name,
  full_name = EXCLUDED.full_name,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  avatar_url = EXCLUDED.avatar_url,
  role = EXCLUDED.role,
  job_title = EXCLUDED.job_title,
  status = EXCLUDED.status;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

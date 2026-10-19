-- =====================================================
-- Homologación de perfiles · registro manual y Google
-- Ejecuta en Supabase → SQL Editor (idempotente)
-- =====================================================

-- 1. Mismos campos para cualquier método de alta
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- El upsert del cliente necesita permiso total sobre su fila
DROP POLICY IF EXISTS "profile_upsert_own" ON public.customer_profiles;
CREATE POLICY "profile_upsert_own" ON public.customer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- =====================================================
-- 2. Trigger: crea el perfil con los metadatos del proveedor
--    Google envía given_name / family_name / picture
--    El registro manual envía first_name / last_name / phone / birthdate
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta  JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  v_first TEXT;
  v_last  TEXT;
  v_full  TEXT;
BEGIN
  v_first := NULLIF(TRIM(COALESCE(v_meta->>'first_name', v_meta->>'given_name')), '');
  v_last  := NULLIF(TRIM(COALESCE(v_meta->>'last_name', v_meta->>'family_name')), '');

  v_full := NULLIF(TRIM(COALESCE(v_meta->>'full_name', v_meta->>'name', '')), '');

  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_first := split_part(v_full, ' ', 1);
  END IF;

  IF v_last IS NULL AND v_full IS NOT NULL THEN
    v_last := NULLIF(TRIM(substr(v_full, length(split_part(v_full, ' ', 1)) + 1)), '');
  END IF;

  IF v_first IS NULL THEN
    v_first := split_part(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.customer_profiles (
    id, tenant_id, email, first_name, last_name, full_name,
    phone, birthdate, marketing_opt_in, avatar_url, role
  )
  VALUES (
    NEW.id,
    '11111111-1111-1111-1111-111111111111',
    NEW.email,
    v_first,
    v_last,
    COALESCE(NULLIF(TRIM(concat_ws(' ', v_first, v_last)), ''), v_full, split_part(NEW.email, '@', 1)),
    NULLIF(TRIM(COALESCE(v_meta->>'phone', '')), ''),
    NULLIF(TRIM(COALESCE(v_meta->>'birthdate', '')), '')::DATE,
    COALESCE((v_meta->>'marketing_opt_in')::BOOLEAN, FALSE),
    COALESCE(v_meta->>'avatar_url', v_meta->>'picture'),
    -- Rol fijo: el rol de staff solo se asigna desde el SQL Editor
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 3. Rellenar perfiles existentes (incluye los creados con Google)
--    Un usuario entrado por Google tiene provider = 'google'
-- =====================================================
UPDATE public.customer_profiles p
SET
  first_name = COALESCE(
    p.first_name,
    NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'given_name'), ''),
    split_part(COALESCE(p.full_name, u.email, ''), ' ', 1)
  ),
  last_name = COALESCE(
    p.last_name,
    NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'family_name'), ''),
    NULLIF(TRIM(substr(COALESCE(p.full_name, ''), length(split_part(COALESCE(p.full_name, ''), ' ', 1)) + 1)), '')
  ),
  avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  role = COALESCE(p.role, 'customer')
FROM auth.users u
WHERE u.id = p.id;

-- Perfiles huérfanos (usuario en auth.users sin fila en customer_profiles)
INSERT INTO public.customer_profiles (
  id, tenant_id, email, first_name, last_name, full_name, avatar_url, role
)
SELECT
  u.id,
  '11111111-1111-1111-1111-111111111111',
  u.email,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'given_name'), ''),
    split_part(u.email, '@', 1)
  ),
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'family_name'), '')
  ),
  COALESCE(
    NULLIF(TRIM(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), ''),
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  'customer'
FROM auth.users u
LEFT JOIN public.customer_profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Verificación: todos los usuarios deben tener perfil y rol
-- =====================================================
SELECT
  u.email,
  p.first_name,
  p.last_name,
  p.phone,
  p.birthdate,
  p.role,
  (u.raw_user_meta_data->>'iss') IS NOT NULL AS via_google
FROM auth.users u
LEFT JOIN public.customer_profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

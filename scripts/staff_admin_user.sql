-- =====================================================
-- Staff: admin@dinerosobreproblemas.com
--
-- 1. Crea el usuario en Supabase → Authentication → Users → "Add user"
--    (email admin@dinerosobreproblemas.com, contraseña, "Auto Confirm User").
-- 2. Corre este script para darle el rol de staff.
--
-- Idempotente: se puede correr varias veces.
-- =====================================================

-- 1. Allowlist (la usa `is_admin()` para RLS)
INSERT INTO public.staff_allowlist (email, note) VALUES
  ('admin@dinerosobreproblemas.com', 'Administrador principal'),
  ('support@dinerosobreproblemas.com', 'Soporte'),
  ('soporte@dinerosobreproblemas.com', 'Soporte (alias)')
ON CONFLICT (email) DO NOTHING;

-- 2. Perfil con rol admin para el usuario ya creado en Auth
INSERT INTO public.customer_profiles (id, tenant_id, email, full_name, role)
SELECT
  u.id,
  '11111111-1111-1111-1111-111111111111',
  lower(u.email),
  COALESCE(u.raw_user_meta_data ->> 'full_name', 'Admin DSP'),
  'admin'
FROM auth.users u
WHERE lower(u.email) = 'admin@dinerosobreproblemas.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      email = EXCLUDED.email,
      tenant_id = EXCLUDED.tenant_id;

-- 3. Verificación
SELECT u.id, u.email, u.email_confirmed_at IS NOT NULL AS confirmado, p.role
FROM auth.users u
LEFT JOIN public.customer_profiles p ON p.id = u.id
WHERE lower(u.email) = 'admin@dinerosobreproblemas.com';

SELECT email, note FROM public.staff_allowlist ORDER BY email;

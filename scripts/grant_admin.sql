-- =====================================================
-- Dar rol de staff (admin) a un usuario registrado, por correo
--
-- Ejecutar en Supabase → SQL Editor (rol postgres / service).
-- El usuario debe existir antes en auth.users (haberse registrado).
--
-- 1) Cambia el correo de la variable v_email.
-- 2) Ejecuta el bloque DO y luego la verificación.
-- 3) Recarga el sitio: el middleware lee el rol en cada request.
--
-- Es idempotente: si el perfil ya existe, solo actualiza el rol.
-- =====================================================

DO $$
DECLARE
  v_email  TEXT := 'angel@wildforgelabs.com';
  v_tenant UUID := '11111111-1111-1111-1111-111111111111';
  v_user   UUID;
BEGIN
  SELECT id INTO v_user
  FROM auth.users
  WHERE lower(email) = lower(v_email);

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %', v_email;
  END IF;

  INSERT INTO public.customer_profiles (id, tenant_id, email, full_name, role)
  SELECT
    u.id,
    v_tenant,
    u.email,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1)
    ),
    'admin'
  FROM auth.users u
  WHERE u.id = v_user
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        updated_at = now();

  RAISE NOTICE 'Rol admin asignado a %', v_email;
END $$;

-- Verificación: debe salir role = admin
SELECT u.id, u.email, p.role, p.updated_at
FROM auth.users u
LEFT JOIN public.customer_profiles p ON p.id = u.id
WHERE lower(u.email) = lower('angel@wildforgelabs.com');

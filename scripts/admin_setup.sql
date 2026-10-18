-- =====================================================
-- Panel de administración · roles y permisos
-- Ejecuta en Supabase → SQL Editor
-- =====================================================

-- 1. Roles de staff en el perfil
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer'
  CHECK (role IN ('customer', 'admin', 'seller'));

-- 2. Función helper: ¿el usuario actual es admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'seller')
  );
$$;

-- =====================================================
-- 3. Políticas de escritura para admins
-- =====================================================

-- Productos: admin puede crear/editar/borrar
DROP POLICY IF EXISTS "admin_write_products" ON products;
CREATE POLICY "admin_write_products" ON products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Variantes
DROP POLICY IF EXISTS "admin_write_variants" ON product_variants;
CREATE POLICY "admin_write_variants" ON product_variants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Imágenes
DROP POLICY IF EXISTS "admin_write_images" ON product_images;
CREATE POLICY "admin_write_images" ON product_images
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Categorías
DROP POLICY IF EXISTS "admin_write_categories" ON categories;
CREATE POLICY "admin_write_categories" ON categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Pedidos: admin ve y modifica todos
DROP POLICY IF EXISTS "admin_read_orders" ON orders;
CREATE POLICY "admin_read_orders" ON orders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_read_order_items" ON order_items;
CREATE POLICY "admin_read_order_items" ON order_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Clientes
DROP POLICY IF EXISTS "admin_read_customers" ON customers;
CREATE POLICY "admin_read_customers" ON customers
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- =====================================================
-- 4. Storage para imágenes de producto
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "admin_write_product_images" ON storage.objects;
CREATE POLICY "admin_write_product_images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- =====================================================
-- 5. Crear usuario admin inicial: admin@wildgvng.com.mx
--    Password: Pedrito111*
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Buscar si ya existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@wildgvng.com.mx';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@wildgvng.com.mx',
      crypt('Pedrito111*', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin DSP"}',
      NOW(), NOW(), '', '', '', ''
    );

    -- Identidad (necesaria para login por email)
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
    ) VALUES (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@wildgvng.com.mx', 'email_verified', true),
      'email',
      NOW(), NOW(), NOW(),
      gen_random_uuid()
    );
  END IF;

  -- Perfil + rol admin
  INSERT INTO public.customer_profiles (id, tenant_id, email, full_name, role)
  VALUES (v_user_id, '11111111-1111-1111-1111-111111111111', 'admin@wildgvng.com.mx', 'Admin DSP', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
END $$;

-- =====================================================
-- Verificación
-- =====================================================
SELECT u.id, u.email, u.email_confirmed_at IS NOT NULL AS confirmado, p.role
FROM auth.users u
LEFT JOIN public.customer_profiles p ON p.id = u.id
WHERE u.email = 'admin@wildgvng.com.mx';

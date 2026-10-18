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
-- 5. Hazte admin (cambia el email por el tuyo)
-- =====================================================
-- UPDATE customer_profiles SET role = 'admin' WHERE email = 'TU_EMAIL@AQUI.COM';

SELECT id, email, role FROM customer_profiles;

-- =====================================================
-- Seguridad del panel + RLS de pedidos + checkout
-- Ejecuta en Supabase → SQL Editor (idempotente: se puede correr varias veces)
--
-- Corrige:
--   1. Cualquier usuario con role='admin' en su perfil entraba al panel.
--      Ahora además debe estar en la allowlist por correo.
--   2. Las políticas tenant_* permitían operar si el JWT traía un
--      tenant_id, sin comprobar rol.
--   3. Pedidos: lectura solo del dueño (o staff).
--   4. El wishlist perdía el favorito al borrar un producto.
--   5. payments.provider no aceptaba 'simulated'.
-- =====================================================

-- 1. Allowlist de staff ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_allowlist (
  email TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajusta esta lista con los correos reales del equipo.
INSERT INTO public.staff_allowlist (email, note) VALUES
  ('admin@wildgvng.com.mx', 'Administrador principal')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.staff_allowlist ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo se administra desde el SQL Editor / service role.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_profiles p
    JOIN auth.users u ON u.id = p.id
    JOIN public.staff_allowlist a ON lower(a.email) = lower(u.email)
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'seller')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 2. Políticas tenant_* sin rol ---------------------------------------
DROP POLICY IF EXISTS "tenant_products" ON public.products;
DROP POLICY IF EXISTS "tenant_categories" ON public.categories;
DROP POLICY IF EXISTS "tenant_customers" ON public.customers;
DROP POLICY IF EXISTS "tenant_orders" ON public.orders;
DROP POLICY IF EXISTS "tenant_payments" ON public.payments;
DROP POLICY IF EXISTS "tenant_users" ON public.users;
DROP POLICY IF EXISTS "tenant_variants" ON public.product_variants;
DROP POLICY IF EXISTS "tenant_images" ON public.product_images;
DROP POLICY IF EXISTS "tenant_order_items" ON public.order_items;
DROP POLICY IF EXISTS "tenant_order_history" ON public.order_status_history;
DROP POLICY IF EXISTS "tenant_addresses" ON public.addresses;

CREATE POLICY "tenant_products" ON public.products
  FOR ALL TO authenticated
  USING ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_categories" ON public.categories
  FOR ALL TO authenticated
  USING ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_customers" ON public.customers
  FOR ALL TO authenticated
  USING ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_orders" ON public.orders
  FOR ALL TO authenticated
  USING ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_payments" ON public.payments
  FOR ALL TO authenticated
  USING ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_users" ON public.users
  FOR ALL TO authenticated
  USING ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK ((tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_variants" ON public.product_variants
  FOR ALL TO authenticated
  USING (product_id IN (SELECT id FROM public.products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK (product_id IN (SELECT id FROM public.products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_images" ON public.product_images
  FOR ALL TO authenticated
  USING (product_id IN (SELECT id FROM public.products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK (product_id IN (SELECT id FROM public.products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

CREATE POLICY "tenant_order_history" ON public.order_status_history
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin())
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID) AND public.is_admin());

-- 3. Pedidos: solo el dueño (o staff) -------------------------------
-- La creación va por /api/orders con service role, así que el cliente
-- solo necesita leer los pedidos que le pertenecen.
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "orders_select_guest" ON public.orders;
DROP POLICY IF EXISTS "order_items_select_guest" ON public.order_items;

-- 4. Wishlist: no desaparece si se borra el producto -------------------
ALTER TABLE public.wishlist_items
  ALTER COLUMN product_id DROP NOT NULL;

-- La FK original era `ON DELETE CASCADE`, y Postgres la creó con un nombre
-- autogenerado: se suelta cualquier FK sobre product_id (por definición) y se
-- vuelve a crear. Así el script se puede correr las veces que haga falta.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.wishlist_items'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%product_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.wishlist_items DROP CONSTRAINT %I', v_name);
  END LOOP;

  ALTER TABLE public.wishlist_items
    ADD CONSTRAINT wishlist_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
END $$;

-- Todas las filas necesitan identificador lógico para el UNIQUE
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS product_key TEXT;

-- Rellena el valor; el producto borrado conserva la clave del slug
UPDATE public.wishlist_items
SET product_key = coalesce(product_id::text, 'slug:' || coalesce(product_slug, id::text))
WHERE product_key IS NULL;

ALTER TABLE public.wishlist_items
  ALTER COLUMN product_key SET NOT NULL;

-- Trigger: mantiene la clave sincronizada sin columnas generadas
CREATE OR REPLACE FUNCTION public.set_wishlist_product_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.product_key := coalesce(NEW.product_id::text, 'slug:' || coalesce(NEW.product_slug, NEW.id::text));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_wishlist_set_key ON public.wishlist_items;
CREATE TRIGGER on_wishlist_set_key
  BEFORE INSERT OR UPDATE OF product_id, product_slug ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_wishlist_product_key();

-- La UNIQUE original (user_id, product_id) es un CONSTRAINT, no un índice
-- suelto: hay que soltar el constraint o Postgres rechaza DROP INDEX.
ALTER TABLE public.wishlist_items
  DROP CONSTRAINT IF EXISTS wishlist_items_user_id_product_id_key;

-- Restos de intentos anteriores (por si el índice quedó huérfano)
DROP INDEX IF EXISTS public.wishlist_items_user_id_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_user_product_key
  ON public.wishlist_items (user_id, product_key);

-- 5. Pagos simulados ---------------------------------------------------
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('simulated', 'stripe', 'mercadopago', 'conekta'));

-- 6. Índices que usan el panel y la cuenta ------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_created ON public.wishlist_items(user_id, created_at DESC);

-- =====================================================
-- Verificación
-- =====================================================
SELECT 'staff activo' AS dato, count(*)::text AS valor
FROM public.customer_profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.staff_allowlist a ON lower(a.email) = lower(u.email)
WHERE p.role IN ('admin', 'seller')
UNION ALL
SELECT 'allowlist', count(*)::text FROM public.staff_allowlist;

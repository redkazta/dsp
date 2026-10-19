-- =====================================================
-- Pedidos + wishlist + pago simulado
-- Ejecuta en Supabase → SQL Editor (idempotente)
-- =====================================================

-- 1. Campos de contacto y pago simulados en el pedido
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS shipping_street TEXT,
  ADD COLUMN IF NOT EXISTS shipping_colonia TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_references TEXT,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'simulated',
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Estados: agregamos los de producción bajo pedido
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',      -- recibido, pago pendiente
    'confirmed',    -- pago aprobado
    'design',       -- diseño en revisión con el cliente
    'preparing',    -- producción / prensado
    'ready',        -- listo para enviar
    'shipped',      -- en camino
    'delivered',
    'cancelled',
    'returned'
  ));

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.orders ALTER COLUMN payment_status SET DEFAULT 'pending';

-- 2. Foto del producto al momento de comprar
--    (aunque el producto cambie o se borre, el pedido conserva lo vendido)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS variant_name TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- La variante puede faltar en productos hechos a medida
ALTER TABLE public.order_items ALTER COLUMN product_variant_id DROP NOT NULL;

-- 3. Wishlist por usuario
CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_slug TEXT,
    product_name TEXT,
    price NUMERIC(10,2),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON public.wishlist_items(user_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlist_all_own" ON public.wishlist_items;
CREATE POLICY "wishlist_all_own" ON public.wishlist_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. RLS de pedidos
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
CREATE POLICY "order_items_insert_own" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
CREATE POLICY "order_items_select_own" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Historial: el admin escribe, el cliente lee solo el de sus pedidos
DROP POLICY IF EXISTS "order_history_select_own" ON public.order_status_history;
CREATE POLICY "order_history_select_own" ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "order_history_admin_write" ON public.order_status_history;
CREATE POLICY "order_history_admin_write" ON public.order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 5. Folio legible: DSP-000123
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'DSP-' || LPAD(nextval('public.order_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_insert_number ON public.orders;
CREATE TRIGGER on_order_insert_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- 6. Cada cambio de estado queda registrado (seguimiento)
CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, status, notes)
    VALUES (NEW.id, NEW.status, 'Pedido creado');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, status, notes)
    VALUES (NEW.id, NEW.status, 'Cambio de estado');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- =====================================================
-- Verificación
-- =====================================================
SELECT 'orders' AS tabla, count(*) FROM public.orders
UNION ALL
SELECT 'order_items', count(*) FROM public.order_items
UNION ALL
SELECT 'wishlist_items', count(*) FROM public.wishlist_items;

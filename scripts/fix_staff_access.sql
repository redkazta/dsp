-- =====================================================
-- Acceso staff al panel (ERP): pedidos, productos y mensajes
--
-- Ejecutar en Supabase → SQL Editor (rol postgres / service).
-- Es idempotente: se puede volver a correr sin efectos raros.
--
-- Por qué existe:
--   `is_admin()` no solo mira el rol del perfil: exige que el correo esté
--   en `staff_allowlist`. Si el correo no está ahí, el panel abre (el
--   middleware solo mira el rol) pero RLS devuelve 0 filas en `orders`
--   y el ERP se ve vacío.
-- =====================================================

-- 1. Allowlist de staff
CREATE TABLE IF NOT EXISTS public.staff_allowlist (
  email TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff_allowlist ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo se administra desde el SQL Editor / service role.

INSERT INTO public.staff_allowlist (email, note)
VALUES ('angel@wildforgelabs.com', 'Owner')
ON CONFLICT (email) DO NOTHING;

-- 2. Rol de staff en el perfil
UPDATE public.customer_profiles p
SET role = 'admin',
    updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = lower('angel@wildforgelabs.com');

-- 3. is_admin(): rol + allowlist
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

-- 4. Pedidos para staff
--    Las policies `tenant_*` pedían `(auth.jwt() ->> 'tenant_id')::UUID`,
--    un claim que el JWT de Supabase no trae por defecto: siempre daban
--    false. Se reemplazan por la comprobación de rol.
DROP POLICY IF EXISTS "tenant_orders" ON public.orders;
DROP POLICY IF EXISTS "tenant_order_items" ON public.order_items;
DROP POLICY IF EXISTS "tenant_order_history" ON public.order_status_history;

DROP POLICY IF EXISTS "staff_orders_all" ON public.orders;
CREATE POLICY "staff_orders_all" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff_order_items_all" ON public.order_items;
CREATE POLICY "staff_order_items_all" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff_order_history_all" ON public.order_status_history;
CREATE POLICY "staff_order_history_all" ON public.order_status_history
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- El dueño sigue viendo lo suyo (la cuenta del cliente depende de esto).
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- 5. Recargar el esquema en PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- Diagnóstico: esto es lo que debe decir al final
-- =====================================================
SELECT
  u.email,
  p.role,
  EXISTS (
    SELECT 1 FROM public.staff_allowlist a
    WHERE lower(a.email) = lower(u.email)
  ) AS en_allowlist
FROM auth.users u
LEFT JOIN public.customer_profiles p ON p.id = u.id
WHERE lower(u.email) = lower('angel@wildforgelabs.com');

-- Pedidos que debería ver el panel (sin filtro de tenant a propósito)
SELECT count(*) AS pedidos_visibles
FROM public.orders
WHERE is_deleted = false;

-- El pedido del reporte: si `tenant_id` no es el de la tienda, ese era el
-- motivo de que el panel filtrara a 0.
SELECT order_number, tenant_id, user_id, status, payment_status, is_deleted
FROM public.orders
WHERE order_number = 'DSP-001040';

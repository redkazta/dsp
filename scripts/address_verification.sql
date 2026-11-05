-- =====================================================
-- Verificación manual de direcciones (EE. UU.)
--
--   · El checkout guarda la dirección tal cual, sin validación externa.
--   · El operador la revisa en /admin/pedidos y la marca:
--       pending → verified | corrected | invalid
--   · Cada cambio queda en `order_address_audit`.
--
-- Idempotente. Correr en Supabase → SQL Editor.
-- =====================================================

-- 1. Campos de verificación en el pedido --------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_country TEXT NOT NULL DEFAULT 'US';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS address_verification_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS address_verification_notes TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS address_verified_by UUID;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMPTZ;

-- URL del PDF de la guía (bucket `shipping-labels`).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;

-- Constraint del estado (Postgres no tiene ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_address_verification_check
    CHECK (address_verification_status IN ('pending', 'verified', 'corrected', 'invalid'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Auditoría de cambios de dirección --------------------------------
CREATE TABLE IF NOT EXISTS public.order_address_audit (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_address_audit_order
  ON public.order_address_audit (order_id, changed_at DESC);

ALTER TABLE public.order_address_audit ENABLE ROW LEVEL SECURITY;

-- Solo staff lee desde el navegador; las escrituras van con service role.
DROP POLICY IF EXISTS "order_address_audit_staff_read" ON public.order_address_audit;
CREATE POLICY "order_address_audit_staff_read" ON public.order_address_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'seller')
    )
  );

-- 3. Verificación ------------------------------------------------------
SELECT
    address_verification_status,
    count(*) AS pedidos
FROM public.orders
GROUP BY address_verification_status
ORDER BY pedidos DESC;

NOTIFY pgrst, 'reload schema';

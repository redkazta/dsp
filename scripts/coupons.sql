-- =====================================================
-- Cupones y descuentos
--
-- Idempotente: se puede correr varias veces.
-- Ningún cupón queda activo por defecto: la tienda rechaza todo
-- hasta que se cree uno con `is_active = true`.
-- =====================================================

-- 1. Tabla de cupones ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('percent', 'fixed')),
    value NUMERIC(10, 2) NOT NULL CHECK (value > 0),
    min_subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_tenant_code
    ON public.coupons (tenant_id, code);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Solo staff lee; las escrituras van con service role.
DROP POLICY IF EXISTS "coupons_staff_read" ON public.coupons;
CREATE POLICY "coupons_staff_read" ON public.coupons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.customer_profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'seller')
        )
    );

-- 2. Descuento aplicado en el pedido ---------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- 3. Consumo atómico de un cupón -------------------------------------
-- Se llama al confirmar el pago, no al abrir Stripe.
CREATE OR REPLACE FUNCTION public.increment_coupon_use(p_tenant UUID, p_code TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.coupons
       SET used_count = used_count + 1
     WHERE tenant_id = p_tenant
       AND code = p_code;
$$;

NOTIFY pgrst, 'reload schema';

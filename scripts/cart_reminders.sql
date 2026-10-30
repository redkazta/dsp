-- =====================================================
-- Recordatorios de carrito / checkout abandonado
--
-- Idempotente. Cada fila es un correo pendiente; `sent_at` y
-- `canceled_at` lo cierran. El pago aprobado cancela el aviso.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cart_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'es',
    send_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cart_reminders_due
    ON public.cart_reminders (send_at)
    WHERE sent_at IS NULL AND canceled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cart_reminders_order
    ON public.cart_reminders (order_id);

ALTER TABLE public.cart_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_reminders_staff_read" ON public.cart_reminders;
CREATE POLICY "cart_reminders_staff_read" ON public.cart_reminders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.customer_profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'seller')
        )
    );

NOTIFY pgrst, 'reload schema';

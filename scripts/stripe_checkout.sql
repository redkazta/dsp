-- =====================================================
-- Pagos reales con Stripe
-- Ejecuta en Supabase → SQL Editor (idempotente)
--
-- 1. Referencia del pago (PaymentIntent) en el pedido.
-- 2. `payments` acepta 'stripe' aunque la tabla se creó solo con
--    ('stripe','mercadopago','conekta'): no hace falta tocar el CHECK.
-- 3. Índice para que el webhook resuelva idempotencias por PaymentIntent.
-- =====================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN public.orders.payment_reference IS
  'Id del pago en el proveedor (p. ej. pi_… de Stripe)';

CREATE INDEX IF NOT EXISTS idx_payments_provider_tx
  ON public.payments (provider_transaction_id);

-- Verificación: pedidos con pago aprobado y su referencia
SELECT
  'órdenes pagadas por Stripe' AS dato,
  count(*)::text AS valor
FROM public.orders
WHERE payment_method = 'stripe' AND payment_status = 'approved';

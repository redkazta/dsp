-- ============================================================
-- Idempotencia del webhook de Stripe
-- ------------------------------------------------------------
-- Stripe reintenta un evento si no recibe 2xx (o si tarda). Sin control,
-- eso duplica correos y vuelve a aplicar el pago. Esta tabla reserva cada
-- `event.id` antes de procesarlo:
--
--   * el INSERT funciona como candado (PK = event_id)
--   * al terminar se sella `processed_at`
--   * si el proceso muere a medias, queda sin `processed_at` y el
--     reintento lo reprocesa (aplicar el pago es idempotente)
--
-- Solo la usa el service role. Sin policies = invisible para anon/authenticated.
--
-- Ejecutar UNA vez en el SQL Editor. Es idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id     TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error        TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_received
  ON public.stripe_webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_events_order
  ON public.stripe_webhook_events (order_id);

CREATE INDEX IF NOT EXISTS idx_stripe_events_pending
  ON public.stripe_webhook_events (received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Refresca la caché de esquema de PostgREST (evita PGRST205 justo después
-- de crear la tabla).
NOTIFY pgrst, 'reload schema';

-- Verificación.
SELECT count(*) AS eventos FROM public.stripe_webhook_events;

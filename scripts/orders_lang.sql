-- =====================================================
-- Idioma del pedido
--
--   · `orders.lang` ('es' | 'en') guarda el idioma con el que se compró.
--   · Los correos de cambio de estado salen en ese idioma en vez de salir
--     siempre en español.
--
-- Idempotente. Los pedidos viejos quedan en 'es' (eran la mayoría).
-- Después de correrlo: NOTIFY para que PostgREST vea la columna nueva.
-- =====================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'es';

-- Constraint (Postgres no tiene ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_lang_check CHECK (lang IN ('es', 'en'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


SELECT lang, count(*)
FROM public.orders
GROUP BY lang
ORDER BY lang;

NOTIFY pgrst, 'reload schema';

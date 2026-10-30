-- ============================================================
-- Checkout como invitado
-- ------------------------------------------------------------
-- Un pedido sin cuenta se guarda con `user_id = NULL`. Si la tabla se creó
-- con `user_id UUID NOT NULL`, el INSERT falla con 23502 y el checkout
-- responde 500. Este script lo deja opcional.
--
-- `orders.customer_id` es otra FK heredada del esquema viejo: no la escribe
-- el storefront, así que también debe aceptar NULL. Se ajusta si acaso.
--
-- Ejecutar UNA vez en el SQL Editor. Es idempotente.
-- ============================================================

ALTER TABLE public.orders
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'customer_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verificación: ambas deben decir YES.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('user_id', 'customer_id')
ORDER BY column_name;

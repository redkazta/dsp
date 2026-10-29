-- ============================================================
-- order_items: columnas que el checkout escribe
-- ------------------------------------------------------------
-- La tabla se creó con lo mínimo (order_id, variant, cantidad, precio).
-- El detalle del pedido guarda además el nombre, la talla, el color y la
-- foto del momento de la compra. Sin estas columnas Supabase responde
-- PGRST204 y /api/checkout devuelve 500.
--
-- Ejecutar UNA vez en el SQL Editor. Es idempotente.
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS variant_name TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- El código nuevo deja de usar `is_deleted`/`deleted_at` aquí, pero si la
-- tabla los tenía, se respetan. No se borra nada.

-- Refresca la caché de esquema de la API REST (evita seguir viendo PGRST204
-- aunque la columna ya exista).
NOTIFY pgrst, 'reload schema';

-- Verificación: deben aparecer las 7 columnas.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_items'
ORDER BY ordinal_position;

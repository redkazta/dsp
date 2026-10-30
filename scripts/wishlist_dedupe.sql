-- ============================================================
-- Favoritos: quitar duplicados y garantizar unicidad
-- ------------------------------------------------------------
-- Si `wishlist_items` se creó antes de existir el UNIQUE, puede haber
-- varias filas para el mismo (user_id, product_id). Visualmente se ven
-- como tarjetas repetidas y una baja parece borrar "de más".
--
-- Ejecutar UNA vez en el SQL Editor. Es idempotente.
-- ============================================================

-- 1) Conserva la fila más antigua de cada par y borra el resto.
DELETE FROM public.wishlist_items a
USING public.wishlist_items b
WHERE a.user_id = b.user_id
  AND a.product_id = b.product_id
  AND a.ctid < b.ctid;

-- 2) Asegura el UNIQUE (no falla si ya existe con otro nombre).
DO $$
DECLARE
  has_unique BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    WHERE c.oid = 'public.wishlist_items'::regclass
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM unnest(i.indkey) AS k
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k
      ) = ARRAY['product_id', 'user_id']::text[]
  ) INTO has_unique;

  IF NOT has_unique THEN
    ALTER TABLE public.wishlist_items
      ADD CONSTRAINT wishlist_items_user_product_key UNIQUE (user_id, product_id);
  END IF;
END $$;

-- 3) Verificación: cuántos pares quedan repetidos (debe ser 0).
SELECT user_id, product_id, count(*) AS filas
FROM public.wishlist_items
GROUP BY user_id, product_id
HAVING count(*) > 1;

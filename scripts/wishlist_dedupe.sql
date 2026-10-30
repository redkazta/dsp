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

-- 2) Asegura el UNIQUE (no falla si ya existe, ni con otro nombre ni con
--    el mismo nombre ya ocupado):
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.wishlist_items'::regclass
      AND conname = 'wishlist_items_user_product_key'
  ) THEN
    BEGIN
      ALTER TABLE public.wishlist_items
        ADD CONSTRAINT wishlist_items_user_product_key UNIQUE (user_id, product_id);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;

-- 3) Verificación: cuántos pares quedan repetidos (debe ser 0).
SELECT user_id, product_id, count(*) AS filas
FROM public.wishlist_items
GROUP BY user_id, product_id
HAVING count(*) > 1;
